// Constants
const RESPONSE_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8' };
const MS_PER_HOUR = 3600000;
const MS_PER_MINUTE = 60000;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

const MAX_BALANCE = 999999999;
const MIN_TRANSFER = 1;
const MAX_TRANSFER = 100000;
const HOURLY_JACKPOT_AMOUNT = 100;
const COOLDOWN_SECONDS = 30; // Spin cooldown in seconds
const BANK_USERNAME = 'dachsbank';
const BANK_START_BALANCE = 444444;
const BANK_KEY = `user:${BANK_USERNAME}`;

// TTL Constants (in seconds)
const LEADERBOARD_CACHE_TTL = 300; // 5 minutes
const DAILY_TTL_SECONDS = SECONDS_PER_DAY + SECONDS_PER_HOUR; // 25 hours (1 day + buffer)
const PEEK_TTL_SECONDS = SECONDS_PER_HOUR; // 1 hour
const JACKPOT_CLAIM_TTL = SECONDS_PER_HOUR; // 1 hour
const BUFF_TTL_BUFFER_SECONDS = 60; // Extra buffer for buff expiration

// Balance Constants
const STARTING_BALANCE = 100;

// Daily Rewards
const DAILY_AMOUNT = 50;
const DAILY_BOOST_AMOUNT = 250;
const LOW_BALANCE_WARNING = 100;

// Streak System
const STREAK_THRESHOLD = 5; // Wins/Losses in Folge für Bonus
const HOT_STREAK_BONUS = 500; // Bonus für 5 Wins in Folge
const COMEBACK_BONUS = 150; // Bonus für Win nach 5 Losses
const STREAK_TTL_SECONDS = 604800; // 7 Tage
const STREAK_MULTIPLIER_INCREMENT = 0.1;
const STREAK_MULTIPLIER_MAX = 3.0;

// Dachs Payouts
const DACHS_TRIPLE_PAYOUT = 15000; // 3x Dachs Jackpot
const DACHS_PAIR_PAYOUT = 2500; // 2x Dachs
const DACHS_SINGLE_PAYOUT = 100; // 1x Dachs

// Insurance
const INSURANCE_REFUND_RATE = 0.5; // 50% Refund

// DEBUG MODE - Set to true for testing (exaint_ only)
const DEBUG_MODE = false; // Change to true to enable

// OPTIMIZED: Symbol weights with pre-computed cumulative weights (eliminates loop iteration)
const SYMBOL_WEIGHTS = [
  { symbol: '🍒', weight: 24 },
  { symbol: '🍋', weight: 20 },
  { symbol: '🍊', weight: 19 },
  { symbol: '💎', weight: 21 },
  { symbol: '🍇', weight: 15 },
  { symbol: '🍉', weight: 11 },
  { symbol: '⭐', weight: 10 }
];
const TOTAL_WEIGHT = 120;

// Pre-computed cumulative weights for O(1) binary search lookup
const CUMULATIVE_WEIGHTS = SYMBOL_WEIGHTS.reduce((acc, { symbol, weight }) => {
  const cumulative = (acc.length > 0 ? acc[acc.length - 1].cumulative : 0) + weight;
  acc.push({ symbol, cumulative });
  return acc;
}, []);

const SHOP_ITEMS = {
  1: { name: 'Peek Token', price: 75, type: 'peek' },
  2: { name: '🍒 Kirschen-Boost', price: 50, type: 'boost', symbol: '🍒' },
  3: { name: '🍋 Zitronen-Boost', price: 50, type: 'boost', symbol: '🍋' },
  4: { name: '🍊 Orangen-Boost', price: 50, type: 'boost', symbol: '🍊' },
  5: { name: '🍇 Trauben-Boost', price: 50, type: 'boost', symbol: '🍇' },
  6: { name: '🍉 Wassermelonen-Boost', price: 50, type: 'boost', symbol: '🍉' },
  7: { name: '⭐ Stern-Boost', price: 50, type: 'boost', symbol: '⭐' },
  8: { name: '🦡 Dachs-Boost', price: 150, type: 'boost', symbol: '🦡', weeklyLimit: true },
  9: { name: 'Insurance Pack', price: 250, type: 'insurance' },
  10: { name: 'Win Multiplier', price: 250, type: 'winmulti' },
  11: { name: 'Chaos Spin', price: 250, type: 'instant' },
  12: { name: 'Glücksrad Spin', price: 300, type: 'instant' },
  13: { name: '!slots 20 Unlock', price: 500, type: 'unlock', unlockKey: 'slots_20' },
  14: { name: 'Happy Hour', price: 800, type: 'timed', buffKey: 'happy_hour', duration: 3600 },
  15: { name: 'Spin Bundle', price: 90, type: 'bundle' },
  16: { name: 'Mystery Box', price: 1000, type: 'instant' },
  17: { name: 'Bronze Dachs Rang 🥉', price: 1200, type: 'prestige', rank: '🥉' },
  18: { name: 'Stats Tracker', price: 1250, type: 'unlock', unlockKey: 'stats_tracker' },
  19: { name: '!slots 30 Unlock', price: 2000, type: 'unlock', unlockKey: 'slots_30', requires: 'slots_20' },
  20: { name: 'Lucky Charm', price: 2000, type: 'timed', buffKey: 'lucky_charm', duration: 3600 },
  21: { name: '!slots 50 Unlock', price: 2500, type: 'unlock', unlockKey: 'slots_50', requires: 'slots_30' },
  22: { name: 'Silber Dachs Rang 🥈', price: 3000, type: 'prestige', rank: '🥈', requiresRank: '🥉' },
  23: { name: '!slots 100 Unlock', price: 3250, type: 'unlock', unlockKey: 'slots_100', requires: 'slots_50' },
  24: { name: 'Golden Hour', price: 3500, type: 'timed', buffKey: 'golden_hour', duration: 3600 },
  25: { name: '!slots all Unlock', price: 4444, type: 'unlock', unlockKey: 'slots_all', requires: 'slots_100' },
  26: { name: 'Gold Dachs Rang 🥇', price: 8000, type: 'prestige', rank: '🥇', requiresRank: '🥈' },
  27: { name: 'Daily Interest Boost', price: 10000, type: 'unlock', unlockKey: 'daily_boost' },
  28: { name: 'Custom Win Message', price: 10000, type: 'unlock', unlockKey: 'custom_message' },
  29: { name: 'Platin Dachs Rang 💎', price: 25000, type: 'prestige', rank: '💎', requiresRank: '🥇' },
  30: { name: 'Legendary Dachs Rang 👑', price: 44444, type: 'prestige', rank: '👑', requiresRank: '💎' },
  31: { name: 'Reverse Chaos', price: 150, type: 'instant' },
  32: { name: '🌟 Star Magnet', price: 1200, type: 'timed', buffKey: 'star_magnet', duration: 3600 },
  33: { name: '🦡 Dachs Locator', price: 1500, type: 'timed', buffKey: 'dachs_locator', duration: 600, uses: 10 },
  34: { name: '🔥 Rage Mode', price: 4000, type: 'timed', buffKey: 'rage_mode', duration: 1800 },
  35: { name: '📈 Profit Doubler', price: 5000, type: 'timed', buffKey: 'profit_doubler', duration: 86400 },
  36: { name: '💎 Diamond Mine', price: 2500, type: 'instant' },
  37: { name: '🎯 Guaranteed Pair', price: 180, type: 'instant' },
  38: { name: '🃏 Wild Card', price: 250, type: 'instant' },
  39: { name: '💎 Diamond Rush', price: 2000, type: 'timed', buffKey: 'diamond_rush', duration: 3600 }
};

const PREREQUISITE_NAMES = {
  'slots_20': '!slots 20',
  'slots_30': '!slots 30',
  'slots_50': '!slots 50',
  'slots_100': '!slots 100'
};

const PRESTIGE_RANKS = ['🥉', '🥈', '🥇', '💎', '👑'];

const TRIPLE_PAYOUTS = {'⭐': 500, '🍉': 250, '🍇': 150, '🍊': 100, '🍋': 75, '🍒': 50};
const PAIR_PAYOUTS = {'⭐': 50, '🍉': 25, '🍇': 15, '🍊': 10, '🍋': 8, '🍒': 5};

// OPTIMIZED: Module-level constants for better performance
const UNLOCK_MAP = { 20: 'slots_20', 30: 'slots_30', 50: 'slots_50', 100: 'slots_100' };
const MULTIPLIER_MAP = { 10: 1, 20: 2, 30: 3, 50: 5, 100: 10 };
const BASE_SPIN_COST = 10;
const DACHS_BASE_CHANCE = 1 / 150;

// OPTIMIZED: Loss messages as constant
const LOSS_MESSAGES = {
  10: ' 😔 10 Losses in Folge - Möchtest du vielleicht eine Pause einlegen?',
  11: ' 🦡 11 Losses - Der Dachs versteckt sich noch... vielleicht eine kurze Pause?',
  12: ' 🦡💤 12 Losses - Der Dachs macht ein Nickerchen... Pause könnte helfen!',
  13: ' 🦡🌙 13 Losses - Der Dachs träumt vom Gewinn... Morgen vielleicht?',
  14: ' 🦡🍂 14 Losses - Der Dachs sammelt Wintervorräte... Zeit für eine Pause!',
  15: ' 🦡❄️ 15 Losses - Der Dachs überwintert... Komm später wieder!',
  16: ' 🦡🏔️ 16 Losses - Der Dachs ist tief im Bau... Vielleicht morgen mehr Glück?',
  17: ' 🦡🌌 17 Losses - Der Dachs philosophiert über das Leben... Pause empfohlen!',
  18: ' 🦡📚 18 Losses - Der Dachs liest ein Buch... Du auch? Pause! 📖',
  19: ' 🦡🎮 19 Losses - Der Dachs zockt was anderes... Du auch? 🎮',
  20: ' 🦡☕ 20 Losses - Der Dachs trinkt Kaffee und entspannt... Pause seriously! ☕'
};

const ROTATING_LOSS_MESSAGES = [
  ' 🦡🛌 Der Dachs schläft fest... Lass ihn ruhen! 😴',
  ' 🦡🧘 Der Dachs meditiert... Innere Ruhe finden! 🧘‍♂️',
  ' 🦡🎨 Der Dachs malt ein Bild... Kreative Pause! 🎨',
  ' 🦡🏃 Der Dachs macht Sport... Beweg dich auch! 🏃',
  ' 🦡🌳 Der Dachs genießt die Natur... Geh raus! 🌳'
];

// OPTIMIZED: Static loss messages array (avoid recreation per spin)
const SPIN_LOSS_MESSAGES = ['Leider verloren! 😢', 'Nächstes Mal!', 'Fast! Versuch es nochmal!', 'Kein Glück diesmal...'];

// Monthly Login rewards
const MONTHLY_LOGIN_REWARDS = {
  1: 50,
  5: 150,
  10: 400,
  15: 750,
  20: 1500
};

// Combo bonus system
const COMBO_BONUSES = {
  2: 10, 3: 30, 4: 100
};

// Grid configuration
const GRID_SIZE = 9;
const GRID_WIDTH = 3;
const MIDDLE_ROW_START = 3;
const MIDDLE_ROW_END = 5;

// Debug mode configuration
const DEBUG_DACHS_PAIR_CHANCE = 0.75; // 75% chance for 2 dachs in debug mode

// Chaos Spin ranges
const CHAOS_SPIN_MIN = -300;
const CHAOS_SPIN_MAX = 700;
const REVERSE_CHAOS_MIN = 50;
const REVERSE_CHAOS_MAX = 200;

// Diamond Mine free spins range
const DIAMOND_MINE_MIN_SPINS = 3;
const DIAMOND_MINE_MAX_SPINS = 5;

// Star Magnet & Diamond Rush reroll chance
const BUFF_REROLL_CHANCE = 0.66;

// Symbol boost chance modification
const SYMBOL_BOOST_CHANCE = 0.33;

// Shop limits
const WEEKLY_DACHS_BOOST_LIMIT = 1;
const WEEKLY_SPIN_BUNDLE_LIMIT = 3;
const SPIN_BUNDLE_COUNT = 10;
const SPIN_BUNDLE_MULTIPLIER = 1;

// Rage Mode constants
const RAGE_MODE_LOSS_STACK = 5;
const RAGE_MODE_MAX_STACK = 100;
const RAGE_MODE_WIN_THRESHOLD = 50;

// URLs
const URLS = {
  INFO: 'https://git.new/DachsbauSlotInfos',
  SHOP: 'https://git.new/DachsbauSlotsShop',
  UNLOCK: 'https://dub.sh/SlotUnlock'
};

// Buff lists for admin operations
const ALL_BUFF_KEYS = ['happy_hour', 'lucky_charm', 'golden_hour', 'dachs_locator', 'rage_mode', 'star_magnet', 'profit_doubler', 'diamond_rush'];
const ALL_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '🦡', '💎'];
const ALL_UNLOCK_KEYS = ['slots_20', 'slots_30', 'slots_50', 'slots_100', 'slots_all', 'stats_tracker', 'daily_boost', 'custom_message'];

// OPTIMIZED: Static symbol arrays for reuse (avoid recreation per request)
const GUARANTEED_PAIR_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐'];
const BUFF_SYMBOLS_WITH_NAMES = [
  { symbol: '🍒', name: 'Kirschen' },
  { symbol: '🍋', name: 'Zitronen' },
  { symbol: '🍊', name: 'Orangen' },
  { symbol: '🍇', name: 'Trauben' },
  { symbol: '🍉', name: 'Wassermelonen' },
  { symbol: '⭐', name: 'Stern' },
  { symbol: '🦡', name: 'Dachs' }
];

export {
  RESPONSE_HEADERS,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_DAY,
  MAX_BALANCE,
  MIN_TRANSFER,
  MAX_TRANSFER,
  HOURLY_JACKPOT_AMOUNT,
  COOLDOWN_SECONDS,
  BANK_USERNAME,
  BANK_START_BALANCE,
  BANK_KEY,
  LEADERBOARD_CACHE_TTL,
  DAILY_TTL_SECONDS,
  PEEK_TTL_SECONDS,
  JACKPOT_CLAIM_TTL,
  BUFF_TTL_BUFFER_SECONDS,
  DEBUG_MODE,
  SYMBOL_WEIGHTS,
  TOTAL_WEIGHT,
  CUMULATIVE_WEIGHTS,
  SHOP_ITEMS,
  PREREQUISITE_NAMES,
  PRESTIGE_RANKS,
  TRIPLE_PAYOUTS,
  PAIR_PAYOUTS,
  UNLOCK_MAP,
  MULTIPLIER_MAP,
  BASE_SPIN_COST,
  DACHS_BASE_CHANCE,
  STARTING_BALANCE,
  DAILY_AMOUNT,
  DAILY_BOOST_AMOUNT,
  LOW_BALANCE_WARNING,
  STREAK_THRESHOLD,
  HOT_STREAK_BONUS,
  COMEBACK_BONUS,
  STREAK_TTL_SECONDS,
  STREAK_MULTIPLIER_INCREMENT,
  STREAK_MULTIPLIER_MAX,
  DACHS_TRIPLE_PAYOUT,
  DACHS_PAIR_PAYOUT,
  DACHS_SINGLE_PAYOUT,
  INSURANCE_REFUND_RATE,
  LOSS_MESSAGES,
  ROTATING_LOSS_MESSAGES,
  MONTHLY_LOGIN_REWARDS,
  COMBO_BONUSES,
  GRID_SIZE,
  GRID_WIDTH,
  MIDDLE_ROW_START,
  MIDDLE_ROW_END,
  DEBUG_DACHS_PAIR_CHANCE,
  CHAOS_SPIN_MIN,
  CHAOS_SPIN_MAX,
  REVERSE_CHAOS_MIN,
  REVERSE_CHAOS_MAX,
  DIAMOND_MINE_MIN_SPINS,
  DIAMOND_MINE_MAX_SPINS,
  BUFF_REROLL_CHANCE,
  SYMBOL_BOOST_CHANCE,
  WEEKLY_DACHS_BOOST_LIMIT,
  WEEKLY_SPIN_BUNDLE_LIMIT,
  SPIN_BUNDLE_COUNT,
  SPIN_BUNDLE_MULTIPLIER,
  RAGE_MODE_LOSS_STACK,
  RAGE_MODE_MAX_STACK,
  RAGE_MODE_WIN_THRESHOLD,
  URLS,
  ALL_BUFF_KEYS,
  ALL_SYMBOLS,
  ALL_UNLOCK_KEYS,
  GUARANTEED_PAIR_SYMBOLS,
  BUFF_SYMBOLS_WITH_NAMES,
  SPIN_LOSS_MESSAGES
};
