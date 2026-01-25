/**
 * Shared TypeScript Type Definitions
 * These types can be imported in .ts files or referenced in JSDoc
 */

// ============================================================================
// Core Game Types
// ============================================================================

/** Win result from calculateWin */
export interface WinResult {
  /** Points won (0 if loss) */
  points: number;
  /** Result message to display */
  message: string;
  /** Free spins awarded (optional) */
  freeSpins?: number;
}

/** Spin amount parsing result */
export interface SpinAmountResult {
  /** Cost of the spin */
  spinCost?: number;
  /** Win multiplier */
  multiplier?: number;
  /** Error message if invalid */
  error?: string;
}

/** Streak data stored in KV */
export interface StreakData {
  /** Consecutive wins */
  wins: number;
  /** Consecutive losses */
  losses: number;
}

/** Streak bonus calculation result */
export interface StreakBonusResult {
  /** Bonus from hot streak or comeback */
  streakBonus: number;
  /** Bonus from combo */
  comboBonus: number;
  /** Bonus messages to display */
  naturalBonuses: string[];
  /** Warning message for loss streaks */
  lossWarningMessage: string;
  /** Updated streak data */
  newStreak: StreakData;
}

// ============================================================================
// Buff Types
// ============================================================================

/** Pre-loaded buff states for performance optimization */
export interface PreloadedBuffs {
  /** Golden hour buff active */
  hasGoldenHour: boolean;
  /** Profit doubler buff active */
  hasProfitDoubler: boolean;
  /** Jackpot booster buff active (+25% on triples) */
  hasJackpotBooster: boolean;
  /** Current streak multiplier (1.0+) */
  currentStreakMulti: number;
}

/** Buff uses data */
export interface BuffUsesData {
  /** Remaining uses */
  uses: number;
  /** Expiration timestamp (ms) */
  expireAt: number;
}

/** Buff with uses (like dachs_locator) */
export interface BuffWithUses {
  /** Whether buff is active */
  active: boolean;
  /** Buff data if active */
  data: BuffUsesData | null;
}

/** Buff stack data */
export interface BuffStackData {
  /** Current stack level */
  stack: number;
  /** Expiration timestamp (ms) */
  expireAt: number;
}

/** Buff with stack (like rage_mode) */
export interface BuffWithStack {
  /** Whether buff is active */
  active: boolean;
  /** Buff data if active */
  data: BuffStackData | null;
}

// ============================================================================
// User Types
// ============================================================================

/** Player statistics stored in KV */
export interface PlayerStats {
  /** Total number of spins */
  totalSpins: number;
  /** Total wins */
  wins: number;
  /** Largest single win */
  biggestWin: number;
  /** Total amount won */
  totalWon: number;
  /** Total amount lost */
  totalLost: number;
}

/** Monthly login data */
export interface MonthlyLoginData {
  /** Current month (YYYY-MM) */
  month: string;
  /** Days logged in (YYYY-MM-DD) */
  days: string[];
  /** Milestone days claimed */
  claimedMilestones: number[];
}

/** Achievement data stored in KV */
export interface AchievementData {
  /** Array of unlocked achievement IDs */
  unlocked: string[];
  /** Collected triple symbols */
  triples: Record<string, boolean>;
  /** Total spins for stat-based achievements */
  totalSpins: number;
  /** Total wins for stat-based achievements */
  wins: number;
}

/** Logged-in user from JWT cookie */
export interface LoggedInUser {
  /** Twitch user ID */
  twitchId: string;
  /** Twitch username (lowercase) */
  username: string;
  /** Twitch display name */
  displayName: string;
  /** Twitch avatar URL */
  avatar?: string;
  /** Whether user has accepted disclaimer */
  hasDisclaimer?: boolean;
}

// ============================================================================
// Shop Types
// ============================================================================

/** Shop item definition */
export interface ShopItem {
  /** Item name */
  name: string;
  /** Item price in DachsTaler */
  price: number;
  /** Item type */
  type: 'boost' | 'instant' | 'timed' | 'unlock' | 'prestige';
  /** KV key for unlock items */
  unlockKey?: string;
  /** Prestige rank symbol */
  rank?: string;
  /** Required unlock */
  requires?: string;
  /** Required prestige rank */
  requiresRank?: string;
  /** Whether item has weekly purchase limit */
  weeklyLimit?: boolean;
}

/** Free spin entry stored in KV */
export interface FreeSpinEntry {
  /** Number of free spins */
  count: number;
  /** Multiplier for these spins */
  multiplier: number;
}

// ============================================================================
// Duel Types
// ============================================================================

/** Duel challenge stored in KV */
export interface DuelChallenge {
  /** Username of challenger */
  challenger: string;
  /** Username of target */
  target: string;
  /** Duel amount */
  amount: number;
  /** Timestamp of creation */
  createdAt: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/** Standard API error response */
export interface ApiError {
  /** Error message */
  error: string;
}

/** Standard API success response */
export interface ApiSuccess<T = unknown> {
  /** Always true */
  success: true;
  /** Optional response data */
  data?: T;
}

// ============================================================================
// Environment Types
// ============================================================================

/** Cloudflare Worker environment bindings */
export interface Env {
  /** KV namespace for game data */
  SLOTS_KV: KVNamespace;
  /** D1 database for persistent data */
  DB: D1Database;
  /** Twitch OAuth client ID */
  TWITCH_CLIENT_ID?: string;
  /** Twitch OAuth client secret */
  TWITCH_CLIENT_SECRET?: string;
  /** Secret for JWT signing */
  JWT_SECRET?: string;
}

// ============================================================================
// Custom Messages Types
// ============================================================================

/** Custom win/loss messages stored in KV */
export interface CustomMessages {
  /** Win messages (max 5) */
  win: string[];
  /** Loss messages (max 5) */
  loss: string[];
}

// ============================================================================
// Validation Types
// ============================================================================

/** Result of validateAndCleanTarget */
export interface ValidateTargetResult {
  /** Error type if validation failed */
  error: 'missing' | 'invalid' | null;
  /** Cleaned target username if valid */
  cleanTarget: string | null;
}
