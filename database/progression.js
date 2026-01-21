/**
 * Progression System - Streaks, Stats, Monthly Login, Prestige, Unlocks
 */

import { STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_MAX, KV_TRUE } from '../constants.js';
import { getCurrentMonth, getCurrentDate, logError, kvKey } from '../utils.js';

// Streak Multiplier
async function getStreakMultiplier(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('streakmultiplier:', username));
    return value ? parseFloat(value) : 1.0;
  } catch (error) {
    return 1.0;
  }
}

async function incrementStreakMultiplier(username, env) {
  try {
    const current = await getStreakMultiplier(username, env);
    const newMultiplier = Math.min(current + STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_MAX);
    await env.SLOTS_KV.put(kvKey('streakmultiplier:', username), newMultiplier.toFixed(1));
    return newMultiplier;
  } catch (error) {
    return 1.0;
  }
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

    const data = JSON.parse(value);

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

// Stats
async function getStats(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('stats:', username));
    if (!value) return { totalSpins: 0, wins: 0, biggestWin: 0, totalWon: 0, totalLost: 0 };
    return JSON.parse(value);
  } catch (error) {
    logError('getStats', error, { username });
    return { totalSpins: 0, wins: 0, biggestWin: 0, totalWon: 0, totalLost: 0 };
  }
}

async function updateStats(username, isWin, winAmount, lostAmount, env) {
  try {
    const stats = await getStats(username, env);
    stats.totalSpins++;
    if (isWin) {
      stats.wins++;
      stats.totalWon += winAmount;
      if (winAmount > stats.biggestWin) stats.biggestWin = winAmount;
    } else {
      stats.totalLost += lostAmount;
    }
    await env.SLOTS_KV.put(kvKey('stats:', username), JSON.stringify(stats));
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
