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

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  reward: number;
  hidden: boolean;
  requirement?: number;
}

// Master switch for reward payouts (false = tracked but no DT added)
export const ACHIEVEMENTS_REWARDS_ENABLED = false;

// Achievement Categories
export const ACHIEVEMENT_CATEGORIES = {
  SPINNING: 'spinning',
  WINNING: 'winning',
  LOSING: 'losing',
  COLLECTING: 'collecting',
  SOCIAL: 'social',
  DEDICATION: 'dedication',
  SHOPPING: 'shopping',
  ITEMS: 'items',
  SPECIAL: 'special'
} as const;

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
export const ACHIEVEMENTS: Record<string, Achievement> = {
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
  HOURLY_JACKPOT_3: {
    id: 'hourly_jackpot_3',
    name: 'Jackpot-Sammler',
    description: 'Gewinne 3 Hourly Jackpots',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 75,
    hidden: false,
    requirement: 3
  },
  HOURLY_JACKPOT_10: {
    id: 'hourly_jackpot_10',
    name: 'Jackpot-Magnet',
    description: 'Gewinne 10 Hourly Jackpots',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 200,
    hidden: false,
    requirement: 10
  },
  HOURLY_JACKPOT_25: {
    id: 'hourly_jackpot_25',
    name: 'Jackpot-Legende',
    description: 'Gewinne 25 Hourly Jackpots',
    category: ACHIEVEMENT_CATEGORIES.WINNING,
    reward: 500,
    hidden: false,
    requirement: 25
  },

  // ========================================
  // LOSING - Loss Milestones & Streaks
  // ========================================
  LOSS_100: {
    id: 'loss_100',
    name: 'Pechvogel',
    description: 'Verliere 100 Mal',
    category: ACHIEVEMENT_CATEGORIES.LOSING,
    reward: 50,
    hidden: false,
    requirement: 100
  },
  LOSS_500: {
    id: 'loss_500',
    name: 'Leidgeprüft',
    description: 'Verliere 500 Mal',
    category: ACHIEVEMENT_CATEGORIES.LOSING,
    reward: 150,
    hidden: false,
    requirement: 500
  },
  LOSS_1000: {
    id: 'loss_1000',
    name: 'Stehaufmännchen',
    description: 'Verliere 1.000 Mal',
    category: ACHIEVEMENT_CATEGORIES.LOSING,
    reward: 300,
    hidden: false,
    requirement: 1000
  },
  LOSS_STREAK_5: {
    id: 'loss_streak_5',
    name: 'Pechsträhne',
    description: 'Verliere 5 Mal in Folge',
    category: ACHIEVEMENT_CATEGORIES.LOSING,
    reward: 50,
    hidden: false,
    requirement: 5
  },
  LOSS_STREAK_10: {
    id: 'loss_streak_10',
    name: 'Schwarzer Tag',
    description: 'Verliere 10 Mal in Folge',
    category: ACHIEVEMENT_CATEGORIES.LOSING,
    reward: 100,
    hidden: false,
    requirement: 10
  },
  LOSS_STREAK_15: {
    id: 'loss_streak_15',
    name: 'Unzerstörbar',
    description: 'Verliere 15 Mal in Folge',
    category: ACHIEVEMENT_CATEGORIES.LOSING,
    reward: 200,
    hidden: false,
    requirement: 15
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
  DACHS_SEEN_10: {
    id: 'dachs_seen_10',
    name: 'Dachs-Spotter',
    description: 'Sieh insgesamt 10 Dachse in deinen Spins',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 25,
    hidden: false,
    requirement: 10
  },
  DACHS_SEEN_50: {
    id: 'dachs_seen_50',
    name: 'Dachs-Freund',
    description: 'Sieh insgesamt 50 Dachse in deinen Spins',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 75,
    hidden: false,
    requirement: 50
  },
  DACHS_SEEN_100: {
    id: 'dachs_seen_100',
    name: 'Dachs-Magnet',
    description: 'Sieh insgesamt 100 Dachse in deinen Spins',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 200,
    hidden: false,
    requirement: 100
  },
  DACHS_SEEN_500: {
    id: 'dachs_seen_500',
    name: 'Dachs-Flüsterer',
    description: 'Sieh insgesamt 500 Dachse in deinen Spins',
    category: ACHIEVEMENT_CATEGORIES.COLLECTING,
    reward: 500,
    hidden: false,
    requirement: 500
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
  DUEL_LOSS_10: {
    id: 'duel_loss_10',
    name: 'Guter Verlierer',
    description: 'Verliere 10 Duelle',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 50,
    hidden: false,
    requirement: 10
  },
  DUEL_LOSS_50: {
    id: 'duel_loss_50',
    name: 'Ehrenhaft',
    description: 'Verliere 50 Duelle',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 150,
    hidden: false,
    requirement: 50
  },
  DUEL_LOSS_100: {
    id: 'duel_loss_100',
    name: 'Unerschütterlich',
    description: 'Verliere 100 Duelle',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 300,
    hidden: false,
    requirement: 100
  },
  DUEL_STREAK_5: {
    id: 'duel_streak_5',
    name: 'Duell-Serie',
    description: 'Gewinne 5 Duelle in Folge',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 100,
    hidden: false,
    requirement: 5
  },
  DUEL_STREAK_10: {
    id: 'duel_streak_10',
    name: 'Duell-Dominator',
    description: 'Gewinne 10 Duelle in Folge',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 250,
    hidden: false,
    requirement: 10
  },
  DUEL_STREAK_20: {
    id: 'duel_streak_20',
    name: 'Unbesiegbar',
    description: 'Gewinne 20 Duelle in Folge',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 500,
    hidden: false,
    requirement: 20
  },
  DUEL_WINNINGS_1000: {
    id: 'duel_winnings_1000',
    name: 'Duell-Profiteur',
    description: 'Gewinne insgesamt 1.000 DT in Duellen',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 100,
    hidden: false,
    requirement: 1000
  },
  DUEL_WINNINGS_5000: {
    id: 'duel_winnings_5000',
    name: 'Duell-Abräumer',
    description: 'Gewinne insgesamt 5.000 DT in Duellen',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 250,
    hidden: false,
    requirement: 5000
  },
  DUEL_WINNINGS_10000: {
    id: 'duel_winnings_10000',
    name: 'Duell-Tycoon',
    description: 'Gewinne insgesamt 10.000 DT in Duellen',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 500,
    hidden: false,
    requirement: 10000
  },
  TRANSFER_COUNT_10: {
    id: 'transfer_count_10',
    name: 'Überweiser',
    description: 'Tätige 10 Überweisungen',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 50,
    hidden: false,
    requirement: 10
  },
  TRANSFER_COUNT_50: {
    id: 'transfer_count_50',
    name: 'Bankberater',
    description: 'Tätige 50 Überweisungen',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 150,
    hidden: false,
    requirement: 50
  },
  TRANSFER_COUNT_100: {
    id: 'transfer_count_100',
    name: 'Finanzexperte',
    description: 'Tätige 100 Überweisungen',
    category: ACHIEVEMENT_CATEGORIES.SOCIAL,
    reward: 300,
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
  PLAY_DAYS_7: {
    id: 'play_days_7',
    name: 'Erste Woche',
    description: 'Spiele an 7 verschiedenen Tagen',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 25,
    hidden: false,
    requirement: 7
  },
  PLAY_DAYS_30: {
    id: 'play_days_30',
    name: 'Monatspass',
    description: 'Spiele an 30 verschiedenen Tagen',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 100,
    hidden: false,
    requirement: 30
  },
  PLAY_DAYS_100: {
    id: 'play_days_100',
    name: 'Treuer Spieler',
    description: 'Spiele an 100 verschiedenen Tagen',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 300,
    hidden: false,
    requirement: 100
  },
  PLAY_DAYS_365: {
    id: 'play_days_365',
    name: 'Jahreskarte',
    description: 'Spiele an 365 verschiedenen Tagen',
    category: ACHIEVEMENT_CATEGORIES.DEDICATION,
    reward: 1000,
    hidden: false,
    requirement: 365
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
  // ITEMS - Item & Buff Usage
  // ========================================
  CHAOS_SPIN_10: {
    id: 'chaos_spin_10',
    name: 'Chaos-Fan',
    description: 'Nutze 10 Chaos-Spins',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 50,
    hidden: false,
    requirement: 10
  },
  CHAOS_SPIN_50: {
    id: 'chaos_spin_50',
    name: 'Chaos-Liebhaber',
    description: 'Nutze 50 Chaos-Spins',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 150,
    hidden: false,
    requirement: 50
  },
  CHAOS_SPIN_100: {
    id: 'chaos_spin_100',
    name: 'Chaos-Süchtig',
    description: 'Nutze 100 Chaos-Spins',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 300,
    hidden: false,
    requirement: 100
  },
  REVERSE_CHAOS_10: {
    id: 'reverse_chaos_10',
    name: 'Reverse-Enthusiast',
    description: 'Nutze 10 Reverse-Chaos-Spins',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 75,
    hidden: false,
    requirement: 10
  },
  WHEEL_SPIN_10: {
    id: 'wheel_spin_10',
    name: 'Glücksrad-Dreher',
    description: 'Nutze 10 Glücksrad-Spins',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 50,
    hidden: false,
    requirement: 10
  },
  MYSTERY_BOX_10: {
    id: 'mystery_box_10',
    name: 'Mystery-Sammler',
    description: 'Öffne 10 Mystery-Boxen',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 50,
    hidden: false,
    requirement: 10
  },
  INSURANCE_5: {
    id: 'insurance_5',
    name: 'Gut versichert',
    description: 'Werde 5 Mal von Insurance gerettet',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 50,
    hidden: false,
    requirement: 5
  },
  WILD_CARD_10: {
    id: 'wild_card_10',
    name: 'Wild-Experte',
    description: 'Nutze 10 Wild-Cards',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 50,
    hidden: false,
    requirement: 10
  },
  FREE_SPIN_10: {
    id: 'free_spin_10',
    name: 'Freeloader',
    description: 'Nutze 10 Free-Spins',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 50,
    hidden: false,
    requirement: 10
  },
  FREE_SPIN_50: {
    id: 'free_spin_50',
    name: 'Freigeist',
    description: 'Nutze 50 Free-Spins',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 150,
    hidden: false,
    requirement: 50
  },
  FREE_SPIN_100: {
    id: 'free_spin_100',
    name: 'Gratis-König',
    description: 'Nutze 100 Free-Spins',
    category: ACHIEVEMENT_CATEGORIES.ITEMS,
    reward: 300,
    hidden: false,
    requirement: 100
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
export function getAchievementById(id: string): Achievement | null {
  return Object.values(ACHIEVEMENTS).find(a => a.id === id) || null;
}

// Helper: Get all achievements in a category
export function getAchievementsByCategory(category: string): Achievement[] {
  return Object.values(ACHIEVEMENTS).filter(a => a.category === category);
}

// Helper: Get all visible achievements
export function getVisibleAchievements(): Achievement[] {
  return Object.values(ACHIEVEMENTS).filter(a => !a.hidden);
}

// Helper: Get all achievements as array
export function getAllAchievements(): Achievement[] {
  return Object.values(ACHIEVEMENTS);
}

// Map achievement IDs to stat keys for progress tracking
const ACHIEVEMENT_STAT_MAPPING: Record<string, string> = {
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
  'hourly_jackpot_3': 'hourlyJackpots',
  'hourly_jackpot_10': 'hourlyJackpots',
  'hourly_jackpot_25': 'hourlyJackpots',
  // Losing
  'loss_100': 'losses',
  'loss_500': 'losses',
  'loss_1000': 'losses',
  'loss_streak_5': 'maxLossStreak',
  'loss_streak_10': 'maxLossStreak',
  'loss_streak_15': 'maxLossStreak',
  // Collecting
  'dachs_seen_10': 'totalDachsSeen',
  'dachs_seen_50': 'totalDachsSeen',
  'dachs_seen_100': 'totalDachsSeen',
  'dachs_seen_500': 'totalDachsSeen',
  // Social
  'transfer_1000': 'totalTransferred',
  'transfer_10000': 'totalTransferred',
  'transfer_count_10': 'transfersSentCount',
  'transfer_count_50': 'transfersSentCount',
  'transfer_count_100': 'transfersSentCount',
  'duel_win_10': 'duelsWon',
  'duel_win_50': 'duelsWon',
  'duel_win_100': 'duelsWon',
  'duel_loss_10': 'duelsLost',
  'duel_loss_50': 'duelsLost',
  'duel_loss_100': 'duelsLost',
  'duel_streak_5': 'maxDuelStreak',
  'duel_streak_10': 'maxDuelStreak',
  'duel_streak_20': 'maxDuelStreak',
  'duel_winnings_1000': 'totalDuelWinnings',
  'duel_winnings_5000': 'totalDuelWinnings',
  'duel_winnings_10000': 'totalDuelWinnings',
  // Dedication
  'daily_7': 'dailysClaimed',
  'daily_14': 'dailysClaimed',
  'daily_20': 'dailysClaimed',
  'play_days_7': 'playDays',
  'play_days_30': 'playDays',
  'play_days_100': 'playDays',
  'play_days_365': 'playDays',
  // Shopping
  'shop_10': 'shopPurchases',
  'shop_50': 'shopPurchases',
  'shop_100': 'shopPurchases',
  // Items
  'chaos_spin_10': 'chaosSpins',
  'chaos_spin_50': 'chaosSpins',
  'chaos_spin_100': 'chaosSpins',
  'reverse_chaos_10': 'reverseChaosSpins',
  'wheel_spin_10': 'wheelSpins',
  'mystery_box_10': 'mysteryBoxes',
  'insurance_5': 'insuranceTriggers',
  'wild_card_10': 'wildCardsUsed',
  'free_spin_10': 'freeSpinsUsed',
  'free_spin_50': 'freeSpinsUsed',
  'free_spin_100': 'freeSpinsUsed'
};

export function getStatKeyForAchievement(achievementId: string): string | null {
  return ACHIEVEMENT_STAT_MAPPING[achievementId] || null;
}
