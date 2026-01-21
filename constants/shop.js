/**
 * Shop Constants - Items, limits, and prerequisite mappings
 */

export const SHOP_ITEMS = {
  1: { name: 'Peek Token', price: 75, type: 'peek', symbol: '👁️' },
  2: { name: 'Kirschen-Boost', price: 50, type: 'boost', symbol: '🍒' },
  3: { name: 'Zitronen-Boost', price: 50, type: 'boost', symbol: '🍋' },
  4: { name: 'Orangen-Boost', price: 50, type: 'boost', symbol: '🍊' },
  5: { name: 'Trauben-Boost', price: 50, type: 'boost', symbol: '🍇' },
  6: { name: 'Wassermelonen-Boost', price: 50, type: 'boost', symbol: '🍉' },
  7: { name: 'Stern-Boost', price: 50, type: 'boost', symbol: '⭐' },
  8: { name: 'Dachs-Boost', price: 150, type: 'boost', symbol: '🦡', weeklyLimit: true },
  9: { name: 'Insurance Pack', price: 250, type: 'insurance', symbol: '🛡️' },
  10: { name: 'Win Multiplier', price: 250, type: 'winmulti', symbol: '✖️' },
  11: { name: 'Chaos Spin', price: 250, type: 'instant', symbol: '🌀' },
  12: { name: 'Glücksrad Spin', price: 300, type: 'instant', symbol: '🎡' },
  13: { name: '!slots 20 Unlock', price: 500, type: 'unlock', unlockKey: 'slots_20', symbol: '🔓' },
  14: { name: 'Happy Hour', price: 800, type: 'timed', buffKey: 'happy_hour', duration: 3600, symbol: '⚡' },
  15: { name: 'Spin Bundle', price: 90, type: 'bundle', symbol: '🎰' },
  16: { name: 'Mystery Box', price: 1000, type: 'instant', symbol: '📦' },
  17: { name: 'Bronze Dachs Rang', price: 1200, type: 'prestige', rank: '🥉', symbol: '🥉' },
  19: { name: '!slots 30 Unlock', price: 2000, type: 'unlock', unlockKey: 'slots_30', requires: 'slots_20', symbol: '🔓' },
  20: { name: 'Lucky Charm', price: 2000, type: 'timed', buffKey: 'lucky_charm', duration: 3600, symbol: '🍀' },
  21: { name: '!slots 50 Unlock', price: 2500, type: 'unlock', unlockKey: 'slots_50', requires: 'slots_30', symbol: '🔓' },
  22: { name: 'Silber Dachs Rang', price: 3000, type: 'prestige', rank: '🥈', requiresRank: '🥉', symbol: '🥈' },
  23: { name: '!slots 100 Unlock', price: 3250, type: 'unlock', unlockKey: 'slots_100', requires: 'slots_50', symbol: '🔓' },
  24: { name: 'Golden Hour', price: 3500, type: 'timed', buffKey: 'golden_hour', duration: 3600, symbol: '✨' },
  25: { name: '!slots all Unlock', price: 4444, type: 'unlock', unlockKey: 'slots_all', requires: 'slots_100', symbol: '🔓' },
  26: { name: 'Gold Dachs Rang', price: 8000, type: 'prestige', rank: '🥇', requiresRank: '🥈', symbol: '🥇' },
  27: { name: 'Daily Interest Boost', price: 10000, type: 'unlock', unlockKey: 'daily_boost', symbol: '💰' },
  28: { name: 'Custom Win Message', price: 10000, type: 'unlock', unlockKey: 'custom_message', symbol: '💬' },
  29: { name: 'Platin Dachs Rang', price: 25000, type: 'prestige', rank: '💎', requiresRank: '🥇', symbol: '💎' },
  30: { name: 'Legendary Dachs Rang', price: 44444, type: 'prestige', rank: '👑', requiresRank: '💎', symbol: '👑' },
  31: { name: 'Reverse Chaos', price: 150, type: 'instant', symbol: '🔄' },
  32: { name: 'Star Magnet', price: 1200, type: 'timed', buffKey: 'star_magnet', duration: 3600, symbol: '🌟' },
  33: { name: 'Dachs Locator', price: 1500, type: 'timed', buffKey: 'dachs_locator', duration: 600, uses: 10, symbol: '🦡' },
  34: { name: 'Rage Mode', price: 4000, type: 'timed', buffKey: 'rage_mode', duration: 1800, symbol: '🔥' },
  35: { name: 'Profit Doubler', price: 5000, type: 'timed', buffKey: 'profit_doubler', duration: 86400, symbol: '📈' },
  36: { name: 'Diamond Mine', price: 2500, type: 'instant', symbol: '💎' },
  37: { name: 'Guaranteed Pair', price: 180, type: 'instant', symbol: '🎯' },
  38: { name: 'Wild Card', price: 250, type: 'instant', symbol: '🃏' },
  39: { name: 'Diamond Rush', price: 2000, type: 'timed', buffKey: 'diamond_rush', duration: 3600, symbol: '💎' }
};

export const PREREQUISITE_NAMES = {
  'slots_20': '!slots 20',
  'slots_30': '!slots 30',
  'slots_50': '!slots 50',
  'slots_100': '!slots 100'
};

// Shop limits
export const WEEKLY_DACHS_BOOST_LIMIT = 1;
export const WEEKLY_SPIN_BUNDLE_LIMIT = 3;
export const SPIN_BUNDLE_COUNT = 10;
export const SPIN_BUNDLE_MULTIPLIER = 1;
