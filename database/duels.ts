/**
 * Duel System - KV operations for duels
 *
 * ARCHITECTURE NOTES (for future coding sessions):
 * ================================================
 * KV KEYS:
 * - duel:{challenger} - Active challenge from this user
 *   Value: JSON { target, amount, createdAt }
 * - duel_target:{target} - Reverse lookup: who challenged this user
 *   Value: challenger username (for strongly-consistent lookups)
 * - duel_optout:{username} - User has opted out of duels
 *   Value: 'true'
 *
 * FLOW:
 * 1. !duel @target amount - Creates challenge (stored under challenger)
 * 2. !duelaccept - Target accepts, both spin, winner gets pot
 * 3. !dueldecline - Target declines, challenge deleted
 * 4. Timeout after DUEL_TIMEOUT_SECONDS auto-deletes challenge
 *
 * RACE CONDITION PREVENTION:
 * - acceptDuel uses delete + verify pattern
 * - Only one active challenge per challenger
 */

import { DUEL_TIMEOUT_SECONDS, DUEL_COOLDOWN_SECONDS, KV_TRUE } from '../constants.js';
import { logError, kvKey } from '../utils.js';
import { D1_ENABLED } from './d1.js';
import { sendChatMessage } from '../web/twitch.js';
import { scheduleDuelAlarm, cancelDuelAlarm } from './duel-alarm.js';
import type { Env, DuelChallenge } from '../types/index.js';

// ============================================
// Types
// ============================================

export interface DuelData {
  target: string;
  amount: number;
  createdAt: number;
}

export interface DuelLogData {
  challenger: string;
  target: string;
  amount: number;
  challengerGrid: string[];
  targetGrid: string[];
  challengerScore: number;
  targetScore: number;
  winner: string | null;
  pot: number;
}

export interface DuelHistoryEntry {
  id: number;
  challenger: string;
  target: string;
  amount: number;
  challengerGrid: string[];
  targetGrid: string[];
  challengerScore: number;
  targetScore: number;
  winner: string | null;
  pot: number;
  createdAt: number;
}

export type AcceptDuelResult =
  | { success: true; duel: DuelChallenge }
  | { success: false; reason: 'not_found' | 'expired' | 'already_claimed' | 'race_condition' | 'error'; debugInfo?: string };

// ============================================
// Duel Challenge Operations
// ============================================

/**
 * Create a new duel challenge
 */
export async function createDuel(challenger: string, target: string, amount: number, env: Env): Promise<boolean> {
  try {
    const key = kvKey('duel:', challenger);
    const lowerTarget = target.toLowerCase();
    const data: DuelData = {
      target: lowerTarget,
      amount,
      createdAt: Date.now()
    };
    await Promise.all([
      env.SLOTS_KV.put(key, JSON.stringify(data), {
        expirationTtl: DUEL_TIMEOUT_SECONDS + 10
      }),
      // Reverse lookup for strongly-consistent target queries (KV.list is eventually consistent)
      env.SLOTS_KV.put(kvKey('duel_target:', lowerTarget), challenger.toLowerCase(), {
        expirationTtl: DUEL_TIMEOUT_SECONDS + 10
      }),
      // Notify key for cron-based timeout notification (fallback)
      env.SLOTS_KV.put(kvKey('duel_notify:', challenger.toLowerCase()), JSON.stringify({
        target: lowerTarget,
        amount,
        notifyAfter: Date.now() + (DUEL_TIMEOUT_SECONDS + 2) * 1000
      }), {
        expirationTtl: DUEL_TIMEOUT_SECONDS + 120
      }),
      // Durable Object alarm for precise timeout notification
      scheduleDuelAlarm(challenger, lowerTarget, amount, env)
    ]);
    return true;
  } catch (error) {
    logError('createDuel', error, { challenger, target, amount });
    return false;
  }
}

/**
 * Get active duel challenge from a specific challenger
 */
export async function getDuel(challenger: string, env: Env): Promise<DuelChallenge | null> {
  try {
    const key = kvKey('duel:', challenger);
    const value = await env.SLOTS_KV.get(key);
    if (!value) return null;

    const data: DuelData = JSON.parse(value);

    // Check if expired
    if (Date.now() > data.createdAt + (DUEL_TIMEOUT_SECONDS * 1000)) {
      await Promise.all([
        env.SLOTS_KV.delete(key),
        env.SLOTS_KV.delete(kvKey('duel_target:', data.target))
      ]);
      return null;
    }

    return { challenger: challenger.toLowerCase(), ...data };
  } catch (error) {
    logError('getDuel', error, { challenger });
    return null;
  }
}

/**
 * Find pending duel where user is the target
 */
export async function findDuelForTarget(target: string, env: Env): Promise<DuelChallenge | null> {
  try {
    const lowerTarget = target.toLowerCase();

    // Fast path: use reverse lookup key (strongly consistent, unlike KV.list)
    const reverseKey = kvKey('duel_target:', lowerTarget);
    const challenger = await env.SLOTS_KV.get(reverseKey);
    if (challenger) {
      const duel = await getDuel(challenger, env);
      if (duel && duel.target === lowerTarget) {
        return duel;
      }
      // Reverse lookup was stale - clean it up
      await env.SLOTS_KV.delete(reverseKey);
    }

    // Fallback: scan all duel keys (eventually consistent, may miss recent entries)
    const list = await env.SLOTS_KV.list({ prefix: 'duel:' });

    for (const key of list.keys) {
      // Skip claim keys and reverse lookup keys
      if (key.name.includes(':claim:') || key.name.startsWith('duel_target:')) continue;

      const value = await env.SLOTS_KV.get(key.name);
      if (!value) continue;

      try {
        const data: DuelData = JSON.parse(value);

        // Validate data structure
        if (typeof data.target !== 'string' || typeof data.amount !== 'number' || typeof data.createdAt !== 'number') {
          continue;
        }

        // Check if this duel targets the user and isn't expired
        if (data.target === lowerTarget &&
            Date.now() <= data.createdAt + (DUEL_TIMEOUT_SECONDS * 1000)) {
          const challengerName = key.name.replace('duel:', '');
          return { challenger: challengerName, ...data };
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    logError('findDuelForTarget', error, { target });
    return null;
  }
}

/**
 * Delete a duel challenge (accept/decline/timeout)
 */
export async function deleteDuel(challenger: string, env: Env): Promise<boolean> {
  try {
    const key = kvKey('duel:', challenger);
    // Read duel first to get target for reverse lookup cleanup
    const value = await env.SLOTS_KV.get(key);
    const deletePromises: Promise<unknown>[] = [
      env.SLOTS_KV.delete(key),
      env.SLOTS_KV.delete(kvKey('duel_notify:', challenger.toLowerCase())),
      // Cancel Durable Object alarm
      cancelDuelAlarm(challenger, env)
    ];
    if (value) {
      try {
        const data: DuelData = JSON.parse(value);
        if (data.target) {
          deletePromises.push(env.SLOTS_KV.delete(kvKey('duel_target:', data.target)));
        }
      } catch { /* ignore parse errors */ }
    }
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    logError('deleteDuel', error, { challenger });
    return false;
  }
}

/**
 * Accept a duel - claim-lock + delete + verify to prevent race conditions
 * Returns detailed result with failure reason
 */
export async function acceptDuel(challenger: string, env: Env): Promise<AcceptDuelResult> {
  try {
    // Validate input
    if (!challenger || typeof challenger !== 'string') {
      logError('acceptDuel', new Error('Invalid challenger'), { challenger });
      return { success: false, reason: 'error', debugInfo: 'invalid_challenger' };
    }

    const key = kvKey('duel:', challenger);

    // First read the duel to get createdAt for unique claim key
    const value = await env.SLOTS_KV.get(key);
    if (!value) return { success: false, reason: 'not_found' };

    // Parse and validate duel data
    let data: DuelData;
    try {
      data = JSON.parse(value);
      if (typeof data.target !== 'string' || typeof data.amount !== 'number' || typeof data.createdAt !== 'number') {
        logError('acceptDuel', new Error('Invalid duel data structure'), { challenger, data });
        return { success: false, reason: 'error', debugInfo: `invalid_data:t=${typeof data.target},a=${typeof data.amount},c=${typeof data.createdAt}` };
      }
    } catch (parseError) {
      logError('acceptDuel', parseError, { challenger, dataLength: value.length });
      return { success: false, reason: 'error', debugInfo: `parse_error:len=${value.length}` };
    }

    // Check if expired
    if (Date.now() > data.createdAt + (DUEL_TIMEOUT_SECONDS * 1000)) {
      await Promise.all([
        env.SLOTS_KV.delete(key),
        env.SLOTS_KV.delete(kvKey('duel_target:', data.target))
      ]);
      return { success: false, reason: 'expired' };
    }

    // Unique claim key per duel (prevents stale claim locks from previous duels)
    const claimKey = `${key}:claim:${data.createdAt}`;

    // Write-first-verify: write a unique claim value, then verify we won the race
    // This eliminates the TOCTOU window of check-then-set
    const claimValue = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    await env.SLOTS_KV.put(claimKey, claimValue, { expirationTtl: 60 });

    // Verify our claim won (KV is strongly consistent for GET-after-PUT on same key)
    const storedClaim = await env.SLOTS_KV.get(claimKey);
    if (storedClaim !== claimValue) {
      return { success: false, reason: 'already_claimed' };
    }

    // Delete the duel, reverse lookup, notify key, and cancel DO alarm
    await Promise.all([
      env.SLOTS_KV.delete(key),
      env.SLOTS_KV.delete(kvKey('duel_target:', data.target)),
      env.SLOTS_KV.delete(kvKey('duel_notify:', challenger.toLowerCase())),
      cancelDuelAlarm(challenger, env)
    ]);

    // Verify deletion succeeded (secondary race guard)
    const verify = await env.SLOTS_KV.get(key);
    if (verify !== null) {
      env.SLOTS_KV.delete(claimKey).catch(() => {});
      return { success: false, reason: 'race_condition' };
    }

    // Cleanup claim lock (fire-and-forget, TTL handles cleanup anyway)
    env.SLOTS_KV.delete(claimKey).catch(() => {});

    return { success: true, duel: { challenger: challenger.toLowerCase(), ...data } };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logError('acceptDuel', error, { challenger });
    return { success: false, reason: 'error', debugInfo: `exception:${errMsg.substring(0, 50)}` };
  }
}

/**
 * Check if user has an active outgoing challenge
 */
export async function hasActiveDuel(username: string, env: Env): Promise<boolean> {
  const duel = await getDuel(username, env);
  return duel !== null;
}

// ============================================
// Duel Opt-Out
// ============================================

/**
 * Set user's duel opt-out status
 */
export async function setDuelOptOut(username: string, optOut: boolean, env: Env): Promise<boolean> {
  try {
    const key = kvKey('duel_optout:', username);
    if (optOut) {
      await env.SLOTS_KV.put(key, KV_TRUE);
    } else {
      await env.SLOTS_KV.delete(key);
    }
    return true;
  } catch (error) {
    logError('setDuelOptOut', error, { username, optOut });
    return false;
  }
}

/**
 * Check if user has opted out of duels
 */
export async function isDuelOptedOut(username: string, env: Env): Promise<boolean> {
  try {
    const key = kvKey('duel_optout:', username);
    const value = await env.SLOTS_KV.get(key);
    return value === KV_TRUE;
  } catch (error) {
    logError('isDuelOptedOut', error, { username });
    return false;
  }
}

// ============================================
// Duel Cooldown
// ============================================

/**
 * Check if user is on duel cooldown
 * Returns remaining seconds if on cooldown, 0 if not
 */
export async function getDuelCooldown(username: string, env: Env): Promise<number> {
  try {
    const key = kvKey('duel_cooldown:', username);
    const value = await env.SLOTS_KV.get(key);
    if (!value) return 0;

    const expiresAt = parseInt(value, 10);
    const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch (error) {
    logError('getDuelCooldown', error, { username });
    return 0;
  }
}

/**
 * Set duel cooldown for user
 */
export async function setDuelCooldown(username: string, env: Env): Promise<boolean> {
  try {
    const key = kvKey('duel_cooldown:', username);
    const expiresAt = Date.now() + (DUEL_COOLDOWN_SECONDS * 1000);
    await env.SLOTS_KV.put(key, expiresAt.toString(), {
      expirationTtl: DUEL_COOLDOWN_SECONDS + 10
    });
    return true;
  } catch (error) {
    logError('setDuelCooldown', error, { username });
    return false;
  }
}

// ============================================
// Duel Logging (D1)
// ============================================

/**
 * Log a completed duel to D1 (fire-and-forget)
 */
export async function logDuel(data: DuelLogData, env: Env): Promise<void> {
  if (!D1_ENABLED || !env.DB) return;

  try {
    await env.DB.prepare(`
      INSERT INTO duel_log (challenger, target, amount, challenger_grid, target_grid, challenger_score, target_score, winner, pot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.challenger.toLowerCase(),
      data.target.toLowerCase(),
      data.amount,
      JSON.stringify(data.challengerGrid),
      JSON.stringify(data.targetGrid),
      data.challengerScore,
      data.targetScore,
      data.winner ? data.winner.toLowerCase() : null,
      data.pot
    ).run();
  } catch (error) {
    logError('logDuel', error, { challenger: data.challenger, target: data.target });
  }
}

export interface DuelStats {
  played: number;
  won: number;
  lost: number;
  tied: number;
}

/**
 * Get accurate duel win/loss/tie counts from D1
 */
export async function getDuelStats(username: string, env: Env): Promise<DuelStats> {
  if (!D1_ENABLED || !env.DB) return { played: 0, won: 0, lost: 0, tied: 0 };

  try {
    const lower = username.toLowerCase();
    const result = await env.DB.prepare(`
      SELECT
        COUNT(*) as played,
        SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN winner IS NOT NULL AND winner != ? THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END) as tied
      FROM duel_log
      WHERE challenger = ? OR target = ?
    `).bind(lower, lower, lower, lower).first<{
      played: number;
      won: number;
      lost: number;
      tied: number;
    }>();

    return {
      played: result?.played || 0,
      won: result?.won || 0,
      lost: result?.lost || 0,
      tied: result?.tied || 0
    };
  } catch (error) {
    logError('getDuelStats', error, { username });
    return { played: 0, won: 0, lost: 0, tied: 0 };
  }
}

/**
 * Get duel history for a player from D1
 */
export async function getDuelHistory(username: string, limit: number, env: Env): Promise<DuelHistoryEntry[]> {
  if (!D1_ENABLED || !env.DB) return [];

  try {
    const lowerUsername = username.toLowerCase();
    const result = await env.DB.prepare(`
      SELECT id, challenger, target, amount, challenger_grid, target_grid,
             challenger_score, target_score, winner, pot, created_at
      FROM duel_log
      WHERE challenger = ? OR target = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(lowerUsername, lowerUsername, limit).all<{
      id: number;
      challenger: string;
      target: string;
      amount: number;
      challenger_grid: string;
      target_grid: string;
      challenger_score: number;
      target_score: number;
      winner: string | null;
      pot: number;
      created_at: number;
    }>();

    return (result.results || []).map(row => ({
      id: row.id,
      challenger: row.challenger,
      target: row.target,
      amount: row.amount,
      challengerGrid: JSON.parse(row.challenger_grid) as string[],
      targetGrid: JSON.parse(row.target_grid) as string[],
      challengerScore: row.challenger_score,
      targetScore: row.target_score,
      winner: row.winner,
      pot: row.pot,
      createdAt: row.created_at
    }));
  } catch (error) {
    logError('getDuelHistory', error, { username });
    return [];
  }
}

// ============================================
// Duel Timeout Notifications (Cron)
// ============================================

interface DuelNotifyData {
  target: string;
  amount: number;
  notifyAfter: number;
}

/**
 * Process expired duel notifications (called by cron every minute).
 * Scans duel_notify:* keys, sends chat message for expired duels.
 */
export async function processDuelTimeoutNotifications(env: Env): Promise<void> {
  try {
    const list = await env.SLOTS_KV.list({ prefix: 'duel_notify:' });
    const now = Date.now();

    for (const key of list.keys) {
      try {
        const value = await env.SLOTS_KV.get(key.name);
        if (!value) continue;

        const data: DuelNotifyData = JSON.parse(value);
        if (now < data.notifyAfter) continue; // Not yet expired

        // Extract challenger from key name (format: duel_notify:{challenger})
        const challenger = key.name.replace('duel_notify:', '');

        // Send timeout notification
        await sendChatMessage(
          `⏰ @${challenger} Dein Duell gegen @${data.target} (${data.amount} DachsTaler) ist abgelaufen — @${data.target} hat sich wie ein feiger Dachs im Dachsbau versteckt :c`,
          env
        );

        // Clean up notify key
        await env.SLOTS_KV.delete(key.name);
      } catch (error) {
        logError('processDuelTimeoutNotifications.entry', error, { key: key.name });
      }
    }
  } catch (error) {
    logError('processDuelTimeoutNotifications', error);
  }
}
