/**
 * Shared JSDoc Type Definitions
 * Import with: @typedef {import('./types.js').TypeName} TypeName
 */

// ============================================================================
// Core Game Types
// ============================================================================

/**
 * Win result from calculateWin
 * @typedef {Object} WinResult
 * @property {number} points - Points won (0 if loss)
 * @property {string} message - Result message to display
 * @property {number} [freeSpins] - Free spins awarded (optional)
 */

/**
 * Spin amount parsing result
 * @typedef {Object} SpinAmountResult
 * @property {number} [spinCost] - Cost of the spin
 * @property {number} [multiplier] - Win multiplier
 * @property {string} [error] - Error message if invalid
 */

/**
 * Streak data stored in KV
 * @typedef {Object} StreakData
 * @property {number} wins - Consecutive wins
 * @property {number} losses - Consecutive losses
 */

/**
 * Streak bonus calculation result
 * @typedef {Object} StreakBonusResult
 * @property {number} streakBonus - Bonus from hot streak or comeback
 * @property {number} comboBonus - Bonus from combo
 * @property {string[]} naturalBonuses - Bonus messages to display
 * @property {string} lossWarningMessage - Warning message for loss streaks
 * @property {StreakData} newStreak - Updated streak data
 */

// ============================================================================
// Buff Types
// ============================================================================

/**
 * Pre-loaded buff states for performance optimization
 * @typedef {Object} PreloadedBuffs
 * @property {boolean} hasGoldenHour - Golden hour buff active
 * @property {boolean} hasProfitDoubler - Profit doubler buff active
 * @property {number} currentStreakMulti - Current streak multiplier (1.0+)
 */

/**
 * Buff with uses (like dachs_locator)
 * @typedef {Object} BuffWithUses
 * @property {boolean} active - Whether buff is active
 * @property {BuffUsesData|null} data - Buff data if active
 */

/**
 * @typedef {Object} BuffUsesData
 * @property {number} uses - Remaining uses
 * @property {number} expireAt - Expiration timestamp (ms)
 */

/**
 * Buff with stack (like rage_mode)
 * @typedef {Object} BuffWithStack
 * @property {boolean} active - Whether buff is active
 * @property {BuffStackData|null} data - Buff data if active
 */

/**
 * @typedef {Object} BuffStackData
 * @property {number} stack - Current stack level
 * @property {number} expireAt - Expiration timestamp (ms)
 */

// ============================================================================
// User Types
// ============================================================================

/**
 * Player statistics stored in KV
 * @typedef {Object} PlayerStats
 * @property {number} totalSpins - Total number of spins
 * @property {number} wins - Total wins
 * @property {number} biggestWin - Largest single win
 * @property {number} totalWon - Total amount won
 * @property {number} totalLost - Total amount lost
 */

/**
 * Monthly login data
 * @typedef {Object} MonthlyLoginData
 * @property {string} month - Current month (YYYY-MM)
 * @property {string[]} days - Days logged in (YYYY-MM-DD)
 * @property {number[]} claimedMilestones - Milestone days claimed
 */

/**
 * Achievement data stored in KV
 * @typedef {Object} AchievementData
 * @property {string[]} unlocked - Array of unlocked achievement IDs
 * @property {Object.<string, boolean>} triples - Collected triple symbols
 * @property {number} totalSpins - Total spins for stat-based achievements
 * @property {number} wins - Total wins for stat-based achievements
 */

/**
 * Logged-in user from JWT cookie
 * @typedef {Object} LoggedInUser
 * @property {string} twitchId - Twitch user ID
 * @property {string} username - Twitch username (lowercase)
 * @property {string} displayName - Twitch display name
 * @property {string} [avatar] - Twitch avatar URL
 * @property {boolean} [hasDisclaimer] - Whether user has accepted disclaimer
 */

// ============================================================================
// Shop Types
// ============================================================================

/**
 * Shop item definition
 * @typedef {Object} ShopItem
 * @property {string} name - Item name
 * @property {number} price - Item price in DachsTaler
 * @property {string} type - Item type (boost, instant, timed, unlock, prestige)
 * @property {string} [unlockKey] - KV key for unlock items
 * @property {string} [rank] - Prestige rank symbol
 * @property {string} [requires] - Required unlock
 * @property {string} [requiresRank] - Required prestige rank
 * @property {boolean} [weeklyLimit] - Whether item has weekly purchase limit
 */

/**
 * Free spin entry stored in KV
 * @typedef {Object} FreeSpinEntry
 * @property {number} count - Number of free spins
 * @property {number} multiplier - Multiplier for these spins
 */

// ============================================================================
// Duel Types
// ============================================================================

/**
 * Duel challenge stored in KV
 * @typedef {Object} DuelChallenge
 * @property {string} challenger - Username of challenger
 * @property {string} target - Username of target
 * @property {number} amount - Duel amount
 * @property {number} createdAt - Timestamp of creation
 */

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API error response
 * @typedef {Object} ApiError
 * @property {string} error - Error message
 */

/**
 * Standard API success response
 * @typedef {Object} ApiSuccess
 * @property {boolean} success - Always true
 * @property {*} [data] - Optional response data
 */

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Cloudflare Worker environment bindings
 * @typedef {Object} Env
 * @property {KVNamespace} SLOTS_KV - KV namespace for game data
 * @property {string} [TWITCH_CLIENT_ID] - Twitch OAuth client ID
 * @property {string} [TWITCH_CLIENT_SECRET] - Twitch OAuth client secret
 * @property {string} [JWT_SECRET] - Secret for JWT signing
 */

/**
 * KV Namespace interface (Cloudflare)
 * @typedef {Object} KVNamespace
 * @property {function(string): Promise<string|null>} get - Get value by key
 * @property {function(string, string, Object=): Promise<void>} put - Put value with optional TTL
 * @property {function(string): Promise<void>} delete - Delete key
 * @property {function(Object): Promise<{keys: Array<{name: string}>}>} list - List keys
 */

// Export empty object to make this a module
export {};
