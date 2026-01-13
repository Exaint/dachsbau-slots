/**
 * Slot Machine - Main game logic
 * Engine functions (grid, win calculation) are in ./slots/engine.js
 */

import {
  RESPONSE_HEADERS,
  MAX_BALANCE,
  COOLDOWN_SECONDS,
  BASE_SPIN_COST,
  UNLOCK_MAP,
  MULTIPLIER_MAP,
  LOSS_MESSAGES,
  ROTATING_LOSS_MESSAGES,
  COMBO_BONUSES,
  HOURLY_JACKPOT_AMOUNT,
  DACHS_BASE_CHANCE,
  DAILY_BOOST_AMOUNT,
  DAILY_AMOUNT,
  LOW_BALANCE_WARNING,
  STREAK_THRESHOLD,
  HOT_STREAK_BONUS,
  COMEBACK_BONUS,
  STREAK_TTL_SECONDS,
  INSURANCE_REFUND_RATE,
  URLS,
  RAGE_MODE_LOSS_STACK,
  RAGE_MODE_MAX_STACK,
  RAGE_MODE_WIN_THRESHOLD,
  BUFF_TTL_BUFFER_SECONDS
} from '../constants.js';
import { calculateBuffTTL } from '../utils.js';
import { CUSTOM_MESSAGES } from '../config.js';
import {
  getBalance,
  setBalance,
  getLastSpin,
  setLastSpin,
  hasAcceptedDisclaimer,
  setDisclaimerAccepted,
  isSelfBanned,
  hasGuaranteedPair,
  hasWildCard,
  getFreeSpins,
  addFreeSpinsWithMultiplier,
  consumeFreeSpinWithMultiplier,
  hasUnlock,
  isBuffActive,
  getBuffWithUses,
  getBuffWithStack,
  consumeBoost,
  consumeWinMultiplier,
  getMulliganCount,
  setMulliganCount,
  getInsuranceCount,
  setInsuranceCount,
  getStreakMultiplier,
  incrementStreakMultiplier,
  resetStreakMultiplier,
  getStreak,
  updateStats,
  getPrestigeRank,
  updateBankBalance,
  checkAndClaimHourlyJackpot,
  getLastDaily
} from '../database.js';

// Engine functions
import { generateGrid, applySpecialItems, calculateWin, buildResponseMessage } from './slots/engine.js';

// Pre-compiled regex patterns
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u034F\u061C\u180E\u0000-\u001F\u007F-\u009F]+/g;
const NORMALIZE_SPACES_REGEX = /\s+/g;

// Unlock prices for error messages
const UNLOCK_PRICES = { 20: 500, 30: 2000, 50: 2500, 100: 3250, all: 4444 };

// Helper: Get custom message for special users
function getCustomMessage(lowerUsername, username, isWin, data) {
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

// Helper: Parse and validate spin cost/multiplier
async function parseSpinAmount(username, amountParam, currentBalance, isFreeSpinUsed, env) {
  if (isFreeSpinUsed || !amountParam) {
    return { spinCost: BASE_SPIN_COST, multiplier: 1 };
  }

  const lower = amountParam.toLowerCase();

  if (lower === 'all') {
    if (!await hasUnlock(username, 'slots_all', env)) {
      return { error: `@${username} ❌ !slots all nicht freigeschaltet! Du musst es für ${UNLOCK_PRICES.all} DachsTaler im Shop kaufen! Weitere Infos: ${URLS.UNLOCK}` };
    }
    if (currentBalance < BASE_SPIN_COST) {
      return { error: `@${username} ❌ Du brauchst mindestens ${BASE_SPIN_COST} DachsTaler für !slots all!` };
    }
    const multiplier = Math.floor(currentBalance / BASE_SPIN_COST);
    return { spinCost: multiplier * BASE_SPIN_COST, multiplier };
  }

  const customAmount = parseInt(amountParam, 10);
  if (isNaN(customAmount)) {
    return { spinCost: BASE_SPIN_COST, multiplier: 1 };
  }

  if (customAmount < BASE_SPIN_COST) {
    return { error: `@${username} ❌ Minimum ist !slots ${BASE_SPIN_COST}! Verfügbar: 10, 20, 30, 50, 100, all 💡` };
  }
  if (customAmount > 100) {
    return { error: `@${username} ❌ Maximum ist !slots 100! Verfügbar: 10, 20, 30, 50, 100, all 💡` };
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

  return { error: `@${username} ❌ !slots ${customAmount} existiert nicht! Verfügbar: 10, 20, 30, 50, 100, all | Info: ${URLS.UNLOCK}` };
}

// Helper: Apply multipliers and buffs to win result
async function applyMultipliersAndBuffs(username, result, multiplier, grid, env) {
  const shopBuffs = [];

  // Award Free Spins
  if (result.freeSpins && result.freeSpins > 0) {
    try {
      await addFreeSpinsWithMultiplier(username, result.freeSpins, multiplier, env);
    } catch (error) {
      console.error('Add Free Spins Error:', error);
    }
  }

  result.points = result.points * multiplier;

  // Win Multiplier (Shop Buff)
  if (result.points > 0 && await consumeWinMultiplier(username, env)) {
    result.points *= 2;
    shopBuffs.push('2x');
  }

  // Symbol Boost - only check for matching symbols
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

  // Golden Hour, Profit Doubler & Streak Multiplier
  let streakMulti = 1.0;
  if (result.points > 0) {
    const [hasGoldenHour, hasProfitDoubler, currentStreakMulti] = await Promise.all([
      isBuffActive(username, 'golden_hour', env),
      isBuffActive(username, 'profit_doubler', env),
      getStreakMultiplier(username, env)
    ]);

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

// Helper: Calculate streak bonuses
async function calculateStreakBonuses(lowerUsername, username, isWin, env) {
  const previousStreak = await getStreak(username, env);
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

  await env.SLOTS_KV.put(`streak:${lowerUsername}`, JSON.stringify(newStreak), { expirationTtl: STREAK_TTL_SECONDS });

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

// Main slot handler
async function handleSlot(username, amountParam, url, env) {
  try {
    const lowerUsername = username.toLowerCase();

    // Sanitize input
    if (amountParam) {
      amountParam = amountParam
        .replace(INVISIBLE_CHARS_REGEX, '')
        .replace(NORMALIZE_SPACES_REGEX, ' ')
        .trim();
    }

    const now = Date.now();

    // Initial parallel checks
    const [selfBanData, hasAccepted, lastSpin, currentBalance, hasGuaranteedPairToken, hasWildCardToken] = await Promise.all([
      isSelfBanned(username, env),
      hasAcceptedDisclaimer(username, env),
      getLastSpin(username, env),
      getBalance(username, env),
      hasGuaranteedPair(username, env),
      hasWildCard(username, env)
    ]);

    // Selfban Check
    if (selfBanData) {
      return new Response(`@${username} 🚫 Du hast dich selbst vom Spielen ausgeschlossen (seit ${selfBanData.date}). Kontaktiere einen Admin für eine Freischaltung. Hilfe: ${URLS.INFO}`, { headers: RESPONSE_HEADERS });
    }

    // First-Time Disclaimer
    if (!hasAccepted) {
      await setDisclaimerAccepted(username, env);
      return new Response(`@${username} 🦡 Willkommen! Dachsbau Slots ist nur zur Unterhaltung - kein Echtgeld! Verstanden? Schreib nochmal !slots zum Spielen! Weitere Infos: ${URLS.INFO} | Shop: ${URLS.SHOP} 🎰`, { headers: RESPONSE_HEADERS });
    }

    // Cooldown Check
    const cooldownMs = COOLDOWN_SECONDS * 1000;
    if (lastSpin && (now - lastSpin) < cooldownMs) {
      const remainingSec = Math.ceil((cooldownMs - (now - lastSpin)) / 1000);
      return new Response(`@${username} ⏱️ Cooldown: Noch ${remainingSec} Sekunden!     `, { headers: RESPONSE_HEADERS });
    }

    // Free Spins
    let isFreeSpinUsed = false;
    let freeSpinMultiplier = 1;
    try {
      const freeSpinResult = await consumeFreeSpinWithMultiplier(username, env);
      if (freeSpinResult && typeof freeSpinResult === 'object') {
        isFreeSpinUsed = freeSpinResult.used === true;
        freeSpinMultiplier = (typeof freeSpinResult.multiplier === 'number' && freeSpinResult.multiplier > 0) ? freeSpinResult.multiplier : 1;
      }
    } catch (freeSpinError) {
      console.error('Free Spin Consumption Error:', freeSpinError);
    }

    // Parse spin amount
    const spinAmountResult = await parseSpinAmount(username, amountParam, currentBalance, isFreeSpinUsed, env);
    if (spinAmountResult.error) {
      return new Response(spinAmountResult.error, { headers: RESPONSE_HEADERS });
    }

    let spinCost = isFreeSpinUsed ? 0 : (spinAmountResult.spinCost || BASE_SPIN_COST);
    let multiplier = isFreeSpinUsed ? freeSpinMultiplier : (spinAmountResult.multiplier || 1);

    // Happy Hour check
    if (!isFreeSpinUsed && spinCost < 1000) {
      const hasHappyHour = await isBuffActive(username, 'happy_hour', env);
      if (hasHappyHour) {
        spinCost = Math.floor(spinCost / 2);
      }
    }

    // Balance check
    if (!isFreeSpinUsed && currentBalance < spinCost) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! Du brauchst ${spinCost} (Aktuell: ${currentBalance}) 🦡`, { headers: RESPONSE_HEADERS });
    }

    // Load buffs
    let hasStarMagnet, hasDiamondRush, hasLuckyCharm, hasDachsLocator, hasRageMode;

    if (isFreeSpinUsed) {
      [hasStarMagnet, hasDiamondRush] = await Promise.all([
        isBuffActive(username, 'star_magnet', env),
        isBuffActive(username, 'diamond_rush', env)
      ]);
      hasLuckyCharm = false;
      hasDachsLocator = { active: false, uses: 0 };
      hasRageMode = { active: false, stack: 0 };
    } else {
      [hasStarMagnet, hasDiamondRush, hasLuckyCharm, hasDachsLocator, hasRageMode] = await Promise.all([
        isBuffActive(username, 'star_magnet', env),
        isBuffActive(username, 'diamond_rush', env),
        isBuffActive(username, 'lucky_charm', env),
        getBuffWithUses(username, 'dachs_locator', env),
        getBuffWithStack(username, 'rage_mode', env)
      ]);
    }

    // Calculate Dachs chance
    let dachsChance = DACHS_BASE_CHANCE;
    if (hasLuckyCharm) dachsChance *= 2;
    if (hasDachsLocator.active) dachsChance *= 3;
    if (hasRageMode.active && hasRageMode.stack > 0) {
      dachsChance *= (1 + hasRageMode.stack / 100);
    }

    // Generate grid
    const grid = await generateGrid(lowerUsername, dachsChance, hasStarMagnet, hasDiamondRush, env);

    // Decrement Dachs Locator uses
    if (hasDachsLocator.active && hasDachsLocator.data) {
      const data = hasDachsLocator.data;
      data.uses--;
      if (data.uses <= 0) {
        await env.SLOTS_KV.delete(`buff:${lowerUsername}:dachs_locator`);
      } else {
        await env.SLOTS_KV.put(`buff:${lowerUsername}:dachs_locator`, JSON.stringify(data), { expirationTtl: calculateBuffTTL(data.expireAt) });
      }
    }

    // Apply special items
    await applySpecialItems(username, grid, hasGuaranteedPairToken, hasWildCardToken, env);

    // Calculate win
    let result = calculateWin(grid);

    // Hourly Jackpot
    let hourlyJackpotWon = false;
    if (await checkAndClaimHourlyJackpot(env)) {
      result.points += HOURLY_JACKPOT_AMOUNT;
      hourlyJackpotWon = true;
    }

    // Apply buffs
    const { shopBuffs, streakMulti } = await applyMultipliersAndBuffs(username, result, multiplier, grid, env);

    // Calculate streak bonuses
    const isWin = result.points > 0 || (result.freeSpins && result.freeSpins > 0);
    const streakBonusResult = await calculateStreakBonuses(lowerUsername, username, isWin, env);
    const { streakBonus, comboBonus, naturalBonuses } = streakBonusResult;
    let lossWarningMessage = streakBonusResult.lossWarningMessage;

    // Rage Mode updates
    if (!isWin && hasRageMode.active && hasRageMode.data) {
      const data = hasRageMode.data;
      data.stack = Math.min((data.stack || 0) + RAGE_MODE_LOSS_STACK, RAGE_MODE_MAX_STACK);
      await Promise.all([
        env.SLOTS_KV.put(`buff:${lowerUsername}:rage_mode`, JSON.stringify(data), { expirationTtl: calculateBuffTTL(data.expireAt) }),
        resetStreakMultiplier(username, env)
      ]);
    } else if (isWin && hasRageMode.active && hasRageMode.data) {
      const data = hasRageMode.data;
      data.stack = 0;
      await Promise.all([
        env.SLOTS_KV.put(`buff:${lowerUsername}:rage_mode`, JSON.stringify(data), { expirationTtl: calculateBuffTTL(data.expireAt) }),
        incrementStreakMultiplier(username, env)
      ]);
    } else if (isWin) {
      await incrementStreakMultiplier(username, env);
    } else {
      await resetStreakMultiplier(username, env);
    }

    // Mulligan/Insurance
    if (!isFreeSpinUsed && result.points === 0 && !result.freeSpins) {
      const [mulliganCount, insuranceCount] = await Promise.all([
        getMulliganCount(username, env),
        getInsuranceCount(username, env)
      ]);

      if (mulliganCount > 0) {
        await setMulliganCount(username, mulliganCount - 1, env);
        return new Response(`@${username} 🔄 Mulligan! Du hast noch ${mulliganCount - 1} Re-Spins. Spin nochmal!`, { headers: RESPONSE_HEADERS });
      }

      if (insuranceCount > 0) {
        const refund = Math.floor(spinCost * INSURANCE_REFUND_RATE);
        const newBalanceWithRefund = Math.max(0, Math.min(currentBalance - spinCost + refund, MAX_BALANCE));

        const [, , , rank] = await Promise.all([
          setBalance(username, newBalanceWithRefund, env),
          updateStats(username, false, result.points, spinCost, env),
          setInsuranceCount(username, insuranceCount - 1, env),
          getPrestigeRank(username, env)
        ]);
        const rankSymbol = rank ? `${rank} ` : '';

        return new Response(`@${username} ${rankSymbol}[ ${grid.join(' ')} ] ${result.message} 🛡️ ║ Insurance +${refund} (${insuranceCount - 1} übrig) ║ Kontostand: ${newBalanceWithRefund} DachsTaler`, { headers: RESPONSE_HEADERS });
      }
    }

    // Final balance calculation
    const totalBonuses = streakBonus + comboBonus;
    const newBalance = Math.max(0, Math.min(currentBalance - spinCost + result.points + totalBonuses, MAX_BALANCE));

    // Final updates
    const finalUpdates = [
      setBalance(username, newBalance, env),
      updateStats(username, result.points > 0, result.points, spinCost, env),
      setLastSpin(username, now, env),
      getPrestigeRank(username, env),
      getFreeSpins(username, env)
    ];

    if (!isFreeSpinUsed) {
      finalUpdates.push(updateBankBalance(spinCost - (result.points + totalBonuses), env));
    }

    const results = await Promise.all(finalUpdates);
    const rank = results[3];
    const remainingFreeSpins = results[4];

    let remainingCount = 0;
    try {
      if (Array.isArray(remainingFreeSpins)) {
        remainingCount = remainingFreeSpins.reduce((sum, fs) => sum + (fs.count || 0), 0);
      }
    } catch (error) {
      console.error('Get Remaining Free Spins Error:', error);
    }

    // Low Balance Warning
    if (newBalance < LOW_BALANCE_WARNING) {
      try {
        const [lastDaily, hasBoost] = await Promise.all([
          getLastDaily(username, env),
          hasUnlock(username, 'daily_boost', env)
        ]);

        const nowDate = new Date(now);
        const todayUTC = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());

        let dailyAvailable = !lastDaily;
        if (lastDaily) {
          const lastDailyDate = new Date(lastDaily);
          const lastDailyUTC = Date.UTC(lastDailyDate.getUTCFullYear(), lastDailyDate.getUTCMonth(), lastDailyDate.getUTCDate());
          dailyAvailable = todayUTC !== lastDailyUTC;
        }

        if (dailyAvailable) {
          const dailyAmountValue = hasBoost ? DAILY_BOOST_AMOUNT : DAILY_AMOUNT;
          lossWarningMessage = lossWarningMessage
            ? `${lossWarningMessage} ⚠️ Niedriger Kontostand! Nutze !slots daily für +${dailyAmountValue} DachsTaler`
            : `⚠️ Niedriger Kontostand! Nutze !slots daily für +${dailyAmountValue} DachsTaler`;
        }
      } catch (error) {
        console.error('Low Balance Warning Check Error:', error);
      }
    }

    // Custom Message Check
    const isCustomWin = result.points > 0 || totalBonuses > 0;
    const totalWinAmount = (result.points || 0) + totalBonuses;
    const customMsg = getCustomMessage(lowerUsername, username, isCustomWin, {
      amount: isCustomWin ? totalWinAmount : spinCost,
      balance: newBalance,
      grid: grid.join(' ')
    });

    if (customMsg) {
      return new Response(`@${username} [ ${grid.join(' ')} ] ${customMsg} ║ Kontostand: ${newBalance} DachsTaler`, { headers: RESPONSE_HEADERS });
    }

    // Build response
    const totalWin = result.points + totalBonuses;
    const message = buildResponseMessage(username, grid, result, totalWin, newBalance, rank, isFreeSpinUsed, multiplier, remainingCount, hourlyJackpotWon, naturalBonuses, shopBuffs, streakMulti, lossWarningMessage);
    return new Response(message, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleSlot Error:', error);
    return new Response(`@${username} ❌ Fehler beim Spin.`, { headers: RESPONSE_HEADERS });
  }
}

export { handleSlot, calculateWin };
