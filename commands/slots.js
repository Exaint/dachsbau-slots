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
  PAIR_PAYOUTS
} from '../constants.js';
import { getWeightedSymbol } from '../utils.js';
import {
  getBalance,
  setBalance,
  getLastSpin,
  setLastSpin,
  hasAcceptedDisclaimer,
  setDisclaimerAccepted,
  isSelfBanned,
  setSelfBan,
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
  decrementBuffUses,
  consumeBoost,
  consumeWinMultiplier,
  getMulliganCount,
  decrementMulligan,
  getInsuranceCount,
  decrementInsurance,
  getStreakMultiplier,
  incrementStreakMultiplier,
  resetStreakMultiplier,
  getStreak,
  updateStreak,
  resetStreak,
  incrementRageModeStack,
  resetRageModeStack,
  updateStats,
  getPrestigeRank,
  updateBankBalance,
  checkAndClaimHourlyJackpot,
  getLastDaily
} from '../database.js';

async function handleSlot(username, amountParam, url, env) {
  try {
    // OPTIMIZED: Cache username.toLowerCase() to avoid repeated calls
    const usernameLower = username.toLowerCase();

    // Sanitize amountParam: Remove invisible characters, zero-width spaces, etc.
    if (amountParam) {
      // Remove all invisible/control characters but keep normal spaces and alphanumeric
      amountParam = amountParam
        .replace(/[\u200B-\u200D\uFEFF\u00AD\u034F\u061C\u180E]/g, '') // Zero-width spaces
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
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
      return new Response(`@${username} 🚫 Du hast dich selbst vom Spielen ausgeschlossen (seit ${selfBanData.date}). Kontaktiere einen Admin für eine Freischaltung. Hilfe: https://git.new/DachsbauSlotInfos     `, { headers: RESPONSE_HEADERS });
    }

    // First-Time Disclaimer Check
    if (!hasAccepted) {
      await setDisclaimerAccepted(username, env);
      return new Response(`@${username} 🦡 Willkommen! Dachsbau Slots ist nur zur Unterhaltung - kein Echtgeld! Verstanden? Schreib nochmal !slots zum Spielen! Weitere Infos: https://git.new/DachsbauSlotInfos | Shop: https://git.new/DachsbauSlotsShop 🎰     `, { headers: RESPONSE_HEADERS });
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

    let spinCost = isFreeSpinUsed ? 0 : 10;
    let multiplier = isFreeSpinUsed ? freeSpinMultiplier : 1;

    // Check custom stake
    if (!isFreeSpinUsed && amountParam) {
      const lower = amountParam.toLowerCase();

      if (lower === 'all') {
        if (!await hasUnlock(username, 'slots_all', env)) {
          return new Response(`@${username} ❌ !slots all nicht freigeschaltet! Weitere Infos: https://dub.sh/SlotUnlock`, { headers: RESPONSE_HEADERS });
        }
        if (currentBalance < 10) {
          return new Response(`@${username} ❌ Du brauchst mindestens 10 DachsTaler für !slots all!`, { headers: RESPONSE_HEADERS });
        }
        spinCost = currentBalance;
        multiplier = Math.floor(currentBalance / 10);
      } else {
        const customAmount = parseInt(amountParam, 10);
        if (!isNaN(customAmount)) {
          // OPTIMIZED: Use module-level constants UNLOCK_MAP and MULTIPLIER_MAP

          // Check if amount is too low
          if (customAmount < 10) {

            return new Response(`@${username} ❌ Minimum ist !slots 10! Verfügbar: 10, 20, 30, 50, 100, all 💡     `, { headers: RESPONSE_HEADERS });
          }

          // Check if amount is too high
          if (customAmount > 100) {

            return new Response(`@${username} ❌ Maximum ist !slots 100! Verfügbar: 10, 20, 30, 50, 100, all 💡     `, { headers: RESPONSE_HEADERS });
          }

          if (customAmount === BASE_SPIN_COST) {
            spinCost = BASE_SPIN_COST;
            multiplier = 1;
          } else if (UNLOCK_MAP[customAmount]) {
            if (await hasUnlock(username, UNLOCK_MAP[customAmount], env)) {
              spinCost = customAmount;
              multiplier = MULTIPLIER_MAP[customAmount];
            } else {
              return new Response(`@${username} ❌ !slots ${customAmount} nicht freigeschaltet! Weitere Infos: https://dub.sh/SlotUnlock`, { headers: RESPONSE_HEADERS });
            }
          } else {
            // Numbers like 15, 25, 35, 45, 69, etc.

            return new Response(`@${username} ❌ !slots ${customAmount} existiert nicht! Verfügbar: 10, 20, 30, 50, 100, all | Info: https://dub.sh/SlotUnlock     `, { headers: RESPONSE_HEADERS });
          }
        }
      }
    }

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

    // OPTIMIZED: Load buffs in two stages
    // Stage 1: Always needed (for grid generation)
    const [hasStarMagnet, hasDiamondRush] = await Promise.all([
      isBuffActive(username, 'star_magnet', env),
      isBuffActive(username, 'diamond_rush', env)
    ]);

    // Stage 2: Only for normal spins (for dachs chance calculation)
    let hasLuckyCharm = false;
    let hasDachsLocator = { active: false, uses: 0 };
    let hasRageMode = { active: false, stack: 0 };

    if (!isFreeSpinUsed) {
      [hasLuckyCharm, hasDachsLocator, hasRageMode] = await Promise.all([
        isBuffActive(username, 'lucky_charm', env),
        getBuffWithUses(username, 'dachs_locator', env),
        getBuffWithStack(username, 'rage_mode', env)
      ]);
    }

    // Generate spin with modified probabilities
    let dachsChance = 1 / 150;
    if (hasLuckyCharm) dachsChance = 1 / 75;
    if (hasDachsLocator.active) dachsChance = dachsChance * 3; // 3x Dachs chance

    // Rage Mode: Apply stack bonus to win chance (simulated by adjusting dachs chance)
    // Each stack gives +5% win chance, max 50%
    // We simulate this by also boosting dachs chance
    if (hasRageMode.active && hasRageMode.stack > 0) {
      const rageBoost = 1 + (hasRageMode.stack / 100); // 5% = 1.05, 50% = 1.5
      dachsChance = dachsChance * rageBoost;
    }

    // Check if user has a stored peek grid
    const peekKey = `peek:${username.toLowerCase()}`;
    const storedPeek = await env.SLOTS_KV.get(peekKey);
    let grid = [];

    if (storedPeek) {
      // Use the stored peek grid
      grid = JSON.parse(storedPeek);
      // Delete the peek after use
      await env.SLOTS_KV.delete(peekKey);
    } else {
      // Normal grid generation
      // DEBUG MODE: exaint_ gets 75% chance for exactly 2 dachs (next to each other)
      if (DEBUG_MODE && username.toLowerCase() === 'exaint_') {
        const roll = Math.random();
        if (roll < 0.75) {
          // 75% chance: Exactly 2 dachs next to each other on middle row
          // Possible positions: [0,1] or [1,2]
          const dachsPair = Math.random() < 0.5 ? [3, 4] : [4, 5]; // Position 0-1 or 1-2 on middle row

          // Build middle row
          for (let i = 3; i < 6; i++) {
            if (dachsPair.includes(i)) {
              grid[i] = '🦡';
            } else {
              grid[i] = getWeightedSymbol();
            }
          }

          // Fill top and bottom rows normally (no dachs)
          for (let i = 0; i < 3; i++) {
            grid[i] = getWeightedSymbol();
            grid[i + 6] = getWeightedSymbol();
          }
        } else {
          // 25% chance: Normal generation with normal dachs chance
          for (let i = 0; i < 9; i++) {
            if (Math.random() < dachsChance) {
              grid.push('🦡');
            } else {
              let symbol = getWeightedSymbol();
              if (hasStarMagnet && Math.random() < 0.66) {
                const starRoll = Math.random();
                if (starRoll < 0.33) symbol = '⭐';
              }
              grid.push(symbol);
            }
          }
        }
      } else {
        // Normal generation for all other users
        for (let i = 0; i < 9; i++) {
          if (Math.random() < dachsChance) {
            grid.push('🦡');
          } else {
            // Star Magnet: 3x more stars
            let symbol = getWeightedSymbol();
            if (hasStarMagnet && Math.random() < 0.66) {
              // 66% chance to re-roll for star if not already star
              const starRoll = Math.random();
              if (starRoll < 0.33) symbol = '⭐'; // Extra star chance
            }
            // Diamond Rush: 3x more diamonds
            if (hasDiamondRush && symbol !== '💎' && Math.random() < 0.66) {
              const diamondRoll = Math.random();
              if (diamondRoll < 0.33) symbol = '💎'; // Extra diamond chance
            }
            grid.push(symbol);
          }
        }
      }
    }

    // Decrement Dachs Locator uses
    if (hasDachsLocator.active) {
      await decrementBuffUses(username, 'dachs_locator', env);
    }

    // Guaranteed Pair: Ensure at least a pair in middle row
    if (hasGuaranteedPairToken) {
      const middle = [grid[3], grid[4], grid[5]];
      const hasPair = (middle[0] === middle[1]) || (middle[1] === middle[2]) || (middle[0] === middle[2]);

      if (!hasPair) {
        // Force a pair by making positions 0 and 1 the same
        const symbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐'];
        const pairSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        grid[3] = pairSymbol;
        grid[4] = pairSymbol;
      }
      await consumeGuaranteedPair(username, env);
    }

    // Wild Card: Add 🃏 to middle row at random position
    if (hasWildCardToken) {
      const wildPos = Math.floor(Math.random() * 3) + 3; // Position 3, 4, or 5
      grid[wildPos] = '🃏';
      await consumeWildCard(username, env);
    }

    let result = calculateWin(grid);

    // Check Hourly Jackpot (with anti-duplicate claim)
    let hourlyJackpotWon = false;
    if (await checkAndClaimHourlyJackpot(env)) {
      result.points += HOURLY_JACKPOT_AMOUNT;
      hourlyJackpotWon = true;
    }

    // Award Free Spins
    if (result.freeSpins && result.freeSpins > 0) {
      try {
        await addFreeSpinsWithMultiplier(username, result.freeSpins, multiplier, env);
      } catch (addFreeSpinError) {
        console.error('Add Free Spins Error:', addFreeSpinError);
      }
    }

    result.points = result.points * multiplier;

    // Win Multiplier
    if (result.points > 0 && await consumeWinMultiplier(username, env)) {
      result.points *= 2;
      result.message += ' (⚡ 2x Win Boost!)';
    }

    // Symbol Boost
    const middle = [grid[3], grid[4], grid[5]];
    if (result.points > 0) {
      const symbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '🦡'];
      for (const symbol of symbols) {
        if (middle.includes(symbol) && await consumeBoost(username, symbol, env)) {
          const hasMatch = (middle[0] === symbol && middle[1] === symbol) ||
            (middle[1] === symbol && middle[2] === symbol) ||
            (middle[0] === symbol && middle[2] === symbol) ||
            (middle[0] === symbol && middle[1] === symbol && middle[2] === symbol);

          if (hasMatch) {
            result.points *= 2;
            result.message += ' (🔥 2x Boost!)';
            break;
          }
        }
      }
    }

    // OPTIMIZED: Only check Golden Hour and Profit Doubler if we have points
    if (result.points > 0) {
      const [hasGoldenHour, hasProfitDoubler] = await Promise.all([
        isBuffActive(username, 'golden_hour', env),
        isBuffActive(username, 'profit_doubler', env)
      ]);

      if (hasGoldenHour) {
        result.points = Math.floor(result.points * 1.3);
        result.message += ' (+30%)';
      }

      if (hasProfitDoubler && result.points > 100) {
        result.points *= 2;
        result.message += ' (📈 Profit x2!)';
      }
    }

    // Streak Multiplier: Increases with consecutive wins
    const currentStreakMulti = await getStreakMultiplier(username, env);
    if (result.points > 0 && currentStreakMulti > 1.0) {
      result.points = Math.floor(result.points * currentStreakMulti);
      result.message += ` (🔥 ${currentStreakMulti.toFixed(1)}x Streak!)`;
    }

    // Update streak and check for bonuses
    const isWin = result.points > 0 || (result.freeSpins && result.freeSpins > 0);
    const previousStreak = await getStreak(username, env);
    const newStreak = await updateStreak(username, isWin, env);

    let streakBonus = 0;
    let streakMessage = '';

    // Hot Streak: 5 wins in a row
    if (isWin && newStreak.wins === 5) {
      streakBonus = 500;
      streakMessage = ' 🔥 HOT STREAK! 5 Wins in Folge! +500 DT Bonus!';
      await resetStreak(username, env);
    }

    // Comeback King: 5 losses then a win
    if (isWin && previousStreak.losses >= 5) {
      streakBonus = 150;
      streakMessage = ' 👑 COMEBACK KING! Nach 5 Verlusten gewonnen! +150 DT Bonus!';
      await resetStreak(username, env);
    }

    // Combo Bonus System
    let comboBonus = 0;
    let comboMessage = '';
    if (isWin && newStreak.wins >= 2 && newStreak.wins < 5) {
      comboBonus = COMBO_BONUSES[newStreak.wins] || 0;
      if (comboBonus > 0) {
        comboMessage = ` 🎯 ${newStreak.wins}x Combo! +${comboBonus} DT!`;
      }
    }

    // Rage Mode: Increase chance after losses
    if (!isWin && hasRageMode.active) {
      await incrementRageModeStack(username, env);
      await resetStreakMultiplier(username, env); // Reset streak multiplier on loss
    } else if (isWin && hasRageMode.active) {
      await resetRageModeStack(username, env);
      await incrementStreakMultiplier(username, env); // Increment streak multiplier on win
    } else if (isWin) {
      await incrementStreakMultiplier(username, env); // Increment even without Rage Mode
    } else {
      await resetStreakMultiplier(username, env); // Reset on loss
    }

    // OPTIMIZED: Use module-level LOSS_MESSAGES constants
    let lossWarningMessage = '';
    if (!isWin && newStreak.losses >= 10) {
      if (LOSS_MESSAGES[newStreak.losses]) {
        lossWarningMessage = LOSS_MESSAGES[newStreak.losses];
      } else if (newStreak.losses > 20) {
        // Rotate through messages for 21+
        const index = (newStreak.losses - 21) % ROTATING_LOSS_MESSAGES.length;
        lossWarningMessage = ROTATING_LOSS_MESSAGES[index];
      }
    }

    // Mulligan/Insurance
    if (!isFreeSpinUsed && result.points === 0 && !result.freeSpins) {
      const [mulliganCount, insuranceCount] = await Promise.all([
        getMulliganCount(username, env),
        getInsuranceCount(username, env)
      ]);

      if (mulliganCount > 0) {
        await decrementMulligan(username, env);
        return new Response(`@${username} 🔄 Mulligan! Du hast noch ${mulliganCount - 1} Re-Spins. Spin nochmal!`, { headers: RESPONSE_HEADERS });
      }

      if (insuranceCount > 0) {
        await decrementInsurance(username, env);
        const refund = Math.floor(spinCost * 0.5);
        const newBalanceWithRefund = Math.min(currentBalance - spinCost + refund, MAX_BALANCE);

        await Promise.all([
          setBalance(username, newBalanceWithRefund, env),
          updateStats(username, false, result.points, spinCost, env)
        ]);

        const rank = await getPrestigeRank(username, env);
        const rankSymbol = rank ? `${rank} ` : '';

        return new Response(`@${username} ${rankSymbol}[ ${grid[3]} ${grid[4]} ${grid[5]} ] ║ ${result.message} -${spinCost} (+${refund} Insurance) = -${spinCost - refund} 🛡️ ║ Kontostand: ${newBalanceWithRefund} DachsTaler (${insuranceCount - 1} Insurance übrig)`, { headers: RESPONSE_HEADERS });
      }
    }

    const totalBonuses = streakBonus + comboBonus;
    const newBalance = Math.min(currentBalance - spinCost + result.points + totalBonuses, MAX_BALANCE);

    await Promise.all([
      setBalance(username, newBalance, env),
      updateStats(username, result.points > 0, result.points, spinCost, env),
      setLastSpin(username, now, env) // Update cooldown timestamp
    ]);

    // Update DachsBank balance
    if (!isFreeSpinUsed) {
      // Bank receives the spin cost
      await updateBankBalance(spinCost, env);

      // Bank pays out winnings (if any)
      if (result.points > 0 || totalBonuses > 0) {
        await updateBankBalance(-(result.points + totalBonuses), env);
      }
    }

    const rank = await getPrestigeRank(username, env);
    const rankSymbol = rank ? `${rank} ` : '';

    let remainingCount = 0;
    try {
      const remainingFreeSpins = await getFreeSpins(username, env);
      if (Array.isArray(remainingFreeSpins)) {
        remainingCount = remainingFreeSpins.reduce((sum, fs) => sum + (fs.count || 0), 0);
      }
    } catch (error) {
      console.error('Get Remaining Free Spins Error:', error);
    }

    const freeSpinPrefix = isFreeSpinUsed ? `FREE SPIN (${multiplier * 10} DT)${remainingCount > 0 ? ` (${remainingCount} übrig)` : ''} ` : '';

    // OPTIMIZED: Build message using array join (reduces string concatenation overhead)
    const middleRow = [grid[3], grid[4], grid[5]].join(' ');
    const messageParts = [`@${username}`, rankSymbol, freeSpinPrefix, `[ ${middleRow} ]`];

    if (result.freeSpins && result.freeSpins > 0) {
      messageParts.push(`║ ${result.message}`);
    } else if (result.points > 0 || totalBonuses > 0) {
      const totalWin = result.points + totalBonuses;
      const netWin = totalWin - spinCost;
      messageParts.push(`║ ${result.message}`);
      if (result.points > 0) {
        messageParts.push(`+${result.points}`);
      }
      if (hourlyJackpotWon) {
        messageParts.push(`⏰ HOURLY JACKPOT! +${HOURLY_JACKPOT_AMOUNT} DT!`);
      }
      if (streakBonus > 0) {
        messageParts.push(streakMessage);
      }
      if (comboBonus > 0) {
        messageParts.push(comboMessage);
      }
      if (spinCost > 0) {
        messageParts.push(`(-${spinCost}) = ${netWin >= 0 ? '+' : ''}${netWin} 💰`);
      } else {
        messageParts.push('💰');
      }
    } else {
      if (spinCost > 0) {
        messageParts.push(`║ ${result.message} -${spinCost} 💸`);
      } else {
        messageParts.push(`║ ${result.message}`);
      }
    }

    messageParts.push(`║ Kontostand: ${newBalance} DachsTaler 🦡`);

    // Low Balance Warning: Check if under 100 DT and daily is available
    if (newBalance < 100) {
      try {
        const lastDaily = await getLastDaily(username, env);
        const now = Date.now();
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
          const hasBoost = await hasUnlock(username, 'daily_boost', env);
          const dailyAmount = hasBoost ? 250 : 50;
          messageParts.push(`⚠️ Niedriger Kontostand! Nutze !slots daily für +${dailyAmount} DT`);
        }
      } catch (error) {
        console.error('Low Balance Warning Check Error:', error);
      }
    }

    // Add loss warning if applicable
    if (lossWarningMessage) {
      messageParts.push(lossWarningMessage);
    }

    const message = messageParts.filter(p => p).join(' ');
    return new Response(message, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleSlot Error:', error);
    return new Response(`@${username} ❌ Fehler beim Spin.`, { headers: RESPONSE_HEADERS });
  }
}

function calculateWin(grid) {
  const middle = [grid[3], grid[4], grid[5]];

  // Count Wild Cards
  const wildCount = middle.filter(s => s === '🃏').length;

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
      // 1 wild → make best pair
      // Find if we already have a pair
      if (nonWildSymbols[0] === nonWildSymbols[1]) {
        // Already a pair, wild makes triple
        processedMiddle = [nonWildSymbols[0], nonWildSymbols[0], nonWildSymbols[0]];
      } else {
        // No pair, wild creates pair with higher value symbol
        const symbol1 = nonWildSymbols[0];
        const symbol2 = nonWildSymbols[1];
        // Use the symbol that appears first (simple heuristic)
        processedMiddle = [symbol1, symbol1, symbol2];
      }
    }
  }

  // Check Dachs (using processed middle)
  const dachsCount = processedMiddle.filter(s => s === '🦡').length;
  if (dachsCount === 3) {
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points: 15000, message: '🔥🦡🔥 MEGAAA DACHS JACKPOT!!! 🔥🦡🔥 HOLY MOLY!!!' + wildSuffix };
  }
  if (dachsCount === 2) {
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points: 2500, message: '💥🦡💥 KRASSER DOPPEL-DACHS!!! 💥🦡💥' + wildSuffix };
  }
  if (dachsCount === 1) {
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points: 100, message: '🦡 Dachs gesichtet! Nice!' + wildSuffix };
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
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points, message: `Dreifach ${symbol}!${wildSuffix}` };
  }

  // Check Pairs (using processed middle) - Only adjacent pairs count
  if ((processedMiddle[0] === processedMiddle[1] && processedMiddle[0] !== processedMiddle[2]) ||
    (processedMiddle[1] === processedMiddle[2] && processedMiddle[0] !== processedMiddle[1])) {
    const symbol = processedMiddle[0] === processedMiddle[1] ? processedMiddle[0] : processedMiddle[1];
    const points = PAIR_PAYOUTS[symbol] || 5;
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points, message: `Doppel ${symbol}!${wildSuffix}` };
  }

  const messages = ['Leider verloren! 😢', 'Nächstes Mal!', 'Fast! Versuch es nochmal!', 'Kein Glück diesmal...'];
  return { points: 0, message: messages[Math.floor(Math.random() * messages.length)] };
}

export { handleSlot, calculateWin };
