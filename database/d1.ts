/**
 * D1 Database Layer for Dachsbau Slots
 *
 * This module provides D1 database operations with fallback to KV.
 * During migration, data is read from D1 first, then KV as fallback.
 * Writes go to both D1 and KV to ensure consistency.
 *
 * After full migration, KV fallback can be removed.
 */

import { logError } from '../utils.js';
import type { Env } from '../types/index.js';

// ============================================
// Configuration
// ============================================

// Set to true to enable D1 (after database is created and migrated)
export const D1_ENABLED = true;

// Set to true to write to both D1 and KV during migration
export const DUAL_WRITE = true;

// Which storage reads stats primarily: 'kv' (safe default) or 'd1' (after migration)
export const STATS_READ_PRIMARY: 'kv' | 'd1' = 'kv';

// Retry configuration for D1 writes
const D1_WRITE_RETRIES = 2;
const D1_RETRY_DELAY_MS = 50;

/**
 * Execute a D1 write operation with retry logic.
 * Fire-and-forget pattern with automatic retries on failure.
 * @param operation - The D1 operation to execute (async function)
 * @param context - Context for logging (operation name, params)
 */
export function executeD1Write(
  operation: () => Promise<unknown>,
  context: { name: string; params?: Record<string, unknown> }
): void {
  const executeWithRetry = async (attempt: number = 0): Promise<void> => {
    try {
      await operation();
    } catch (error) {
      if (attempt < D1_WRITE_RETRIES) {
        await new Promise(r => setTimeout(r, D1_RETRY_DELAY_MS * (attempt + 1)));
        return executeWithRetry(attempt + 1);
      }
      logError(`D1Write.${context.name}`, error, { ...context.params, attempts: attempt + 1 });
    }
  };
  executeWithRetry().catch(() => {}); // Ensure no unhandled rejections
}

// ============================================
// Types
// ============================================

export interface D1User {
  username: string;
  balance: number;
  prestige_rank: string | null;
  disclaimer_accepted: number;
  leaderboard_hidden: number;
  duel_opt_out: number;
  is_blacklisted: number;
  selfban_timestamp: number | null;
  last_active_at: number | null;
  streak_wins?: number;
  streak_losses?: number;
  streak_multiplier?: number;
  created_at: number;
  updated_at: number;
}

export interface UserUpdateData {
  balance?: number;
  prestige_rank?: string | null;
  disclaimer_accepted?: boolean;
  leaderboard_hidden?: boolean;
  duel_opt_out?: boolean;
  is_blacklisted?: boolean;
  selfban_timestamp?: number | null;
  last_active_at?: number;
}

export interface LeaderboardEntry {
  username: string;
  balance: number;
}

// ============================================
// User Operations (Balance, Flags, Preferences)
// ============================================

/**
 * Get user data from D1
 * Returns null if user doesn't exist
 */
export async function getUser(username: string, env: Env): Promise<D1User | null> {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username.toLowerCase()).first<D1User>();

    return result;
  } catch (error) {
    logError('d1.getUser', error, { username });
    return null;
  }
}

/**
 * Create or update user in D1
 */
export async function upsertUser(username: string, data: UserUpdateData, env: Env): Promise<boolean> {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    const lowerUsername = username.toLowerCase();

    // Build dynamic SET clause based on provided data
    const fields: string[] = ['updated_at'];
    const values: (string | number | null)[] = [now];
    const placeholders: string[] = ['updated_at = ?'];

    if (data.balance !== undefined) {
      fields.push('balance');
      values.push(data.balance);
      placeholders.push('balance = ?');
    }
    if (data.prestige_rank !== undefined) {
      fields.push('prestige_rank');
      values.push(data.prestige_rank);
      placeholders.push('prestige_rank = ?');
    }
    if (data.disclaimer_accepted !== undefined) {
      fields.push('disclaimer_accepted');
      values.push(data.disclaimer_accepted ? 1 : 0);
      placeholders.push('disclaimer_accepted = ?');
    }
    if (data.leaderboard_hidden !== undefined) {
      fields.push('leaderboard_hidden');
      values.push(data.leaderboard_hidden ? 1 : 0);
      placeholders.push('leaderboard_hidden = ?');
    }
    if (data.duel_opt_out !== undefined) {
      fields.push('duel_opt_out');
      values.push(data.duel_opt_out ? 1 : 0);
      placeholders.push('duel_opt_out = ?');
    }
    if (data.is_blacklisted !== undefined) {
      fields.push('is_blacklisted');
      values.push(data.is_blacklisted ? 1 : 0);
      placeholders.push('is_blacklisted = ?');
    }
    if (data.selfban_timestamp !== undefined) {
      fields.push('selfban_timestamp');
      values.push(data.selfban_timestamp);
      placeholders.push('selfban_timestamp = ?');
    }
    if (data.last_active_at !== undefined) {
      fields.push('last_active_at');
      values.push(data.last_active_at);
      placeholders.push('last_active_at = ?');
    }

    // Use INSERT OR REPLACE for upsert
    await env.DB.prepare(`
      INSERT INTO users (username, ${fields.join(', ')}, created_at)
      VALUES (?, ${fields.map(() => '?').join(', ')}, ?)
      ON CONFLICT(username) DO UPDATE SET ${placeholders.join(', ')}
    `).bind(lowerUsername, ...values, now, ...values).run();

    return true;
  } catch (error) {
    logError('d1.upsertUser', error, { username, data });
    return false;
  }
}

/**
 * Update only the balance for a user (optimized for frequent updates)
 */
export async function updateBalance(username: string, balance: number, env: Env): Promise<boolean> {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO users (username, balance, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET balance = ?, updated_at = ?
    `).bind(username.toLowerCase(), balance, now, now, balance, now).run();

    return true;
  } catch (error) {
    logError('d1.updateBalance', error, { username, balance });
    return false;
  }
}

/**
 * Get balance from D1
 * Returns null if not found (caller should fall back to KV)
 */
export async function getBalance(username: string, env: Env): Promise<number | null> {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(
      'SELECT balance FROM users WHERE username = ?'
    ).bind(username.toLowerCase()).first<{ balance: number }>();

    return result ? result.balance : null;
  } catch (error) {
    logError('d1.getBalance', error, { username });
    return null;
  }
}

// ============================================
// Leaderboard Operations (Main Performance Gain)
// ============================================

/**
 * Get leaderboard from D1 - Single query replaces 2500+ KV operations
 */
export async function getLeaderboard(limit: number = 25, env: Env): Promise<LeaderboardEntry[] | null> {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(`
      SELECT username, balance
      FROM users
      WHERE balance > 0
        AND disclaimer_accepted = 1
        AND is_blacklisted = 0
        AND leaderboard_hidden = 0
      ORDER BY balance DESC
      LIMIT ?
    `).bind(limit).all<LeaderboardEntry>();

    return result.results || [];
  } catch (error) {
    logError('d1.getLeaderboard', error, { limit });
    return null;
  }
}

/**
 * Get user rank in leaderboard
 */
export async function getUserRank(username: string, env: Env): Promise<number | null> {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    // Get user's balance first
    const user = await env.DB.prepare(
      'SELECT balance FROM users WHERE username = ?'
    ).bind(username.toLowerCase()).first<{ balance: number }>();

    if (!user || user.balance <= 0) return null;

    // Count users with higher balance
    const result = await env.DB.prepare(`
      SELECT COUNT(*) as rank
      FROM users
      WHERE balance > ?
        AND disclaimer_accepted = 1
        AND is_blacklisted = 0
        AND leaderboard_hidden = 0
    `).bind(user.balance).first<{ rank: number }>();

    return result ? result.rank + 1 : null;
  } catch (error) {
    logError('d1.getUserRank', error, { username });
    return null;
  }
}

/**
 * Search users by username prefix
 */
export async function searchUsers(query: string, limit: number = 10, env: Env): Promise<LeaderboardEntry[] | null> {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(`
      SELECT username, balance
      FROM users
      WHERE username LIKE ?
        AND disclaimer_accepted = 1
        AND is_blacklisted = 0
      ORDER BY balance DESC
      LIMIT ?
    `).bind(query.toLowerCase() + '%', limit).all<LeaderboardEntry>();

    return result.results || [];
  } catch (error) {
    logError('d1.searchUsers', error, { query });
    return null;
  }
}

// ============================================
// Player Items Operations
// ============================================

/**
 * Upsert a player item in D1
 * @param username
 * @param itemKey - 'insurance', 'wildcard', 'guaranteedpair', 'winmulti', 'freespins'
 * @param value - count, 'active', or JSON string
 */
export async function upsertItem(username: string, itemKey: string, value: string, env: Env): Promise<boolean> {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO player_items (username, item_key, value, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username, item_key) DO UPDATE SET value = ?, updated_at = ?
    `).bind(username.toLowerCase(), itemKey, value, now, value, now).run();

    return true;
  } catch (error) {
    logError('d1.upsertItem', error, { username, itemKey });
    return false;
  }
}

/**
 * Delete a player item from D1 (consumed/expired)
 */
export async function deleteItem(username: string, itemKey: string, env: Env): Promise<boolean> {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    await env.DB.prepare(
      'DELETE FROM player_items WHERE username = ? AND item_key = ?'
    ).bind(username.toLowerCase(), itemKey).run();

    return true;
  } catch (error) {
    logError('d1.deleteItem', error, { username, itemKey });
    return false;
  }
}

// ============================================
// Purchase Limits Operations
// ============================================

/**
 * Update weekly purchase limit count in D1
 */
export async function upsertPurchaseLimit(username: string, itemType: string, count: number, weekStart: string, env: Env): Promise<boolean> {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO purchase_limits (username, item_type, count, week_start, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(username, item_type) DO UPDATE SET count = ?, week_start = ?, updated_at = ?
    `).bind(username.toLowerCase(), itemType, count, weekStart, now, count, weekStart, now).run();

    return true;
  } catch (error) {
    logError('d1.upsertPurchaseLimit', error, { username, itemType });
    return false;
  }
}

// ============================================
// Streak Operations
// ============================================

/**
 * Update streak win/loss counts in D1
 */
export async function updateStreakCounts(username: string, wins: number, losses: number, env: Env): Promise<boolean> {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO users (username, streak_wins, streak_losses, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET streak_wins = ?, streak_losses = ?, updated_at = ?
    `).bind(username.toLowerCase(), wins, losses, now, now, wins, losses, now).run();

    return true;
  } catch (error) {
    logError('d1.updateStreakCounts', error, { username });
    return false;
  }
}

/**
 * Update streak multiplier in D1
 */
export async function updateStreakMultiplier(username: string, multiplier: number, env: Env): Promise<boolean> {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO users (username, streak_multiplier, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET streak_multiplier = ?, updated_at = ?
    `).bind(username.toLowerCase(), multiplier, now, now, multiplier, now).run();

    return true;
  } catch (error) {
    logError('d1.updateStreakMultiplier', error, { username });
    return false;
  }
}

// ============================================
// Migration Helpers
// ============================================

export interface KVUserData {
  balance?: number;
  prestige_rank?: string | null;
  disclaimer_accepted?: boolean;
  leaderboard_hidden?: boolean;
  duel_opt_out?: boolean;
  is_blacklisted?: boolean;
  selfban_timestamp?: number | null;
  last_active_at?: number | null;
}

/**
 * Migrate a single user from KV to D1
 * Called lazily when user data is accessed
 */
export async function migrateUserFromKV(username: string, kvData: KVUserData, env: Env): Promise<boolean> {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO users (
        username, balance, prestige_rank, disclaimer_accepted,
        leaderboard_hidden, duel_opt_out, is_blacklisted,
        selfban_timestamp, last_active_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO NOTHING
    `).bind(
      username.toLowerCase(),
      kvData.balance || 0,
      kvData.prestige_rank || null,
      kvData.disclaimer_accepted ? 1 : 0,
      kvData.leaderboard_hidden ? 1 : 0,
      kvData.duel_opt_out ? 1 : 0,
      kvData.is_blacklisted ? 1 : 0,
      kvData.selfban_timestamp || null,
      kvData.last_active_at || null,
      now,
      now
    ).run();

    return true;
  } catch (error) {
    logError('d1.migrateUserFromKV', error, { username });
    return false;
  }
}

export interface BatchMigrateUser {
  username: string;
  balance: number;
}

export interface BatchMigrateResult {
  success: number;
  failed: number;
}

/**
 * Batch migrate users from KV list results
 * Used for initial migration
 */
export async function batchMigrateUsers(users: BatchMigrateUser[], env: Env): Promise<BatchMigrateResult> {
  if (!D1_ENABLED || !env.DB) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  // Process in batches of 50 to avoid timeout
  const batchSize = 50;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);

    try {
      const statements = batch.map(user =>
        env.DB.prepare(`
          INSERT INTO users (username, balance, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET balance = ?, updated_at = ?
        `).bind(
          user.username.toLowerCase(),
          user.balance,
          Date.now(),
          Date.now(),
          user.balance,
          Date.now()
        )
      );

      await env.DB.batch(statements);
      success += batch.length;
    } catch (error) {
      logError('d1.batchMigrateUsers', error, { batchStart: i, batchSize: batch.length });
      failed += batch.length;
    }
  }

  return { success, failed };
}

/**
 * Get total user count in D1
 */
export async function getUserCount(env: Env): Promise<number | null> {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first<{ count: number }>();

    return result ? result.count : 0;
  } catch (error) {
    logError('d1.getUserCount', error);
    return null;
  }
}

export interface HomePageStats {
  totalPlayers: number;
  totalBalance: number;
  totalWon: number;
  totalLost: number;
}

/**
 * Get aggregate stats for home page display
 * Returns total players, DT in circulation, total won/lost
 */
export async function getHomePageStats(env: Env): Promise<HomePageStats | null> {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const [usersResult, statsResult] = await Promise.all([
      env.DB.prepare(
        'SELECT COUNT(*) as total_players, COALESCE(SUM(balance), 0) as total_balance FROM users'
      ).first<{ total_players: number; total_balance: number }>(),
      env.DB.prepare(
        'SELECT COALESCE(SUM(total_won), 0) as total_won, COALESCE(SUM(total_lost), 0) as total_lost FROM player_stats'
      ).first<{ total_won: number; total_lost: number }>()
    ]);

    return {
      totalPlayers: usersResult?.total_players || 0,
      totalBalance: usersResult?.total_balance || 0,
      totalWon: statsResult?.total_won || 0,
      totalLost: statsResult?.total_lost || 0
    };
  } catch (error) {
    logError('d1.getHomePageStats', error);
    return null;
  }
}
