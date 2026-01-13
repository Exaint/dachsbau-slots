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
  handleResetDaily
} from './economy.js';
