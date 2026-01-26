/**
 * Slot Engine - Grid generation, win calculation, and helper functions
 * Extracted from slots.js for better code organization
 */

import {
  GRID_SIZE,
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
import type { Env, WinResult } from '../../types/index.js';

// ============================================
// Grid Generation
// ============================================

/**
 * Generate spin grid with optional buff effects
 */
async function generateGrid(
  lowerUsername: string,
  dachsChance: number,
  hasStarMagnet: boolean,
  hasDiamondRush: boolean,
  env: Env
): Promise<string[]> {
  // Check if user has a stored peek grid
  const peekKey = `peek:${lowerUsername}`;
  const storedPeek = await env.SLOTS_KV.get(peekKey);

  if (storedPeek) {
    await env.SLOTS_KV.delete(peekKey);
    const parsedPeek = safeJsonParse(storedPeek) as string[] | null;
    if (parsedPeek && Array.isArray(parsedPeek) && parsedPeek.length === GRID_SIZE) {
      return parsedPeek;
    }
    // Invalid peek data, continue with normal grid generation
  }

  const grid: string[] = [];

  // OPTIMIZED: Pre-generate random values to reduce crypto calls
  // Without buffs: 3 values (1 dachs check per symbol)
  // With buffs: 9 values (1 dachs check + 2 buff rolls per symbol)
  const poolSize = (hasStarMagnet || hasDiamondRush) ? 9 : 3;
  const randomPool = Array.from({length: poolSize}, () => secureRandom());
  let randomIndex = 0;

  // Generate 3 elements (the winning row)
  for (let i = 0; i < GRID_SIZE; i++) {
    if (randomPool[randomIndex++] < dachsChance) {
      grid.push('🦡');
    } else {
      let symbol = getWeightedSymbol();

      // Only generate buff random values if buffs are active
      if (hasStarMagnet || hasDiamondRush) {
        const buffRoll = randomPool[randomIndex++];
        const boostRoll = randomPool[randomIndex++];

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

// ============================================
// Special Items
// ============================================

/**
 * Apply special items (Guaranteed Pair, Wild Card) to grid
 */
async function applySpecialItems(
  username: string,
  grid: string[],
  hasGuaranteedPairToken: boolean,
  hasWildCardToken: boolean,
  env: Env
): Promise<void> {
  if (hasGuaranteedPairToken && grid.length >= 2 && GUARANTEED_PAIR_SYMBOLS.length > 0) {
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
    // Wild Card: Replace worst symbol with best for maximum payout
    // Only consume token if it actually changed the grid (consistent with Guaranteed Pair behavior)
    const wildApplied = applyWildCardOptimization(grid);
    if (wildApplied) {
      await consumeWildCard(username, env);
    }
    // If not applied (e.g. Dachs pair), save token for next spin
  }
}

/**
 * Wild Card optimization: Create best possible non-Dachs outcome
 * Rules:
 * - Wild Card can NEVER become a Dachs
 * - Non-Dachs pair → complete to triple
 * - Dachs pair → don't change (already good)
 * - No pair → create best non-Dachs adjacent pair
 */
function applyWildCardOptimization(grid: string[]): boolean {
  // Symbol value hierarchy (excluding Dachs - Wild can't become Dachs)
  const getSymbolValue = (symbol: string): number => {
    const values: Record<string, number> = {
      '⭐': 50,    // Star pair payout (best regular)
      '🍉': 25,    // Watermelon
      '🍇': 15,    // Grapes
      '🍊': 10,    // Orange
      '🍋': 8,     // Lemon
      '🍒': 5,     // Cherry
      '💎': 1     // Diamond (lowest for pairs)
    };
    return values[symbol] || 0;
  };

  // Helper: Check if symbol is Dachs
  const isDachs = (s: string): boolean => s === '🦡';

  // Helper: Find existing pair
  const findPair = (grid: string[]): { pairType: '01' | '12' | '02' | null, symbol: string | null } => {
    const pair01 = grid[0] === grid[1] && grid[0] !== grid[2];
    const pair12 = grid[1] === grid[2] && grid[0] !== grid[1];
    const pair02 = grid[0] === grid[2] && grid[0] !== grid[1];

    if (pair01) return { pairType: '01', symbol: grid[0] };
    if (pair12) return { pairType: '12', symbol: grid[1] };
    if (pair02) return { pairType: '02', symbol: grid[0] };
    return { pairType: null, symbol: null };
  };

  // Helper: Find best non-Dachs symbol
  const findBestNonDachs = (grid: string[]): { index: number, symbol: string } | null => {
    let bestValue = -1;
    let bestIndex = -1;
    let bestSymbol: string | null = null;

    for (let i = 0; i < 3; i++) {
      if (!isDachs(grid[i])) {
        const value = getSymbolValue(grid[i]);
        if (value > bestValue) {
          bestValue = value;
          bestIndex = i;
          bestSymbol = grid[i];
        }
      }
    }

    return bestIndex !== -1 && bestSymbol ? { index: bestIndex, symbol: bestSymbol } : null;
  };

  // Main logic
  const pair = findPair(grid);

  // If NON-DACHS pair exists → complete to triple
  if (pair.pairType && pair.symbol && !isDachs(pair.symbol)) {
    if (pair.pairType === '01') grid[2] = pair.symbol;
    else if (pair.pairType === '12') grid[0] = pair.symbol;
    else if (pair.pairType === '02') grid[1] = pair.symbol;
    return true;
  }

  // If DACHS pair exists → don't change
  if (pair.pairType) return false;

  // No pair exists → create best non-Dachs adjacent pair
  const best = findBestNonDachs(grid);
  if (!best) return false;

  // Replace adjacent position to create pair
  if (best.index === 0) grid[1] = best.symbol;
  else if (best.index === 2) grid[1] = best.symbol;
  else grid[0] = best.symbol; // Best at 1 → replace 0

  return true;
}

// ============================================
// Win Calculation
// ============================================

/**
 * Calculate win result from grid
 */
function calculateWin(grid: string[]): WinResult {
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

        const getPairValue = (s: string): number => {
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

  // Check Diamonds FIRST (using ORIGINAL grid - wilds don't count for free spins)
  // This must be checked before Dachs to allow combined wins (e.g., 🦡 💎 💎 = 100 DT + 1 Free Spin)
  let diamondFreeSpins = 0;
  let diamondMessage = '';
  if (grid[0] === '💎' && grid[1] === '💎' && grid[2] === '💎') {
    diamondFreeSpins = 5;
    diamondMessage = '💎💎💎 DIAMANTEN JACKPOT! +5 FREE SPINS!';
  } else {
    // Only adjacent diamond pairs count (positions 0+1 or 1+2)
    const adjacentDiamondPair =
      (grid[0] === '💎' && grid[1] === '💎') ||
      (grid[1] === '💎' && grid[2] === '💎');
    if (adjacentDiamondPair) {
      diamondFreeSpins = 1;
      diamondMessage = '💎💎 +1 FREE SPIN!';
    }
  }

  // Check Dachs (using processed grid)
  const dachsCount = processedGrid.filter(s => s === '🦡').length;
  if (dachsCount === 3) {
    // Triple Dachs + possible diamonds
    const msg = '🔥🦡🔥 MEGAAA DACHS JACKPOT!!! 🔥🦡🔥 HOLY MOLY!!!' + wildSuffix + (diamondMessage ? ` ${diamondMessage}` : '');
    return { points: DACHS_TRIPLE_PAYOUT, message: msg, freeSpins: diamondFreeSpins || undefined };
  }
  if (dachsCount === 2) {
    // Double Dachs + possible diamond (🦡 🦡 💎 = only 1 diamond, no free spin)
    return { points: DACHS_PAIR_PAYOUT, message: '💥🦡💥 KRASSER DOPPEL-DACHS!!! 💥🦡💥' + wildSuffix };
  }
  if (dachsCount === 1) {
    // Single Dachs + possible 2 diamonds (🦡 💎 💎 = 100 DT + 1 Free Spin!)
    const msg = '🦡 Dachs gesichtet! Nice!' + wildSuffix + (diamondMessage ? ` ${diamondMessage}` : '');
    return { points: DACHS_SINGLE_PAYOUT, message: msg, freeSpins: diamondFreeSpins || undefined };
  }

  // Pure diamond wins (no Dachs)
  if (diamondFreeSpins > 0) {
    return { points: 0, message: diamondMessage, freeSpins: diamondFreeSpins };
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

// ============================================
// Response Building
// ============================================

/**
 * Build response message in D2 format
 * Format: [ Grid ] Result! +X DachsTaler 💰 ║ Natural Bonuses ║ 🛒 Shop Buffs ║ Kontostand: X DachsTaler
 */
function buildResponseMessage(
  username: string,
  grid: string[],
  result: WinResult,
  totalWin: number,
  newBalance: number,
  rank: string | null,
  isFreeSpinUsed: boolean,
  multiplier: number,
  remainingCount: number,
  hourlyJackpotWon: boolean,
  naturalBonuses: string[],
  shopBuffs: string[],
  streakMulti: number,
  lossWarningMessage: string,
  spinCost: number = 0,
  wildCardUsed: boolean = false
): string {
  // Add Wild Card to shop buffs if used
  if (wildCardUsed) {
    shopBuffs.push('🃏 Wild');
  }
  const rankSymbol = rank ? `${rank} ` : '';
  const freeSpinPrefix = isFreeSpinUsed ? `FREE SPIN (${multiplier * 10} DachsTaler)${remainingCount > 0 ? ` (${remainingCount} übrig)` : ''} ` : '';
  const middleRow = grid.join(' ');

  const messageParts: string[] = [`@${username}`, rankSymbol, freeSpinPrefix, `[ ${middleRow} ]`];

  // Free Spins won
  if (result.freeSpins && result.freeSpins > 0) {
    messageParts.push(result.message);
  }
  // Net win (payout >= spin cost)
  else if (totalWin > 0 && totalWin >= spinCost) {
    const netWin = totalWin - spinCost;
    messageParts.push(`${result.message} +${netWin} DT 💰`);

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
  // Partial win (payout > 0 but < spin cost) = net loss
  else if (totalWin > 0 && totalWin < spinCost) {
    const netLoss = spinCost - totalWin;
    messageParts.push(`${result.message} ${totalWin} von ${spinCost} DT zurück • -${netLoss} DT 💸`);
  }
  // Total loss
  else {
    messageParts.push(`${result.message} -${spinCost} DT 💸`);
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
