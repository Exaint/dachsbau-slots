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
import { logError, logInfo, kvKey } from '../../utils.js';
import { D1_ENABLED, DUAL_WRITE, updateStreakCounts } from '../../database/d1.js';
import {
  hasUnlock,
  consumeWinMultiplier,
  consumeBoost,
  updateAchievementStatBatch,
  markTripleCollected,
  recordDachsHit,
  checkAndUnlockAchievement,
  checkBalanceAchievements,
  checkBigWinAchievements,
  addFreeSpinsWithMultiplier,
  updatePlayerStat,
  updatePlayerStatBatch
} from '../../database.js';
import type { Env, WinResult, SpinAmountResult, StreakBonusResult, StreakData, PreloadedBuffs } from '../../types/index.js';
import type { PlayerStats } from '../../database/progression.js';

// Unlock prices for error messages
const UNLOCK_PRICES: Record<number | string, number> = { 20: 500, 30: 2000, 50: 2500, 100: 3250, all: 4444 };

/**
 * Get list of amounts the user has unlocked (for dynamic error messages)
 * Only called on error paths, so extra KV reads are acceptable
 */
async function getAvailableAmountsText(username: string, env: Env): Promise<string> {
  const parts: string[] = ['!slots', '!slots 10']; // always available
  const unlockAmounts = [20, 30, 50, 100] as const;
  const checks = await Promise.all(
    unlockAmounts.map(a => hasUnlock(username, UNLOCK_MAP[a], env))
  );
  for (let i = 0; i < unlockAmounts.length; i++) {
    if (checks[i]) parts.push(`!slots ${unlockAmounts[i]}`);
  }
  return parts.join(', ');
}

// ============================================
// Types
// ============================================

/** Extended tracking data for achievements */
interface ExtendedData {
  spinCost?: number;
  currentLossStreak?: number;
}

/** Result from applyMultipliersAndBuffs */
interface MultiplierResult {
  shopBuffs: string[];
  streakMulti: number;
}

// ============================================
// Achievement Tracking
// ============================================

/**
 * Achievement tracking (called via ctx.waitUntil, runs after response is sent)
 * IMPORTANT: All operations must be awaited to ensure completion before Worker terminates
 */
export async function trackSlotAchievements(
  username: string,
  originalGrid: string[],
  displayGrid: string[],
  result: WinResult,
  newBalance: number,
  isFreeSpinUsed: boolean,
  isAllIn: boolean,
  hasWildCardToken: boolean,
  insuranceUsed: boolean,
  hourlyJackpotWon: boolean,
  hotStreakTriggered: boolean,
  comebackTriggered: boolean,
  env: Env,
  extendedData: ExtendedData = {}
): Promise<void> {
  try {
    // Core stats: achievement-blob only (stats-KV already handled by updateStats() in slots.ts)
    const dachsCount = originalGrid.filter(s => s === '🦡').length;
    const coreStats: [string, number][] = [['totalSpins', 1]];
    const isStatWin = result.points > 0 || (result.freeSpins && result.freeSpins > 0);
    if (isStatWin) {
      coreStats.push(['wins', 1]);
    } else {
      coreStats.push(['losses', 1]);
    }
    await updateAchievementStatBatch(username, coreStats, env);

    // Extended stats: unified (achievement-blob + stats-KV + D1)
    const extendedStats: [keyof PlayerStats, number][] = [];
    if (isFreeSpinUsed) extendedStats.push(['freeSpinsUsed', 1]);
    if (insuranceUsed) extendedStats.push(['insuranceTriggers', 1]);
    if (hourlyJackpotWon) extendedStats.push(['hourlyJackpots', 1]);
    if (dachsCount > 0) extendedStats.push(['totalDachsSeen', dachsCount]);
    if (isAllIn) extendedStats.push(['allInSpins', 1]);
    if (extendedData.spinCost && extendedData.spinCost >= 50) extendedStats.push(['highBetSpins', 1]);

    const maxUpdates: [keyof PlayerStats, number][] = [];
    if (extendedData.currentLossStreak && extendedData.currentLossStreak > 0) {
      maxUpdates.push(['maxLossStreak', extendedData.currentLossStreak]);
    }

    if (extendedStats.length > 0 || maxUpdates.length > 0) {
      await updatePlayerStatBatch(username, extendedStats, maxUpdates.length > 0 ? maxUpdates : null, env);
    }

    // PlayDays tracking (check if player already played today)
    await trackPlayDay(username, env);

    // Collect all one-time achievements to unlock
    const achievementsToUnlock: string[] = [];

    // First spin achievement (not in stat mapping, must be explicitly unlocked)
    achievementsToUnlock.push(ACHIEVEMENTS.FIRST_SPIN.id);

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
    // Defensive check: ensure displayGrid has exactly 3 elements
    if (displayGrid && displayGrid.length === 3 &&
        displayGrid[0] === displayGrid[1] && displayGrid[1] === displayGrid[2] && displayGrid[0] !== '🃏') {
      const tripleSymbol = displayGrid[0];
      try {
        const unlockedAchievements = await markTripleCollected(username, tripleSymbol, env);
        if (unlockedAchievements.length > 0) {
          logInfo('trackSlotAchievements', 'Triple achievement unlocked', { username, tripleSymbol, unlocked: unlockedAchievements.map(a => a.achievement.id) });
        }
      } catch (tripleError) {
        logError('trackSlotAchievements.triple', tripleError, { username, tripleSymbol });
      }
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
async function trackPlayDay(username: string, env: Env): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = kvKey('playDay:', `${username}:${today}`);
    const existing = await env.SLOTS_KV.get(key);
    if (!existing) {
      await env.SLOTS_KV.put(key, '1', { expirationTtl: 86400 * 2 }); // 2 day TTL
      await updatePlayerStat(username, 'playDays', 1, env);
    }
  } catch (error) {
    logError('trackPlayDay', error, { username });
  }
}

// ============================================
// Spin Parsing
// ============================================

/**
 * Parse and validate spin cost/multiplier
 */
export async function parseSpinAmount(
  username: string,
  amountParam: string | null,
  currentBalance: number,
  isFreeSpinUsed: boolean,
  env: Env
): Promise<SpinAmountResult> {
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
    const available = await getAvailableAmountsText(username, env);
    return { error: `@${username} ❌ Minimum ist !slots ${BASE_SPIN_COST}! Du kannst verwenden: ${available} | Weitere Unlocks im Shop: ${URLS.UNLOCK}` };
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

  const available = await getAvailableAmountsText(username, env);
  return { error: `@${username} ❌ Du kannst !slots ${customAmount} noch nicht verwenden. Um freie Einsätze zu nutzen, kaufe !slots all für ${UNLOCK_PRICES.all} DT im Shop. Du kannst verwenden: ${available} | Weitere Unlocks im Shop: ${URLS.UNLOCK}` };
}

// ============================================
// Multipliers and Buffs
// ============================================

/**
 * Apply multipliers and buffs to win result (uses pre-loaded buff values)
 */
export async function applyMultipliersAndBuffs(
  username: string,
  result: WinResult,
  multiplier: number,
  grid: string[],
  env: Env,
  preloadedBuffs: PreloadedBuffs
): Promise<MultiplierResult> {
  const { hasGoldenHour, hasProfitDoubler, hasJackpotBooster, currentStreakMulti } = preloadedBuffs;
  const shopBuffs: string[] = [];

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
    const matchingSymbols = new Set<string>();
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

  // Golden Hour, Jackpot Booster, Profit Doubler & Streak Multiplier (pre-loaded)
  let streakMulti = 1.0;
  if (result.points > 0) {
    // Jackpot Booster: +25% on triples
    const isTriple = grid[0] === grid[1] && grid[1] === grid[2];
    if (hasJackpotBooster && isTriple) {
      result.points = Math.floor(result.points * 1.25);
      shopBuffs.push('+25% Triple');
    }
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

// ============================================
// Streak Bonuses
// ============================================

/**
 * Calculate streak bonuses (uses pre-loaded streak)
 */
export async function calculateStreakBonuses(
  lowerUsername: string,
  _username: string,
  isWin: boolean,
  previousStreak: StreakData,
  env: Env
): Promise<StreakBonusResult> {
  const naturalBonuses: string[] = [];
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

  const newStreak: StreakData = shouldResetStreak
    ? { wins: 0, losses: 0 }
    : { wins: isWin ? previousStreak.wins + 1 : 0, losses: isWin ? 0 : previousStreak.losses + 1 };

  // Fire-and-forget: streak state only affects next spin, not current response
  env.SLOTS_KV.put(kvKey('streak:', lowerUsername), JSON.stringify(newStreak), { expirationTtl: STREAK_TTL_SECONDS })
    .catch(err => logError('calculateStreakBonuses.streakWrite', err, { username: lowerUsername }));

  if (D1_ENABLED && DUAL_WRITE && env.DB) {
    updateStreakCounts(lowerUsername, newStreak.wins, newStreak.losses, env)
      .catch(err => logError('calculateStreakBonuses.d1', err, { username: lowerUsername }));
  }

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
