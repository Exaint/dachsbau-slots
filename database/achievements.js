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
  losses: 0,
  maxLossStreak: 0,
  biggestWin: 0,
  totalWon: 0,
  totalLost: 0,
  totalTransferred: 0,
  transfersSentCount: 0,
  shopPurchases: 0,
  duelsPlayed: 0,
  duelsWon: 0,
  duelsLost: 0,
  maxDuelStreak: 0,
  totalDuelWinnings: 0,
  dailysClaimed: 0,
  playDays: 0,
  // Item usage
  chaosSpins: 0,
  reverseChaosSpins: 0,
  wheelSpins: 0,
  mysteryBoxes: 0,
  insuranceTriggers: 0,
  wildCardsUsed: 0,
  freeSpinsUsed: 0,
  // Dachs & Jackpot
  totalDachsSeen: 0,
  hourlyJackpots: 0,
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
        // Migrate existing player stats (pull ALL available fields)
        const legacy = JSON.parse(legacyStats);
        const migratedData = {
          unlockedAt: {},
          stats: {
            ...DEFAULT_STATS,
            triplesCollected: { ...DEFAULT_STATS.triplesCollected },
            // Migrate all available stats
            totalSpins: legacy.totalSpins || 0,
            wins: legacy.wins || 0,
            biggestWin: legacy.biggestWin || 0,
            totalWon: legacy.totalWon || 0,
            totalLost: legacy.totalLost || 0,
            losses: legacy.losses || 0,
            maxLossStreak: legacy.maxLossStreak || 0,
            totalDachsSeen: legacy.totalDachsSeen || 0,
            hourlyJackpots: legacy.hourlyJackpots || 0,
            chaosSpins: legacy.chaosSpins || 0,
            reverseChaosSpins: legacy.reverseChaosSpins || 0,
            wheelSpins: legacy.wheelSpins || 0,
            mysteryBoxes: legacy.mysteryBoxes || 0,
            insuranceTriggers: legacy.insuranceTriggers || 0,
            wildCardsUsed: legacy.wildCardsUsed || 0,
            freeSpinsUsed: legacy.freeSpinsUsed || 0,
            duelsPlayed: legacy.duelsPlayed || 0,
            duelsWon: legacy.duelsWon || 0,
            duelsLost: legacy.duelsLost || 0,
            maxDuelStreak: legacy.maxDuelStreak || 0,
            totalDuelWinnings: legacy.totalDuelWinnings || 0,
            totalTransferred: legacy.totalTransferred || 0,
            transfersSentCount: legacy.transfersSentCount || 0,
            shopPurchases: legacy.shopPurchases || 0,
            dailysClaimed: legacy.dailysClaimed || 0,
            playDays: legacy.playDays || 0
          },
          pendingRewards: 0,
          statsSynced: true,
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

    // One-time stats sync: Pull all stats from stats:{username} into achievement stats
    // This catches retroactive achievements for losses, dachs, items, duels, etc.
    if (!data.statsSynced) {
      const fullStats = await env.SLOTS_KV.get(kvKey('stats:', username));
      if (fullStats) {
        try {
          const legacy = JSON.parse(fullStats);
          const now = Date.now();
          let addedRewards = 0;
          const counterPromises = [];

          // Sync all stat fields from stats:{username} that might be ahead of achievement stats
          const syncFields = [
            'losses', 'maxLossStreak', 'totalDachsSeen', 'hourlyJackpots',
            'chaosSpins', 'reverseChaosSpins', 'wheelSpins', 'mysteryBoxes',
            'insuranceTriggers', 'wildCardsUsed', 'freeSpinsUsed',
            'duelsWon', 'duelsLost', 'maxDuelStreak', 'totalDuelWinnings',
            'transfersSentCount', 'totalTransferred', 'playDays',
            'shopPurchases', 'dailysClaimed', 'totalSpins', 'wins'
          ];

          for (const field of syncFields) {
            const legacyVal = legacy[field] || 0;
            const currentVal = data.stats[field] || 0;
            if (legacyVal > currentVal) {
              data.stats[field] = legacyVal;
            }
          }

          // Calculate losses from totalSpins - wins if higher than stored value
          const calculatedLosses = (data.stats.totalSpins || 0) - (data.stats.wins || 0);
          if (calculatedLosses > (data.stats.losses || 0)) {
            data.stats.losses = calculatedLosses;
          }

          // Now check ALL stat-based achievements against synced values
          for (const field of syncFields) {
            const value = data.stats[field] || 0;
            if (value <= 0) continue;

            const achievementsToCheck = getAchievementsForStat(field);
            for (const achKey of achievementsToCheck) {
              const achievement = ACHIEVEMENTS[achKey];
              if (!achievement || data.unlockedAt[achievement.id]) continue;
              const requirement = achievement.requirement || 1;
              if (value >= requirement) {
                data.unlockedAt[achievement.id] = now;
                addedRewards += achievement.reward || 0;
                counterPromises.push(incrementAchievementCounter(achievement.id, env));
              }
            }
          }

          if (addedRewards > 0 && !ACHIEVEMENTS_REWARDS_ENABLED) {
            data.pendingRewards = (data.pendingRewards || 0) + addedRewards;
          }

          data.statsSynced = true;
          await Promise.all([
            env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data)),
            ...counterPromises
          ]);
        } catch (e) {
          logError('statsSyncMigration', e, { username });
          data.statsSynced = true;
          await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
        }
      } else {
        data.statsSynced = true;
        await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
      }
    }

    // One-time fix: Recalculate losses from totalSpins - wins for users who already synced
    if (!data.lossesCalcFixed) {
      const fullStats = await env.SLOTS_KV.get(kvKey('stats:', username));
      if (fullStats) {
        try {
          const legacy = JSON.parse(fullStats);
          const totalSpins = Math.max(legacy.totalSpins || 0, data.stats.totalSpins || 0);
          const wins = Math.max(legacy.wins || 0, data.stats.wins || 0);
          const calculatedLosses = totalSpins - wins;

          if (calculatedLosses > (data.stats.losses || 0)) {
            data.stats.losses = calculatedLosses;
            data.stats.totalSpins = totalSpins;
            data.stats.wins = wins;

            // Check loss achievements with corrected value
            const now = Date.now();
            let addedRewards = 0;
            const counterPromises = [];
            const lossAchievements = getAchievementsForStat('losses');
            for (const achKey of lossAchievements) {
              const achievement = ACHIEVEMENTS[achKey];
              if (!achievement || data.unlockedAt[achievement.id]) continue;
              if (calculatedLosses >= (achievement.requirement || 1)) {
                data.unlockedAt[achievement.id] = now;
                addedRewards += achievement.reward || 0;
                counterPromises.push(incrementAchievementCounter(achievement.id, env));
              }
            }
            if (addedRewards > 0 && !ACHIEVEMENTS_REWARDS_ENABLED) {
              data.pendingRewards = (data.pendingRewards || 0) + addedRewards;
            }
            data.lossesCalcFixed = true;
            await Promise.all([
              env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data)),
              ...counterPromises
            ]);
          } else {
            data.lossesCalcFixed = true;
            await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
          }
        } catch (e) {
          logError('lossesCalcFix', e, { username });
          data.lossesCalcFixed = true;
          await env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data));
        }
      } else {
        data.lossesCalcFixed = true;
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

  // Check ALL stat-based achievements using the general mapping
  const statFields = [
    'losses', 'maxLossStreak', 'totalDachsSeen', 'hourlyJackpots',
    'chaosSpins', 'reverseChaosSpins', 'wheelSpins', 'mysteryBoxes',
    'insuranceTriggers', 'wildCardsUsed', 'freeSpinsUsed',
    'duelsWon', 'duelsLost', 'maxDuelStreak', 'totalDuelWinnings',
    'transfersSentCount', 'totalTransferred', 'playDays',
    'shopPurchases', 'dailysClaimed'
  ];

  for (const field of statFields) {
    const value = stats[field] || 0;
    if (value <= 0) continue;

    const achievementsToCheck = getAchievementsForStat(field);
    for (const achKey of achievementsToCheck) {
      const achievement = ACHIEVEMENTS[achKey];
      if (!achievement || unlockedAt[achievement.id]) continue;
      if (value >= (achievement.requirement || 1)) {
        unlockedAt[achievement.id] = now;
        pendingRewards += achievement.reward || 0;
        unlockedIds.push(achievement.id);
      }
    }
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
/**
 * Legacy: Decrement counter. Now just invalidates cache since
 * getAchievementStats() does a full scan.
 */
async function decrementAchievementCounter(achievementId, env) {
  await invalidateAchievementStatsCache(env);
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

    // Save player achievements and invalidate stats cache
    await Promise.all([
      savePlayerAchievements(username, data, env),
      env.SLOTS_KV.delete(STATS_CACHE_KEY)
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
 * Set a max-value achievement stat (only updates if new value is higher)
 * Used for stats like maxLossStreak, maxDuelStreak where we track the maximum
 */
async function setMaxAchievementStat(username, statKey, newValue, env) {
  try {
    const data = await getPlayerAchievements(username, env);
    const currentValue = data.stats[statKey] || 0;

    if (newValue <= currentValue) return [];

    data.stats[statKey] = newValue;
    const unlockedAchievements = [];

    const achievementsToCheck = getAchievementsForStat(statKey);
    for (const achKey of achievementsToCheck) {
      const achievement = ACHIEVEMENTS[achKey];
      if (!achievement || data.unlockedAt[achievement.id]) continue;
      if (newValue >= (achievement.requirement || 1)) {
        const result = await unlockAchievement(username, achievement.id, env, data);
        if (result.unlocked) {
          unlockedAchievements.push({ achievement: result.achievement, reward: result.reward });
        }
      }
    }

    await savePlayerAchievements(username, data, env);
    return unlockedAchievements;
  } catch (error) {
    logError('setMaxAchievementStat', error, { username, statKey, newValue });
    return [];
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
    losses: ['LOSS_100', 'LOSS_500', 'LOSS_1000'],
    maxLossStreak: ['LOSS_STREAK_5', 'LOSS_STREAK_10', 'LOSS_STREAK_15'],
    totalTransferred: ['TRANSFER_1000', 'TRANSFER_10000'],
    transfersSentCount: ['TRANSFER_COUNT_10', 'TRANSFER_COUNT_50', 'TRANSFER_COUNT_100'],
    shopPurchases: ['SHOP_10', 'SHOP_50', 'SHOP_100'],
    duelsWon: ['DUEL_WIN_10', 'DUEL_WIN_50', 'DUEL_WIN_100'],
    duelsLost: ['DUEL_LOSS_10', 'DUEL_LOSS_50', 'DUEL_LOSS_100'],
    maxDuelStreak: ['DUEL_STREAK_5', 'DUEL_STREAK_10', 'DUEL_STREAK_20'],
    totalDuelWinnings: ['DUEL_WINNINGS_1000', 'DUEL_WINNINGS_5000', 'DUEL_WINNINGS_10000'],
    dailysClaimed: ['DAILY_7', 'DAILY_14', 'DAILY_20'],
    playDays: ['PLAY_DAYS_7', 'PLAY_DAYS_30', 'PLAY_DAYS_100', 'PLAY_DAYS_365'],
    hourlyJackpots: ['HOURLY_JACKPOT_3', 'HOURLY_JACKPOT_10', 'HOURLY_JACKPOT_25'],
    totalDachsSeen: ['DACHS_SEEN_10', 'DACHS_SEEN_50', 'DACHS_SEEN_100', 'DACHS_SEEN_500'],
    chaosSpins: ['CHAOS_SPIN_10', 'CHAOS_SPIN_50', 'CHAOS_SPIN_100'],
    reverseChaosSpins: ['REVERSE_CHAOS_10'],
    wheelSpins: ['WHEEL_SPIN_10'],
    mysteryBoxes: ['MYSTERY_BOX_10'],
    insuranceTriggers: ['INSURANCE_5'],
    wildCardsUsed: ['WILD_CARD_10'],
    freeSpinsUsed: ['FREE_SPIN_10', 'FREE_SPIN_50', 'FREE_SPIN_100']
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
/**
 * Invalidate the achievement stats cache so next read does a fresh scan.
 * Called whenever an achievement is unlocked.
 */
async function invalidateAchievementStatsCache(env) {
  try {
    await env.SLOTS_KV.delete(STATS_CACHE_KEY);
  } catch (error) {
    // Non-critical, cache will expire naturally
  }
}

/**
 * Legacy: Increment counter and invalidate cache.
 * The counter keys (achievement_count:*) are no longer the source of truth -
 * getAchievementStats() now does a full scan. This just invalidates the cache.
 */
async function incrementAchievementCounter(achievementId, env) {
  await invalidateAchievementStatsCache(env);
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
      // Skip placeholder users
      if (username === 'spieler') continue;
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
    // Check cache first (valid for 5 minutes)
    const cached = await env.SLOTS_KV.get(STATS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.totalPlayers > 0 && parsed.counts) {
          return parsed;
        }
      } catch {
        // Invalid cache, recalculate
      }
    }

    // Run migration to ensure all players have achievement entries
    await migrateAllPlayersToAchievements(env);

    // Full scan: List all achievement entries
    const achievementList = await env.SLOTS_KV.list({ prefix: 'achievements:', limit: 1000 });
    const keys = achievementList.keys || [];
    const totalPlayers = keys.length;

    // Initialize counts for all achievements
    const achievementIds = Object.values(ACHIEVEMENTS).map(a => a.id);
    const counts = {};
    for (const id of achievementIds) {
      counts[id] = 0;
    }

    // Fetch all player achievement data in batches and count unlocks
    const batchSize = 20;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(k => env.SLOTS_KV.get(k.name)));
      for (const raw of results) {
        if (!raw) continue;
        try {
          const data = JSON.parse(raw);
          if (data.unlockedAt) {
            for (const achievementId of Object.keys(data.unlockedAt)) {
              if (counts[achievementId] !== undefined) {
                counts[achievementId]++;
              }
            }
          }
        } catch {
          // Skip invalid entries
        }
      }
    }

    const result = { totalPlayers, counts };

    // Cache for 5 minutes
    await env.SLOTS_KV.put(STATS_CACHE_KEY, JSON.stringify(result), { expirationTtl: STATS_CACHE_TTL });

    return result;
  } catch (error) {
    logError('getAchievementStats', error);
    return { totalPlayers: 0, counts: {} };
  }
}

/**
 * Bulk sync: Recalculate all players' achievement stats from their real stats.
 * Fixes discrepancies (e.g. losses not tracked from beginning).
 */
async function syncAllPlayerAchievementStats(env) {
  const results = { processed: 0, updated: 0, achievementsUnlocked: 0, errors: 0, details: [] };

  try {
    // List all users
    const userList = await env.SLOTS_KV.list({ prefix: 'user:', limit: 1000 });
    const userKeys = userList.keys || [];

    const syncFields = [
      'totalSpins', 'wins', 'losses', 'maxLossStreak', 'totalDachsSeen', 'hourlyJackpots',
      'chaosSpins', 'reverseChaosSpins', 'wheelSpins', 'mysteryBoxes',
      'insuranceTriggers', 'wildCardsUsed', 'freeSpinsUsed',
      'duelsWon', 'duelsLost', 'maxDuelStreak', 'totalDuelWinnings',
      'transfersSentCount', 'totalTransferred', 'playDays',
      'shopPurchases', 'dailysClaimed'
    ];

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < userKeys.length; i += batchSize) {
      const batch = userKeys.slice(i, i + batchSize);
      await Promise.all(batch.map(async (key) => {
        const username = key.name.replace('user:', '').toLowerCase();
        if (username === 'spieler') return;

        try {
          // Read both stats and achievements
          const [statsRaw, achievementsRaw] = await Promise.all([
            env.SLOTS_KV.get(kvKey('stats:', username)),
            env.SLOTS_KV.get(kvKey('achievements:', username))
          ]);

          if (!statsRaw || !achievementsRaw) return;

          const stats = JSON.parse(statsRaw);
          const data = JSON.parse(achievementsRaw);
          if (!data.stats) data.stats = { ...DEFAULT_STATS };

          let changed = false;
          let playerUnlocked = 0;
          const counterPromises = [];
          const now = Date.now();

          // Sync all stat fields
          for (const field of syncFields) {
            const realVal = stats[field] || 0;
            const achVal = data.stats[field] || 0;
            if (realVal > achVal) {
              data.stats[field] = realVal;
              changed = true;
            }
          }

          // Calculate losses from totalSpins - wins if higher
          const calculatedLosses = (data.stats.totalSpins || 0) - (data.stats.wins || 0);
          if (calculatedLosses > (data.stats.losses || 0)) {
            data.stats.losses = calculatedLosses;
            changed = true;
          }

          // Check all stat-based achievements
          for (const field of [...syncFields, 'losses']) {
            const value = data.stats[field] || 0;
            if (value <= 0) continue;

            const achievementsToCheck = getAchievementsForStat(field);
            for (const achKey of achievementsToCheck) {
              const achievement = ACHIEVEMENTS[achKey];
              if (!achievement || data.unlockedAt[achievement.id]) continue;
              if (value >= (achievement.requirement || 1)) {
                data.unlockedAt[achievement.id] = now;
                playerUnlocked++;
                changed = true;
                counterPromises.push(incrementAchievementCounter(achievement.id, env));
              }
            }
          }

          if (changed) {
            // Mark migrations as done so they don't re-run
            data.statsSynced = true;
            data.lossesCalcFixed = true;
            await Promise.all([
              env.SLOTS_KV.put(kvKey('achievements:', username), JSON.stringify(data)),
              ...counterPromises
            ]);
            results.updated++;
            results.achievementsUnlocked += playerUnlocked;
            if (playerUnlocked > 0) {
              results.details.push({ username, unlocked: playerUnlocked });
            }
          }

          results.processed++;
        } catch (e) {
          results.errors++;
          logError('syncAllPlayerAchievementStats.player', e, { username });
        }
      }));
    }
  } catch (error) {
    logError('syncAllPlayerAchievementStats', error);
    results.error = error.message;
  }

  // Always invalidate stats cache after sync
  await invalidateAchievementStatsCache(env);

  return results;
}

export {
  getPlayerAchievements,
  savePlayerAchievements,
  hasAchievement,
  unlockAchievement,
  lockAchievement,
  updateAchievementStat,
  updateAchievementStatBatch,
  setMaxAchievementStat,
  markTripleCollected,
  recordDachsHit,
  checkAndUnlockAchievement,
  checkBalanceAchievements,
  checkBigWinAchievements,
  getPendingRewards,
  claimPendingRewards,
  getUnlockedAchievementCount,
  getAchievementStats,
  syncAllPlayerAchievementStats
};
