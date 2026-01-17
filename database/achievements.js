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
import { logError } from '../utils.js';

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
    const lowerUsername = username.toLowerCase();
    const value = await env.SLOTS_KV.get(`achievements:${lowerUsername}`);

    if (!value) {
      // New achievement record - check for legacy stats to migrate
      const legacyStats = await env.SLOTS_KV.get(`stats:${lowerUsername}`);

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
        migrateAchievementsFromStats(migratedData);

        // Save the migrated data
        await env.SLOTS_KV.put(`achievements:${lowerUsername}`, JSON.stringify(migratedData));

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
 */
function migrateAchievementsFromStats(data) {
  const { stats, unlockedAt } = data;
  const now = Date.now();
  let pendingRewards = 0;

  // Spin milestones
  if (stats.totalSpins >= 1) {
    unlockedAt[ACHIEVEMENTS.FIRST_SPIN.id] = now;
    pendingRewards += ACHIEVEMENTS.FIRST_SPIN.reward || 0;
  }
  if (stats.totalSpins >= 100) {
    unlockedAt[ACHIEVEMENTS.SPIN_100.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_100.reward || 0;
  }
  if (stats.totalSpins >= 500) {
    unlockedAt[ACHIEVEMENTS.SPIN_500.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_500.reward || 0;
  }
  if (stats.totalSpins >= 1000) {
    unlockedAt[ACHIEVEMENTS.SPIN_1000.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_1000.reward || 0;
  }
  if (stats.totalSpins >= 5000) {
    unlockedAt[ACHIEVEMENTS.SPIN_5000.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_5000.reward || 0;
  }
  if (stats.totalSpins >= 10000) {
    unlockedAt[ACHIEVEMENTS.SPIN_10000.id] = now;
    pendingRewards += ACHIEVEMENTS.SPIN_10000.reward || 0;
  }

  // Win milestones
  if (stats.wins >= 1) {
    unlockedAt[ACHIEVEMENTS.FIRST_WIN.id] = now;
    pendingRewards += ACHIEVEMENTS.FIRST_WIN.reward || 0;
  }
  if (stats.wins >= 100) {
    unlockedAt[ACHIEVEMENTS.WIN_100.id] = now;
    pendingRewards += ACHIEVEMENTS.WIN_100.reward || 0;
  }
  if (stats.wins >= 500) {
    unlockedAt[ACHIEVEMENTS.WIN_500.id] = now;
    pendingRewards += ACHIEVEMENTS.WIN_500.reward || 0;
  }
  if (stats.wins >= 1000) {
    unlockedAt[ACHIEVEMENTS.WIN_1000.id] = now;
    pendingRewards += ACHIEVEMENTS.WIN_1000.reward || 0;
  }

  // Big win milestones (based on biggestWin)
  if (stats.biggestWin >= 500) {
    unlockedAt[ACHIEVEMENTS.BIG_WIN_500.id] = now;
    pendingRewards += ACHIEVEMENTS.BIG_WIN_500.reward || 0;
  }
  if (stats.biggestWin >= 1000) {
    unlockedAt[ACHIEVEMENTS.BIG_WIN_1000.id] = now;
    pendingRewards += ACHIEVEMENTS.BIG_WIN_1000.reward || 0;
  }
  if (stats.biggestWin >= 5000) {
    unlockedAt[ACHIEVEMENTS.BIG_WIN_5000.id] = now;
    pendingRewards += ACHIEVEMENTS.BIG_WIN_5000.reward || 0;
  }
  if (stats.biggestWin >= 10000) {
    unlockedAt[ACHIEVEMENTS.BIG_WIN_10000.id] = now;
    pendingRewards += ACHIEVEMENTS.BIG_WIN_10000.reward || 0;
  }

  // Store pending rewards (paid out when ACHIEVEMENTS_REWARDS_ENABLED = true)
  data.pendingRewards = pendingRewards;
}

/**
 * Save achievement data for a player
 */
async function savePlayerAchievements(username, data, env) {
  try {
    await env.SLOTS_KV.put(`achievements:${username.toLowerCase()}`, JSON.stringify(data));
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

      // Check requirement
      const requirement = achievement.requirement || 1;
      if (oldValue < requirement && newValue >= requirement) {
        const result = await unlockAchievement(username, achievement.id, env, data);
        if (result.unlocked) {
          unlockedAchievements.push({ achievement: result.achievement, reward: result.reward });
        }
      }
    }

    await savePlayerAchievements(username, data, env);
    return unlockedAchievements;
  } catch (error) {
    logError('updateAchievementStat', error, { username, statKey, increment });
    return [];
  }
}

/**
 * Mark a triple as collected and check for collection achievements
 */
async function markTripleCollected(username, symbol, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    const symbolKey = getTripleKey(symbol);

    if (!symbolKey || data.stats.triplesCollected[symbolKey]) {
      return []; // Already collected or unknown symbol
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
    const allFruitsCollected = fruitKeys.every(k => data.stats.triplesCollected[k]);
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
    const allTriplesCollected = allKeys.every(k => data.stats.triplesCollected[k]);
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
    dailysClaimed: ['DAILY_7', 'DAILY_14', 'DAILY_21', 'DAILY_28']
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
 */
async function incrementAchievementCounter(achievementId, env) {
  try {
    const key = `achievement_count:${achievementId}`;
    const current = await env.SLOTS_KV.get(key);
    const newCount = (parseInt(current, 10) || 0) + 1;
    await env.SLOTS_KV.put(key, newCount.toString());
  } catch (error) {
    logError('incrementAchievementCounter', error, { achievementId });
  }
}

/**
 * Get global achievement statistics (how many players have each achievement)
 * Calculates live from player data for accuracy
 */
async function getAchievementStats(env) {
  try {
    // Get all achievement records
    const achievementList = await env.SLOTS_KV.list({ prefix: 'achievements:', limit: 1000 });
    const achievementKeys = achievementList.keys || [];

    // Initialize counts
    const achievementIds = Object.values(ACHIEVEMENTS).map(a => a.id);
    const counts = {};
    for (const id of achievementIds) {
      counts[id] = 0;
    }

    // Count achievements from all players
    const totalPlayers = achievementKeys.length;

    // Fetch all player achievement data in parallel (batch of 10 for performance)
    const batchSize = 10;
    for (let i = 0; i < achievementKeys.length; i += batchSize) {
      const batch = achievementKeys.slice(i, i + batchSize);
      const promises = batch.map(k => env.SLOTS_KV.get(k.name));
      const results = await Promise.all(promises);

      for (const data of results) {
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.unlockedAt) {
            for (const achievementId of Object.keys(parsed.unlockedAt)) {
              if (counts[achievementId] !== undefined) {
                counts[achievementId]++;
              }
            }
          }
        } catch {
          // Skip invalid data
        }
      }
    }

    return {
      totalPlayers,
      counts
    };
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
  updateAchievementStat,
  markTripleCollected,
  checkAndUnlockAchievement,
  checkBalanceAchievements,
  checkBigWinAchievements,
  getPendingRewards,
  claimPendingRewards,
  getUnlockedAchievementCount,
  getAchievementStats
};
