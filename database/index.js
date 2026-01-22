/**
 * Database Module Index
 *
 * This module provides all database operations for the Dachsbau Slots game.
 * All functions interact with Cloudflare KV storage.
 *
 * @module database
 *
 * Structure:
 * - core.js: Balance, Daily, Cooldown, Disclaimer, Selfban, Blacklist
 * - buffs.js: Timed buffs, Symbol boosts, Insurance, Win Multiplier
 * - items.js: Guaranteed Pair, Wild Card, Free Spins
 * - progression.js: Streaks, Stats, Monthly Login, Prestige, Unlocks
 * - shop.js: Weekly purchase limits (Spin Bundle, Dachs Boost)
 * - bank.js: DachsBank balance, Hourly Jackpot
 */

// Core functions
export {
  getBalance,
  setBalance,
  getLastDaily,
  setLastDaily,
  getLastSpin,
  setLastSpin,
  hasAcceptedDisclaimer,
  setDisclaimerAccepted,
  isSelfBanned,
  setSelfBan,
  removeSelfBan,
  isBlacklisted,
  getLastActive,
  setLastActive,
  isLeaderboardHidden,
  setLeaderboardHidden
} from './core.js';

// Buff system
export {
  activateBuff,
  isBuffActive,
  activateBuffWithUses,
  getBuffWithUses,
  decrementBuffUses,
  activateBuffWithStack,
  getBuffWithStack,
  addBoost,
  consumeBoost,
  addInsurance,
  getInsuranceCount,
  setInsuranceCount,
  decrementInsuranceCount,
  addWinMultiplier,
  consumeWinMultiplier
} from './buffs.js';

// Items
export {
  activateGuaranteedPair,
  hasGuaranteedPair,
  consumeGuaranteedPair,
  activateWildCard,
  hasWildCard,
  consumeWildCard,
  getFreeSpins,
  addFreeSpinsWithMultiplier,
  consumeFreeSpinWithMultiplier
} from './items.js';

// Progression
export {
  getStreakMultiplier,
  incrementStreakMultiplier,
  resetStreakMultiplier,
  getPrestigeRank,
  setPrestigeRank,
  hasUnlock,
  setUnlock,
  getMonthlyLogin,
  updateMonthlyLogin,
  markMilestoneClaimed,
  getStreak,
  getStats,
  updateStats
} from './progression.js';

// Shop
export {
  getSpinBundlePurchases,
  incrementSpinBundlePurchases,
  getDachsBoostPurchases,
  incrementDachsBoostPurchases
} from './shop.js';

// Bank
export {
  updateBankBalance,
  getBankBalance,
  checkAndClaimHourlyJackpot
} from './bank.js';

// Duels
export {
  setDuelOptOut,
  isDuelOptedOut
} from './duels.js';

// Achievements
export {
  getPlayerAchievements,
  savePlayerAchievements,
  hasAchievement,
  unlockAchievement,
  lockAchievement,
  updateAchievementStat,
  markTripleCollected,
  checkAndUnlockAchievement,
  checkBalanceAchievements,
  checkBigWinAchievements,
  getPendingRewards,
  claimPendingRewards,
  getUnlockedAchievementCount,
  getAchievementStats
} from './achievements.js';
