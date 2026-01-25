/**
 * Symbol Constants - Weights, lists, and buff configuration
 */

export interface SymbolWeight {
  symbol: string;
  weight: number;
}

export interface CumulativeWeight {
  symbol: string;
  cumulative: number;
}

export interface BuffSymbol {
  symbol: string;
  name: string;
}

// Symbol weights
export const SYMBOL_WEIGHTS: SymbolWeight[] = [
  { symbol: '🍒', weight: 24 },
  { symbol: '🍋', weight: 20 },
  { symbol: '🍊', weight: 19 },
  { symbol: '💎', weight: 21 },
  { symbol: '🍇', weight: 15 },
  { symbol: '🍉', weight: 11 },
  { symbol: '⭐', weight: 10 }
];
export const TOTAL_WEIGHT = 120;

// Pre-computed cumulative weights for O(1) binary search lookup
export const CUMULATIVE_WEIGHTS: CumulativeWeight[] = SYMBOL_WEIGHTS.reduce<CumulativeWeight[]>((acc, { symbol, weight }) => {
  const cumulative = (acc.length > 0 ? acc[acc.length - 1].cumulative : 0) + weight;
  acc.push({ symbol, cumulative });
  return acc;
}, []);

// Symbol arrays for game logic
export const GUARANTEED_PAIR_SYMBOLS: string[] = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐'];
export const ALL_SYMBOLS: string[] = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '🦡', '💎'];

export const BUFF_SYMBOLS_WITH_NAMES: BuffSymbol[] = [
  { symbol: '🍒', name: 'Kirschen' },
  { symbol: '🍋', name: 'Zitronen' },
  { symbol: '🍊', name: 'Orangen' },
  { symbol: '🍇', name: 'Trauben' },
  { symbol: '🍉', name: 'Wassermelonen' },
  { symbol: '⭐', name: 'Stern' },
  { symbol: '🦡', name: 'Dachs' }
];

// Buff chance modifiers
export const BUFF_REROLL_CHANCE = 0.66;
export const SYMBOL_BOOST_CHANCE = 0.33;

// Buff and unlock keys for admin operations
export const ALL_BUFF_KEYS: string[] = ['happy_hour', 'lucky_charm', 'golden_hour', 'dachs_locator', 'rage_mode', 'star_magnet', 'profit_doubler', 'diamond_rush'];
export const ALL_UNLOCK_KEYS: string[] = ['slots_20', 'slots_30', 'slots_50', 'slots_100', 'slots_all', 'daily_boost', 'custom_message'];
export const PRESTIGE_RANKS: string[] = ['🥉', '🥈', '🥇', '💎', '👑'];
