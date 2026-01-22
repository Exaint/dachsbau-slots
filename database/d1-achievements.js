/**
 * D1 Database Layer for Achievements and Stats
 *
 * Provides D1 operations with KV fallback for achievements, stats, and unlocks.
 * Uses dual-write during migration period for data consistency.
 */

import { logError } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE } from './d1.js';

// ============================================
// Player Achievements
// ============================================

/**
 * Get all achievement IDs unlocked by a player from D1
 * Returns Map<achievementId, unlockedAt>
 */
async function getPlayerAchievementsD1(username, env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(`
      SELECT achievement_id, unlocked_at
      FROM player_achievements
      WHERE username = ?
    `).bind(username.toLowerCase()).all();

    const unlockedAt = {};
    for (const row of result.results || []) {
      unlockedAt[row.achievement_id] = row.unlocked_at;
    }
    return unlockedAt;
  } catch (error) {
    logError('d1.getPlayerAchievements', error, { username });
    return null;
  }
}

/**
 * Unlock an achievement in D1
 */
async function unlockAchievementD1(username, achievementId, env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO player_achievements (username, achievement_id, unlocked_at)
      VALUES (?, ?, ?)
      ON CONFLICT(username, achievement_id) DO NOTHING
    `).bind(username.toLowerCase(), achievementId, now).run();

    // Update global counter
    await env.DB.prepare(`
      INSERT INTO achievement_stats (achievement_id, unlock_count, last_updated)
      VALUES (?, 1, ?)
      ON CONFLICT(achievement_id) DO UPDATE SET
        unlock_count = unlock_count + 1,
        last_updated = ?
    `).bind(achievementId, now, now).run();

    return true;
  } catch (error) {
    logError('d1.unlockAchievement', error, { username, achievementId });
    return false;
  }
}

/**
 * Lock (remove) an achievement in D1
 */
async function lockAchievementD1(username, achievementId, env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const result = await env.DB.prepare(`
      DELETE FROM player_achievements
      WHERE username = ? AND achievement_id = ?
    `).bind(username.toLowerCase(), achievementId).run();

    if (result.meta?.changes > 0) {
      // Decrement global counter
      await env.DB.prepare(`
        UPDATE achievement_stats
        SET unlock_count = MAX(0, unlock_count - 1),
            last_updated = ?
        WHERE achievement_id = ?
      `).bind(Date.now(), achievementId).run();
    }

    return true;
  } catch (error) {
    logError('d1.lockAchievement', error, { username, achievementId });
    return false;
  }
}

/**
 * Get global achievement statistics from D1
 * Returns { counts: { achievementId: count }, totalPlayers: number }
 */
async function getAchievementStatsD1(env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const [statsResult, playerCountResult] = await Promise.all([
      env.DB.prepare(`
        SELECT achievement_id, unlock_count
        FROM achievement_stats
      `).all(),
      env.DB.prepare(`
        SELECT COUNT(DISTINCT username) as total
        FROM player_achievements
      `).first()
    ]);

    const counts = {};
    for (const row of statsResult.results || []) {
      counts[row.achievement_id] = row.unlock_count;
    }

    return {
      counts,
      totalPlayers: playerCountResult?.total || 0
    };
  } catch (error) {
    logError('d1.getAchievementStats', error);
    return null;
  }
}

// ============================================
// Player Statistics
// ============================================

/**
 * Get player stats from D1
 */
async function getPlayerStatsD1(username, env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(`
      SELECT * FROM player_stats WHERE username = ?
    `).bind(username.toLowerCase()).first();

    if (!result) return null;

    // Convert D1 columns to stats object format
    return {
      totalSpins: result.total_spins || 0,
      wins: result.wins || 0,
      biggestWin: result.biggest_win || 0,
      totalWon: result.total_won || 0,
      totalLost: result.total_lost || 0,
      totalTransferred: result.total_transferred || 0,
      shopPurchases: result.shop_purchases || 0,
      duelsPlayed: result.duels_played || 0,
      duelsWon: result.duels_won || 0,
      dailysClaimed: result.dailys_claimed || 0,
      streakMultiplier: result.streak_multiplier || 1.0,
      pendingRewards: result.pending_rewards || 0,
      triplesCollected: {
        dachs: result.triple_dachs > 0,
        diamond: result.triple_diamond > 0,
        star: result.triple_star > 0,
        watermelon: result.triple_watermelon > 0,
        grapes: result.triple_grapes > 0,
        orange: result.triple_orange > 0,
        lemon: result.triple_lemon > 0,
        cherry: result.triple_cherry > 0
      }
    };
  } catch (error) {
    logError('d1.getPlayerStats', error, { username });
    return null;
  }
}

/**
 * Update player stats in D1 (upsert)
 */
async function updatePlayerStatsD1(username, stats, env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    const lowerUsername = username.toLowerCase();

    await env.DB.prepare(`
      INSERT INTO player_stats (
        username, total_spins, wins, biggest_win, total_won, total_lost,
        total_transferred, shop_purchases, duels_played, duels_won,
        dailys_claimed, streak_multiplier, pending_rewards,
        triple_dachs, triple_diamond, triple_star, triple_watermelon,
        triple_grapes, triple_orange, triple_lemon, triple_cherry,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        total_spins = ?,
        wins = ?,
        biggest_win = ?,
        total_won = ?,
        total_lost = ?,
        total_transferred = ?,
        shop_purchases = ?,
        duels_played = ?,
        duels_won = ?,
        dailys_claimed = ?,
        streak_multiplier = ?,
        pending_rewards = ?,
        triple_dachs = ?,
        triple_diamond = ?,
        triple_star = ?,
        triple_watermelon = ?,
        triple_grapes = ?,
        triple_orange = ?,
        triple_lemon = ?,
        triple_cherry = ?,
        updated_at = ?
    `).bind(
      lowerUsername,
      stats.totalSpins || 0,
      stats.wins || 0,
      stats.biggestWin || 0,
      stats.totalWon || 0,
      stats.totalLost || 0,
      stats.totalTransferred || 0,
      stats.shopPurchases || 0,
      stats.duelsPlayed || 0,
      stats.duelsWon || 0,
      stats.dailysClaimed || 0,
      stats.streakMultiplier || 1.0,
      stats.pendingRewards || 0,
      stats.triplesCollected?.dachs ? 1 : 0,
      stats.triplesCollected?.diamond ? 1 : 0,
      stats.triplesCollected?.star ? 1 : 0,
      stats.triplesCollected?.watermelon ? 1 : 0,
      stats.triplesCollected?.grapes ? 1 : 0,
      stats.triplesCollected?.orange ? 1 : 0,
      stats.triplesCollected?.lemon ? 1 : 0,
      stats.triplesCollected?.cherry ? 1 : 0,
      now, now,
      // ON CONFLICT values
      stats.totalSpins || 0,
      stats.wins || 0,
      stats.biggestWin || 0,
      stats.totalWon || 0,
      stats.totalLost || 0,
      stats.totalTransferred || 0,
      stats.shopPurchases || 0,
      stats.duelsPlayed || 0,
      stats.duelsWon || 0,
      stats.dailysClaimed || 0,
      stats.streakMultiplier || 1.0,
      stats.pendingRewards || 0,
      stats.triplesCollected?.dachs ? 1 : 0,
      stats.triplesCollected?.diamond ? 1 : 0,
      stats.triplesCollected?.star ? 1 : 0,
      stats.triplesCollected?.watermelon ? 1 : 0,
      stats.triplesCollected?.grapes ? 1 : 0,
      stats.triplesCollected?.orange ? 1 : 0,
      stats.triplesCollected?.lemon ? 1 : 0,
      stats.triplesCollected?.cherry ? 1 : 0,
      now
    ).run();

    return true;
  } catch (error) {
    logError('d1.updatePlayerStats', error, { username });
    return false;
  }
}

/**
 * Increment a single stat in D1
 */
async function incrementStatD1(username, statKey, increment, env) {
  if (!D1_ENABLED || !env.DB) return false;

  // Map stat keys to D1 column names
  const columnMap = {
    totalSpins: 'total_spins',
    wins: 'wins',
    biggestWin: 'biggest_win',
    totalWon: 'total_won',
    totalLost: 'total_lost',
    totalTransferred: 'total_transferred',
    shopPurchases: 'shop_purchases',
    duelsPlayed: 'duels_played',
    duelsWon: 'duels_won',
    dailysClaimed: 'dailys_claimed'
  };

  const column = columnMap[statKey];
  if (!column) return false;

  try {
    const now = Date.now();
    const lowerUsername = username.toLowerCase();

    // Use dynamic SQL for the column (safe since column comes from our map)
    await env.DB.prepare(`
      INSERT INTO player_stats (username, ${column}, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        ${column} = ${column} + ?,
        updated_at = ?
    `).bind(lowerUsername, increment, now, now, increment, now).run();

    return true;
  } catch (error) {
    logError('d1.incrementStat', error, { username, statKey, increment });
    return false;
  }
}

/**
 * Update biggest win if new value is higher
 */
async function updateBiggestWinD1(username, winAmount, env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO player_stats (username, biggest_win, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        biggest_win = MAX(biggest_win, ?),
        updated_at = ?
    `).bind(username.toLowerCase(), winAmount, now, now, winAmount, now).run();

    return true;
  } catch (error) {
    logError('d1.updateBiggestWin', error, { username, winAmount });
    return false;
  }
}

// ============================================
// Player Unlocks (Shop Features)
// ============================================

/**
 * Check if player has an unlock
 */
async function hasUnlockD1(username, unlockKey, env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(`
      SELECT 1 FROM player_unlocks
      WHERE username = ? AND unlock_key = ?
    `).bind(username.toLowerCase(), unlockKey).first();

    return result !== null;
  } catch (error) {
    logError('d1.hasUnlock', error, { username, unlockKey });
    return null;
  }
}

/**
 * Add an unlock for a player
 */
async function addUnlockD1(username, unlockKey, env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    await env.DB.prepare(`
      INSERT INTO player_unlocks (username, unlock_key, unlocked_at)
      VALUES (?, ?, ?)
      ON CONFLICT(username, unlock_key) DO NOTHING
    `).bind(username.toLowerCase(), unlockKey, Date.now()).run();

    return true;
  } catch (error) {
    logError('d1.addUnlock', error, { username, unlockKey });
    return false;
  }
}

/**
 * Remove an unlock from a player
 */
async function removeUnlockD1(username, unlockKey, env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    await env.DB.prepare(`
      DELETE FROM player_unlocks
      WHERE username = ? AND unlock_key = ?
    `).bind(username.toLowerCase(), unlockKey).run();

    return true;
  } catch (error) {
    logError('d1.removeUnlock', error, { username, unlockKey });
    return false;
  }
}

/**
 * Get all unlocks for a player
 */
async function getUnlocksD1(username, env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(`
      SELECT unlock_key FROM player_unlocks WHERE username = ?
    `).bind(username.toLowerCase()).all();

    return (result.results || []).map(r => r.unlock_key);
  } catch (error) {
    logError('d1.getUnlocks', error, { username });
    return null;
  }
}

// ============================================
// Monthly Login
// ============================================

/**
 * Get monthly login data from D1
 */
async function getMonthlyLoginD1(username, env) {
  if (!D1_ENABLED || !env.DB) return null;

  try {
    const result = await env.DB.prepare(`
      SELECT month, login_days, claimed_milestones
      FROM monthly_login
      WHERE username = ?
    `).bind(username.toLowerCase()).first();

    if (!result) return null;

    return {
      month: result.month,
      days: JSON.parse(result.login_days || '[]'),
      claimedMilestones: JSON.parse(result.claimed_milestones || '[]')
    };
  } catch (error) {
    logError('d1.getMonthlyLogin', error, { username });
    return null;
  }
}

/**
 * Update monthly login data in D1
 */
async function updateMonthlyLoginD1(username, data, env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO monthly_login (username, month, login_days, claimed_milestones, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        month = ?,
        login_days = ?,
        claimed_milestones = ?,
        updated_at = ?
    `).bind(
      username.toLowerCase(),
      data.month,
      JSON.stringify(data.days || []),
      JSON.stringify(data.claimedMilestones || []),
      now, now,
      data.month,
      JSON.stringify(data.days || []),
      JSON.stringify(data.claimedMilestones || []),
      now
    ).run();

    return true;
  } catch (error) {
    logError('d1.updateMonthlyLogin', error, { username });
    return false;
  }
}

// ============================================
// Batch Migration Helpers
// ============================================

/**
 * Batch migrate achievements from KV to D1
 */
async function batchMigrateAchievements(users, env) {
  if (!D1_ENABLED || !env.DB) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;
  const batchSize = 25;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);

    try {
      const statements = [];
      const now = Date.now();

      for (const user of batch) {
        // Insert achievements
        for (const [achievementId, unlockedAt] of Object.entries(user.unlockedAt || {})) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO player_achievements (username, achievement_id, unlocked_at, created_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(username, achievement_id) DO NOTHING
            `).bind(user.username.toLowerCase(), achievementId, unlockedAt, now)
          );
        }

        // Insert stats
        if (user.stats) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO player_stats (
                username, total_spins, wins, biggest_win, total_won, total_lost,
                total_transferred, shop_purchases, duels_played, duels_won,
                dailys_claimed, pending_rewards,
                triple_dachs, triple_diamond, triple_star, triple_watermelon,
                triple_grapes, triple_orange, triple_lemon, triple_cherry,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(username) DO UPDATE SET
                total_spins = ?, wins = ?, biggest_win = ?, total_won = ?, total_lost = ?,
                total_transferred = ?, shop_purchases = ?, duels_played = ?, duels_won = ?,
                dailys_claimed = ?, pending_rewards = ?,
                triple_dachs = ?, triple_diamond = ?, triple_star = ?, triple_watermelon = ?,
                triple_grapes = ?, triple_orange = ?, triple_lemon = ?, triple_cherry = ?,
                updated_at = ?
            `).bind(
              user.username.toLowerCase(),
              user.stats.totalSpins || 0,
              user.stats.wins || 0,
              user.stats.biggestWin || 0,
              user.stats.totalWon || 0,
              user.stats.totalLost || 0,
              user.stats.totalTransferred || 0,
              user.stats.shopPurchases || 0,
              user.stats.duelsPlayed || 0,
              user.stats.duelsWon || 0,
              user.stats.dailysClaimed || 0,
              user.pendingRewards || 0,
              user.stats.triplesCollected?.dachs ? 1 : 0,
              user.stats.triplesCollected?.diamond ? 1 : 0,
              user.stats.triplesCollected?.star ? 1 : 0,
              user.stats.triplesCollected?.watermelon ? 1 : 0,
              user.stats.triplesCollected?.grapes ? 1 : 0,
              user.stats.triplesCollected?.orange ? 1 : 0,
              user.stats.triplesCollected?.lemon ? 1 : 0,
              user.stats.triplesCollected?.cherry ? 1 : 0,
              now, now,
              // ON CONFLICT values
              user.stats.totalSpins || 0,
              user.stats.wins || 0,
              user.stats.biggestWin || 0,
              user.stats.totalWon || 0,
              user.stats.totalLost || 0,
              user.stats.totalTransferred || 0,
              user.stats.shopPurchases || 0,
              user.stats.duelsPlayed || 0,
              user.stats.duelsWon || 0,
              user.stats.dailysClaimed || 0,
              user.pendingRewards || 0,
              user.stats.triplesCollected?.dachs ? 1 : 0,
              user.stats.triplesCollected?.diamond ? 1 : 0,
              user.stats.triplesCollected?.star ? 1 : 0,
              user.stats.triplesCollected?.watermelon ? 1 : 0,
              user.stats.triplesCollected?.grapes ? 1 : 0,
              user.stats.triplesCollected?.orange ? 1 : 0,
              user.stats.triplesCollected?.lemon ? 1 : 0,
              user.stats.triplesCollected?.cherry ? 1 : 0,
              now
            )
          );
        }
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }
      success += batch.length;
    } catch (error) {
      logError('d1.batchMigrateAchievements', error, { batchStart: i });
      failed += batch.length;
    }
  }

  return { success, failed };
}

/**
 * Rebuild achievement_stats table from player_achievements
 */
async function rebuildAchievementStats(env) {
  if (!D1_ENABLED || !env.DB) return false;

  try {
    const now = Date.now();

    // Clear and rebuild
    await env.DB.prepare('DELETE FROM achievement_stats').run();

    await env.DB.prepare(`
      INSERT INTO achievement_stats (achievement_id, unlock_count, last_updated)
      SELECT achievement_id, COUNT(*) as unlock_count, ?
      FROM player_achievements
      GROUP BY achievement_id
    `).bind(now).run();

    return true;
  } catch (error) {
    logError('d1.rebuildAchievementStats', error);
    return false;
  }
}

// ============================================
// Exports
// ============================================

export {
  // Achievements
  getPlayerAchievementsD1,
  unlockAchievementD1,
  lockAchievementD1,
  getAchievementStatsD1,

  // Stats
  getPlayerStatsD1,
  updatePlayerStatsD1,
  incrementStatD1,
  updateBiggestWinD1,

  // Unlocks
  hasUnlockD1,
  addUnlockD1,
  removeUnlockD1,
  getUnlocksD1,

  // Monthly Login
  getMonthlyLoginD1,
  updateMonthlyLoginD1,

  // Migration
  batchMigrateAchievements,
  rebuildAchievementStats
};
