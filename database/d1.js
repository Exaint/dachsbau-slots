/**
 * D1 Database Layer for Dachsbau Slots
 *
 * This module provides D1 database operations with fallback to KV.
 * During migration, data is read from D1 first, then KV as fallback.
 * Writes go to both D1 and KV to ensure consistency.
 *
 * After full migration, KV fallback can be removed.
 */

import { logError, logWarn } from '../utils.js';

// ============================================
// Configuration
// ============================================

// Set to true to enable D1 (after database is created and migrated)
const D1_ENABLED = true;

// Set to true to write to both D1 and KV during migration
const DUAL_WRITE = true;

// ============================================
// User Operations (Balance, Flags, Preferences)
// ============================================

/**
 * Get user data from D1
 * Returns null if user doesn't exist
 */
async function getUser(username, env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username.toLowerCase()).first();

    return result;
  } catch (error) {
    logError('d1.getUser', error, { username });
    return null;
  }
}

/**
 * Create or update user in D1
 */
async function upsertUser(username, data, env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    const lowerUsername = username.toLowerCase();

    // Build dynamic SET clause based on provided data
    const fields = ['updated_at'];
    const values = [now];
    const placeholders = ['updated_at = ?'];

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
async function updateBalance(username, balance, env) {
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
async function getBalance(username, env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(
      'SELECT balance FROM users WHERE username = ?'
    ).bind(username.toLowerCase()).first();

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
async function getLeaderboard(limit = 25, env) {
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
    `).bind(limit).all();

    return result.results || [];
  } catch (error) {
    logError('d1.getLeaderboard', error, { limit });
    return null;
  }
}

/**
 * Get user rank in leaderboard
 */
async function getUserRank(username, env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    // Get user's balance first
    const user = await env.DB.prepare(
      'SELECT balance FROM users WHERE username = ?'
    ).bind(username.toLowerCase()).first();

    if (!user || user.balance <= 0) return null;

    // Count users with higher balance
    const result = await env.DB.prepare(`
      SELECT COUNT(*) as rank
      FROM users
      WHERE balance > ?
        AND disclaimer_accepted = 1
        AND is_blacklisted = 0
        AND leaderboard_hidden = 0
    `).bind(user.balance).first();

    return result ? result.rank + 1 : null;
  } catch (error) {
    logError('d1.getUserRank', error, { username });
    return null;
  }
}

/**
 * Search users by username prefix
 */
async function searchUsers(query, limit = 10, env) {
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
    `).bind(query.toLowerCase() + '%', limit).all();

    return result.results || [];
  } catch (error) {
    logError('d1.searchUsers', error, { query });
    return null;
  }
}

// ============================================
// Migration Helpers
// ============================================

/**
 * Migrate a single user from KV to D1
 * Called lazily when user data is accessed
 */
async function migrateUserFromKV(username, kvData, env) {
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

/**
 * Batch migrate users from KV list results
 * Used for initial migration
 */
async function batchMigrateUsers(users, env) {
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
async function getUserCount(env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first();

    return result ? result.count : 0;
  } catch (error) {
    logError('d1.getUserCount', error);
    return null;
  }
}

// ============================================
// Exports
// ============================================

export {
  // Configuration
  D1_ENABLED,
  DUAL_WRITE,

  // User operations
  getUser,
  upsertUser,
  updateBalance,
  getBalance,

  // Leaderboard operations
  getLeaderboard,
  getUserRank,
  searchUsers,

  // Migration helpers
  migrateUserFromKV,
  batchMigrateUsers,
  getUserCount
};
