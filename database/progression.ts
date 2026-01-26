/**
 * Progression System - Streaks, Stats, Monthly Login, Prestige, Unlocks
 *
 * Uses DUAL_WRITE pattern: writes go to both KV and D1 for consistency
 */

import { STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_MAX, KV_TRUE, MAX_RETRIES } from '../constants.js';
import { getCurrentMonth, getCurrentDate, logError, kvKey, exponentialBackoff } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, STATS_READ_PRIMARY, upsertUser, updateStreakMultiplier as updateStreakMultiplierD1 } from './d1.js';
import { addUnlockD1, removeUnlockD1, updateMonthlyLoginD1, incrementStatD1, updateBiggestWinD1, updateMaxStatD1, getFullPlayerStatsD1 } from './d1-achievements.js';
import { updateAchievementStat, updateAchievementStatBatch, setMaxAchievementStat } from './achievements.js';
import type { Env, MonthlyLoginData, StreakData } from '../types/index.js';

// ============================================
// Types
// ============================================

export interface PlayerStats {
  // Core stats
  totalSpins: number;
  wins: number;
  biggestWin: number;
  totalWon: number;
  totalLost: number;
  // Loss tracking
  losses: number;
  biggestLoss: number;
  maxLossStreak: number;
  // Item/Buff usage
  chaosSpins: number;
  reverseChaosSpins: number;
  wheelSpins: number;
  mysteryBoxes: number;
  peekTokens: number;
  insuranceTriggers: number;
  wildCardsUsed: number;
  guaranteedPairsUsed: number;
  freeSpinsUsed: number;
  diamondMines: number;
  // Duel extended
  duelsPlayed: number;
  duelsWon: number;
  duelsLost: number;
  maxDuelStreak: number;
  totalDuelWinnings: number;
  // Transfer extended
  totalTransferred: number;
  transfersReceived: number;
  transfersSentCount: number;
  // Time/Activity
  playDays: number;
  firstSpinAt: number;
  maxDailyStreak: number;
  // Spin types
  allInSpins: number;
  highBetSpins: number;
  // Dachs tracking
  totalDachsSeen: number;
  // Hourly jackpot
  hourlyJackpots: number;
  // Shop
  shopPurchases: number;
  // Daily
  dailysClaimed: number;
}

// ============================================
// Constants
// ============================================

// Stats - with structure validation
const DEFAULT_STATS: PlayerStats = {
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
  totalTransferred: 0, transfersReceived: 0, transfersSentCount: 0,
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

// Whitelist of valid stat keys for SQL safety (prevents SQL injection via statKey)
const VALID_STAT_KEYS = new Set<string>(Object.keys(DEFAULT_STATS));

// Convert camelCase to snake_case for D1 column names
function statKeyToColumn(statKey: string): string {
  if (!VALID_STAT_KEYS.has(statKey)) {
    throw new Error(`Invalid stat key: ${statKey}`);
  }
  return statKey.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// ============================================
// Streak Multiplier
// ============================================

export async function getStreakMultiplier(username: string, env: Env): Promise<number> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('streakmultiplier:', username));
    return value ? parseFloat(value) : 1.0;
  } catch (error) {
    return 1.0;
  }
}

export async function incrementStreakMultiplier(username: string, env: Env, maxRetries: number = MAX_RETRIES): Promise<number> {
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

export async function resetStreakMultiplier(username: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.delete(kvKey('streakmultiplier:', username));

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      updateStreakMultiplierD1(username, 1.0, env).catch(err => logError('resetStreakMultiplier.d1', err, { username }));
    }
  } catch (error) {
    logError('resetStreakMultiplier', error, { username });
  }
}

// ============================================
// Prestige Rank
// ============================================

export async function getPrestigeRank(username: string, env: Env): Promise<string | null> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('rank:', username));
    // Return null for empty string or null (handles KV edge cases)
    return value || null;
  } catch (error) {
    logError('getPrestigeRank', error, { username });
    return null;
  }
}

export async function setPrestigeRank(username: string, rank: string, env: Env): Promise<void> {
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

export async function removePrestigeRank(username: string, env: Env): Promise<boolean> {
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

// ============================================
// Unlocks
// ============================================

export async function hasUnlock(username: string, unlockKey: string, env: Env): Promise<boolean> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('unlock:', username, unlockKey));
    return value === KV_TRUE;
  } catch (error) {
    logError('hasUnlock', error, { username, unlockKey });
    return false;
  }
}

export async function setUnlock(username: string, unlockKey: string, env: Env): Promise<void> {
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

export async function removeUnlock(username: string, unlockKey: string, env: Env): Promise<boolean> {
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

// ============================================
// Monthly Login System
// ============================================

export async function getMonthlyLogin(username: string, env: Env): Promise<MonthlyLoginData> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('monthlylogin:', username));
    const currentMonth = getCurrentMonth();

    if (!value) {
      return { month: currentMonth, days: [], claimedMilestones: [] };
    }

    let data: MonthlyLoginData;
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

export async function updateMonthlyLogin(username: string, env: Env): Promise<MonthlyLoginData> {
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
export async function markMilestoneClaimed(username: string, milestone: number, env: Env, monthlyLogin: MonthlyLoginData | null = null): Promise<void> {
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

// ============================================
// Streaks
// ============================================

export async function getStreak(username: string, env: Env): Promise<StreakData> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('streak:', username));
    if (!value) return { wins: 0, losses: 0 };
    return JSON.parse(value) as StreakData;
  } catch (error) {
    logError('getStreak', error, { username });
    return { wins: 0, losses: 0 };
  }
}

// ============================================
// Stats
// ============================================

export async function getStats(username: string, env: Env): Promise<PlayerStats> {
  try {
    // D1-primary: try D1 first, KV as fallback
    if (STATS_READ_PRIMARY === 'd1') {
      const d1Stats = await getFullPlayerStatsD1(username, env);
      if (d1Stats) {
        const stats: PlayerStats = { ...DEFAULT_STATS };
        for (const key of Object.keys(DEFAULT_STATS) as (keyof PlayerStats)[]) {
          if (typeof d1Stats[key] === 'number') {
            stats[key] = d1Stats[key];
          }
        }
        return stats;
      }
      // D1 returned null → fall through to KV
    }

    // KV-primary (default) or KV-fallback
    const value = await env.SLOTS_KV.get(kvKey('stats:', username));
    if (!value) return { ...DEFAULT_STATS };

    const parsed = JSON.parse(value);

    // Validate and sanitize each field - merge with defaults for backwards compatibility
    const stats: PlayerStats = { ...DEFAULT_STATS };
    for (const key of Object.keys(DEFAULT_STATS) as (keyof PlayerStats)[]) {
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

export async function updateStats(username: string, isWin: boolean, winAmount: number, lostAmount: number, env: Env): Promise<void> {
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
      const d1Ops: Promise<boolean>[] = [incrementStatD1(username, 'totalSpins', 1, env)];
      if (isWin) {
        d1Ops.push(incrementStatD1(username, 'wins', 1, env));
        d1Ops.push(incrementStatD1(username, 'totalWon', winAmount, env));
        if (wasNewBiggestWin) d1Ops.push(updateBiggestWinD1(username, winAmount, env));
      } else {
        d1Ops.push(incrementStatD1(username, 'losses', 1, env));
        d1Ops.push(incrementStatD1(username, 'totalLost', lostAmount, env));
        if (wasNewBiggestLoss) d1Ops.push(updateMaxStatD1(username, 'biggestLoss', lostAmount, env));
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
export async function incrementStat(username: string, statKey: keyof PlayerStats, amount: number, env: Env): Promise<void> {
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
export async function setStat(username: string, statKey: keyof PlayerStats, value: number, env: Env): Promise<void> {
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
 */
export async function incrementStats(username: string, updates: [keyof PlayerStats, number][], env: Env): Promise<void> {
  try {
    if (!updates || updates.length === 0) return;
    const stats = await getStats(username, env);
    const d1Updates: [string, number][] = [];

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
 */
export async function batchUpdateStats(
  username: string,
  increments: [keyof PlayerStats, number][] | null,
  maxUpdates: [keyof PlayerStats, number][] | null,
  env: Env
): Promise<void> {
  try {
    if ((!increments || increments.length === 0) && (!maxUpdates || maxUpdates.length === 0)) return;
    const stats = await getStats(username, env);
    const d1Promises: (() => Promise<D1Result<unknown>>)[] = [];

    for (const [statKey, amount] of (increments || [])) {
      if (statKey in stats) {
        stats[statKey] += amount;
        d1Promises.push(() => incrementStatD1(username, statKey, amount, env) as unknown as Promise<D1Result<unknown>>);
      }
    }

    for (const [statKey, newValue] of (maxUpdates || [])) {
      if (statKey in stats && newValue > stats[statKey]) {
        stats[statKey] = newValue;
        // Use validated column name to prevent SQL injection
        const column = statKeyToColumn(statKey);
        d1Promises.push(() =>
          env.DB.prepare(`
            UPDATE player_stats SET ${column} = ?
            WHERE username = ? AND ${column} < ?
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
export async function updateMaxStat(username: string, statKey: keyof PlayerStats, newValue: number, env: Env): Promise<void> {
  try {
    const stats = await getStats(username, env);
    if (statKey in stats && newValue > stats[statKey]) {
      stats[statKey] = newValue;
      await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));

      // DUAL_WRITE: Fire-and-forget D1 write
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        // Use validated column name to prevent SQL injection
        const column = statKeyToColumn(statKey);
        env.DB.prepare(`
          UPDATE player_stats SET ${column} = ?
          WHERE username = ? AND ${column} < ?
        `).bind(newValue, username.toLowerCase(), newValue).run()
          .catch(err => logError('updateMaxStat.d1', err, { username, statKey }));
      }
    }
  } catch (error) {
    logError('updateMaxStat', error, { username, statKey, newValue });
  }
}

// ============================================
// Unified Stat Writers
// ============================================
// These functions write to ALL stores (achievement-blob + stats-KV + D1)
// in a single call, eliminating double D1 writes.
// Use these instead of calling updateAchievementStat + incrementStat separately.

/**
 * Unified single-stat writer: achievement-blob + stats-KV + D1 (once)
 */
export async function updatePlayerStat(username: string, statKey: keyof PlayerStats, amount: number, env: Env): Promise<void> {
  // 1. Achievement-blob update + unlock checks + D1 write
  await updateAchievementStat(username, statKey, amount, env);

  // 2. Stats KV update (D1 already done above, no double write)
  try {
    const stats = await getStats(username, env);
    if (statKey in stats) {
      stats[statKey] += amount;
      await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));
    }
  } catch (error) {
    logError('updatePlayerStat.kv', error, { username, statKey });
  }
}

/**
 * Unified batch stat writer: achievement-blob + stats-KV + D1 (once per stat)
 * Handles both increments and max-value updates in a single call.
 */
export async function updatePlayerStatBatch(
  username: string,
  increments: [keyof PlayerStats, number][],
  maxUpdates: [keyof PlayerStats, number][] | null,
  env: Env
): Promise<void> {
  // 1. Achievement-blob batch update + D1 writes (increments)
  if (increments.length > 0) {
    await updateAchievementStatBatch(username, increments.map(([k, v]) => [k as string, v]), env);
  }

  // 2. Max-value achievement stats + D1 writes
  if (maxUpdates && maxUpdates.length > 0) {
    for (const [statKey, value] of maxUpdates) {
      await setMaxAchievementStat(username, statKey, value, env);
    }
  }

  // 3. Stats KV update (D1 already done above, no double writes)
  try {
    const stats = await getStats(username, env);
    for (const [statKey, amount] of increments) {
      if (statKey in stats) stats[statKey] += amount;
    }
    if (maxUpdates) {
      for (const [statKey, value] of maxUpdates) {
        if (statKey in stats && value > stats[statKey]) stats[statKey] = value;
      }
    }
    await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));
  } catch (error) {
    logError('updatePlayerStatBatch.kv', error, { username });
  }
}
