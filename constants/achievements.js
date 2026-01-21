/**
 * Achievements System - Definitions and Rewards
 *
 * ARCHITECTURE NOTES:
 * ===================
 * - Achievements are tracked in KV as JSON: `achievements:{username}`
 * - Each achievement has a unique ID, category, and optional reward
 * - REWARDS_ENABLED controls whether rewards are added to balance
 * - Set REWARDS_ENABLED = true to activate reward payouts
 *
 * CATEGORIES:
 * - spinning: Slot machine milestones
 * - winning: Win-related achievements
 * - collecting: Symbol collection achievements
 * - social: Transfers, duels, community
 * - dedication: Login streaks, daily claims
 * - shopping: Shop purchases
 * - special: Rare/hidden achievements
 */

// Master switch for reward payouts (false = tracked but no DT added)
export const ACHIEVEMENTS_REWARDS_ENABLED = false;

// Achievement Categories
export const ACHIEVEMENT_CATEGORIES = {
  SPINNING: 'spinning',
  WINNING: 'winning',
  COLLECTING: 'collecting',
  SOCIAL: 'social',
  DEDICATION: 'dedication',
  SHOPPING: 'shopping',
  SPECIAL: 'special'
};

/**
 * All achievements with their definitions
 *
 * Structure:
 * - id: Unique identifier (used as KV key)
 * - name: Display name (German)
 * - description: Achievement description (German)
 * - category: One of ACHIEVEMENT_CATEGORIES
 * - reward: DachsTaler reward (paid when REWARDS_ENABLED = true)
 * - hidden: If true, not shown until unlocked
 * - requirement: Numeric threshold (for progressive achievements)
 */
export const ACHIEVEMENTS = {
  // ========================================
  // SPINNING - Slot Machine Milestones
  // ========================================
  FIRST_SPIN: {
    id: 'first_spin',
    name: 'Erster Dreh',
    description: 'Spiele deinen ersten Slot Spin',
    category: ACHIEVEMENT_CATEGORIES.SPINNING,
    reward: 10,
    hidden: false
  },
  SPIN_100: {
    id: 'spin_100',
    name: 'Anfänger',
    description: 'Spiele 100 Spins',
    category: ACHIEVEMENT_CATEGORIES.SPINNING,
    reward: 50,
    hidden: false,
    requirement: 100
  },
  SPIN_500: {
    id: 'spin_500',
    name: 'Stammgast',
    description: 'Spiele 500 Spins',
    category: ACHIEVEMENT_CATEGORIES.SPINNING,
    reward: 150,
    hidden: false,
    requirement: 500
  },
  SPIN_1000: {
    id: 'spin_1000',
    name: 'Dauerspieler',
    description: 'Spiele 1.000 Spins',
    category: ACHIEVEMENT_CATEGORIES.SPINNING,
    reward: 300,
    hidden: false,
    requirement: 1000
  },
  SPIN_5000: {
    id: 'spin_5000',
    name: 'Slot-Veteran',
    description: 'Spiele 5.000 Spins',
    category: ACHIEVEMENT_CATEGORIES.SPINNING,
    reward: 750,
    hidden: false,
    requirement: 5000
  },
  SPIN_10000: {
    id: 'spin_10000',
    name: 'Slot-Legende',
    description: 'Spiele 10.000 Spins',
    category: ACHIEVEMENT_CATEGORIES.SPINNING,
    reward: 1500,
    hidden: false,
    requirement: 10000
  },

  // ========================================
  // WINNING - Win-Related Achievements
  // ========================================
  FIRST_WIN: {
    id: 'first_win',
    name: 'Erster Gewinn',
    description: 'Gewinne zum ersten Mal',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 25,
    hidden: false
  },
  WIN_100: {
    id: 'win_100',
    name: 'Gewinner',
    description: 'Gewinne 100 Mal',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 100,
    hidden: false,
    requirement: 100
  },
  WIN_500: {
    id: 'win_500',
    name: 'Glückspilz',
    description: 'Gewinne 500 Mal',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 300,
    hidden: false,
    requirement: 500
  },
  WIN_1000: {
    id: 'win_1000',
    name: 'Jackpot-Jäger',
    description: 'Gewinne 1.000 Mal',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 600,
    hidden: false,
    requirement: 1000
  },
  BIG_WIN_500: {
    id: 'big_win_500',
    name: 'Großgewinner',
    description: 'Gewinne 500+ DT in einem Spin',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 100,
    hidden: false,
    requirement: 500
  },
  BIG_WIN_1000: {
    id: 'big_win_1000',
    name: 'High Roller',
    description: 'Gewinne 1.000+ DT in einem Spin',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 250,
    hidden: false,
    requirement: 1000
  },
  BIG_WIN_5000: {
    id: 'big_win_5000',
    name: 'Mega-Gewinner',
    description: 'Gewinne 5.000+ DT in einem Spin',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 500,
    hidden: false,
    requirement: 5000
  },
  BIG_WIN_10000: {
    id: 'big_win_10000',
    name: 'Jackpot-König',
    description: 'Gewinne 10.000+ DT in einem Spin',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 1000,
    hidden: false,
    requirement: 10000
  },
  HOT_STREAK: {
    id: 'hot_streak',
    name: 'Feuerwalze',
    description: 'Erreiche einen Hot Streak (5 Gewinne in Folge)',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 75,
    hidden: false
  },
  COMEBACK_KING: {
    id: 'comeback_king',
    name: 'Comeback King',
    description: 'Gewinne nach 5+ Verlusten in Folge',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 100,
    hidden: false
  },
  HOURLY_JACKPOT: {
    id: 'hourly_jackpot',
    name: 'Zur richtigen Zeit',
    description: 'Gewinne den Hourly Jackpot',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 50,
    hidden: false
  },

  // ========================================
  // COLLECTING - Symbol Collection
  // ========================================
  FIRST_DACHS: {
    id: 'first_dachs',
    name: 'Dachs-Finder',
    description: 'Erhalte deinen ersten Dachs im Grid',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 25,
    hidden: false
  },
  DACHS_PAIR: {
    id: 'dachs_pair',
    name: 'Dachs-Duo',
    description: 'Erhalte ein Dachs-Paar',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 100,
    hidden: false
  },
  DACHS_TRIPLE: {
    id: 'dachs_triple',
    name: 'Dachs-Trio',
    description: 'Erhalte einen Dachs-Jackpot (3x Dachs)',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 500,
    hidden: false
  },
  DIAMOND_TRIPLE: {
    id: 'diamond_triple',
    name: 'Diamanten-Sammler',
    description: 'Erhalte ein Diamant-Triple',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 150,
    hidden: false
  },
  STAR_TRIPLE: {
    id: 'star_triple',
    name: 'Sternenstaub',
    description: 'Erhalte ein Stern-Triple',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 75,
    hidden: false
  },
  FRUIT_COLLECTOR: {
    id: 'fruit_collector',
    name: 'Obstkorb',
    description: 'Erhalte jedes Frucht-Triple einmal',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 200,
    hidden: false
  },
  ALL_TRIPLES: {
    id: 'all_triples',
    name: 'Triple-Meister',
    description: 'Erhalte jedes mögliche Triple einmal',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 1000,
    hidden: true
  },

  // ========================================
  // SOCIAL - Community & Interactions
  // ========================================
  FIRST_TRANSFER: {
    id: 'first_transfer',
    name: 'Großzügig',
    description: 'Überweise DachsTaler an einen anderen Spieler',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 25,
    hidden: false
  },
  TRANSFER_1000: {
    id: 'transfer_1000',
    name: 'Spendabel',
    description: 'Überweise insgesamt 1.000 DT an andere',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 75,
    hidden: false,
    requirement: 1000
  },
  TRANSFER_10000: {
    id: 'transfer_10000',
    name: 'Wohltäter',
    description: 'Überweise insgesamt 10.000 DT an andere',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 250,
    hidden: false,
    requirement: 10000
  },
  FIRST_DUEL: {
    id: 'first_duel',
    name: 'Herausforderer',
    description: 'Nimm an deinem ersten Duell teil',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 50,
    hidden: false
  },
  DUEL_WIN_10: {
    id: 'duel_win_10',
    name: 'Duellant',
    description: 'Gewinne 10 Duelle',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 150,
    hidden: false,
    requirement: 10
  },
  DUEL_WIN_50: {
    id: 'duel_win_50',
    name: 'Duell-Meister',
    description: 'Gewinne 50 Duelle',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 400,
    hidden: false,
    requirement: 50
  },
  DUEL_WIN_100: {
    id: 'duel_win_100',
    name: 'Duell-Legende',
    description: 'Gewinne 100 Duelle',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 750,
    hidden: false,
    requirement: 100
  },

  // ========================================
  // DEDICATION - Login & Activity
  // ========================================
  FIRST_DAILY: {
    id: 'first_daily',
    name: 'Tägliche Routine',
    description: 'Hole dir deine erste Daily-Belohnung',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 10,
    hidden: false
  },
  DAILY_7: {
    id: 'daily_7',
    name: 'Wochenspieler',
    description: 'Hole 7 Daily-Belohnungen in einem Monat',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 50,
    hidden: false,
    requirement: 7
  },
  DAILY_14: {
    id: 'daily_14',
    name: 'Halbmonats-Held',
    description: 'Hole 14 Daily-Belohnungen in einem Monat',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 100,
    hidden: false,
    requirement: 14
  },
  DAILY_20: {
    id: 'daily_20',
    name: 'Dauerbrenner',
    description: 'Hole 20 Daily-Belohnungen in einem Monat',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 200,
    hidden: false,
    requirement: 20
  },
  BALANCE_1000: {
    id: 'balance_1000',
    name: 'Sparer',
    description: 'Erreiche 1.000 DT Kontostand',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 50,
    hidden: false,
    requirement: 1000
  },
  BALANCE_5000: {
    id: 'balance_5000',
    name: 'Vermögend',
    description: 'Erreiche 5.000 DT Kontostand',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 150,
    hidden: false,
    requirement: 5000
  },
  BALANCE_10000: {
    id: 'balance_10000',
    name: 'Reich',
    description: 'Erreiche 10.000 DT Kontostand',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 300,
    hidden: false,
    requirement: 10000
  },
  BALANCE_50000: {
    id: 'balance_50000',
    name: 'Millionär',
    description: 'Erreiche 50.000 DT Kontostand',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 750,
    hidden: false,
    requirement: 50000
  },
  BALANCE_100000: {
    id: 'balance_100000',
    name: 'DachsTaler-Tycoon',
    description: 'Erreiche 100.000 DT Kontostand',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 1500,
    hidden: false,
    requirement: 100000
  },

  // ========================================
  // SHOPPING - Shop Purchases
  // ========================================
  FIRST_PURCHASE: {
    id: 'first_purchase',
    name: 'Erster Einkauf',
    description: 'Kaufe dein erstes Item im Shop',
    category: ACHIEVEMENT_CATEGORIES.SHOPPING,
    reward: 25,
    hidden: false
  },
  SHOP_10: {
    id: 'shop_10',
    name: 'Stammkunde',
    description: 'Kaufe 10 Items im Shop',
    category: ACHIEVEMENT_CATEGORIES.SHOPPING,
    reward: 75,
    hidden: false,
    requirement: 10
  },
  SHOP_50: {
    id: 'shop_50',
    name: 'Shopping-König',
    description: 'Kaufe 50 Items im Shop',
    category: ACHIEVEMENT_CATEGORIES.SHOPPING,
    reward: 200,
    hidden: false,
    requirement: 50
  },
  SHOP_100: {
    id: 'shop_100',
    name: 'Kaufsüchtig',
    description: 'Kaufe 100 Items im Shop',
    category: ACHIEVEMENT_CATEGORIES.SHOPPING,
    reward: 500,
    hidden: false,
    requirement: 100
  },
  UNLOCK_ALL_SLOTS: {
    id: 'unlock_all_slots',
    name: 'Freigeschaltet',
    description: 'Schalte alle Slot-Stufen frei (20, 30, 50, 100, all)',
    category: ACHIEVEMENT_CATEGORIES.SHOPPING,
    reward: 500,
    hidden: false
  },

  // ========================================
  // SPECIAL - Rare/Hidden Achievements
  // ========================================
  PERFECT_TIMING: {
    id: 'perfect_timing',
    name: 'Perfektes Timing',
    description: 'Spiele genau um Mitternacht (UTC)',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 100,
    hidden: true
  },
  LUCKY_777: {
    id: 'lucky_777',
    name: 'Lucky 777',
    description: 'Habe genau 777 DT auf dem Konto',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 77,
    hidden: true
  },
  ZERO_HERO: {
    id: 'zero_hero',
    name: 'Zero Hero',
    description: 'Gewinne mit 0 DT auf dem Konto',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 100,
    hidden: true
  },
  INSURANCE_SAVE: {
    id: 'insurance_save',
    name: 'Versichert',
    description: 'Werde zum ersten Mal von Insurance gerettet',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 25,
    hidden: false
  },
  FREE_SPIN_WIN: {
    id: 'free_spin_win',
    name: 'Gratis-Glück',
    description: 'Gewinne mit einem Free Spin',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 25,
    hidden: false
  },
  SLOTS_ALL_WIN: {
    id: 'slots_all_win',
    name: 'All-In Gewinner',
    description: 'Gewinne mit !slots all',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 150,
    hidden: false
  },
  WILD_CARD_WIN: {
    id: 'wild_card_win',
    name: 'Wild Child',
    description: 'Gewinne mit einer Wild Card',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 50,
    hidden: false
  },
  CHAOS_SPIN_BIG: {
    id: 'chaos_spin_big',
    name: 'Chaos-Meister',
    description: 'Gewinne 1000+ DT mit einem Chaos Spin',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 200,
    hidden: true,
    requirement: 1000
  },
  WHEEL_JACKPOT: {
    id: 'wheel_jackpot',
    name: 'Glücksrad-Champion',
    description: 'Gewinne den Glücksrad-Jackpot (5x Dachs)',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    reward: 1000,
    hidden: true
  }
};

// Helper: Get achievement by ID
export function getAchievementById(id) {
  return Object.values(ACHIEVEMENTS).find(a => a.id === id) || null;
}

// Helper: Get all achievements in a category
export function getAchievementsByCategory(category) {
  return Object.values(ACHIEVEMENTS).filter(a => a.category === category);
}

// Helper: Get all visible achievements
export function getVisibleAchievements() {
  return Object.values(ACHIEVEMENTS).filter(a => !a.hidden);
}

// Helper: Get all achievements as array
export function getAllAchievements() {
  return Object.values(ACHIEVEMENTS);
}

// Map achievement IDs to stat keys for progress tracking
const ACHIEVEMENT_STAT_MAPPING = {
  // Spinning
  'spin_100': 'totalSpins',
  'spin_500': 'totalSpins',
  'spin_1000': 'totalSpins',
  'spin_5000': 'totalSpins',
  'spin_10000': 'totalSpins',
  // Winning
  'win_100': 'wins',
  'win_500': 'wins',
  'win_1000': 'wins',
  // Social
  'transfer_1000': 'totalTransferred',
  'transfer_10000': 'totalTransferred',
  'duel_win_10': 'duelsWon',
  'duel_win_50': 'duelsWon',
  'duel_win_100': 'duelsWon',
  // Dedication
  'daily_7': 'dailysClaimed',
  'daily_14': 'dailysClaimed',
  'daily_20': 'dailysClaimed',
  // Shopping
  'shop_10': 'shopPurchases',
  'shop_50': 'shopPurchases',
  'shop_100': 'shopPurchases'
};

export function getStatKeyForAchievement(achievementId) {
  return ACHIEVEMENT_STAT_MAPPING[achievementId] || null;
}
