/**
 * KV to D1 Migration Script
 *
 * Migrates user data from KV to D1 database.
 * Can be run incrementally and safely re-run.
 */

import { logError, logWarn } from '../utils.js';

/**
 * Migrate all users from KV to D1
 * Processes in batches to avoid timeouts
 */
export async function migrateAllUsersToD1(env, options = {}) {
  const {
    batchSize = 100,
    maxUsers = null, // null = all users
    dryRun = false
  } = options;

  if (!env.DB) {
    return { success: false, error: 'D1 database not configured' };
  }

  const stats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    startTime: Date.now()
  };

  try {
    // Get all users from KV
    let cursor = null;
    let allUsers = [];

    do {
      const listOptions = { prefix: 'user:', limit: 1000 };
      if (cursor) listOptions.cursor = cursor;

      const result = await env.SLOTS_KV.list(listOptions);

      for (const key of result.keys) {
        // Skip special accounts like dachsbank
        if (key.name === 'user:dachsbank') continue;

        const username = key.name.replace('user:', '');
        const balance = await env.SLOTS_KV.get(key.name);

        if (balance !== null) {
          allUsers.push({
            username,
            balance: parseInt(balance, 10) || 0
          });
        }
      }

      cursor = result.cursor;

      if (maxUsers && allUsers.length >= maxUsers) {
        allUsers = allUsers.slice(0, maxUsers);
        break;
      }
    } while (cursor);

    stats.total = allUsers.length;

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        stats,
        message: `Would migrate ${stats.total} users`
      };
    }

    // Process in batches
    for (let i = 0; i < allUsers.length; i += batchSize) {
      const batch = allUsers.slice(i, i + batchSize);

      try {
        // Fetch additional data for each user in batch
        const enrichedBatch = await Promise.all(batch.map(async (user) => {
          const [
            disclaimer,
            leaderboardHidden,
            duelOptOut,
            blacklisted,
            selfban,
            rank,
            lastActive
          ] = await Promise.all([
            env.SLOTS_KV.get(`disclaimer:${user.username}`),
            env.SLOTS_KV.get(`leaderboard_hidden:${user.username}`),
            env.SLOTS_KV.get(`duel_optout:${user.username}`),
            env.SLOTS_KV.get(`blacklist:${user.username}`),
            env.SLOTS_KV.get(`selfban:${user.username}`),
            env.SLOTS_KV.get(`rank:${user.username}`),
            env.SLOTS_KV.get(`lastActive:${user.username}`)
          ]);

          let selfbanTimestamp = null;
          if (selfban) {
            try {
              const parsed = JSON.parse(selfban);
              selfbanTimestamp = parsed.timestamp || null;
            } catch (e) {
              // Ignore parse errors
            }
          }

          return {
            ...user,
            disclaimer_accepted: disclaimer === 'accepted' ? 1 : 0,
            leaderboard_hidden: leaderboardHidden === 'true' ? 1 : 0,
            duel_opt_out: duelOptOut === 'true' ? 1 : 0,
            is_blacklisted: blacklisted === 'true' ? 1 : 0,
            selfban_timestamp: selfbanTimestamp,
            prestige_rank: rank || null,
            last_active_at: lastActive ? parseInt(lastActive, 10) : null
          };
        }));

        // Batch insert into D1
        const now = Date.now();
        const statements = enrichedBatch.map(user =>
          env.DB.prepare(`
            INSERT INTO users (
              username, balance, prestige_rank, disclaimer_accepted,
              leaderboard_hidden, duel_opt_out, is_blacklisted,
              selfban_timestamp, last_active_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
              balance = excluded.balance,
              prestige_rank = excluded.prestige_rank,
              disclaimer_accepted = excluded.disclaimer_accepted,
              leaderboard_hidden = excluded.leaderboard_hidden,
              duel_opt_out = excluded.duel_opt_out,
              is_blacklisted = excluded.is_blacklisted,
              selfban_timestamp = excluded.selfban_timestamp,
              last_active_at = excluded.last_active_at,
              updated_at = excluded.updated_at
          `).bind(
            user.username.toLowerCase(),
            user.balance,
            user.prestige_rank,
            user.disclaimer_accepted,
            user.leaderboard_hidden,
            user.duel_opt_out,
            user.is_blacklisted,
            user.selfban_timestamp,
            user.last_active_at,
            now,
            now
          )
        );

        await env.DB.batch(statements);
        stats.migrated += batch.length;
      } catch (batchError) {
        logError('migration.batch', batchError, { batchStart: i, batchSize: batch.length });
        stats.errors += batch.length;
      }
    }

    stats.duration = Date.now() - stats.startTime;

    return {
      success: true,
      stats,
      message: `Migrated ${stats.migrated}/${stats.total} users in ${stats.duration}ms`
    };
  } catch (error) {
    logError('migration.migrateAllUsersToD1', error);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
}

/**
 * Verify migration by comparing KV and D1 data
 */
export async function verifyMigration(env, sampleSize = 50) {
  if (!env.DB) {
    return { success: false, error: 'D1 database not configured' };
  }

  const results = {
    checked: 0,
    matched: 0,
    mismatched: [],
    missing: []
  };

  try {
    // Get sample of users from D1
    const d1Users = await env.DB.prepare(`
      SELECT username, balance, disclaimer_accepted, leaderboard_hidden
      FROM users
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(sampleSize).all();

    for (const d1User of d1Users.results) {
      results.checked++;

      // Get corresponding KV data
      const kvBalance = await env.SLOTS_KV.get(`user:${d1User.username}`);
      const kvDisclaimer = await env.SLOTS_KV.get(`disclaimer:${d1User.username}`);
      const kvHidden = await env.SLOTS_KV.get(`leaderboard_hidden:${d1User.username}`);

      const kvBalanceInt = kvBalance ? parseInt(kvBalance, 10) : 0;
      const kvDisclaimerBool = kvDisclaimer === 'accepted' ? 1 : 0;
      const kvHiddenBool = kvHidden === 'true' ? 1 : 0;

      if (
        d1User.balance === kvBalanceInt &&
        d1User.disclaimer_accepted === kvDisclaimerBool &&
        d1User.leaderboard_hidden === kvHiddenBool
      ) {
        results.matched++;
      } else {
        results.mismatched.push({
          username: d1User.username,
          d1: {
            balance: d1User.balance,
            disclaimer: d1User.disclaimer_accepted,
            hidden: d1User.leaderboard_hidden
          },
          kv: {
            balance: kvBalanceInt,
            disclaimer: kvDisclaimerBool,
            hidden: kvHiddenBool
          }
        });
      }
    }

    return {
      success: true,
      results,
      message: `Verified ${results.matched}/${results.checked} users match`
    };
  } catch (error) {
    logError('migration.verifyMigration', error);
    return { success: false, error: error.message, results };
  }
}

/**
 * Get migration status (count of users in D1 vs KV)
 */
export async function getMigrationStatus(env) {
  if (!env.DB) {
    return { success: false, error: 'D1 database not configured' };
  }

  try {
    // Count in D1
    const d1Count = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();

    // Count in KV (approximate)
    let kvCount = 0;
    let cursor = null;
    do {
      const listOptions = { prefix: 'user:', limit: 1000 };
      if (cursor) listOptions.cursor = cursor;

      const result = await env.SLOTS_KV.list(listOptions);
      kvCount += result.keys.filter(k => k.name !== 'user:dachsbank').length;
      cursor = result.cursor;
    } while (cursor);

    return {
      success: true,
      d1Count: d1Count.count,
      kvCount,
      migrationComplete: d1Count.count >= kvCount,
      percentage: kvCount > 0 ? Math.round((d1Count.count / kvCount) * 100) : 0
    };
  } catch (error) {
    logError('migration.getMigrationStatus', error);
    return { success: false, error: error.message };
  }
}
