/**
 * KV to D1 Migration Script
 *
 * Migrates user data from KV to D1 database.
 * Can be run incrementally and safely re-run.
 */

import { logError, logWarn, kvKey } from '../utils.js';
import { batchMigrateAchievements, rebuildAchievementStats } from './d1-achievements.js';

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

/**
 * Migrate achievements and stats from KV to D1
 */
export async function migrateAchievementsToD1(env, options = {}) {
  const {
    batchSize = 50,
    maxUsers = null,
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
    achievements: 0,
    startTime: Date.now()
  };

  try {
    // Get all achievement entries from KV
    let cursor = null;
    let allAchievementData = [];

    do {
      const listOptions = { prefix: 'achievements:', limit: 1000 };
      if (cursor) listOptions.cursor = cursor;

      const result = await env.SLOTS_KV.list(listOptions);

      for (const key of result.keys) {
        const username = key.name.replace('achievements:', '');
        allAchievementData.push({ username, key: key.name });
      }

      cursor = result.cursor;

      if (maxUsers && allAchievementData.length >= maxUsers) {
        allAchievementData = allAchievementData.slice(0, maxUsers);
        break;
      }
    } while (cursor);

    stats.total = allAchievementData.length;

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        stats,
        message: `Would migrate achievements for ${stats.total} users`
      };
    }

    // Process in batches
    for (let i = 0; i < allAchievementData.length; i += batchSize) {
      const batch = allAchievementData.slice(i, i + batchSize);

      try {
        // Fetch achievement data for each user
        const enrichedBatch = await Promise.all(batch.map(async (item) => {
          const data = await env.SLOTS_KV.get(item.key);
          if (!data) return null;

          try {
            const parsed = JSON.parse(data);
            return {
              username: item.username,
              unlockedAt: parsed.unlockedAt || {},
              stats: parsed.stats || {},
              pendingRewards: parsed.pendingRewards || 0
            };
          } catch (e) {
            return null;
          }
        }));

        // Filter out null entries
        const validBatch = enrichedBatch.filter(u => u !== null);

        if (validBatch.length > 0) {
          const result = await batchMigrateAchievements(validBatch, env);
          stats.migrated += result.success;
          stats.errors += result.failed;

          // Count total achievements
          for (const user of validBatch) {
            stats.achievements += Object.keys(user.unlockedAt).length;
          }
        }

        stats.skipped += batch.length - validBatch.length;
      } catch (batchError) {
        logError('migration.achievementsBatch', batchError, { batchStart: i });
        stats.errors += batch.length;
      }
    }

    // Rebuild achievement stats counters
    await rebuildAchievementStats(env);

    stats.duration = Date.now() - stats.startTime;

    return {
      success: true,
      stats,
      message: `Migrated ${stats.migrated}/${stats.total} users (${stats.achievements} achievements) in ${stats.duration}ms`
    };
  } catch (error) {
    logError('migration.migrateAchievementsToD1', error);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
}

/**
 * Migrate unlocks from KV to D1
 */
export async function migrateUnlocksToD1(env, options = {}) {
  const { dryRun = false } = options;

  if (!env.DB) {
    return { success: false, error: 'D1 database not configured' };
  }

  const stats = {
    total: 0,
    migrated: 0,
    errors: 0,
    startTime: Date.now()
  };

  try {
    // Get all unlock entries from KV
    let cursor = null;
    const unlocks = [];

    do {
      const listOptions = { prefix: 'unlock:', limit: 1000 };
      if (cursor) listOptions.cursor = cursor;

      const result = await env.SLOTS_KV.list(listOptions);

      for (const key of result.keys) {
        // Format: unlock:{username}:{unlockKey}
        const parts = key.name.replace('unlock:', '').split(':');
        if (parts.length >= 2) {
          const username = parts[0];
          const unlockKey = parts.slice(1).join(':');
          unlocks.push({ username, unlockKey, kvKey: key.name });
        }
      }

      cursor = result.cursor;
    } while (cursor);

    stats.total = unlocks.length;

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        stats,
        message: `Would migrate ${stats.total} unlocks`
      };
    }

    // Batch insert unlocks
    const batchSize = 50;
    for (let i = 0; i < unlocks.length; i += batchSize) {
      const batch = unlocks.slice(i, i + batchSize);

      try {
        const now = Date.now();
        const statements = batch.map(item =>
          env.DB.prepare(`
            INSERT INTO player_unlocks (username, unlock_key, unlocked_at)
            VALUES (?, ?, ?)
            ON CONFLICT(username, unlock_key) DO NOTHING
          `).bind(item.username.toLowerCase(), item.unlockKey, now)
        );

        await env.DB.batch(statements);
        stats.migrated += batch.length;
      } catch (batchError) {
        logError('migration.unlocksBatch', batchError, { batchStart: i });
        stats.errors += batch.length;
      }
    }

    stats.duration = Date.now() - stats.startTime;

    return {
      success: true,
      stats,
      message: `Migrated ${stats.migrated}/${stats.total} unlocks in ${stats.duration}ms`
    };
  } catch (error) {
    logError('migration.migrateUnlocksToD1', error);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
}

/**
 * Migrate monthly login data from KV to D1
 */
export async function migrateMonthlyLoginToD1(env, options = {}) {
  const { dryRun = false } = options;

  if (!env.DB) {
    return { success: false, error: 'D1 database not configured' };
  }

  const stats = {
    total: 0,
    migrated: 0,
    errors: 0,
    startTime: Date.now()
  };

  try {
    // Get all monthly login entries from KV
    let cursor = null;
    const logins = [];

    do {
      const listOptions = { prefix: 'monthlylogin:', limit: 1000 };
      if (cursor) listOptions.cursor = cursor;

      const result = await env.SLOTS_KV.list(listOptions);

      for (const key of result.keys) {
        const username = key.name.replace('monthlylogin:', '');
        logins.push({ username, kvKey: key.name });
      }

      cursor = result.cursor;
    } while (cursor);

    stats.total = logins.length;

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        stats,
        message: `Would migrate ${stats.total} monthly login records`
      };
    }

    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < logins.length; i += batchSize) {
      const batch = logins.slice(i, i + batchSize);

      try {
        // Fetch data for batch
        const enrichedBatch = await Promise.all(batch.map(async (item) => {
          const data = await env.SLOTS_KV.get(item.kvKey);
          if (!data) return null;

          try {
            const parsed = JSON.parse(data);
            return {
              username: item.username,
              month: parsed.month || '',
              days: parsed.days || [],
              claimedMilestones: parsed.claimedMilestones || []
            };
          } catch (e) {
            return null;
          }
        }));

        const validBatch = enrichedBatch.filter(u => u !== null && u.month);

        if (validBatch.length > 0) {
          const now = Date.now();
          const statements = validBatch.map(item =>
            env.DB.prepare(`
              INSERT INTO monthly_login (username, month, login_days, claimed_milestones, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(username) DO UPDATE SET
                month = excluded.month,
                login_days = excluded.login_days,
                claimed_milestones = excluded.claimed_milestones,
                updated_at = excluded.updated_at
            `).bind(
              item.username.toLowerCase(),
              item.month,
              JSON.stringify(item.days),
              JSON.stringify(item.claimedMilestones),
              now,
              now
            )
          );

          await env.DB.batch(statements);
          stats.migrated += validBatch.length;
        }

        stats.errors += batch.length - validBatch.length;
      } catch (batchError) {
        logError('migration.monthlyLoginBatch', batchError, { batchStart: i });
        stats.errors += batch.length;
      }
    }

    stats.duration = Date.now() - stats.startTime;

    return {
      success: true,
      stats,
      message: `Migrated ${stats.migrated}/${stats.total} monthly logins in ${stats.duration}ms`
    };
  } catch (error) {
    logError('migration.migrateMonthlyLoginToD1', error);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
}

/**
 * Run full migration (users + achievements + unlocks + monthly login)
 */
export async function runFullMigration(env, options = {}) {
  const { dryRun = false } = options;

  const results = {
    users: null,
    achievements: null,
    unlocks: null,
    monthlyLogin: null,
    totalDuration: 0,
    startTime: Date.now()
  };

  // Migrate users first
  results.users = await migrateAllUsersToD1(env, { ...options, dryRun });

  // Then achievements
  results.achievements = await migrateAchievementsToD1(env, { ...options, dryRun });

  // Then unlocks
  results.unlocks = await migrateUnlocksToD1(env, { dryRun });

  // Then monthly login
  results.monthlyLogin = await migrateMonthlyLoginToD1(env, { dryRun });

  results.totalDuration = Date.now() - results.startTime;

  return {
    success: results.users?.success && results.achievements?.success &&
             results.unlocks?.success && results.monthlyLogin?.success,
    dryRun,
    results,
    message: dryRun
      ? 'Dry run complete - no changes made'
      : `Full migration completed in ${results.totalDuration}ms`
  };
}

/**
 * Get comprehensive migration status
 */
export async function getFullMigrationStatus(env) {
  if (!env.DB) {
    return { success: false, error: 'D1 database not configured' };
  }

  try {
    // Get counts from D1
    const [usersD1, achievementsD1, statsD1, unlocksD1, monthlyD1] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM users').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM player_achievements').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM player_stats').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM player_unlocks').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM monthly_login').first()
    ]);

    // Get counts from KV
    const kvCounts = {
      users: 0,
      achievements: 0,
      unlocks: 0,
      monthlyLogin: 0
    };

    // Count KV entries
    const prefixes = [
      { prefix: 'user:', key: 'users' },
      { prefix: 'achievements:', key: 'achievements' },
      { prefix: 'unlock:', key: 'unlocks' },
      { prefix: 'monthlylogin:', key: 'monthlyLogin' }
    ];

    for (const { prefix, key } of prefixes) {
      let cursor = null;
      do {
        const listOptions = { prefix, limit: 1000 };
        if (cursor) listOptions.cursor = cursor;
        const result = await env.SLOTS_KV.list(listOptions);
        kvCounts[key] += result.keys.filter(k =>
          !k.name.includes('dachsbank') && !k.name.includes('spieler')
        ).length;
        cursor = result.cursor;
      } while (cursor);
    }

    return {
      success: true,
      d1: {
        users: usersD1?.count || 0,
        achievements: achievementsD1?.count || 0,
        stats: statsD1?.count || 0,
        unlocks: unlocksD1?.count || 0,
        monthlyLogin: monthlyD1?.count || 0
      },
      kv: kvCounts,
      percentages: {
        users: kvCounts.users > 0 ? Math.round((usersD1?.count || 0) / kvCounts.users * 100) : 0,
        achievements: kvCounts.achievements > 0 ? Math.round((statsD1?.count || 0) / kvCounts.achievements * 100) : 0,
        unlocks: kvCounts.unlocks > 0 ? Math.round((unlocksD1?.count || 0) / kvCounts.unlocks * 100) : 0,
        monthlyLogin: kvCounts.monthlyLogin > 0 ? Math.round((monthlyD1?.count || 0) / kvCounts.monthlyLogin * 100) : 0
      }
    };
  } catch (error) {
    logError('migration.getFullMigrationStatus', error);
    return { success: false, error: error.message };
  }
}
