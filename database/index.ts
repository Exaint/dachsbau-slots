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
 * - jackpot.js: Hourly Jackpot (lucky second mechanism)
 */

// Core functions
export {
  getBalance,
  setBalance,
  adjustBalance,
  deductBalance,
  creditBalance,
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
  setLeaderboardHidden,
  getCustomMessages,
  setCustomMessages
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
  removePrestigeRank,
  hasUnlock,
  setUnlock,
  removeUnlock,
  getMonthlyLogin,
  updateMonthlyLogin,
  markMilestoneClaimed,
  getStreak,
  getStats,
  updateStats,
  updatePlayerStat,
  updatePlayerStatBatch
} from './progression.js';

// Shop
export {
  getSpinBundlePurchases,
  incrementSpinBundlePurchases,
  getDachsBoostPurchases,
  incrementDachsBoostPurchases
} from './shop.js';

// Duels
export {
  setDuelOptOut,
  isDuelOptedOut,
  logDuel,
  getDuelHistory
} from './duels.js';

// Achievements
export type { PlayerAchievementData } from './achievements.js';
export {
  getPlayerAchievements,
  savePlayerAchievements,
  hasAchievement,
  unlockAchievement,
  lockAchievement,
  updateAchievementStat,
  updateAchievementStatBatch,
  setMaxAchievementStat,
  markTripleCollected,
  recordDachsHit,
  checkAndUnlockAchievement,
  checkBalanceAchievements,
  checkBigWinAchievements,
  getPendingRewards,
  claimPendingRewards,
  getUnlockedAchievementCount,
  getAchievementStats,
  syncAllPlayerAchievementStats
} from './achievements.js';

// Jackpot
export {
  checkAndClaimHourlyJackpot
} from './jackpot.js';

// D1 Triple tracking (direct D1 access for admin/display)
export {
  getPlayerTriplesD1,
  getTripleStatsD1
} from './d1-achievements.js';

// D1 Atomic operations (for critical transactions)
export {
  atomicTransfer,
  type AtomicTransferResult
} from './d1.js';
