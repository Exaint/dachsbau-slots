/**
 * Admin Commands Index - Re-exports all admin functions
 */

// Moderation commands
export {
  handleBan,
  handleUnban,
  handleFreeze,
  handleUnfreeze,
  handleReset,
  handleWipe,
  handleMaintenance,
  handleRemoveFromLB
} from './moderation.js';

// Economy commands
export {
  handleGive,
  handleSetBalance,
  handleBankSet,
  handleBankReset,
  handleGiveBuff,
  handleRemoveBuff,
  handleClearAllBuffs,
  handleGetStats,
  handleGetDaily,
  handleResetDaily,
  handleGiveFreespins,
  handleGiveMulligan,
  handleGiveInsurance,
  handleGetMonthlyLogin,
  handleResetWeeklyLimits,
  handleGiveWinMulti
} from './economy.js';
