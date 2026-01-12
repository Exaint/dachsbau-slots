import {
  RESPONSE_HEADERS,
  MAX_BALANCE,
  COOLDOWN_SECONDS,
  BASE_SPIN_COST,
  UNLOCK_MAP,
  MULTIPLIER_MAP,
  DEBUG_MODE,
  LOSS_MESSAGES,
  ROTATING_LOSS_MESSAGES,
  COMBO_BONUSES,
  HOURLY_JACKPOT_AMOUNT,
  TRIPLE_PAYOUTS,
  PAIR_PAYOUTS,
  DACHS_BASE_CHANCE,
  DAILY_BOOST_AMOUNT,
  DAILY_AMOUNT,
  LOW_BALANCE_WARNING,
  STREAK_THRESHOLD,
  HOT_STREAK_BONUS,
  COMEBACK_BONUS,
  STREAK_TTL_SECONDS,
  DACHS_TRIPLE_PAYOUT,
  DACHS_PAIR_PAYOUT,
  DACHS_SINGLE_PAYOUT,
  INSURANCE_REFUND_RATE,
  GRID_SIZE,
  GRID_WIDTH,
  MIDDLE_ROW_START,
  MIDDLE_ROW_END,
  DEBUG_DACHS_PAIR_CHANCE,
  BUFF_REROLL_CHANCE,
  SYMBOL_BOOST_CHANCE,
  URLS,
  GUARANTEED_PAIR_SYMBOLS,
  SPIN_LOSS_MESSAGES,
  RAGE_MODE_LOSS_STACK,
  RAGE_MODE_MAX_STACK,
  RAGE_MODE_WIN_THRESHOLD,
  BUFF_TTL_BUFFER_SECONDS
} from '../constants.js';
import { getWeightedSymbol, secureRandom, secureRandomInt, calculateBuffTTL } from '../utils.js';
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
  consumeGuaranteedPair,
  hasWildCard,
  consumeWildCard,
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

// OPTIMIZED: Pre-compiled regex patterns (avoid recompilation per request)
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u034F\u061C\u180E\u0000-\u001F\u007F-\u009F]+/g;
const NORMALIZE_SPACES_REGEX = /\s+/g;

// Unlock prices for error messages (from SHOP_ITEMS)
const UNLOCK_PRICES = {
  20: 500,
  30: 2000,
  50: 2500,
  100: 3250,
  all: 4444
};

// Helper: Generiert Custom Message falls vorhanden
function getCustomMessage(username, isWin, data) {
  const userMessages = CUSTOM_MESSAGES[username.toLowerCase()];
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
  let spinCost = BASE_SPIN_COST;
  let multiplier = 1;

  if (isFreeSpinUsed || !amountParam) {
    return { spinCost, multiplier };
  }

  const lower = amountParam.toLowerCase();

  if (lower === 'all') {
    if (!await hasUnlock(username, 'slots_all', env)) {
      return { error: `@${username} ❌ !slots all nicht freigeschaltet! Du musst es für ${UNLOCK_PRICES.all} DachsTaler im Shop kaufen! Weitere Infos: ${URLS.UNLOCK}` };
    }
    if (currentBalance < BASE_SPIN_COST) {
      return { error: `@${username} ❌ Du brauchst mindestens ${BASE_SPIN_COST} DachsTaler für !slots all!` };
    }
    // Round down to nearest multiple of BASE_SPIN_COST to avoid wasting DT
    const multiplier = Math.floor(currentBalance / BASE_SPIN_COST);
    const spinCost = multiplier * BASE_SPIN_COST;
    return { spinCost, multiplier };
  }

  const customAmount = parseInt(amountParam, 10);
  if (isNaN(customAmount)) {
    return { spinCost, multiplier };
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

// Helper: Generate spin grid
async function generateGrid(username, dachsChance, hasStarMagnet, hasDiamondRush, env) {
  // Check if user has a stored peek grid
  const peekKey = `peek:${username.toLowerCase()}`;
  const storedPeek = await env.SLOTS_KV.get(peekKey);

  if (storedPeek) {
    await env.SLOTS_KV.delete(peekKey);
    return JSON.parse(storedPeek);
  }

  const grid = [];

  // DEBUG MODE: Special user gets higher chance for exactly 2 dachs
  if (DEBUG_MODE && username.toLowerCase() === 'exaint_') {
    const roll = secureRandom();
    if (roll < DEBUG_DACHS_PAIR_CHANCE) {
      const dachsPair = secureRandom() < 0.5 ? [MIDDLE_ROW_START, MIDDLE_ROW_START + 1] : [MIDDLE_ROW_START + 1, MIDDLE_ROW_END];

      for (let i = MIDDLE_ROW_START; i <= MIDDLE_ROW_END; i++) {
        grid[i] = dachsPair.includes(i) ? '🦡' : getWeightedSymbol();
      }

      for (let i = 0; i < GRID_WIDTH; i++) {
        grid[i] = getWeightedSymbol();
        grid[i + GRID_WIDTH * 2] = getWeightedSymbol();
      }
      return grid;
    }
  }

  // Normal generation
  for (let i = 0; i < GRID_SIZE; i++) {
    if (secureRandom() < dachsChance) {
      grid.push('🦡');
    } else {
      let symbol = getWeightedSymbol();
      if (hasStarMagnet && secureRandom() < BUFF_REROLL_CHANCE) {
        const starRoll = secureRandom();
        if (starRoll < SYMBOL_BOOST_CHANCE) symbol = '⭐';
      }
      if (hasDiamondRush && symbol !== '💎' && secureRandom() < BUFF_REROLL_CHANCE) {
        const diamondRoll = secureRandom();
        if (diamondRoll < SYMBOL_BOOST_CHANCE) symbol = '💎';
      }
      grid.push(symbol);
    }
  }

  return grid;
}

// Helper: Apply special items to grid
async function applySpecialItems(username, grid, hasGuaranteedPairToken, hasWildCardToken, env) {
  if (hasGuaranteedPairToken) {
    const middle = [grid[MIDDLE_ROW_START], grid[MIDDLE_ROW_START + 1], grid[MIDDLE_ROW_END]];
    const hasPair = (middle[0] === middle[1]) || (middle[1] === middle[2]) || (middle[0] === middle[2]);

    if (!hasPair) {
      // OPTIMIZED: Use static constant instead of recreating array
      const pairSymbol = GUARANTEED_PAIR_SYMBOLS[secureRandomInt(0, GUARANTEED_PAIR_SYMBOLS.length - 1)];
      grid[MIDDLE_ROW_START] = pairSymbol;
      grid[MIDDLE_ROW_START + 1] = pairSymbol;
    }
    await consumeGuaranteedPair(username, env);
  }

  if (hasWildCardToken) {
    const wildPos = secureRandomInt(0, GRID_WIDTH - 1) + MIDDLE_ROW_START;
    grid[wildPos] = '🃏';
    await consumeWildCard(username, env);
  }
}

// Helper: Apply multipliers and buffs to win result
// Returns shopBuffs array for D2 message format
async function applyMultipliersAndBuffs(username, result, multiplier, grid, env) {
  const shopBuffs = []; // Track shop buffs separately for message

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

  // Symbol Boost (Shop Buff)
  const middle = [grid[MIDDLE_ROW_START], grid[MIDDLE_ROW_START + 1], grid[MIDDLE_ROW_END]];
  if (result.points > 0) {
    const uniqueMiddleSymbols = [...new Set(middle)];
    const boostChecks = await Promise.all(
      uniqueMiddleSymbols.map(symbol =>
        consumeBoost(username, symbol, env).then(hasBoost => ({ symbol, hasBoost }))
      )
    );

    for (const { symbol, hasBoost } of boostChecks) {
      if (hasBoost) {
        const hasMatch = (middle[0] === symbol && middle[1] === symbol) ||
          (middle[1] === symbol && middle[2] === symbol) ||
          (middle[0] === symbol && middle[2] === symbol) ||
          (middle[0] === symbol && middle[1] === symbol && middle[2] === symbol);

        if (hasMatch) {
          result.points *= 2;
          shopBuffs.push('2x Boost');
          break;
        }
      }
    }
  }

  // OPTIMIZED: Golden Hour, Profit Doubler & Streak Multiplier in parallel
  let streakMulti = 1.0;
  if (result.points > 0) {
    const [hasGoldenHour, hasProfitDoubler, currentStreakMulti] = await Promise.all([
      isBuffActive(username, 'golden_hour', env),
      isBuffActive(username, 'profit_doubler', env),
      getStreakMultiplier(username, env)
    ]);

    // Golden Hour (Shop Buff)
    if (hasGoldenHour) {
      result.points = Math.floor(result.points * 1.3);
      shopBuffs.push('+30%');
    }

    // Profit Doubler (Shop Buff)
    if (hasProfitDoubler && result.points > RAGE_MODE_WIN_THRESHOLD) {
      result.points *= 2;
      shopBuffs.push('Profit x2');
    }

    // Streak Multiplier (Natural bonus - tracked separately)
    if (currentStreakMulti > 1.0) {
      result.points = Math.floor(result.points * currentStreakMulti);
      streakMulti = currentStreakMulti;
    }
  }

  return { shopBuffs, streakMulti };
}

// Helper: Calculate streak bonuses
// Returns natural bonuses in D2 format
async function calculateStreakBonuses(username, isWin, env) {
  const previousStreak = await getStreak(username, env);

  const naturalBonuses = []; // Track natural bonuses for D2 format
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

  // Comeback King (can stack with Hot Streak if both conditions are met)
  if (isWin && previousStreak.losses >= STREAK_THRESHOLD) {
    streakBonus += COMEBACK_BONUS;
    naturalBonuses.push(`👑 Comeback +${COMEBACK_BONUS}`);
    shouldResetStreak = true;
  }

  // OPTIMIZED: Calculate final streak state and write only ONCE
  const newStreak = shouldResetStreak
    ? { wins: 0, losses: 0 }
    : { wins: isWin ? previousStreak.wins + 1 : 0, losses: isWin ? 0 : previousStreak.losses + 1 };

  await env.SLOTS_KV.put(`streak:${username.toLowerCase()}`, JSON.stringify(newStreak), { expirationTtl: STREAK_TTL_SECONDS });

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

// Helper: Build response message (D2 format)
// Format: [ Grid ] Result! +X DT 💰 ║ Natural Bonuses ║ 🛒 Shop Buffs ║ Kontostand: X DT
function buildResponseMessage(username, grid, result, totalWin, newBalance, rank, isFreeSpinUsed, multiplier, remainingCount, hourlyJackpotWon, naturalBonuses, shopBuffs, streakMulti, lossWarningMessage) {
  const rankSymbol = rank ? `${rank} ` : '';
  const freeSpinPrefix = isFreeSpinUsed ? `FREE SPIN (${multiplier * 10} DT)${remainingCount > 0 ? ` (${remainingCount} übrig)` : ''} ` : '';
  const middleRow = [grid[MIDDLE_ROW_START], grid[MIDDLE_ROW_START + 1], grid[MIDDLE_ROW_END]].join(' ');

  const messageParts = [`@${username}`, rankSymbol, freeSpinPrefix, `[ ${middleRow} ]`];

  // Free Spins won
  if (result.freeSpins && result.freeSpins > 0) {
    messageParts.push(result.message);
  }
  // Win
  else if (totalWin > 0) {
    messageParts.push(`${result.message} +${totalWin} DT 💰`);

    // Hourly Jackpot (special natural bonus)
    if (hourlyJackpotWon) {
      naturalBonuses.unshift(`⏰ Jackpot +${HOURLY_JACKPOT_AMOUNT}`);
    }

    // Streak Multiplier (natural bonus)
    if (streakMulti > 1.0) {
      naturalBonuses.push(`🔥 ${streakMulti.toFixed(1)}x Streak`);
    }

    // Natural bonuses section
    if (naturalBonuses.length > 0) {
      messageParts.push(`║ ${naturalBonuses.join(' • ')}`);
    }

    // Shop buffs section
    if (shopBuffs.length > 0) {
      messageParts.push(`║ 🛒 ${shopBuffs.join(', ')}`);
    }
  }
  // Loss
  else {
    messageParts.push(`${result.message} 💸`);
  }

  messageParts.push(`║ Kontostand: ${newBalance} DT`);

  if (lossWarningMessage) {
    messageParts.push(lossWarningMessage);
  }

  return messageParts.filter(p => p).join(' ');
}

async function handleSlot(username, amountParam, url, env) {
  try {

    // OPTIMIZED: Sanitize amountParam with pre-compiled regex patterns
    if (amountParam) {
      amountParam = amountParam
        .replace(INVISIBLE_CHARS_REGEX, '') // All invisible/control chars
        .replace(NORMALIZE_SPACES_REGEX, ' ') // Normalize spaces
        .trim();
    }

    // OPTIMIZED: Combined parallel KV reads for initial checks (saves ~300-400ms)
    const now = Date.now();
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

    // First-Time Disclaimer Check
    if (!hasAccepted) {
      await setDisclaimerAccepted(username, env);
      return new Response(`@${username} 🦡 Willkommen! Dachsbau Slots ist nur zur Unterhaltung - kein Echtgeld! Verstanden? Schreib nochmal !slots zum Spielen! Weitere Infos: ${URLS.INFO} | Shop: ${URLS.SHOP} 🎰`, { headers: RESPONSE_HEADERS });
    }

    // Cooldown Check (before processing actual spin)
    const cooldownMs = COOLDOWN_SECONDS * 1000;

    if (lastSpin && (now - lastSpin) < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastSpin);
      const remainingSec = Math.ceil(remainingMs / 1000);
      return new Response(`@${username} ⏱️ Cooldown: Noch ${remainingSec} Sekunden!     `, { headers: RESPONSE_HEADERS });
    }

    // Check for Free Spins
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
      isFreeSpinUsed = false;
      freeSpinMultiplier = 1;
    }

    // Parse spin amount and multiplier
    const spinAmountResult = await parseSpinAmount(username, amountParam, currentBalance, isFreeSpinUsed, env);
    if (spinAmountResult.error) {
      return new Response(spinAmountResult.error, { headers: RESPONSE_HEADERS });
    }

    let spinCost = isFreeSpinUsed ? 0 : (spinAmountResult.spinCost || BASE_SPIN_COST);
    let multiplier = isFreeSpinUsed ? freeSpinMultiplier : (spinAmountResult.multiplier || 1);

    // OPTIMIZED: Only check Happy Hour if not using free spin
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

    // OPTIMIZED: Load all buffs in single Promise.all() for maximum parallelization
    let hasStarMagnet, hasDiamondRush, hasLuckyCharm, hasDachsLocator, hasRageMode;

    if (isFreeSpinUsed) {
      // Free spin: Only need grid generation buffs
      [hasStarMagnet, hasDiamondRush] = await Promise.all([
        isBuffActive(username, 'star_magnet', env),
        isBuffActive(username, 'diamond_rush', env)
      ]);
      hasLuckyCharm = false;
      hasDachsLocator = { active: false, uses: 0 };
      hasRageMode = { active: false, stack: 0 };
    } else {
      // Normal spin: Load ALL buffs in single batch
      [hasStarMagnet, hasDiamondRush, hasLuckyCharm, hasDachsLocator, hasRageMode] = await Promise.all([
        isBuffActive(username, 'star_magnet', env),
        isBuffActive(username, 'diamond_rush', env),
        isBuffActive(username, 'lucky_charm', env),
        getBuffWithUses(username, 'dachs_locator', env),
        getBuffWithStack(username, 'rage_mode', env)
      ]);
    }

    // Calculate Dachs chance with buffs
    let dachsChance = DACHS_BASE_CHANCE;
    if (hasLuckyCharm) dachsChance = DACHS_BASE_CHANCE * 2;
    if (hasDachsLocator.active) dachsChance = dachsChance * 3;

    // Rage Mode: Apply stack bonus to win chance
    if (hasRageMode.active && hasRageMode.stack > 0) {
      const rageBoost = 1 + (hasRageMode.stack / 100);
      dachsChance = dachsChance * rageBoost;
    }

    // Generate grid
    const grid = await generateGrid(username, dachsChance, hasStarMagnet, hasDiamondRush, env);

    // OPTIMIZED: Decrement Dachs Locator uses inline (avoids redundant KV read)
    if (hasDachsLocator.active && hasDachsLocator.data) {
      const data = hasDachsLocator.data;
      data.uses--;

      if (data.uses <= 0) {
        await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:dachs_locator`);
      } else {
        await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:dachs_locator`, JSON.stringify(data), { expirationTtl: calculateBuffTTL(data.expireAt) });
      }
    }

    // Apply special items to grid
    await applySpecialItems(username, grid, hasGuaranteedPairToken, hasWildCardToken, env);

    let result = calculateWin(grid);

    // Check Hourly Jackpot (with anti-duplicate claim)
    let hourlyJackpotWon = false;
    if (await checkAndClaimHourlyJackpot(env)) {
      result.points += HOURLY_JACKPOT_AMOUNT;
      hourlyJackpotWon = true;
    }

    // Apply multipliers and buffs to result
    const { shopBuffs, streakMulti } = await applyMultipliersAndBuffs(username, result, multiplier, grid, env);

    // Calculate streak bonuses
    const isWin = result.points > 0 || (result.freeSpins && result.freeSpins > 0);
    const streakBonusResult = await calculateStreakBonuses(username, isWin, env);
    const streakBonus = streakBonusResult.streakBonus;
    const comboBonus = streakBonusResult.comboBonus;
    const naturalBonuses = streakBonusResult.naturalBonuses;
    let lossWarningMessage = streakBonusResult.lossWarningMessage;

    // OPTIMIZED: Rage Mode inline updates (avoids redundant KV reads) + use calculateBuffTTL helper
    if (!isWin && hasRageMode.active && hasRageMode.data) {
      const data = hasRageMode.data;
      data.stack = Math.min((data.stack || 0) + RAGE_MODE_LOSS_STACK, RAGE_MODE_MAX_STACK);
      await Promise.all([
        env.SLOTS_KV.put(`buff:${username.toLowerCase()}:rage_mode`, JSON.stringify(data), { expirationTtl: calculateBuffTTL(data.expireAt) }),
        resetStreakMultiplier(username, env)
      ]);
    } else if (isWin && hasRageMode.active && hasRageMode.data) {
      const data = hasRageMode.data;
      data.stack = 0;
      await Promise.all([
        env.SLOTS_KV.put(`buff:${username.toLowerCase()}:rage_mode`, JSON.stringify(data), { expirationTtl: calculateBuffTTL(data.expireAt) }),
        incrementStreakMultiplier(username, env)
      ]);
    } else if (isWin) {
      await incrementStreakMultiplier(username, env);
    } else {
      await resetStreakMultiplier(username, env);
    }

    // Mulligan/Insurance - OPTIMIZED: Use setMulliganCount/setInsuranceCount to avoid redundant KV reads
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

        // OPTIMIZED: Fetch rank in parallel with balance/stats/insurance updates
        const [, , , rank] = await Promise.all([
          setBalance(username, newBalanceWithRefund, env),
          updateStats(username, false, result.points, spinCost, env),
          setInsuranceCount(username, insuranceCount - 1, env),
          getPrestigeRank(username, env)
        ]);
        const rankSymbol = rank ? `${rank} ` : '';

        return new Response(`@${username} ${rankSymbol}[ ${grid[3]} ${grid[4]} ${grid[5]} ] ${result.message} 🛡️ ║ Insurance +${refund} (${insuranceCount - 1} übrig) ║ Kontostand: ${newBalanceWithRefund} DT`, { headers: RESPONSE_HEADERS });
      }
    }

    const totalBonuses = streakBonus + comboBonus;
    const newBalance = Math.max(0, Math.min(currentBalance - spinCost + result.points + totalBonuses, MAX_BALANCE));

    // OPTIMIZED: Parallelize all final updates including rank fetch AND free spins check
    const finalUpdates = [
      setBalance(username, newBalance, env),
      updateStats(username, result.points > 0, result.points, spinCost, env),
      setLastSpin(username, now, env),
      getPrestigeRank(username, env),
      getFreeSpins(username, env) // Fetch remaining free spins in parallel
    ];

    // Add bank update if not free spin
    if (!isFreeSpinUsed) {
      const netBankChange = spinCost - (result.points + totalBonuses);
      finalUpdates.push(updateBankBalance(netBankChange, env));
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

    // Low Balance Warning - OPTIMIZED: Parallel fetch of lastDaily and hasBoost
    if (newBalance < LOW_BALANCE_WARNING) {
      try {
        const [lastDaily, hasBoost] = await Promise.all([
          getLastDaily(username, env),
          hasUnlock(username, 'daily_boost', env)
        ]);

        const nowDate = new Date(now);
        const todayUTC = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());

        let dailyAvailable = false;
        if (!lastDaily) {
          dailyAvailable = true;
        } else {
          const lastDailyDate = new Date(lastDaily);
          const lastDailyUTC = Date.UTC(lastDailyDate.getUTCFullYear(), lastDailyDate.getUTCMonth(), lastDailyDate.getUTCDate());
          dailyAvailable = todayUTC !== lastDailyUTC;
        }

        if (dailyAvailable) {
          const dailyAmountValue = hasBoost ? DAILY_BOOST_AMOUNT : DAILY_AMOUNT;
          lossWarningMessage = lossWarningMessage
            ? `${lossWarningMessage} ⚠️ Niedriger Kontostand! Nutze !slots daily für +${dailyAmountValue} DT`
            : `⚠️ Niedriger Kontostand! Nutze !slots daily für +${dailyAmountValue} DT`;
        }
      } catch (error) {
        console.error('Low Balance Warning Check Error:', error);
      }
    }

    // Custom Message Check
    const isCustomWin = result.points > 0 || totalBonuses > 0;
    const totalWinAmount = (result.points || 0) + totalBonuses;
    const customMsg = getCustomMessage(username, isCustomWin, {
      amount: isCustomWin ? totalWinAmount : spinCost,
      balance: newBalance,
      grid: [grid[MIDDLE_ROW_START], grid[MIDDLE_ROW_START + 1], grid[MIDDLE_ROW_END]].join(' ')
    });

    if (customMsg) {
      return new Response(`@${username} [ ${[grid[MIDDLE_ROW_START], grid[MIDDLE_ROW_START + 1], grid[MIDDLE_ROW_END]].join(' ')} ] ${customMsg} ║ Kontostand: ${newBalance} DT`, { headers: RESPONSE_HEADERS });
    }

    // Build response message (D2 format)
    const totalWin = result.points + totalBonuses;
    const message = buildResponseMessage(username, grid, result, totalWin, newBalance, rank, isFreeSpinUsed, multiplier, remainingCount, hourlyJackpotWon, naturalBonuses, shopBuffs, streakMulti, lossWarningMessage);
    return new Response(message, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleSlot Error:', error);
    return new Response(`@${username} ❌ Fehler beim Spin.`, { headers: RESPONSE_HEADERS });
  }
}

function calculateWin(grid) {
  const middle = [grid[MIDDLE_ROW_START], grid[MIDDLE_ROW_START + 1], grid[MIDDLE_ROW_END]];

  // Count Wild Cards
  const wildCount = middle.filter(s => s === '🃏').length;
  const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';

  // Process wilds: Replace with best matching symbol
  let processedMiddle = [...middle];
  if (wildCount > 0) {
    // Find non-wild symbols
    const nonWildSymbols = middle.filter(s => s !== '🃏');

    if (nonWildSymbols.length === 0) {
      // All wilds → treat as best symbol (⭐)
      processedMiddle = ['⭐', '⭐', '⭐'];
    } else if (wildCount === 2) {
      // 2 wilds + 1 symbol → make triple of that symbol
      const symbol = nonWildSymbols[0];
      processedMiddle = [symbol, symbol, symbol];
    } else if (wildCount === 1) {
      // 1 wild → make best pair or triple
      if (nonWildSymbols[0] === nonWildSymbols[1]) {
        // Already a pair, wild makes triple
        processedMiddle = [nonWildSymbols[0], nonWildSymbols[0], nonWildSymbols[0]];
      } else {
        // No pair, wild creates pair with HIGHER VALUE symbol
        const symbol1 = nonWildSymbols[0];
        const symbol2 = nonWildSymbols[1];

        // Get payouts for both symbols (Dachs has special payouts, use PAIR_PAYOUTS for others)
        const getPairValue = (s) => {
          if (s === '🦡') return DACHS_PAIR_PAYOUT; // 2500
          if (s === '💎') return 0; // Diamonds give free spins, not points - treat as lowest for pair
          return PAIR_PAYOUTS[s] || 5;
        };

        const value1 = getPairValue(symbol1);
        const value2 = getPairValue(symbol2);

        // Use the symbol with higher payout for the pair
        if (value1 >= value2) {
          processedMiddle = [symbol1, symbol1, symbol2];
        } else {
          processedMiddle = [symbol2, symbol2, symbol1];
        }
      }
    }
  }

  // Check Dachs (using processed middle)
  const dachsCount = processedMiddle.filter(s => s === '🦡').length;
  if (dachsCount === 3) {
    return { points: DACHS_TRIPLE_PAYOUT, message: '🔥🦡🔥 MEGAAA DACHS JACKPOT!!! 🔥🦡🔥 HOLY MOLY!!!' + wildSuffix };
  }
  if (dachsCount === 2) {
    return { points: DACHS_PAIR_PAYOUT, message: '💥🦡💥 KRASSER DOPPEL-DACHS!!! 💥🦡💥' + wildSuffix };
  }
  if (dachsCount === 1) {
    return { points: DACHS_SINGLE_PAYOUT, message: '🦡 Dachs gesichtet! Nice!' + wildSuffix };
  }

  // Check Diamonds (using ORIGINAL middle, not processed - wilds don't count for free spins)
  if (middle[0] === '💎' && middle[1] === '💎' && middle[2] === '💎') {
    return { points: 0, message: '💎💎💎 DIAMANTEN JACKPOT! +5 FREE SPINS!', freeSpins: 5 };
  }

  if ((middle[0] === '💎' && middle[1] === '💎' && middle[2] !== '💎' && middle[2] !== '🃏') ||
    (middle[1] === '💎' && middle[2] === '💎' && middle[0] !== '💎' && middle[0] !== '🃏')) {
    return { points: 0, message: '💎💎 Diamanten! +1 FREE SPIN!', freeSpins: 1 };
  }

  // Check Triples (using processed middle)
  if (processedMiddle[0] === processedMiddle[1] && processedMiddle[1] === processedMiddle[2]) {
    const symbol = processedMiddle[0];
    const points = TRIPLE_PAYOUTS[symbol] || 50;
    return { points, message: `Dreifach ${symbol}!${wildSuffix}` };
  }

  // Check Pairs (using processed middle) - Only adjacent pairs count
  if ((processedMiddle[0] === processedMiddle[1] && processedMiddle[0] !== processedMiddle[2]) ||
    (processedMiddle[1] === processedMiddle[2] && processedMiddle[0] !== processedMiddle[1])) {
    const symbol = processedMiddle[0] === processedMiddle[1] ? processedMiddle[0] : processedMiddle[1];
    const points = PAIR_PAYOUTS[symbol] || 5;
    return { points, message: `Doppel ${symbol}!${wildSuffix}` };
  }

  // OPTIMIZED: Use static constant instead of recreating array
  return { points: 0, message: SPIN_LOSS_MESSAGES[secureRandomInt(0, SPIN_LOSS_MESSAGES.length - 1)] };
}

export { handleSlot, calculateWin };
