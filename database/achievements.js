/**
 * Achievements Database Module - KV Operations for Achievement System
 *
 * ARCHITECTURE NOTES:
 * ===================
 * - User achievements stored as JSON: `achievements:{username}`
 * - Structure: { unlockedAt: { achievementId: timestamp }, stats: { ... } }
 * - Stats track progressive values (totalSpins, wins, transfers, etc.)
 * - Rewards are tracked but only added to balance when ACHIEVEMENTS_REWARDS_ENABLED = true
 *
 * USAGE:
 * - Call checkAndUnlockAchievement() when an achievement condition is met
 * - Call updateAchievementStat() to increment progressive counters
 * - Use getPlayerAchievements() to read all achievements for a player
 */

import { ACHIEVEMENTS, ACHIEVEMENTS_REWARDS_ENABLED, getAchievementById } from '../constants/achievements.js';
import { logError, kvKey } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE } from './d1.js';
import { unlockAchievementD1, lockAchievementD1, incrementStatD1, updatePlayerStatsD1, recordTripleHitD1 } from './d1-achievements.js';

// Cache keys (defined early so they can be used in migrations)
const STATS_CACHE_KEY = 'cache:achievement_stats_v3';
const STATS_CACHE_TTL = 300; // 5 minutes in seconds

// Default stats structure for new players
const DEFAULT_STATS = {
  totalSpins: 0,
  wins: 0,
  biggestWin: 0,
  totalWon: 0,
  totalLost: 0,
  totalTransferred: 0,
  shopPurchases: 0,
  duelsPlayed: 0,
  duelsWon: 0,
  dailysClaimed: 0,
  // Triple tracking for FRUIT_COLLECTOR and ALL_TRIPLES
  triplesCollected: {
    dachs: false,
    diamond: false,
    star: false,
    watermelon: false,
    grapes: false,
    orange: false,
    lemon: false,
    cherry: false
  }
};

/**
 * Get all achievement data for a player
 * Includes automatic migration of legacy stats from stats:{username}
 * @returns {{ unlockedAt: Object, stats: Object, pendingRewards: number }}
 */
async function getPlayerAchievements(username, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('achievements:', username));

    if (!value) {
      // New achievement record - check for legacy stats to migrate
      const legacyStats = await env.SLOTS_KV.get(kvKey('stats:', username));

      if (legacyStats) {
        // Migrate existing player stats
        const legacy = JSON.parse(legacyStats);
        const migratedData = {
          unlockedAt: {},
          stats: {
            ...DEFAULT_STATS,
            triplesCollected: { ...DEFAULT_STATS.triplesCollected },
            // Migrate legacy stats
            totalSpins: legacy.totalSpins || 0,
            wins: legacy.wins || 0,
            biggestWin: legacy.biggestWin || 0,
            totalWon: legacy.totalWon || 0,
            totalLost: legacy.totalLost || 0
          },
          pendingRewards: 0,
          migratedAt: Date.now()
        };

        // Auto-unlock achievements based on migrated stats
        const unlockedIds = migrateAchievementsFromStats(migratedData);

        // Save the migrated data and increment global counters
        await Promise.all([
          env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(migratedData)),
          ...unlockedIds.map(id => incrementAchievementCounter(id, env))
        ]);

        return migratedData;
      }

      // Truly new player
      return {
        unlockedAt: {},
        stats: { ...DEFAULT_STATS, triplesCollected: { ...DEFAULT_STATS.triplesCollected } },
        pendingRewards: 0
      };
    }

    const data = JSON.parse(value);
    // Ensure stats has all fields (migration safety)
    if (!data.stats) {
      data.stats = { ...DEFAULT_STATS, triplesCollected: { ...DEFAULT_STATS.triplesCollected } };
    }
    if (!data.stats.triplesCollected) {
      data.stats.triplesCollected = { ...DEFAULT_STATS.triplesCollected };
    }
    if (!data.unlockedAt) {
      data.unlockedAt = {};
    }
    if (typeof data.pendingRewards !== 'number') {
      data.pendingRewards = 0;
    }

    // One-time shop migration: Check unlocks and update shopPurchases stat
    if (!data.shopMigrated) {
      const shopUnlockKeys = ['slots_20', 'slots_30', 'slots_50', 'slots_100', 'slots_all', 'daily_boost'];
      const unlockChecks = await Promise.all(
        shopUnlockKeys.map(key => env.SLOTS_KV.get(kvKey('unlock:', username, key)))
      );

      // Count how many unlocks the user has (each unlock = 1 shop purchase)
      const unlockCount = unlockChecks.filter(v => v === 'true').length;
      const counterPromises = [];

      if (unlockCount > 0 && (data.stats.shopPurchases || 0) < unlockCount) {
        data.stats.shopPurchases = unlockCount;

        // Auto-unlock shop achievements based on count
        const now = Date.now();
        let addedRewards = 0;

        if (!data.unlockedAt[ACHIEVEMENTS.FIRST_PURCHASE.id]) {
          data.unlockedAt[ACHIEVEMENTS.FIRST_PURCHASE.id] = now;
          addedRewards += ACHIEVEMENTS.FIRST_PURCHASE.reward || 0;
          counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.FIRST_PURCHASE.id, env));
        }
        if (unlockCount >= 10 && !data.unlockedAt[ACHIEVEMENTS.SHOP_10.id]) {
          data.unlockedAt[ACHIEVEMENTS.SHOP_10.id] = now;
          addedRewards += ACHIEVEMENTS.SHOP_10.reward || 0;
          counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.SHOP_10.id, env));
        }
        if (unlockCount >= 50 && !data.unlockedAt[ACHIEVEMENTS.SHOP_50.id]) {
          data.unlockedAt[ACHIEVEMENTS.SHOP_50.id] = now;
          addedRewards += ACHIEVEMENTS.SHOP_50.reward || 0;
          counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.SHOP_50.id, env));
        }
        if (unlockCount >= 100 && !data.unlockedAt[ACHIEVEMENTS.SHOP_100.id]) {
          data.unlockedAt[ACHIEVEMENTS.SHOP_100.id] = now;
          addedRewards += ACHIEVEMENTS.SHOP_100.reward || 0;
          counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.SHOP_100.id, env));
        }

        if (addedRewards > 0 && !ACHIEVEMENTS_REWARDS_ENABLED) {
          data.pendingRewards = (data.pendingRewards || 0) + addedRewards;
        }
      }

      data.shopMigrated = true;
      // Save migrated data and increment counters
      await Promise.all([
        env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data)),
        ...counterPromises
      ]);
    }

    // Daily achievement catch-up: Check monthly login and unlock missed daily achievements
    // This runs every time (not one-time) because monthly days change throughout the month
    const monthlyLoginData = await env.SLOTS_KV.get(kvKey('monthlylogin:', username));
    if (monthlyLoginData) {
      try {
        const monthlyLogin = JSON.parse(monthlyLoginData);
        const monthlyDays = monthlyLogin.days ? monthlyLogin.days.length : 0;

        if (monthlyDays > 0) {
          const now = Date.now();
          let addedRewards = 0;
          const counterPromises = [];

          // FIRST_DAILY if they have any daily claims
          if (!data.unlockedAt[ACHIEVEMENTS.FIRST_DAILY.id]) {
            data.unlockedAt[ACHIEVEMENTS.FIRST_DAILY.id] = now;
            addedRewards += ACHIEVEMENTS.FIRST_DAILY.reward || 0;
            counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.FIRST_DAILY.id, env));
          }

          // DAILY_7/14/21/28 based on monthly login days
          if (monthlyDays >= 7 && !data.unlockedAt[ACHIEVEMENTS.DAILY_7.id]) {
            data.unlockedAt[ACHIEVEMENTS.DAILY_7.id] = now;
            addedRewards += ACHIEVEMENTS.DAILY_7.reward || 0;
            counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.DAILY_7.id, env));
          }
          if (monthlyDays >= 14 && !data.unlockedAt[ACHIEVEMENTS.DAILY_14.id]) {
            data.unlockedAt[ACHIEVEMENTS.DAILY_14.id] = now;
            addedRewards += ACHIEVEMENTS.DAILY_14.reward || 0;
            counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.DAILY_14.id, env));
          }
          if (monthlyDays >= 20 && !data.unlockedAt[ACHIEVEMENTS.DAILY_20.id]) {
            data.unlockedAt[ACHIEVEMENTS.DAILY_20.id] = now;
            addedRewards += ACHIEVEMENTS.DAILY_20.reward || 0;
            counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.DAILY_20.id, env));
          }

          if (addedRewards > 0 && !ACHIEVEMENTS_REWARDS_ENABLED) {
            data.pendingRewards = (data.pendingRewards || 0) + addedRewards;
          }

          if (counterPromises.length > 0) {
            await Promise.all([
              env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data)),
              ...counterPromises,
              // Invalidate stats cache so new unlocks are reflected immediately
              env.SLOTS_KV.delete(STATS_CACHE_KEY)
            ]);
          }
        }
      } catch (e) {
        // Invalid monthly login data, skip
        logError('dailyAchievementCatchup', e, { username });
      }
    }

    // One-time transfer achievement catch-up: Unlock FIRST_TRANSFER if user has totalTransferred > 0
    if (!data.transferMigrated) {
      if ((data.stats.totalTransferred || 0) > 0 && !data.unlockedAt[ACHIEVEMENTS.FIRST_TRANSFER.id]) {
        const now = Date.now();
        data.unlockedAt[ACHIEVEMENTS.FIRST_TRANSFER.id] = now;
        if (!ACHIEVEMENTS_REWARDS_ENABLED && ACHIEVEMENTS.FIRST_TRANSFER.reward > 0) {
          data.pendingRewards = (data.pendingRewards || 0) + ACHIEVEMENTS.FIRST_TRANSFER.reward;
        }
        await Promise.all([
          env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify({ ...data, transferMigrated: true })),
          incrementAchievementCounter(ACHIEVEMENTS.FIRST_TRANSFER.id, env)
        ]);
        data.transferMigrated = true;
      } else {
        data.transferMigrated = true;
        await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
      }
    }

    // One-time duel achievement catch-up: Unlock FIRST_DUEL if user has duelsWon > 0
    if (!data.duelMigrated) {
      if ((data.stats.duelsWon || 0) > 0 && !data.unlockedAt[ACHIEVEMENTS.FIRST_DUEL.id]) {
        const now = Date.now();
        data.unlockedAt[ACHIEVEMENTS.FIRST_DUEL.id] = now;
        if (!ACHIEVEMENTS_REWARDS_ENABLED && ACHIEVEMENTS.FIRST_DUEL.reward > 0) {
          data.pendingRewards = (data.pendingRewards || 0) + ACHIEVEMENTS.FIRST_DUEL.reward;
        }
        await Promise.all([
          env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify({ ...data, duelMigrated: true })),
          incrementAchievementCounter(ACHIEVEMENTS.FIRST_DUEL.id, env)
        ]);
        data.duelMigrated = true;
      } else {
        data.duelMigrated = true;
        await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
      }
    }

    // One-time balance achievement catch-up: Check current balance and unlock missed balance achievements
    if (!data.balanceMigrated) {
      const balanceData = await env.SLOTS_KV.get(kvKey('user:', username));
      if (balanceData) {
        const balance = parseInt(balanceData, 10);
        if (!isNaN(balance) && balance > 0) {
          const now = Date.now();
          let addedRewards = 0;
          const counterPromises = [];

          const balanceAchievements = [
            { id: 'balance_1000', threshold: 1000, achievement: ACHIEVEMENTS.BALANCE_1000 },
            { id: 'balance_5000', threshold: 5000, achievement: ACHIEVEMENTS.BALANCE_5000 },
            { id: 'balance_10000', threshold: 10000, achievement: ACHIEVEMENTS.BALANCE_10000 },
            { id: 'balance_50000', threshold: 50000, achievement: ACHIEVEMENTS.BALANCE_50000 },
            { id: 'balance_100000', threshold: 100000, achievement: ACHIEVEMENTS.BALANCE_100000 }
          ];

          for (const { id, threshold, achievement } of balanceAchievements) {
            if (balance >= threshold && !data.unlockedAt[id]) {
              data.unlockedAt[id] = now;
              addedRewards += achievement.reward || 0;
              counterPromises.push(incrementAchievementCounter(id, env));
            }
          }

          // Special: Lucky 777
          if (balance === 777 && !data.unlockedAt[ACHIEVEMENTS.LUCKY_777.id]) {
            data.unlockedAt[ACHIEVEMENTS.LUCKY_777.id] = now;
            addedRewards += ACHIEVEMENTS.LUCKY_777.reward || 0;
            counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.LUCKY_777.id, env));
          }

          if (addedRewards > 0 && !ACHIEVEMENTS_REWARDS_ENABLED) {
            data.pendingRewards = (data.pendingRewards || 0) + addedRewards;
          }

          data.balanceMigrated = true;
          if (counterPromises.length > 0) {
            await Promise.all([
              env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data)),
              ...counterPromises
            ]);
          } else {
            await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
          }
        } else {
          data.balanceMigrated = true;
          await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
        }
      } else {
        data.balanceMigrated = true;
        await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
      }
    }

    return data;
  } catch (error) {
    logError('getPlayerAchievements', error, { username });
    return {
      unlockedAt: {},
      stats: { ...DEFAULT_STATS, triplesCollected: { ...DEFAULT_STATS.triplesCollected } },
      pendingRewards: 0
    };
  }
}

/**
 * Auto-unlock achievements based on migrated stats
 * Called once during migration from legacy stats system
 * Returns array of unlocked achievement IDs for counter updates
 */
function migrateAchievementsFromStats(data) {
  const { stats, unlockedAt } = data;
  const now = Date.now();
  let pendingRewards = 0;
  const unlockedIds = [];

  // Spin milestones
  if (stats.totalSpins >= 1) {
    unlockedAt[ACHIEVEMENTS.FIRST_SPIN.id] = now;
    pendingRewards += ACHIEVEMENTS.FIRST_SPIN.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.FIRST_SPIN.id);
  }
  if (stats.totalSpins >= 100) {
    unlockedAt[ACHIEVEMENTS.SPIN_100.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_100.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.SPIN_100.id);
  }
  if (stats.totalSpins >= 500) {
    unlockedAt[ACHIEVEMENTS.SPIN_500.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_500.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.SPIN_500.id);
  }
  if (stats.totalSpins >= 1000) {
    unlockedAt[ACHIEVEMENTS.SPIN_1000.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_1000.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.SPIN_1000.id);
  }
  if (stats.totalSpins >= 5000) {
    unlockedAt[ACHIEVEMENTS.SPIN_5000.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_5000.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.SPIN_5000.id);
  }
  if (stats.totalSpins >= 10000) {
    unlockedAt[ACHIEVEMENTS.SPIN_10000.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_10000.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.SPIN_10000.id);
  }

  // Win milestones
  if (stats.wins >= 1) {
    unlockedAt[ACHIEVEMENTS.FIRST_WIN.id] = now;
    pendingRewards += ACHIEVEMENTS.FIRST_WIN.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.FIRST_WIN.id);
  }
  if (stats.wins >= 100) {
    unlockedAt[ACHIEVEMENTS.WIN_100.id] = now;
    pendingRewards += ACHIEVEMENTS.WIN_100.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.WIN_100.id);
  }
  if (stats.wins >= 500) {
    unlockedAt[ACHIEVEMENTS.WIN_500.id] = now;
    pendingRewards += ACHIEVEMENTS.WIN_500.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.WIN_500.id);
  }
  if (stats.wins >= 1000) {
    unlockedAt[ACHIEVEMENTS.WIN_1000.id] = now;
    pendingRewards += ACHIEVEMENTS.WIN_1000.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.WIN_1000.id);
  }

  // Big win milestones (based on biggestWin)
  if (stats.biggestWin >= 500) {
    unlockedAt[ACHIEVEMENTS.BIG_WIN_500.id] = now;
    pendingRewards += ACHIEVEMENTS.BIG_WIN_500.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.BIG_WIN_500.id);
  }
  if (stats.biggestWin >= 1000) {
    unlockedAt[ACHIEVEMENTS.BIG_WIN_1000.id] = now;
    pendingRewards += ACHIEVEMENTS.BIG_WIN_1000.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.BIG_WIN_1000.id);
  }
  if (stats.biggestWin >= 5000) {
    unlockedAt[ACHIEVEMENTS.BIG_WIN_5000.id] = now;
    pendingRewards += ACHIEVEMENTS.BIG_WIN_5000.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.BIG_WIN_5000.id);
  }
  if (stats.biggestWin >= 10000) {
    unlockedAt[ACHIEVEMENTS.BIG_WIN_10000.id] = now;
    pendingRewards += ACHIEVEMENTS.BIG_WIN_10000.reward || 0;
    unlockedIds.push(ACHIEVEMENTS.BIG_WIN_10000.id);
  }

  // Store pending rewards (paid out when ACHIEVEMENTS_REWARDS_ENABLED = true)
  data.pendingRewards = pendingRewards;

  return unlockedIds;
}

/**
 * Save achievement data for a player
 */
async function savePlayerAchievements(username, data, env) {
  try {
    await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB && data.stats) {
      updatePlayerStatsD1(username, {
        ...data.stats,
        pendingRewards: data.pendingRewards || 0
      }, env).catch(err => logError('savePlayerAchievements.d1', err, { username }));
    }
  } catch (error) {
    logError('savePlayerAchievements', error, { username });
  }
}

/**
 * Check if player has unlocked an achievement
 */
async function hasAchievement(username, achievementId, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    return !!data.unlockedAt[achievementId];
  } catch (error) {
    logError('hasAchievement', error, { username, achievementId });
    return false;
  }
}

/**
 * Lock (remove) an achievement from a player
 * Used by admins to revoke achievements
 */
async function lockAchievement(username, achievementId, env) {
  try {
    const data = await getPlayerAchievements(username, env);

    // Not unlocked, nothing to do
    if (!data.unlockedAt[achievementId]) {
      return { locked: false, wasUnlocked: false };
    }

    // Remove the achievement
    delete data.unlockedAt[achievementId];

    // Save and decrement global counter in parallel
    await Promise.all([
      savePlayerAchievements(username, data, env),
      decrementAchievementCounter(achievementId, env)
    ]);

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      lockAchievementD1(username, achievementId, env).catch(err => logError('lockAchievement.d1', err, { username, achievementId }));
    }

    return { locked: true, wasUnlocked: true };
  } catch (error) {
    logError('lockAchievement', error, { username, achievementId });
    return { locked: false, wasUnlocked: false };
  }
}

/**
 * Decrement the global counter for an achievement
 */
async function decrementAchievementCounter(achievementId, env) {
  try {
    const key = `achievement_count:${achievementId}`;
    const current = parseInt(await env.SLOTS_KV.get(key) || '0', 10);
    if (current > 0) {
      await env.SLOTS_KV.put(key, String(current - 1));
    }
  } catch (error) {
    logError('decrementAchievementCounter', error, { achievementId });
  }
}

/**
 * Unlock an achievement for a player (if not already unlocked)
 * Returns the reward amount if newly unlocked and REWARDS_ENABLED, otherwise 0
 *
 * @param {string} username
 * @param {string} achievementId
 * @param {object} env
 * @param {object|null} existingData - Optional pre-loaded achievement data to avoid extra KV read
 * @returns {Promise<{ unlocked: boolean, reward: number, achievement: object|null }>}
 */
async function unlockAchievement(username, achievementId, env, existingData = null) {
  try {
    const achievement = getAchievementById(achievementId);
    if (!achievement) {
      return { unlocked: false, reward: 0, achievement: null };
    }

    const data = existingData || await getPlayerAchievements(username, env);

    // Already unlocked
    if (data.unlockedAt[achievementId]) {
      return { unlocked: false, reward: 0, achievement };
    }

    // Unlock it
    data.unlockedAt[achievementId] = Date.now();

    // Track reward
    const reward = achievement.reward || 0;
    if (reward > 0 && !ACHIEVEMENTS_REWARDS_ENABLED) {
      // Track pending rewards for later
      data.pendingRewards = (data.pendingRewards || 0) + reward;
    }

    // Save player achievements and increment global counter in parallel
    await Promise.all([
      savePlayerAchievements(username, data, env),
      incrementAchievementCounter(achievementId, env)
    ]);

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      unlockAchievementD1(username, achievementId, env).catch(err => logError('unlockAchievement.d1', err, { username, achievementId }));
    }

    return {
      unlocked: true,
      reward: ACHIEVEMENTS_REWARDS_ENABLED ? reward : 0,
      achievement
    };
  } catch (error) {
    logError('unlockAchievement', error, { username, achievementId });
    return { unlocked: false, reward: 0, achievement: null };
  }
}

/**
 * Update a stat and check for related achievements
 * Returns array of newly unlocked achievements
 *
 * @param {string} username
 * @param {string} statKey - Key in stats object (e.g., 'totalSpins', 'wins')
 * @param {number} increment - Amount to add (default 1)
 * @param {object} env
 * @returns {Promise<Array<{ achievement: object, reward: number }>>}
 */
async function updateAchievementStat(username, statKey, increment, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    const oldValue = data.stats[statKey] || 0;
    const newValue = oldValue + increment;
    data.stats[statKey] = newValue;

    const unlockedAchievements = [];

    // Check stat-based achievements
    const achievementsToCheck = getAchievementsForStat(statKey);
    for (const achKey of achievementsToCheck) {
      const achievement = ACHIEVEMENTS[achKey];
      if (!achievement) continue;

      // Skip if already unlocked
      if (data.unlockedAt[achievement.id]) continue;

      // Check requirement - also catch up achievements that were missed
      // (e.g., if stats were tracked before achievements existed)
      const requirement = achievement.requirement || 1;
      if (newValue >= requirement) {
        const result = await unlockAchievement(username, achievement.id, env, data);
        if (result.unlocked) {
          unlockedAchievements.push({ achievement: result.achievement, reward: result.reward });
        }
      }
    }

    await savePlayerAchievements(username, data, env);

    // DUAL_WRITE: Fire-and-forget D1 write
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      incrementStatD1(username, statKey, increment, env).catch(err => logError('updateAchievementStat.d1', err, { username, statKey }));
    }

    return unlockedAchievements;
  } catch (error) {
    logError('updateAchievementStat', error, { username, statKey, increment });
    return [];
  }
}

/**
 * Batch update multiple achievement stats in a single read-modify-write cycle
 * @param {string} username - Player username
 * @param {Array<[string, number]>} updates - Array of [statKey, increment] pairs
 * @param {object} env
 */
async function updateAchievementStatBatch(username, updates, env) {
  try {
    const data = await getPlayerAchievements(username, env);

    for (const [statKey, increment] of updates) {
      const newValue = (data.stats[statKey] || 0) + increment;
      data.stats[statKey] = newValue;

      // Check stat-based achievements for each updated stat
      const achievementsToCheck = getAchievementsForStat(statKey);
      for (const achKey of achievementsToCheck) {
        const achievement = ACHIEVEMENTS[achKey];
        if (!achievement || data.unlockedAt[achievement.id]) continue;
        if (newValue >= (achievement.requirement || 1)) {
          await unlockAchievement(username, achievement.id, env, data);
        }
      }
    }

    await savePlayerAchievements(username, data, env);

    // DUAL_WRITE: Fire-and-forget D1 writes
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      Promise.all(updates.map(([key, amt]) => incrementStatD1(username, key, amt, env)))
        .catch(err => logError('updateAchievementStatBatch.d1', err, { username }));
    }
  } catch (error) {
    logError('updateAchievementStatBatch', error, { username, updates: updates.map(u => u[0]) });
  }
}

/**
 * Mark a triple as collected and check for collection achievements
 * Also records to D1 for detailed tracking with timestamps and counters
 */
async function markTripleCollected(username, symbol, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    const symbolKey = getTripleKey(symbol);

    if (!symbolKey) {
      return []; // Unknown symbol
    }

    // DUAL_WRITE: Fire-and-forget D1 write (increments counter even if already collected)
    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      const d1Key = symbolKey === 'dachs' ? 'dachs_triple' : symbolKey;
      recordTripleHitD1(username, d1Key, env).catch(err => logError('markTripleCollected.d1', err, { username, symbolKey }));
    }

    // Check if already collected in KV (for achievement tracking)
    if (data.stats.triplesCollected?.[symbolKey]) {
      return []; // Already collected, but D1 counter was incremented above
    }

    // Ensure triplesCollected exists before setting
    if (!data.stats.triplesCollected) {
      data.stats.triplesCollected = { ...DEFAULT_STATS.triplesCollected };
    }
    data.stats.triplesCollected[symbolKey] = true;

    const unlockedAchievements = [];

    // Check individual triple achievements
    const tripleAchievementMap = {
      dachs: 'DACHS_TRIPLE',
      diamond: 'DIAMOND_TRIPLE',
      star: 'STAR_TRIPLE'
    };

    if (tripleAchievementMap[symbolKey]) {
      const achKey = tripleAchievementMap[symbolKey];
      const achievement = ACHIEVEMENTS[achKey];
      if (achievement && !data.unlockedAt[achievement.id]) {
        data.unlockedAt[achievement.id] = Date.now();
        const reward = ACHIEVEMENTS_REWARDS_ENABLED ? (achievement.reward || 0) : 0;
        if (!ACHIEVEMENTS_REWARDS_ENABLED && achievement.reward > 0) {
          data.pendingRewards = (data.pendingRewards || 0) + achievement.reward;
        }
        unlockedAchievements.push({ achievement, reward });
      }
    }

    // Check FRUIT_COLLECTOR (all fruit triples)
    const fruitKeys = ['watermelon', 'grapes', 'orange', 'lemon', 'cherry'];
    const allFruitsCollected = fruitKeys.every(k => data.stats.triplesCollected?.[k])
    if (allFruitsCollected && !data.unlockedAt[ACHIEVEMENTS.FRUIT_COLLECTOR.id]) {
      data.unlockedAt[ACHIEVEMENTS.FRUIT_COLLECTOR.id] = Date.now();
      const reward = ACHIEVEMENTS_REWARDS_ENABLED ? (ACHIEVEMENTS.FRUIT_COLLECTOR.reward || 0) : 0;
      if (!ACHIEVEMENTS_REWARDS_ENABLED && ACHIEVEMENTS.FRUIT_COLLECTOR.reward > 0) {
        data.pendingRewards = (data.pendingRewards || 0) + ACHIEVEMENTS.FRUIT_COLLECTOR.reward;
      }
      unlockedAchievements.push({ achievement: ACHIEVEMENTS.FRUIT_COLLECTOR, reward });
    }

    // Check ALL_TRIPLES (every triple)
    const allKeys = Object.keys(DEFAULT_STATS.triplesCollected);
    const allTriplesCollected = allKeys.every(k => data.stats.triplesCollected?.[k]);
    if (allTriplesCollected && !data.unlockedAt[ACHIEVEMENTS.ALL_TRIPLES.id]) {
      data.unlockedAt[ACHIEVEMENTS.ALL_TRIPLES.id] = Date.now();
      const reward = ACHIEVEMENTS_REWARDS_ENABLED ? (ACHIEVEMENTS.ALL_TRIPLES.reward || 0) : 0;
      if (!ACHIEVEMENTS_REWARDS_ENABLED && ACHIEVEMENTS.ALL_TRIPLES.reward > 0) {
        data.pendingRewards = (data.pendingRewards || 0) + ACHIEVEMENTS.ALL_TRIPLES.reward;
      }
      unlockedAchievements.push({ achievement: ACHIEVEMENTS.ALL_TRIPLES, reward });
    }

    await savePlayerAchievements(username, data, env);
    return unlockedAchievements;
  } catch (error) {
    logError('markTripleCollected', error, { username, symbol });
    return [];
  }
}

/**
 * Record a dachs hit (single or double) to D1
 * Called from slots helpers for non-triple dachs appearances
 */
function recordDachsHit(username, count, env) {
  if (!D1_ENABLED || !DUAL_WRITE || !env.DB) return;

  // Fire-and-forget D1 write
  const key = count === 1 ? 'dachs_single' : count === 2 ? 'dachs_double' : null;
  if (key) {
    recordTripleHitD1(username, key, env).catch(err => logError('recordDachsHit.d1', err, { username, count }));
  }
}

/**
 * Check and unlock a one-time achievement (e.g., FIRST_SPIN, FIRST_WIN)
 * Returns unlock result
 */
async function checkAndUnlockAchievement(username, achievementId, env) {
  return unlockAchievement(username, achievementId, env);
}

/**
 * Check balance milestones and unlock if reached
 */
async function checkBalanceAchievements(username, newBalance, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    const unlockedAchievements = [];

    const balanceAchievements = [
      { id: 'balance_1000', threshold: 1000 },
      { id: 'balance_5000', threshold: 5000 },
      { id: 'balance_10000', threshold: 10000 },
      { id: 'balance_50000', threshold: 50000 },
      { id: 'balance_100000', threshold: 100000 }
    ];

    // Special: Lucky 777
    const counterPromises = [];
    if (newBalance === 777 && !data.unlockedAt[ACHIEVEMENTS.LUCKY_777.id]) {
      data.unlockedAt[ACHIEVEMENTS.LUCKY_777.id] = Date.now();
      const reward = ACHIEVEMENTS_REWARDS_ENABLED ? (ACHIEVEMENTS.LUCKY_777.reward || 0) : 0;
      if (!ACHIEVEMENTS_REWARDS_ENABLED && ACHIEVEMENTS.LUCKY_777.reward > 0) {
        data.pendingRewards = (data.pendingRewards || 0) + ACHIEVEMENTS.LUCKY_777.reward;
      }
      unlockedAchievements.push({ achievement: ACHIEVEMENTS.LUCKY_777, reward });
      counterPromises.push(incrementAchievementCounter(ACHIEVEMENTS.LUCKY_777.id, env));
    }

    for (const { id, threshold } of balanceAchievements) {
      if (newBalance >= threshold && !data.unlockedAt[id]) {
        const achievement = getAchievementById(id);
        if (achievement) {
          data.unlockedAt[id] = Date.now();
          const reward = ACHIEVEMENTS_REWARDS_ENABLED ? (achievement.reward || 0) : 0;
          if (!ACHIEVEMENTS_REWARDS_ENABLED && achievement.reward > 0) {
            data.pendingRewards = (data.pendingRewards || 0) + achievement.reward;
          }
          unlockedAchievements.push({ achievement, reward });
          counterPromises.push(incrementAchievementCounter(id, env));
        }
      }
    }

    if (unlockedAchievements.length > 0) {
      await Promise.all([
        savePlayerAchievements(username, data, env),
        ...counterPromises
      ]);
    }

    return unlockedAchievements;
  } catch (error) {
    logError('checkBalanceAchievements', error, { username, newBalance });
    return [];
  }
}

/**
 * Check big win achievements
 */
async function checkBigWinAchievements(username, winAmount, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    const unlockedAchievements = [];

    // Update biggest win stat
    if (winAmount > (data.stats.biggestWin || 0)) {
      data.stats.biggestWin = winAmount;
    }

    const bigWinAchievements = [
      { id: 'big_win_500', threshold: 500 },
      { id: 'big_win_1000', threshold: 1000 },
      { id: 'big_win_5000', threshold: 5000 },
      { id: 'big_win_10000', threshold: 10000 }
    ];

    const counterPromises = [];
    for (const { id, threshold } of bigWinAchievements) {
      if (winAmount >= threshold && !data.unlockedAt[id]) {
        const achievement = getAchievementById(id);
        if (achievement) {
          data.unlockedAt[id] = Date.now();
          const reward = ACHIEVEMENTS_REWARDS_ENABLED ? (achievement.reward || 0) : 0;
          if (!ACHIEVEMENTS_REWARDS_ENABLED && achievement.reward > 0) {
            data.pendingRewards = (data.pendingRewards || 0) + achievement.reward;
          }
          unlockedAchievements.push({ achievement, reward });
          counterPromises.push(incrementAchievementCounter(id, env));
        }
      }
    }

    if (unlockedAchievements.length > 0 || winAmount > (data.stats.biggestWin || 0)) {
      await Promise.all([
        savePlayerAchievements(username, data, env),
        ...counterPromises
      ]);
    }

    return unlockedAchievements;
  } catch (error) {
    logError('checkBigWinAchievements', error, { username, winAmount });
    return [];
  }
}

/**
 * Get total pending rewards for a player (rewards earned while REWARDS_ENABLED was false)
 */
async function getPendingRewards(username, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    return data.pendingRewards || 0;
  } catch (error) {
    logError('getPendingRewards', error, { username });
    return 0;
  }
}

/**
 * Claim all pending rewards (when REWARDS_ENABLED is turned on)
 * Returns the amount claimed and resets pendingRewards to 0
 */
async function claimPendingRewards(username, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    const amount = data.pendingRewards || 0;
    if (amount > 0) {
      data.pendingRewards = 0;
      await savePlayerAchievements(username, data, env);
    }
    return amount;
  } catch (error) {
    logError('claimPendingRewards', error, { username });
    return 0;
  }
}

/**
 * Get count of unlocked achievements for a player
 */
async function getUnlockedAchievementCount(username, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    return Object.keys(data.unlockedAt).length;
  } catch (error) {
    logError('getUnlockedAchievementCount', error, { username });
    return 0;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map stat keys to achievement keys
 */
function getAchievementsForStat(statKey) {
  const mapping = {
    totalSpins: ['SPIN_100', 'SPIN_500', 'SPIN_1000', 'SPIN_5000', 'SPIN_10000'],
    wins: ['WIN_100', 'WIN_500', 'WIN_1000'],
    totalTransferred: ['TRANSFER_1000', 'TRANSFER_10000'],
    shopPurchases: ['SHOP_10', 'SHOP_50', 'SHOP_100'],
    duelsWon: ['DUEL_WIN_10', 'DUEL_WIN_50', 'DUEL_WIN_100'],
    dailysClaimed: ['DAILY_7', 'DAILY_14', 'DAILY_20']
  };
  return mapping[statKey] || [];
}

/**
 * Map symbol emoji to triple key
 */
function getTripleKey(symbol) {
  const mapping = {
    '🦡': 'dachs',
    '💎': 'diamond',
    '⭐': 'star',
    '🍉': 'watermelon',
    '🍇': 'grapes',
    '🍊': 'orange',
    '🍋': 'lemon',
    '🍒': 'cherry'
  };
  return mapping[symbol] || null;
}

// ============================================
// Global Achievement Statistics (for Rarity)
// ============================================

/**
 * Increment global counter when an achievement is unlocked
 * Uses retry mechanism to handle race conditions
 */
async function incrementAchievementCounter(achievementId, env, maxRetries = 3) {
  const key = `achievement_count:${achievementId}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const current = await env.SLOTS_KV.get(key);
      const currentCount = parseInt(current, 10) || 0;
      const newCount = currentCount + 1;
      await env.SLOTS_KV.put(key, newCount.toString());

      // Verify the write succeeded
      const verifyValue = await env.SLOTS_KV.get(key);
      const verifyCount = parseInt(verifyValue, 10) || 0;

      // Check if the count increased (might be higher due to concurrent increments, that's OK)
      if (verifyCount >= newCount) {
        return; // Success
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
      }
    } catch (error) {
      logError('incrementAchievementCounter', error, { achievementId, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return;
    }
  }
}

/**
 * Migrate all players with user: entries to have achievements: entries
 * This ensures all existing players are counted in achievement stats
 * Runs once per cache period (5 minutes)
 */
const MIGRATION_KEY = 'cache:all_players_migrated_v3';
const MIGRATION_TTL = 300; // Check every 5 minutes for new players

async function migrateAllPlayersToAchievements(env) {
  try {
    // Check if we already ran migration recently
    const migrated = await env.SLOTS_KV.get(MIGRATION_KEY);
    if (migrated) {
      return; // Skip, already done recently
    }

    // Get all user: entries
    const userList = await env.SLOTS_KV.list({ prefix: 'user:', limit: 1000 });
    const userKeys = userList.keys || [];

    // Get all existing achievements: entries
    const achievementList = await env.SLOTS_KV.list({ prefix: 'achievements:', limit: 1000 });
    const existingAchievements = new Set(achievementList.keys.map(k => k.name.replace('achievements:', '')));

    // Find users without achievement entries
    const missingUsers = [];
    for (const key of userKeys) {
      const username = key.name.replace('user:', '').toLowerCase();
      // Skip DachsBank and placeholder users
      if (username === 'dachsbank' || username === 'spieler') continue;
      if (!existingAchievements.has(username)) {
        missingUsers.push(username);
      }
    }

    // Create achievement entries for missing users (batch of 5 to avoid timeouts)
    const batchSize = 5;
    for (let i = 0; i < missingUsers.length; i += batchSize) {
      const batch = missingUsers.slice(i, i + batchSize);
      await Promise.all(batch.map(username => getPlayerAchievements(username, env)));
    }

    // Mark migration as done
    await env.SLOTS_KV.put(MIGRATION_KEY, 'true', { expirationTtl: MIGRATION_TTL });
  } catch (error) {
    logError('migrateAllPlayersToAchievements', error);
  }
}

/**
 * Get global achievement statistics (how many players have each achievement)
 * Uses the achievement_count:{id} counters for real-time accuracy
 * Total players is cached for 5 minutes to reduce load
 */
async function getAchievementStats(env) {
  try {
    // Run migration to ensure all players have achievement entries
    await migrateAllPlayersToAchievements(env);

    // Get all achievement IDs
    const achievementIds = Object.values(ACHIEVEMENTS).map(a => a.id);

    // Fetch all achievement counts in parallel (these are always up-to-date)
    const countPromises = achievementIds.map(id =>
      env.SLOTS_KV.get(`achievement_count:${id}`)
    );

    // Check cached total players count
    let totalPlayers = 0;
    const cachedTotal = await env.SLOTS_KV.get(STATS_CACHE_KEY);
    if (cachedTotal) {
      try {
        const parsed = JSON.parse(cachedTotal);
        totalPlayers = parsed.totalPlayers || 0;
      } catch {
        // Invalid cache, recalculate
      }
    }

    // If no cached total, count achievement records
    if (totalPlayers === 0) {
      const achievementList = await env.SLOTS_KV.list({ prefix: 'achievements:', limit: 1000 });
      totalPlayers = achievementList.keys?.length || 0;
      // Cache just the total players count
      await env.SLOTS_KV.put(STATS_CACHE_KEY, JSON.stringify({ totalPlayers }), { expirationTtl: STATS_CACHE_TTL });
    }

    // Wait for all count fetches
    const countResults = await Promise.all(countPromises);

    // Build counts object
    const counts = {};
    for (let i = 0; i < achievementIds.length; i++) {
      counts[achievementIds[i]] = parseInt(countResults[i] || '0', 10);
    }

    return { totalPlayers, counts };
  } catch (error) {
    logError('getAchievementStats', error);
    return { totalPlayers: 0, counts: {} };
  }
}

export {
  getPlayerAchievements,
  savePlayerAchievements,
  hasAchievement,
  unlockAchievement,
  lockAchievement,
  updateAchievementStat,
  updateAchievementStatBatch,
  markTripleCollected,
  recordDachsHit,
  checkAndUnlockAchievement,
  checkBalanceAchievements,
  checkBigWinAchievements,
  getPendingRewards,
  claimPendingRewards,
  getUnlockedAchievementCount,
  getAchievementStats
};
