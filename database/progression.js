/**
 * Progression System - Streaks, Stats, Monthly Login, Prestige, Unlocks
 *
 * Uses DUAL_WRITE pattern: writes go to both KV and D1 for consistency
 */

import { STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_MAX, KV_TRUE, MAX_RETRIES } from '../constants.js';
import { getCurrentMonth, getCurrentDate, logError, kvKey, exponentialBackoff } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, upsertUser } from './d1.js';
import { addUnlockD1, updateMonthlyLoginD1, incrementStatD1, updateBiggestWinD1 } from './d1-achievements.js';

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

    // DUAL_WRITE: Also update D1
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      await upsertUser(username, { prestige_rank: rank }, env);
    }
  } catch (error) {
    logError('setPrestigeRank', error, { username, rank });
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

    // DUAL_WRITE: Also update D1
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      await addUnlockD1(username, unlockKey, env);
    }
  } catch (error) {
    logError('setUnlock', error, { username, unlockKey });
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

    // DUAL_WRITE: Also update D1
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      await updateMonthlyLoginD1(username, monthlyLogin, env);
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

      // DUAL_WRITE: Also update D1
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        await updateMonthlyLoginD1(username, data, env);
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
const DEFAULT_STATS = { totalSpins: 0, wins: 0, biggestWin: 0, totalWon: 0, totalLost: 0 };

async function getStats(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('stats:', username));
    if (!value) return { ...DEFAULT_STATS };

    const parsed = JSON.parse(value);

    // Validate and sanitize each field
    return {
      totalSpins: typeof parsed.totalSpins === 'number' ? parsed.totalSpins : 0,
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      biggestWin: typeof parsed.biggestWin === 'number' ? parsed.biggestWin : 0,
      totalWon: typeof parsed.totalWon === 'number' ? parsed.totalWon : 0,
      totalLost: typeof parsed.totalLost === 'number' ? parsed.totalLost : 0
    };
  } catch (error) {
    logError('getStats', error, { username });
    return { ...DEFAULT_STATS };
  }
}

async function updateStats(username, isWin, winAmount, lostAmount, env) {
  try {
    const stats = await getStats(username, env);
    const wasNewBiggestWin = isWin && winAmount > stats.biggestWin;

    stats.totalSpins++;
    if (isWin) {
      stats.wins++;
      stats.totalWon += winAmount;
      if (wasNewBiggestWin) stats.biggestWin = winAmount;
    } else {
      stats.totalLost += lostAmount;
    }
    await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));

    // DUAL_WRITE: Also update D1
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      // Increment individual stats in D1
      await incrementStatD1(username, 'totalSpins', 1, env);
      if (isWin) {
        await incrementStatD1(username, 'wins', 1, env);
        await incrementStatD1(username, 'totalWon', winAmount, env);
        if (wasNewBiggestWin) {
          await updateBiggestWinD1(username, winAmount, env);
        }
      } else {
        await incrementStatD1(username, 'totalLost', lostAmount, env);
      }
    }
  } catch (error) {
    logError('updateStats', error, { username });
  }
}

export {
  getStreakMultiplier,
  incrementStreakMultiplier,
  resetStreakMultiplier,
  getPrestigeRank,
  setPrestigeRank,
  hasUnlock,
  setUnlock,
  getMonthlyLogin,
  updateMonthlyLogin,
  markMilestoneClaimed,
  getStreak,
  getStats,
  updateStats
};
