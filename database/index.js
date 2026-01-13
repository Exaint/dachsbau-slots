/**
 * Database Index - Re-exports all database functions
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
  isBlacklisted
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
  getMulliganCount,
  setMulliganCount,
  addInsurance,
  getInsuranceCount,
  setInsuranceCount,
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
