/**
 * Core Database Functions - Balance, Daily, Cooldown, Disclaimer, Selfban
 *
 * Uses DUAL_WRITE pattern: writes go to both KV and D1 for consistency
 */

import { MAX_BALANCE, DAILY_TTL_SECONDS, STARTING_BALANCE, COOLDOWN_TTL_SECONDS, KV_TRUE, KV_ACCEPTED } from '../constants.js';
import { logError, logWarn, kvKey } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, updateBalance as updateBalanceD1, upsertUser, upsertItem, atomicDeductBalance as atomicDeductBalanceD1, atomicAdjustBalance as atomicAdjustBalanceD1 } from './d1.js';
import type { Env, CustomMessages } from '../types/index.js';

export interface SelfBanData {
  timestamp: number;
  date: string;
}

// Balance Functions
export async function getBalance(username: string, env: Env): Promise<number> {
  try {
    const key = kvKey('user:', username);
    const value = await env.SLOTS_KV.get(key);
    if (value === null) {
      // New user: Only grant starting balance if disclaimer accepted
      // Legacy users already have balance in KV, so they bypass this check
      const disclaimerKey = kvKey('disclaimer:', username);
      const hasDisclaimer = await env.SLOTS_KV.get(disclaimerKey);
      if (hasDisclaimer === KV_ACCEPTED) {
        await setBalance(username, STARTING_BALANCE, env);
        return STARTING_BALANCE;
      }
      // No disclaimer, no balance - return 0 (user must accept first)
      return 0;
    }
    const balance = parseInt(value, 10);
    return isNaN(balance) ? 0 : Math.min(balance, MAX_BALANCE);
  } catch (error) {
    logError('getBalance', error, { username });
    return 0;
  }
}

export async function setBalance(username: string, balance: number, env: Env): Promise<void> {
  try {
    const safeBalance = Math.max(0, Math.min(balance, MAX_BALANCE));

    // Write to KV (primary)
    await env.SLOTS_KV.put(kvKey('user:', username), safeBalance.toString());

    // DUAL_WRITE: Fire-and-forget D1 write (not on critical path)
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      updateBalanceD1(username, safeBalance, env).catch(err => logError('setBalance.d1', err, { username }));
    }
  } catch (error) {
    logError('setBalance', error, { username, balance });
  }
}

/**
 * Adjust balance by delta (read → compute → write).
 * Returns the new balance.
 *
 * KNOWN LIMITATION: KV doesn't support atomic compare-and-swap, so there's a
 * TOCTOU window between the GET and PUT. In practice this is mitigated by:
 *   - Spin cooldowns prevent concurrent operations per user
 *   - Duel acceptance uses its own claim-lock pattern
 *   - Transfer commands are serialized through Twitch chat
 * When D1 becomes the primary data store, use SQL `UPDATE ... SET balance = balance + ?`
 * for true atomicity.
 */
export async function adjustBalance(username: string, delta: number, env: Env): Promise<number> {
  try {
    const key = kvKey('user:', username);
    const value = await env.SLOTS_KV.get(key);
    const current = value !== null ? (parseInt(value, 10) || 0) : 0;
    const newBalance = Math.max(0, Math.min(current + delta, MAX_BALANCE));
    await env.SLOTS_KV.put(key, newBalance.toString());

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      updateBalanceD1(username, newBalance, env).catch(err => logError('adjustBalance.d1', err, { username }));
    }

    return newBalance;
  } catch (error) {
    logError('adjustBalance', error, { username, delta });
    return 0;
  }
}

/**
 * Atomically deduct balance. D1-first with KV sync, falls back to KV-only.
 *
 * Uses SQL WHERE balance >= amount for race-condition-free deduction.
 * Returns { success, newBalance } — success=false if insufficient balance.
 * On D1 unavailable, falls back to KV read-modify-write (TOCTOU-prone but functional).
 */
export async function deductBalance(username: string, amount: number, env: Env): Promise<{ success: boolean; newBalance: number }> {
  // Try D1 atomic first
  if (D1_ENABLED && env.DB) {
    const result = await atomicDeductBalanceD1(username, amount, env);
    if (result.error !== 'd1_unavailable' && result.error !== 'user_not_found') {
      // D1 responded authoritatively — sync KV with D1 balance
      await env.SLOTS_KV.put(kvKey('user:', username), result.newBalance.toString());
      return { success: result.success, newBalance: result.newBalance };
    }
    // D1 unavailable or user not in D1 — fall through to KV
  }

  // KV fallback (TOCTOU-prone, but D1 is unavailable)
  logWarn('deductBalance', 'D1 unavailable, using TOCTOU-prone KV fallback', { username, amount });
  const current = await getBalance(username, env);
  if (current < amount) {
    return { success: false, newBalance: current };
  }
  const newBalance = Math.max(0, current - amount);
  await env.SLOTS_KV.put(kvKey('user:', username), newBalance.toString());
  return { success: true, newBalance };
}

/**
 * Atomically credit (add to) balance. D1-first with KV sync, falls back to KV-only.
 *
 * Uses SQL UPDATE SET balance = MIN(balance + delta, MAX_BALANCE) for atomic addition.
 * Returns the new balance after credit.
 * On D1 unavailable, falls back to KV read-modify-write.
 */
export async function creditBalance(username: string, amount: number, env: Env): Promise<number> {
  // Try D1 atomic first
  if (D1_ENABLED && env.DB) {
    const result = await atomicAdjustBalanceD1(username, amount, MAX_BALANCE, env);
    if (result.success) {
      // Sync KV with authoritative D1 balance
      await env.SLOTS_KV.put(kvKey('user:', username), result.newBalance.toString());
      return result.newBalance;
    }
    if (result.error !== 'd1_unavailable' && result.error !== 'user_not_found') {
      // Unknown error — fall through to KV
    }
  }

  // KV fallback (TOCTOU-prone)
  logWarn('creditBalance', 'D1 unavailable, KV fallback', { username, amount });
  const current = await getBalance(username, env);
  const newBalance = Math.min(current + amount, MAX_BALANCE);
  await setBalance(username, newBalance, env);
  return newBalance;
}

// Daily Functions
export async function getLastDaily(username: string, env: Env): Promise<number | null> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('daily:', username));
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    logError('getLastDaily', error, { username });
    return null;
  }
}

export async function setLastDaily(username: string, timestamp: number, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.put(kvKey('daily:', username), timestamp.toString(), { expirationTtl: DAILY_TTL_SECONDS });

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertItem(username, 'lastDaily', timestamp.toString(), env).catch(err => logError('setLastDaily.d1', err, { username }));
    }
  } catch (error) {
    logError('setLastDaily', error, { username });
  }
}

// Cooldown System
export async function getLastSpin(username: string, env: Env): Promise<number | null> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('cooldown:', username));
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    logError('getLastSpin', error, { username });
    return null;
  }
}

export async function setLastSpin(username: string, timestamp: number, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.put(kvKey('cooldown:', username), timestamp.toString(), { expirationTtl: COOLDOWN_TTL_SECONDS });
  } catch (error) {
    logError('setLastSpin', error, { username });
  }
}

// First-Time User System
export async function hasAcceptedDisclaimer(username: string, env: Env): Promise<boolean> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('disclaimer:', username));
    return value === KV_ACCEPTED;
  } catch (error) {
    logError('hasAcceptedDisclaimer', error, { username });
    return false;
  }
}

export async function setDisclaimerAccepted(username: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.put(kvKey('disclaimer:', username), KV_ACCEPTED);

    // Grant starting balance for new users (if they don't have one yet)
    const existingBalance = await env.SLOTS_KV.get(kvKey('user:', username));
    if (existingBalance === null) {
      await setBalance(username, STARTING_BALANCE, env);
    }

    // Invalidate web leaderboard cache
    env.SLOTS_KV.delete('cache:web_leaderboard').catch(() => {});

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { disclaimer_accepted: true }, env).catch(err => logError('setDisclaimerAccepted.d1', err, { username }));
    }
  } catch (error) {
    logError('setDisclaimerAccepted', error, { username });
  }
}

// Selfban System
export async function isSelfBanned(username: string, env: Env): Promise<SelfBanData | null> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('selfban:', username));
    if (!value) return null;
    return JSON.parse(value) as SelfBanData; // Returns { timestamp, date }
  } catch (error) {
    logError('isSelfBanned', error, { username });
    return null;
  }
}

export async function setSelfBan(username: string, env: Env): Promise<void> {
  try {
    const now = Date.now();
    const date = new Date(now).toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const banData: SelfBanData = {
      timestamp: now,
      date: date
    };

    await env.SLOTS_KV.put(kvKey('selfban:', username), JSON.stringify(banData));

    // Invalidate web leaderboard cache
    env.SLOTS_KV.delete('cache:web_leaderboard').catch(() => {});

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { selfban_timestamp: now }, env).catch(err => logError('setSelfBan.d1', err, { username }));
    }
  } catch (error) {
    logError('setSelfBan', error, { username });
  }
}

export async function removeSelfBan(username: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.delete(kvKey('selfban:', username));

    // Invalidate web leaderboard cache
    env.SLOTS_KV.delete('cache:web_leaderboard').catch(() => {});

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { selfban_timestamp: null }, env).catch(err => logError('removeSelfBan.d1', err, { username }));
    }
  } catch (error) {
    logError('removeSelfBan', error, { username });
  }
}

// Blacklist
export async function isBlacklisted(username: string, env: Env): Promise<boolean> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('blacklist:', username));
    return value === KV_TRUE;
  } catch (error) {
    logError('isBlacklisted', error, { username });
    return false;
  }
}

// Last Active tracking
export async function getLastActive(username: string, env: Env): Promise<number | null> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('lastActive:', username));
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    logError('getLastActive', error, { username });
    return null;
  }
}

export async function setLastActive(username: string, env: Env): Promise<void> {
  try {
    const now = Date.now();
    await env.SLOTS_KV.put(kvKey('lastActive:', username), now.toString());

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { last_active_at: now }, env).catch(err => logError('setLastActive.d1', err, { username }));
    }
  } catch (error) {
    logError('setLastActive', error, { username });
  }
}

// Leaderboard Visibility
export async function isLeaderboardHidden(username: string, env: Env): Promise<boolean> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('leaderboard_hidden:', username));
    return value === KV_TRUE;
  } catch (error) {
    logError('isLeaderboardHidden', error, { username });
    return false;
  }
}

export async function setLeaderboardHidden(username: string, hidden: boolean, env: Env): Promise<boolean> {
  try {
    const key = kvKey('leaderboard_hidden:', username);
    if (hidden) {
      await env.SLOTS_KV.put(key, KV_TRUE);
    } else {
      await env.SLOTS_KV.delete(key);
    }

    // Invalidate web leaderboard cache
    env.SLOTS_KV.delete('cache:web_leaderboard').catch(() => {});

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { leaderboard_hidden: hidden }, env).catch(err => logError('setLeaderboardHidden.d1', err, { username }));
    }

    return true;
  } catch (error) {
    logError('setLeaderboardHidden', error, { username, hidden });
    return false;
  }
}

// Custom Messages
export async function getCustomMessages(username: string, env: Env): Promise<CustomMessages | null> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('custom_messages:', username));
    if (!value) return null;
    return JSON.parse(value) as CustomMessages;
  } catch (error) {
    logError('getCustomMessages', error, { username });
    return null;
  }
}

export async function setCustomMessages(username: string, messages: CustomMessages, env: Env): Promise<boolean> {
  try {
    await env.SLOTS_KV.put(kvKey('custom_messages:', username), JSON.stringify(messages));
    return true;
  } catch (error) {
    logError('setCustomMessages', error, { username });
    return false;
  }
}
