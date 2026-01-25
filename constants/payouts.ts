/**
 * Payout Constants - All win amounts and rewards
 */

// Daily Rewards
export const DAILY_AMOUNT = 50;
export const DAILY_BOOST_AMOUNT = 250;
export const LOW_BALANCE_WARNING = 100;

// Dachs Payouts
export const DACHS_TRIPLE_PAYOUT = 15000;
export const DACHS_PAIR_PAYOUT = 2500;
export const DACHS_SINGLE_PAYOUT = 100;
export const DACHS_BASE_CHANCE = 1 / 150;

// Symbol Payouts
export const TRIPLE_PAYOUTS: Record<string, number> = { '⭐': 500, '🍉': 250, '🍇': 150, '🍊': 100, '🍋': 75, '🍒': 50 };
export const PAIR_PAYOUTS: Record<string, number> = { '⭐': 50, '🍉': 25, '🍇': 15, '🍊': 10, '🍋': 8, '🍒': 5 };

// Duell Symbol Values (half of pair payouts, used for tiebreaker)
export const DUEL_SYMBOL_VALUES: Record<string, number> = { '🦡': 500, '💎': 100, '⭐': 25, '🍉': 13, '🍇': 8, '🍊': 5, '🍋': 4, '🍒': 3 };

// Streak System
export const STREAK_THRESHOLD = 5;
export const HOT_STREAK_BONUS = 500;
export const COMEBACK_BONUS = 150;
export const STREAK_MULTIPLIER_INCREMENT = 0.1;
export const STREAK_MULTIPLIER_MAX = 3.0;

// Insurance
export const INSURANCE_REFUND_RATE = 0.5;

// Combo Bonuses
export const COMBO_BONUSES: Record<number, number> = { 2: 10, 3: 30, 4: 100 };

// Monthly Login Rewards
export const MONTHLY_LOGIN_REWARDS: Record<number, number> = { 1: 50, 5: 150, 10: 400, 15: 750, 20: 1500 };

// Chaos Spin
export const CHAOS_SPIN_MIN = -300;
export const CHAOS_SPIN_MAX = 700;
export const REVERSE_CHAOS_MIN = 50;
export const REVERSE_CHAOS_MAX = 200;

// Diamond Mine
export const DIAMOND_MINE_MIN_SPINS = 3;
export const DIAMOND_MINE_MAX_SPINS = 5;

// Hourly Jackpot
export const HOURLY_JACKPOT_AMOUNT = 100;

// Rage Mode
export const RAGE_MODE_LOSS_STACK = 5;
export const RAGE_MODE_MAX_STACK = 100;
export const RAGE_MODE_WIN_THRESHOLD = 50;

// Unlock & Multiplier Maps
export const UNLOCK_MAP: Record<number, string> = { 20: 'slots_20', 30: 'slots_30', 50: 'slots_50', 100: 'slots_100' };
export const MULTIPLIER_MAP: Record<number, number> = { 10: 1, 20: 2, 30: 3, 50: 5, 100: 10 };

// Wheel Probabilities (percentages)
export const WHEEL_JACKPOT_THRESHOLD = 1;        // < 1% for dachs category
export const WHEEL_JACKPOT_CHANCE = 0.00032;    // Within dachs category: 0.032% for 5x DACHS JACKPOT
export const WHEEL_DACHS_PRIZE = 500;           // Normal dachs prize
export const WHEEL_JACKPOT_PRIZE = 100000;      // 5x DACHS JACKPOT prize
export const WHEEL_DIAMOND_THRESHOLD = 5;       // < 5% for diamonds
export const WHEEL_DIAMOND_PRIZE = 1000;
export const WHEEL_GOLD_THRESHOLD = 20;         // < 20% for gold
export const WHEEL_GOLD_PRIZE = 400;
export const WHEEL_STAR_THRESHOLD = 50;         // < 50% for stars
export const WHEEL_STAR_PRIZE = 200;
