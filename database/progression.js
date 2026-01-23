/**
 * Progression System - Streaks, Stats, Monthly Login, Prestige, Unlocks
 *
 * Uses DUAL_WRITE pattern: writes go to both KV and D1 for consistency
 */

import { STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_MAX, KV_TRUE, MAX_RETRIES } from '../constants.js';
import { getCurrentMonth, getCurrentDate, logError, kvKey, exponentialBackoff } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, upsertUser, updateStreakMultiplier as updateStreakMultiplierD1 } from './d1.js';
import { addUnlockD1, removeUnlockD1, updateMonthlyLoginD1, incrementStatD1, updateBiggestWinD1 } from './d1-achievements.js';

// Streak Multiplier
async function getStreakMultiplier(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('streakmultiplier:', username));
    return value ? parseFloat(value) : 1.0;
  } catch (error) {
    return 1.0;
  }
}

async function incrementStreakMultiplier(username, env, maxRetries = MAX_RETRIES) {
  const key = kvKey('streakmultiplier:', username);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const current = await getStreakMultiplier(username, env);
      const newMultiplier = Math.min(current + STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_MAX);
      const newValue = newMultiplier.toFixed(1);
      await env.SLOTS_KV.put(key, newValue);

      // Verify the write succeeded
      const verifyValue = await env.SLOTS_KV.get(key);
      if (verifyValue === newValue) {
        if (D1_ENABLED && DUAL_WRITE && env.DB) {
          updateStreakMultiplierD1(username, newMultiplier, env).catch(err => logError('incrementStreakMultiplier.d1', err, { username }));
        }
        return newMultiplier;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('incrementStreakMultiplier', error, { username, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return 1.0;
    }
  }
  return 1.0;
}

async function resetStreakMultiplier(username, env) {
  try {
    await env.SLOTS_KV.delete(kvKey('streakmultiplier:', username));

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      updateStreakMultiplierD1(username, 1.0, env).catch(err => logError('resetStreakMultiplier.d1', err, { username }));
    }
  } catch (error) {
    logError('resetStreakMultiplier', error, { username });
  }
}

// Prestige Rank
async function getPrestigeRank(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('rank:', username));
    // Return null for empty string or null (handles KV edge cases)
    return value || null;
  } catch (error) {
    logError('getPrestigeRank', error, { username });
    return null;
  }
}

async function setPrestigeRank(username, rank, env) {
  try {
    await env.SLOTS_KV.put(kvKey('rank:', username), rank);

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { prestige_rank: rank }, env).catch(err => logError('setPrestigeRank.d1', err, { username }));
    }
  } catch (error) {
    logError('setPrestigeRank', error, { username, rank });
  }
}

async function removePrestigeRank(username, env) {
  try {
    await env.SLOTS_KV.delete(kvKey('rank:', username));

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertUser(username, { prestige_rank: null }, env).catch(err => logError('removePrestigeRank.d1', err, { username }));
    }
    return true;
  } catch (error) {
    logError('removePrestigeRank', error, { username });
    return false;
  }
}

// Unlocks
async function hasUnlock(username, unlockKey, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('unlock:', username, unlockKey));
    return value === KV_TRUE;
  } catch (error) {
    logError('hasUnlock', error, { username, unlockKey });
    return false;
  }
}

async function setUnlock(username, unlockKey, env) {
  try {
    await env.SLOTS_KV.put(kvKey('unlock:', username, unlockKey), 'true');

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      addUnlockD1(username, unlockKey, env).catch(err => logError('setUnlock.d1', err, { username, unlockKey }));
    }
  } catch (error) {
    logError('setUnlock', error, { username, unlockKey });
  }
}

async function removeUnlock(username, unlockKey, env) {
  try {
    await env.SLOTS_KV.delete(kvKey('unlock:', username, unlockKey));

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      removeUnlockD1(username, unlockKey, env).catch(err => logError('removeUnlock.d1', err, { username, unlockKey }));
    }
    return true;
  } catch (error) {
    logError('removeUnlock', error, { username, unlockKey });
    return false;
  }
}

// Monthly Login System
async function getMonthlyLogin(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('monthlylogin:', username));
    const currentMonth = getCurrentMonth();

    if (!value) {
      return { month: currentMonth, days: [], claimedMilestones: [] };
    }

    let data;
    try {
      data = JSON.parse(value);
    } catch (parseError) {
      logError('getMonthlyLogin.corruptedJSON', parseError, { username, rawValue: value?.substring(0, 100) });
      return { month: currentMonth, days: [], claimedMilestones: [] };
    }

    // Validate structure - ensure days and claimedMilestones are arrays
    if (!Array.isArray(data.days)) {
      logError('getMonthlyLogin.invalidDays', new Error('days is not an array'), { username, data });
      data.days = [];
    }
    if (!Array.isArray(data.claimedMilestones)) {
      logError('getMonthlyLogin.invalidMilestones', new Error('claimedMilestones is not an array'), { username, data });
      data.claimedMilestones = [];
    }

    // Reset if new month
    if (data.month !== currentMonth) {
      return { month: currentMonth, days: [], claimedMilestones: [] };
    }

    return data;
  } catch (error) {
    logError('getMonthlyLogin', error, { username });
    const currentMonth = getCurrentMonth();
    return { month: currentMonth, days: [], claimedMilestones: [] };
  }
}

async function updateMonthlyLogin(username, env) {
  try {
    const monthlyLogin = await getMonthlyLogin(username, env);
    const today = getCurrentDate();

    // Check if today is already logged
    if (!monthlyLogin.days.includes(today)) {
      monthlyLogin.days.push(today);
      monthlyLogin.days.sort(); // Keep sorted
    }

    await env.SLOTS_KV.put(kvKey('monthlylogin:', username), JSON.stringify(monthlyLogin));

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      updateMonthlyLoginD1(username, monthlyLogin, env).catch(err => logError('updateMonthlyLogin.d1', err, { username }));
    }

    return monthlyLogin;
  } catch (error) {
    logError('updateMonthlyLogin', error, { username });
    const currentMonth = getCurrentMonth();
    return { month: currentMonth, days: [], claimedMilestones: [] };
  }
}

// OPTIMIZED: Accept monthlyLogin as parameter to avoid redundant KV read
async function markMilestoneClaimed(username, milestone, env, monthlyLogin = null) {
  try {
    const data = monthlyLogin || await getMonthlyLogin(username, env);

    if (!data.claimedMilestones.includes(milestone)) {
      data.claimedMilestones.push(milestone);
      await env.SLOTS_KV.put(kvKey('monthlylogin:', username), JSON.stringify(data));

      // DUAL_WRITE: Fire-and-forget D1 write
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        updateMonthlyLoginD1(username, data, env).catch(err => logError('markMilestoneClaimed.d1', err, { username }));
      }
    }
  } catch (error) {
    logError('markMilestoneClaimed', error, { username, milestone });
  }
}

// Streaks
async function getStreak(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('streak:', username));
    if (!value) return { wins: 0, losses: 0 };
    return JSON.parse(value);
  } catch (error) {
    logError('getStreak', error, { username });
    return { wins: 0, losses: 0 };
  }
}

// Stats - with structure validation
const DEFAULT_STATS = {
  // Core stats
  totalSpins: 0, wins: 0, biggestWin: 0, totalWon: 0, totalLost: 0,
  // Loss tracking
  losses: 0, biggestLoss: 0, maxLossStreak: 0,
  // Item/Buff usage
  chaosSpins: 0, reverseChaosSpins: 0, wheelSpins: 0, mysteryBoxes: 0,
  peekTokens: 0, insuranceTriggers: 0, wildCardsUsed: 0, guaranteedPairsUsed: 0,
  freeSpinsUsed: 0, diamondMines: 0,
  // Duel extended
  duelsPlayed: 0, duelsWon: 0, duelsLost: 0, maxDuelStreak: 0, totalDuelWinnings: 0,
  // Transfer extended
  totalTransferred: 0, transfersReceived: 0, transfersSentCount: 0, bankDonations: 0,
  // Time/Activity
  playDays: 0, firstSpinAt: 0, maxDailyStreak: 0,
  // Spin types
  allInSpins: 0, highBetSpins: 0,
  // Dachs tracking
  totalDachsSeen: 0,
  // Hourly jackpot
  hourlyJackpots: 0,
  // Shop
  shopPurchases: 0,
  // Daily
  dailysClaimed: 0
};

async function getStats(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('stats:', username));
    if (!value) return { ...DEFAULT_STATS };

    const parsed = JSON.parse(value);

    // Validate and sanitize each field - merge with defaults for backwards compatibility
    const stats = { ...DEFAULT_STATS };
    for (const key of Object.keys(DEFAULT_STATS)) {
      if (typeof parsed[key] === 'number') {
        stats[key] = parsed[key];
      }
    }
    return stats;
  } catch (error) {
    logError('getStats', error, { username });
    return { ...DEFAULT_STATS };
  }
}

async function updateStats(username, isWin, winAmount, lostAmount, env) {
  try {
    const stats = await getStats(username, env);
    const wasNewBiggestWin = isWin && winAmount > stats.biggestWin;
    const wasNewBiggestLoss = !isWin && lostAmount > stats.biggestLoss;

    stats.totalSpins++;
    if (isWin) {
      stats.wins++;
      stats.totalWon += winAmount;
      if (wasNewBiggestWin) stats.biggestWin = winAmount;
    } else {
      stats.losses++;
      stats.totalLost += lostAmount;
      if (wasNewBiggestLoss) stats.biggestLoss = lostAmount;
    }
    await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));

    // DUAL_WRITE: Fire-and-forget D1 writes (batch all D1 updates)
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      const d1Ops = [incrementStatD1(username, 'totalSpins', 1, env)];
      if (isWin) {
        d1Ops.push(incrementStatD1(username, 'wins', 1, env));
        d1Ops.push(incrementStatD1(username, 'totalWon', winAmount, env));
        if (wasNewBiggestWin) d1Ops.push(updateBiggestWinD1(username, winAmount, env));
      } else {
        d1Ops.push(incrementStatD1(username, 'losses', 1, env));
        d1Ops.push(incrementStatD1(username, 'totalLost', lostAmount, env));
      }
      Promise.all(d1Ops).catch(err => logError('updateStats.d1', err, { username }));
    }
  } catch (error) {
    logError('updateStats', error, { username });
  }
}

/**
 * Increment a specific stat by a given amount
 * Used for tracking item usage, special events, etc.
 */
async function incrementStat(username, statKey, amount, env) {
  try {
    const stats = await getStats(username, env);
    if (statKey in stats) {
      stats[statKey] += amount;
      await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));

      // DUAL_WRITE: Fire-and-forget D1 write
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        incrementStatD1(username, statKey, amount, env).catch(err => logError('incrementStat.d1', err, { username, statKey }));
      }
    }
  } catch (error) {
    logError('incrementStat', error, { username, statKey, amount });
  }
}

/**
 * Set a specific stat to a value (for max values, timestamps, etc.)
 */
async function setStat(username, statKey, value, env) {
  try {
    const stats = await getStats(username, env);
    if (statKey in stats) {
      const delta = value - stats[statKey];
      stats[statKey] = value;
      await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));

      // DUAL_WRITE: Fire-and-forget D1 write
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        incrementStatD1(username, statKey, delta, env).catch(err => logError('setStat.d1', err, { username, statKey }));
      }
    }
  } catch (error) {
    logError('setStat', error, { username, statKey, value });
  }
}

/**
 * Batch increment multiple stats in a single read-modify-write cycle
 * Prevents race conditions from parallel incrementStat calls on the same key
 * @param {string} username - Player username
 * @param {Array<[string, number]>} updates - Array of [statKey, amount] pairs
 * @param {object} env - Environment bindings
 */
async function incrementStats(username, updates, env) {
  try {
    if (!updates || updates.length === 0) return;
    const stats = await getStats(username, env);
    const d1Updates = [];

    for (const [statKey, amount] of updates) {
      if (statKey in stats) {
        stats[statKey] += amount;
        d1Updates.push([statKey, amount]);
      }
    }

    await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));

    // DUAL_WRITE: Fire-and-forget D1 writes
    if (D1_ENABLED && DUAL_WRITE && env.DB && d1Updates.length > 0) {
      Promise.all(d1Updates.map(([key, amt]) => incrementStatD1(username, key, amt, env)))
        .catch(err => logError('incrementStats.d1', err, { username }));
    }
  } catch (error) {
    logError('incrementStats', error, { username, updates: updates.map(u => u[0]) });
  }
}

/**
 * Batch increment stats + update max stat in a single read-modify-write
 * @param {string} username - Player username
 * @param {Array<[string, number]>} increments - Array of [statKey, amount] pairs
 * @param {Array<[string, number]>} maxUpdates - Array of [statKey, newValue] pairs for max updates
 * @param {object} env - Environment bindings
 */
async function batchUpdateStats(username, increments, maxUpdates, env) {
  try {
    if ((!increments || increments.length === 0) && (!maxUpdates || maxUpdates.length === 0)) return;
    const stats = await getStats(username, env);
    const d1Promises = [];

    for (const [statKey, amount] of (increments || [])) {
      if (statKey in stats) {
        stats[statKey] += amount;
        d1Promises.push(() => incrementStatD1(username, statKey, amount, env));
      }
    }

    for (const [statKey, newValue] of (maxUpdates || [])) {
      if (statKey in stats && newValue > stats[statKey]) {
        stats[statKey] = newValue;
        d1Promises.push(() =>
          env.DB.prepare(`
            UPDATE player_stats SET ${statKey.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?
            WHERE username = ? AND ${statKey.replace(/([A-Z])/g, '_$1').toLowerCase()} < ?
          `).bind(newValue, username.toLowerCase(), newValue).run()
        );
      }
    }

    await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));

    // DUAL_WRITE: Fire-and-forget D1 writes
    if (D1_ENABLED && DUAL_WRITE && env.DB && d1Promises.length > 0) {
      Promise.all(d1Promises.map(fn => fn()))
        .catch(err => logError('batchUpdateStats.d1', err, { username }));
    }
  } catch (error) {
    logError('batchUpdateStats', error, { username });
  }
}

/**
 * Update max stat if new value is higher
 */
async function updateMaxStat(username, statKey, newValue, env) {
  try {
    const stats = await getStats(username, env);
    if (statKey in stats && newValue > stats[statKey]) {
      stats[statKey] = newValue;
      await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));

      // DUAL_WRITE: Fire-and-forget D1 write
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        env.DB.prepare(`
          UPDATE player_stats SET ${statKey.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?
          WHERE username = ? AND ${statKey.replace(/([A-Z])/g, '_$1').toLowerCase()} < ?
        `).bind(newValue, username.toLowerCase(), newValue).run()
          .catch(err => logError('updateMaxStat.d1', err, { username, statKey }));
      }
    }
  } catch (error) {
    logError('updateMaxStat', error, { username, statKey, newValue });
  }
}

export {
  getStreakMultiplier,
  incrementStreakMultiplier,
  resetStreakMultiplier,
  getPrestigeRank,
  setPrestigeRank,
  removePrestigeRank,
  hasUnlock,
  setUnlock,
  removeUnlock,
  getMonthlyLogin,
  updateMonthlyLogin,
  markMilestoneClaimed,
  getStreak,
  getStats,
  updateStats,
  incrementStat,
  incrementStats,
  batchUpdateStats,
  setStat,
  updateMaxStat
};
