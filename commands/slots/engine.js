/**
 * Slot Engine - Grid generation, win calculation, and helper functions
 * Extracted from slots.js for better code organization
 */

import {
  DEBUG_MODE,
  GRID_SIZE,
  DEBUG_DACHS_PAIR_CHANCE,
  BUFF_REROLL_CHANCE,
  SYMBOL_BOOST_CHANCE,
  GUARANTEED_PAIR_SYMBOLS,
  TRIPLE_PAYOUTS,
  PAIR_PAYOUTS,
  DACHS_TRIPLE_PAYOUT,
  DACHS_PAIR_PAYOUT,
  DACHS_SINGLE_PAYOUT,
  SPIN_LOSS_MESSAGES,
  HOURLY_JACKPOT_AMOUNT
} from '../../constants.js';
import { getWeightedSymbol, secureRandom, secureRandomInt, safeJsonParse } from '../../utils.js';
import { consumeGuaranteedPair, consumeWildCard } from '../../database.js';

/**
 * Generate spin grid with optional buff effects
 * @param {string} lowerUsername - Pre-lowercased username for KV operations
 * @param {number} dachsChance - Current chance for dachs symbol
 * @param {boolean} hasStarMagnet - Star Magnet buff active
 * @param {boolean} hasDiamondRush - Diamond Rush buff active
 * @param {object} env - Cloudflare environment
 * @returns {Promise<string[]>} Grid array [symbol, symbol, symbol]
 */
async function generateGrid(lowerUsername, dachsChance, hasStarMagnet, hasDiamondRush, env) {
  // Check if user has a stored peek grid
  const peekKey = `peek:${lowerUsername}`;
  const storedPeek = await env.SLOTS_KV.get(peekKey);

  if (storedPeek) {
    await env.SLOTS_KV.delete(peekKey);
    const parsedPeek = safeJsonParse(storedPeek, null);
    if (parsedPeek && Array.isArray(parsedPeek) && parsedPeek.length === GRID_SIZE) {
      return parsedPeek;
    }
    // Invalid peek data, continue with normal grid generation
  }

  const grid = [];

  // DEBUG MODE: Special user gets higher chance for exactly 2 dachs
  if (DEBUG_MODE && lowerUsername === 'exaint_') {
    const roll = secureRandom();
    if (roll < DEBUG_DACHS_PAIR_CHANCE) {
      const dachsPair = secureRandom() < 0.5 ? [0, 1] : [1, 2];
      for (let i = 0; i < GRID_SIZE; i++) {
        grid.push(dachsPair.includes(i) ? '🦡' : getWeightedSymbol());
      }
      return grid;
    }
  }

  // Normal generation - only 3 elements needed (the winning row)
  for (let i = 0; i < GRID_SIZE; i++) {
    if (secureRandom() < dachsChance) {
      grid.push('🦡');
    } else {
      let symbol = getWeightedSymbol();

      // Only generate buff random values if buffs are active
      if (hasStarMagnet || hasDiamondRush) {
        const buffRoll = secureRandom();
        const boostRoll = secureRandom();

        // Star Magnet: Only replace if not already a star (consistent with Diamond Rush)
        if (hasStarMagnet && symbol !== '⭐' && buffRoll < BUFF_REROLL_CHANCE && boostRoll < SYMBOL_BOOST_CHANCE) {
          symbol = '⭐';
        } else if (hasDiamondRush && symbol !== '💎' && buffRoll < BUFF_REROLL_CHANCE && boostRoll < SYMBOL_BOOST_CHANCE) {
          symbol = '💎';
        }
      }

      grid.push(symbol);
    }
  }

  return grid;
}

/**
 * Apply special items (Guaranteed Pair, Wild Card) to grid
 * @param {string} username - Original username
 * @param {string[]} grid - Grid array (modified in place)
 * @param {boolean} hasGuaranteedPairToken - Has Guaranteed Pair token
 * @param {boolean} hasWildCardToken - Has Wild Card token
 * @param {object} env - Cloudflare environment
 */
async function applySpecialItems(username, grid, hasGuaranteedPairToken, hasWildCardToken, env) {
  if (hasGuaranteedPairToken) {
    const hasPair = (grid[0] === grid[1]) || (grid[1] === grid[2]) || (grid[0] === grid[2]);

    if (!hasPair) {
      // Only consume token if it was actually used to create a pair
      const pairSymbol = GUARANTEED_PAIR_SYMBOLS[secureRandomInt(0, GUARANTEED_PAIR_SYMBOLS.length - 1)];
      grid[0] = pairSymbol;
      grid[1] = pairSymbol;
      await consumeGuaranteedPair(username, env);
    }
    // If already has pair, don't consume the token - save it for next spin
  }

  if (hasWildCardToken) {
    const wildPos = secureRandomInt(0, 2);
    grid[wildPos] = '🃏';
    await consumeWildCard(username, env);
  }
}

/**
 * Calculate win result from grid
 * @param {string[]} grid - Grid array [symbol, symbol, symbol]
 * @returns {{points: number, message: string, freeSpins?: number}}
 */
function calculateWin(grid) {
  // Count Wild Cards
  const wildCount = grid.filter(s => s === '🃏').length;
  const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';

  // Process wilds: Replace with best matching symbol
  let processedGrid = [...grid];
  if (wildCount > 0) {
    const nonWildSymbols = grid.filter(s => s !== '🃏');

    if (nonWildSymbols.length === 0) {
      // All wilds → treat as best symbol (⭐)
      processedGrid = ['⭐', '⭐', '⭐'];
    } else if (wildCount === 2) {
      // 2 wilds + 1 symbol → make triple of that symbol
      const symbol = nonWildSymbols[0];
      processedGrid = [symbol, symbol, symbol];
    } else if (wildCount === 1) {
      // 1 wild → make best pair or triple
      if (nonWildSymbols[0] === nonWildSymbols[1]) {
        processedGrid = [nonWildSymbols[0], nonWildSymbols[0], nonWildSymbols[0]];
      } else {
        // No pair, wild creates pair with HIGHER VALUE symbol
        const symbol1 = nonWildSymbols[0];
        const symbol2 = nonWildSymbols[1];

        const getPairValue = (s) => {
          if (s === '🦡') return DACHS_PAIR_PAYOUT;
          if (s === '💎') return 0;
          return PAIR_PAYOUTS[s] || 5;
        };

        const value1 = getPairValue(symbol1);
        const value2 = getPairValue(symbol2);

        if (value1 >= value2) {
          processedGrid = [symbol1, symbol1, symbol2];
        } else {
          processedGrid = [symbol2, symbol2, symbol1];
        }
      }
    }
  }

  // Check Dachs (using processed grid)
  const dachsCount = processedGrid.filter(s => s === '🦡').length;
  if (dachsCount === 3) {
    return { points: DACHS_TRIPLE_PAYOUT, message: '🔥🦡🔥 MEGAAA DACHS JACKPOT!!! 🔥🦡🔥 HOLY MOLY!!!' + wildSuffix };
  }
  if (dachsCount === 2) {
    return { points: DACHS_PAIR_PAYOUT, message: '💥🦡💥 KRASSER DOPPEL-DACHS!!! 💥🦡💥' + wildSuffix };
  }
  if (dachsCount === 1) {
    return { points: DACHS_SINGLE_PAYOUT, message: '🦡 Dachs gesichtet! Nice!' + wildSuffix };
  }

  // Check Diamonds (using ORIGINAL grid - wilds don't count for free spins)
  if (grid[0] === '💎' && grid[1] === '💎' && grid[2] === '💎') {
    return { points: 0, message: '💎💎💎 DIAMANTEN JACKPOT! +5 FREE SPINS!', freeSpins: 5 };
  }

  if ((grid[0] === '💎' && grid[1] === '💎' && grid[2] !== '💎' && grid[2] !== '🃏') ||
    (grid[1] === '💎' && grid[2] === '💎' && grid[0] !== '💎' && grid[0] !== '🃏')) {
    return { points: 0, message: '💎💎 Diamanten! +1 FREE SPIN!', freeSpins: 1 };
  }

  // Check Triples (using processed grid)
  if (processedGrid[0] === processedGrid[1] && processedGrid[1] === processedGrid[2]) {
    const symbol = processedGrid[0];
    const points = TRIPLE_PAYOUTS[symbol] || 50;
    return { points, message: `Dreifach ${symbol}!${wildSuffix}` };
  }

  // Check Pairs (using processed grid) - Only adjacent pairs count
  if ((processedGrid[0] === processedGrid[1] && processedGrid[0] !== processedGrid[2]) ||
    (processedGrid[1] === processedGrid[2] && processedGrid[0] !== processedGrid[1])) {
    const symbol = processedGrid[0] === processedGrid[1] ? processedGrid[0] : processedGrid[1];
    const points = PAIR_PAYOUTS[symbol] || 5;
    return { points, message: `Doppel ${symbol}!${wildSuffix}` };
  }

  // Loss
  return { points: 0, message: SPIN_LOSS_MESSAGES[secureRandomInt(0, SPIN_LOSS_MESSAGES.length - 1)] };
}

/**
 * Build response message in D2 format
 * Format: [ Grid ] Result! +X DachsTaler 💰 ║ Natural Bonuses ║ 🛒 Shop Buffs ║ Kontostand: X DachsTaler
 */
function buildResponseMessage(username, grid, result, totalWin, newBalance, rank, isFreeSpinUsed, multiplier, remainingCount, hourlyJackpotWon, naturalBonuses, shopBuffs, streakMulti, lossWarningMessage) {
  const rankSymbol = rank ? `${rank} ` : '';
  const freeSpinPrefix = isFreeSpinUsed ? `FREE SPIN (${multiplier * 10} DachsTaler)${remainingCount > 0 ? ` (${remainingCount} übrig)` : ''} ` : '';
  const middleRow = grid.join(' ');

  const messageParts = [`@${username}`, rankSymbol, freeSpinPrefix, `[ ${middleRow} ]`];

  // Free Spins won
  if (result.freeSpins && result.freeSpins > 0) {
    messageParts.push(result.message);
  }
  // Win
  else if (totalWin > 0) {
    messageParts.push(`${result.message} +${totalWin} DachsTaler 💰`);

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

  messageParts.push(`║ Kontostand: ${newBalance} DachsTaler`);

  if (lossWarningMessage) {
    messageParts.push(lossWarningMessage);
  }

  return messageParts.filter(p => p).join(' ');
}

export {
  generateGrid,
  applySpecialItems,
  calculateWin,
  buildResponseMessage
};
