/**
 * Slot Machine Helper Functions
 * Helper functions for spin parsing, multipliers, streaks, and achievements
 */

import {
  BASE_SPIN_COST,
  UNLOCK_MAP,
  MULTIPLIER_MAP,
  LOSS_MESSAGES,
  ROTATING_LOSS_MESSAGES,
  COMBO_BONUSES,
  STREAK_THRESHOLD,
  HOT_STREAK_BONUS,
  COMEBACK_BONUS,
  STREAK_TTL_SECONDS,
  RAGE_MODE_WIN_THRESHOLD,
  URLS,
  ACHIEVEMENTS
} from '../../constants.js';
import { logError, kvKey } from '../../utils.js';
import { CUSTOM_MESSAGES } from '../../config.js';
import {
  hasUnlock,
  consumeWinMultiplier,
  consumeBoost,
  updateAchievementStat,
  updateAchievementStatBatch,
  setMaxAchievementStat,
  markTripleCollected,
  recordDachsHit,
  checkAndUnlockAchievement,
  checkBalanceAchievements,
  checkBigWinAchievements,
  addFreeSpinsWithMultiplier,
  batchUpdateStats
} from '../../database.js';

// Unlock prices for error messages
const UNLOCK_PRICES = { 20: 500, 30: 2000, 50: 2500, 100: 3250, all: 4444 };

/**
 * Achievement tracking (fire-and-forget, non-blocking)
 * IMPORTANT: Operations are run sequentially to avoid race conditions on KV writes
 * @param {string} username - Player username
 * @param {string[]} originalGrid - Grid before special items (for dachs detection)
 * @param {string[]} displayGrid - Grid after special items (for wild card and triple detection)
 * @param {object} result - Win result from calculateWin
 * @param {number} newBalance - Player's new balance after spin
 * @param {boolean} isFreeSpinUsed - Whether a free spin was used
 * @param {boolean} isAllIn - Whether this was an all-in spin
 * @param {boolean} hasWildCardToken - Whether wild card was used
 * @param {boolean} insuranceUsed - Whether insurance was triggered
 * @param {boolean} hourlyJackpotWon - Whether hourly jackpot was won
 * @param {boolean} hotStreakTriggered - Whether hot streak bonus was triggered
 * @param {boolean} comebackTriggered - Whether comeback bonus was triggered
 * @param {object} env - Environment bindings
 * @param {object} extendedData - Extended tracking data (optional)
 */
export async function trackSlotAchievements(username, originalGrid, displayGrid, result, newBalance, isFreeSpinUsed, isAllIn, hasWildCardToken, insuranceUsed, hourlyJackpotWon, hotStreakTriggered, comebackTriggered, env, extendedData = {}) {
  try {
    // Batch achievement stat updates (single read-modify-write instead of sequential calls)
    const dachsCount = originalGrid.filter(s => s === '🦡').length;
    const achievementStats = [['totalSpins', 1]];
    if (result.points > 0) {
      achievementStats.push(['wins', 1]);
    } else {
      achievementStats.push(['losses', 1]);
    }
    if (isFreeSpinUsed) achievementStats.push(['freeSpinsUsed', 1]);
    if (insuranceUsed) achievementStats.push(['insuranceTriggers', 1]);
    if (hourlyJackpotWon) achievementStats.push(['hourlyJackpots', 1]);
    if (dachsCount > 0) achievementStats.push(['totalDachsSeen', dachsCount]);
    await updateAchievementStatBatch(username, achievementStats, env);

    // Max-value stats (loss streak) - only update if higher
    if (extendedData.currentLossStreak && extendedData.currentLossStreak > 0) {
      setMaxAchievementStat(username, 'maxLossStreak', extendedData.currentLossStreak, env)
        .catch(err => logError('trackSlotAchievements.maxLossStreak', err, { username }));
    }

    // Batch extended stats (D1/progression tracking, fire-and-forget)
    const statIncrements = [];
    const maxUpdates = [];

    if (isAllIn) statIncrements.push(['allInSpins', 1]);
    if (extendedData.spinCost && extendedData.spinCost >= 50) statIncrements.push(['highBetSpins', 1]);
    if (isFreeSpinUsed) statIncrements.push(['freeSpinsUsed', 1]);
    if (insuranceUsed) statIncrements.push(['insuranceTriggers', 1]);
    if (hourlyJackpotWon) statIncrements.push(['hourlyJackpots', 1]);
    if (dachsCount > 0) statIncrements.push(['totalDachsSeen', dachsCount]);
    if (extendedData.currentLossStreak && extendedData.currentLossStreak > 0) {
      maxUpdates.push(['maxLossStreak', extendedData.currentLossStreak]);
    }

    // Fire-and-forget: single atomic batch update for D1/progression
    if (statIncrements.length > 0 || maxUpdates.length > 0) {
      batchUpdateStats(username, statIncrements, maxUpdates, env)
        .catch(err => logError('trackSlotAchievements.extended', err, { username }));
    }

    // PlayDays tracking (check if player already played today, fire-and-forget)
    trackPlayDay(username, env).catch(err => logError('trackSlotAchievements.playDay', err, { username }));

    // Collect all one-time achievements to unlock
    const achievementsToUnlock = [];

    // Win-related achievements
    const isWin = result.points > 0 || (result.freeSpins && result.freeSpins > 0);
    if (isWin) {
      achievementsToUnlock.push(ACHIEVEMENTS.FIRST_WIN.id);

      if (isFreeSpinUsed) {
        achievementsToUnlock.push(ACHIEVEMENTS.FREE_SPIN_WIN.id);
      }
      if (isAllIn && result.points > 0) {
        achievementsToUnlock.push(ACHIEVEMENTS.SLOTS_ALL_WIN.id);
      }
      // Wild Card win uses displayGrid (wild card is added by applySpecialItems)
      if (hasWildCardToken && displayGrid.includes('🃏')) {
        achievementsToUnlock.push(ACHIEVEMENTS.WILD_CARD_WIN.id);
      }
      // ZERO_HERO (win with 0 balance before spin - only for actual point wins)
      if (result.points > 0 && newBalance === result.points) {
        achievementsToUnlock.push(ACHIEVEMENTS.ZERO_HERO.id);
      }
    }

    // Dachs tracking - use originalGrid (before special items may have overwritten dachs)
    if (originalGrid.includes('🦡')) {
      achievementsToUnlock.push(ACHIEVEMENTS.FIRST_DACHS.id);
      if (dachsCount === 2) {
        achievementsToUnlock.push(ACHIEVEMENTS.DACHS_PAIR.id);
      }
      // Record dachs single/double to D1 (triple is recorded via markTripleCollected)
      if (dachsCount < 3) {
        recordDachsHit(username, dachsCount, env);
      }
    }

    // Special event achievements
    if (insuranceUsed) {
      achievementsToUnlock.push(ACHIEVEMENTS.INSURANCE_SAVE.id);
    }
    if (hourlyJackpotWon) {
      achievementsToUnlock.push(ACHIEVEMENTS.HOURLY_JACKPOT.id);
    }
    if (hotStreakTriggered) {
      achievementsToUnlock.push(ACHIEVEMENTS.HOT_STREAK.id);
    }
    if (comebackTriggered) {
      achievementsToUnlock.push(ACHIEVEMENTS.COMEBACK_KING.id);
    }

    // PERFECT_TIMING (midnight UTC)
    const nowUTC = new Date();
    if (nowUTC.getUTCHours() === 0 && nowUTC.getUTCMinutes() === 0) {
      achievementsToUnlock.push(ACHIEVEMENTS.PERFECT_TIMING.id);
    }

    // Unlock all collected achievements sequentially (share same data object)
    for (const achievementId of achievementsToUnlock) {
      await checkAndUnlockAchievement(username, achievementId, env);
    }

    // These functions load their own data, run after unlocks
    if (result.points > 0) {
      await checkBigWinAchievements(username, result.points, env);
    }

    // Triple tracking - use displayGrid (what the user sees)
    if (displayGrid[0] === displayGrid[1] && displayGrid[1] === displayGrid[2] && displayGrid[0] !== '🃏') {
      await markTripleCollected(username, displayGrid[0], env);
    }

    // Balance achievements
    await checkBalanceAchievements(username, newBalance, env);
  } catch (error) {
    // Silently fail - achievements should never break the game
    logError('trackSlotAchievements', error, { username });
  }
}

/**
 * Track unique play days for playDays achievement stat
 * Uses a KV key with today's date to avoid double-counting
 */
async function trackPlayDay(username, env) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = kvKey('playDay:', `${username}:${today}`);
    const existing = await env.SLOTS_KV.get(key);
    if (!existing) {
      await env.SLOTS_KV.put(key, '1', { expirationTtl: 86400 * 2 }); // 2 day TTL
      await updateAchievementStat(username, 'playDays', 1, env);
    }
  } catch (error) {
    logError('trackPlayDay', error, { username });
  }
}

/**
 * Get custom message for special users
 * @param {string} lowerUsername - Lowercased username
 * @param {string} username - Original username
 * @param {boolean} isWin - Whether the spin was a win
 * @param {object} data - Data for template replacement
 * @returns {string|null} Custom message or null
 */
export function getCustomMessage(lowerUsername, username, isWin, data) {
  const userMessages = CUSTOM_MESSAGES[lowerUsername];
  if (!userMessages) return null;

  const template = isWin ? userMessages.win : userMessages.loss;
  if (!template) return null;

  return template
    .replace(/{username}/g, username)
    .replace(/{amount}/g, data.amount)
    .replace(/{balance}/g, data.balance)
    .replace(/{grid}/g, data.grid);
}

/**
 * Parse and validate spin cost/multiplier
 * @param {string} username - Player username
 * @param {string|null} amountParam - Amount parameter from command
 * @param {number} currentBalance - Current player balance
 * @param {boolean} isFreeSpinUsed - Whether using a free spin
 * @param {object} env - Environment bindings
 * @returns {Promise<{spinCost: number, multiplier: number}|{error: string}>}
 */
export async function parseSpinAmount(username, amountParam, currentBalance, isFreeSpinUsed, env) {
  if (isFreeSpinUsed || !amountParam) {
    return { spinCost: BASE_SPIN_COST, multiplier: 1 };
  }

  const lower = amountParam.toLowerCase();

  // "all" = bet entire balance (requires slots_all unlock)
  if (lower === 'all') {
    if (!await hasUnlock(username, 'slots_all', env)) {
      return { error: `@${username} ❌ !slots all nicht freigeschaltet! Du musst es für ${UNLOCK_PRICES.all} DachsTaler im Shop kaufen! Weitere Infos: ${URLS.UNLOCK}` };
    }
    if (currentBalance < 1) {
      return { error: `@${username} ❌ Du brauchst mindestens 1 DachsTaler für !slots all!` };
    }
    // Bet entire balance, multiplier = balance / 10 (rounded down, min 1)
    const multiplier = Math.max(1, Math.floor(currentBalance / BASE_SPIN_COST));
    return { spinCost: currentBalance, multiplier };
  }

  const customAmount = parseInt(amountParam, 10);
  if (isNaN(customAmount)) {
    return { spinCost: BASE_SPIN_COST, multiplier: 1 };
  }

  // Check if user has slots_all unlock - allows any amount from 1 to balance
  const hasCustomUnlock = await hasUnlock(username, 'slots_all', env);

  if (hasCustomUnlock) {
    // With slots_all: any amount from 1 to balance is allowed
    if (customAmount < 1) {
      return { error: `@${username} ❌ Minimum ist !slots 1!` };
    }
    if (customAmount > currentBalance) {
      return { error: `@${username} ❌ Du hast nur ${currentBalance} DachsTaler! Verfügbar: !slots 1-${currentBalance} oder !slots all` };
    }
    // Multiplier = amount / 10 (rounded down, min 1)
    const multiplier = Math.max(1, Math.floor(customAmount / BASE_SPIN_COST));
    return { spinCost: customAmount, multiplier };
  }

  // Without slots_all: only predefined amounts (10, 20, 30, 50, 100)
  if (customAmount < BASE_SPIN_COST) {
    return { error: `@${username} ❌ Minimum ist !slots ${BASE_SPIN_COST}! Verfügbar: 10, 20, 30, 50, 100 | Für freie Beträge: !slots all freischalten 💡` };
  }
  if (customAmount > 100) {
    return { error: `@${username} ❌ Maximum ist !slots 100! Für freie Beträge: !slots all freischalten 💡` };
  }
  if (customAmount === BASE_SPIN_COST) {
    return { spinCost: BASE_SPIN_COST, multiplier: 1 };
  }

  if (UNLOCK_MAP[customAmount]) {
    if (await hasUnlock(username, UNLOCK_MAP[customAmount], env)) {
      return { spinCost: customAmount, multiplier: MULTIPLIER_MAP[customAmount] };
    }
    return { error: `@${username} ❌ !slots ${customAmount} nicht freigeschaltet! Du musst es für ${UNLOCK_PRICES[customAmount]} DachsTaler im Shop kaufen! Weitere Infos: ${URLS.UNLOCK}` };
  }

  return { error: `@${username} ❌ !slots ${customAmount} existiert nicht! Verfügbar: 10, 20, 30, 50, 100 | Für freie Beträge: !slots all freischalten | Info: ${URLS.UNLOCK}` };
}

/**
 * Apply multipliers and buffs to win result (uses pre-loaded buff values)
 * @param {string} username - Player username
 * @param {object} result - Win result from calculateWin (modified in place)
 * @param {number} multiplier - Spin multiplier
 * @param {string[]} grid - Spin grid
 * @param {object} env - Environment bindings
 * @param {object} preloadedBuffs - Pre-loaded buff states
 * @returns {Promise<{shopBuffs: string[], streakMulti: number}>}
 */
export async function applyMultipliersAndBuffs(username, result, multiplier, grid, env, preloadedBuffs) {
  const { hasGoldenHour, hasProfitDoubler, currentStreakMulti } = preloadedBuffs;
  const shopBuffs = [];

  // Award Free Spins
  if (result.freeSpins && result.freeSpins > 0) {
    try {
      await addFreeSpinsWithMultiplier(username, result.freeSpins, multiplier, env);
    } catch (error) {
      logError('applyMultipliersAndBuffs.addFreeSpins', error, { username, freeSpins: result.freeSpins, multiplier });
    }
  }

  result.points = result.points * multiplier;

  // Win Multiplier (Shop Buff) - must consume, so still needs KV call
  if (result.points > 0 && await consumeWinMultiplier(username, env)) {
    result.points *= 2;
    shopBuffs.push('2x');
  }

  // Symbol Boost - only check for matching symbols (must consume, so needs KV)
  if (result.points > 0) {
    const matchingSymbols = new Set();
    if (grid[0] === grid[1]) matchingSymbols.add(grid[0]);
    if (grid[1] === grid[2]) matchingSymbols.add(grid[1]);
    if (grid[0] === grid[2]) matchingSymbols.add(grid[0]);

    if (matchingSymbols.size > 0) {
      const boostResults = await Promise.all(
        Array.from(matchingSymbols).map(symbol => consumeBoost(username, symbol, env))
      );
      if (boostResults.some(hasBoost => hasBoost)) {
        result.points *= 2;
        shopBuffs.push('2x Boost');
      }
    }
  }

  // Golden Hour, Profit Doubler & Streak Multiplier (pre-loaded)
  let streakMulti = 1.0;
  if (result.points > 0) {
    if (hasGoldenHour) {
      result.points = Math.floor(result.points * 1.3);
      shopBuffs.push('+30%');
    }
    if (hasProfitDoubler && result.points > RAGE_MODE_WIN_THRESHOLD) {
      result.points *= 2;
      shopBuffs.push('Profit x2');
    }
    if (currentStreakMulti > 1.0) {
      result.points = Math.floor(result.points * currentStreakMulti);
      streakMulti = currentStreakMulti;
    }
  }

  return { shopBuffs, streakMulti };
}

/**
 * Calculate streak bonuses (uses pre-loaded streak)
 * @param {string} lowerUsername - Lowercased username
 * @param {string} username - Original username
 * @param {boolean} isWin - Whether the spin was a win
 * @param {object} previousStreak - Previous streak state {wins, losses}
 * @param {object} env - Environment bindings
 * @returns {Promise<{streakBonus: number, comboBonus: number, naturalBonuses: string[], lossWarningMessage: string, newStreak: object}>}
 */
export async function calculateStreakBonuses(lowerUsername, username, isWin, previousStreak, env) {
  const naturalBonuses = [];
  let streakBonus = 0;
  let comboBonus = 0;
  let lossWarningMessage = '';
  let shouldResetStreak = false;

  // Hot Streak
  if (isWin && previousStreak.wins + 1 === STREAK_THRESHOLD) {
    streakBonus += HOT_STREAK_BONUS;
    naturalBonuses.push(`🔥 Hot Streak +${HOT_STREAK_BONUS}`);
    shouldResetStreak = true;
  }

  // Comeback King
  if (isWin && previousStreak.losses >= STREAK_THRESHOLD) {
    streakBonus += COMEBACK_BONUS;
    naturalBonuses.push(`👑 Comeback +${COMEBACK_BONUS}`);
    shouldResetStreak = true;
  }

  const newStreak = shouldResetStreak
    ? { wins: 0, losses: 0 }
    : { wins: isWin ? previousStreak.wins + 1 : 0, losses: isWin ? 0 : previousStreak.losses + 1 };

  // Fire-and-forget: streak state only affects next spin, not current response
  env.SLOTS_KV.put(kvKey('streak:', lowerUsername), JSON.stringify(newStreak), { expirationTtl: STREAK_TTL_SECONDS })
    .catch(err => logError('calculateStreakBonuses.streakWrite', err, { username: lowerUsername }));

  // Combo Bonus
  if (isWin && newStreak.wins >= 2 && newStreak.wins < 5) {
    comboBonus = COMBO_BONUSES[newStreak.wins] || 0;
    if (comboBonus > 0) {
      naturalBonuses.push(`🎯 Combo +${comboBonus}`);
    }
  }

  // Loss Warning
  if (!isWin && newStreak.losses >= 10) {
    if (LOSS_MESSAGES[newStreak.losses]) {
      lossWarningMessage = LOSS_MESSAGES[newStreak.losses];
    } else if (newStreak.losses > 20) {
      const index = (newStreak.losses - 21) % ROTATING_LOSS_MESSAGES.length;
      lossWarningMessage = ROTATING_LOSS_MESSAGES[index];
    }
  }

  return { streakBonus, comboBonus, naturalBonuses, lossWarningMessage, newStreak };
}
