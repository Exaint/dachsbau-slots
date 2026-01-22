/**
 * Core Database Functions - Balance, Daily, Cooldown, Disclaimer, Selfban
 *
 * Uses DUAL_WRITE pattern: writes go to both KV and D1 for consistency
 */

import { MAX_BALANCE, DAILY_TTL_SECONDS, STARTING_BALANCE, COOLDOWN_TTL_SECONDS, KV_TRUE, KV_ACCEPTED } from '../constants.js';
import { logError, kvKey } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, updateBalance as updateBalanceD1, upsertUser } from './d1.js';

// Balance Functions
async function getBalance(username, env) {
  try {
    const key = kvKey('user:', username);
    const value = await env.SLOTS_KV.get(key);
    if (value === null) {
      await setBalance(username, STARTING_BALANCE, env);
      return STARTING_BALANCE;
    }
    const balance = parseInt(value, 10);
    return isNaN(balance) ? STARTING_BALANCE : Math.min(balance, MAX_BALANCE);
  } catch (error) {
    logError('getBalance', error, { username });
    return STARTING_BALANCE;
  }
}

async function setBalance(username, balance, env) {
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

// Daily Functions
async function getLastDaily(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('daily:', username));
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    logError('getLastDaily', error, { username });
    return null;
  }
}

async function setLastDaily(username, timestamp, env) {
  try {
    await env.SLOTS_KV.put(kvKey('daily:', username), timestamp.toString(), { expirationTtl: DAILY_TTL_SECONDS });
  } catch (error) {
    logError('setLastDaily', error, { username });
  }
}

// Cooldown System
async function getLastSpin(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('cooldown:', username));
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    logError('getLastSpin', error, { username });
    return null;
  }
}

async function setLastSpin(username, timestamp, env) {
  try {
    await env.SLOTS_KV.put(kvKey('cooldown:', username), timestamp.toString(), { expirationTtl: COOLDOWN_TTL_SECONDS });
  } catch (error) {
    logError('setLastSpin', error, { username });
  }
}

// First-Time User System
async function hasAcceptedDisclaimer(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('disclaimer:', username));
    return value === KV_ACCEPTED;
  } catch (error) {
    logError('hasAcceptedDisclaimer', error, { username });
    return false;
  }
}

async function setDisclaimerAccepted(username, env) {
  try {
    await env.SLOTS_KV.put(kvKey('disclaimer:', username), KV_ACCEPTED);

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { disclaimer_accepted: true }, env).catch(err => logError('setDisclaimerAccepted.d1', err, { username }));
    }
  } catch (error) {
    logError('setDisclaimerAccepted', error, { username });
  }
}

// Selfban System
async function isSelfBanned(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('selfban:', username));
    if (!value) return null;
    return JSON.parse(value); // Returns { timestamp, date }
  } catch (error) {
    logError('isSelfBanned', error, { username });
    return null;
  }
}

async function setSelfBan(username, env) {
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

    const banData = {
      timestamp: now,
      date: date
    };

    await env.SLOTS_KV.put(kvKey('selfban:', username), JSON.stringify(banData));

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { selfban_timestamp: now }, env).catch(err => logError('setSelfBan.d1', err, { username }));
    }
  } catch (error) {
    logError('setSelfBan', error, { username });
  }
}

async function removeSelfBan(username, env) {
  try {
    await env.SLOTS_KV.delete(kvKey('selfban:', username));

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { selfban_timestamp: null }, env).catch(err => logError('removeSelfBan.d1', err, { username }));
    }
  } catch (error) {
    logError('removeSelfBan', error, { username });
  }
}

// Blacklist
async function isBlacklisted(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('blacklist:', username));
    return value === KV_TRUE;
  } catch (error) {
    logError('isBlacklisted', error, { username });
    return false;
  }
}

// Last Active tracking
async function getLastActive(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('lastActive:', username));
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    logError('getLastActive', error, { username });
    return null;
  }
}

async function setLastActive(username, env) {
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
async function isLeaderboardHidden(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('leaderboard_hidden:', username));
    return value === KV_TRUE;
  } catch (error) {
    logError('isLeaderboardHidden', error, { username });
    return false;
  }
}

async function setLeaderboardHidden(username, hidden, env) {
  try {
    const key = kvKey('leaderboard_hidden:', username);
    if (hidden) {
      await env.SLOTS_KV.put(key, KV_TRUE);
    } else {
      await env.SLOTS_KV.delete(key);
    }

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

export {
  getBalance,
  setBalance,
  getLastDaily,
  setLastDaily,
  getLastSpin,
  setLastSpin,
  hasAcceptedDisclaimer,
  setDisclaimerAccepted,
  isSelfBanned,
  setSelfBan,
  removeSelfBan,
  isBlacklisted,
  getLastActive,
  setLastActive,
  isLeaderboardHidden,
  setLeaderboardHidden
};
