/**
 * API Handlers for Achievement Website
 * Returns JSON responses for frontend consumption
 */

import { getPlayerAchievements, getStats, getBalance, getPrestigeRank, hasAcceptedDisclaimer } from '../database.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES } from '../constants.js';
import { logError } from '../utils.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*'
};

/**
 * Handle API requests
 */
export async function handleApi(api, url, env) {
  const username = url.searchParams.get('user');

  try {
    switch (api) {
      case 'achievements':
        return await handleAchievementsApi(username, env);
      case 'profile':
        return await handleProfileApi(username, env);
      case 'leaderboard':
        return await handleLeaderboardApi(env);
      default:
        return jsonResponse({ error: 'Unknown API endpoint' }, 404);
    }
  } catch (error) {
    logError('handleApi', error, { api, username });
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Get player achievements with progress
 */
async function handleAchievementsApi(username, env) {
  if (!username) {
    return jsonResponse({ error: 'Username required' }, 400);
  }

  // Check if user exists
  const hasPlayed = await hasAcceptedDisclaimer(username, env);
  if (!hasPlayed) {
    return jsonResponse({ error: 'Player not found', username }, 404);
  }

  const data = await getPlayerAchievements(username, env);
  const allAchievements = getAllAchievements();

  // Build achievements with unlock status and progress
  const achievements = allAchievements.map(ach => {
    const unlocked = !!data.unlockedAt[ach.id];
    const unlockedAt = data.unlockedAt[ach.id] || null;

    // Calculate progress for requirement-based achievements
    let progress = null;
    if (ach.requirement && !unlocked) {
      const statKey = getStatKeyForAchievement(ach.id);
      if (statKey && data.stats[statKey] !== undefined) {
        progress = {
          current: data.stats[statKey],
          required: ach.requirement,
          percent: Math.min(100, Math.round((data.stats[statKey] / ach.requirement) * 100))
        };
      }
    }

    return {
      id: ach.id,
      name: ach.name,
      description: ach.description,
      category: ach.category,
      reward: ach.reward,
      hidden: ach.hidden,
      unlocked,
      unlockedAt,
      progress
    };
  });

  // Group by category
  const byCategory = {};
  for (const cat of Object.values(ACHIEVEMENT_CATEGORIES)) {
    byCategory[cat] = achievements.filter(a => a.category === cat);
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const visibleCount = achievements.filter(a => !a.hidden || a.unlocked).length;

  return jsonResponse({
    username,
    stats: data.stats,
    pendingRewards: data.pendingRewards,
    summary: {
      unlocked: unlockedCount,
      total: allAchievements.length,
      visible: visibleCount
    },
    achievements,
    byCategory
  });
}

/**
 * Get full player profile (balance, rank, stats, achievements summary)
 */
async function handleProfileApi(username, env) {
  if (!username) {
    return jsonResponse({ error: 'Username required' }, 400);
  }

  // Check if user exists
  const hasPlayed = await hasAcceptedDisclaimer(username, env);
  if (!hasPlayed) {
    return jsonResponse({ error: 'Player not found', username }, 404);
  }

  const [balance, rank, stats, achievementData] = await Promise.all([
    getBalance(username, env),
    getPrestigeRank(username, env),
    getStats(username, env),
    getPlayerAchievements(username, env)
  ]);

  const allAchievements = getAllAchievements();
  const unlockedCount = Object.keys(achievementData.unlockedAt).length;

  return jsonResponse({
    username,
    balance,
    rank,
    stats,
    achievements: {
      unlocked: unlockedCount,
      total: allAchievements.length,
      pendingRewards: achievementData.pendingRewards
    }
  });
}

/**
 * Get leaderboard data
 */
async function handleLeaderboardApi(env) {
  const LEADERBOARD_LIMIT = 1000;
  const BATCH_SIZE = 100;

  try {
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

    if (!listResult.keys || listResult.keys.length === 0) {
      return jsonResponse({ players: [] });
    }

    const users = [];

    // Batch fetch balances
    for (let i = 0; i < listResult.keys.length; i += BATCH_SIZE) {
      const batch = listResult.keys.slice(i, i + BATCH_SIZE);
      const balances = await Promise.all(
        batch.map(key => env.SLOTS_KV.get(key.name))
      );

      for (let j = 0; j < batch.length; j++) {
        if (balances[j]) {
          const balance = parseInt(balances[j], 10);
          const username = batch[j].name.replace('user:', '');
          // Filter out DachsBank (not a real player)
          if (!isNaN(balance) && balance > 0 && username.toLowerCase() !== 'dachsbank') {
            users.push({
              username,
              balance
            });
          }
        }
      }
    }

    // Sort by balance descending
    users.sort((a, b) => b.balance - a.balance);

    // Return top 100
    return jsonResponse({
      players: users.slice(0, 100),
      total: users.length
    });
  } catch (error) {
    logError('handleLeaderboardApi', error);
    return jsonResponse({ error: 'Failed to load leaderboard' }, 500);
  }
}

/**
 * Map achievement IDs to stat keys for progress tracking
 */
function getStatKeyForAchievement(achievementId) {
  const mapping = {
    // Spinning
    'spin_100': 'totalSpins',
    'spin_500': 'totalSpins',
    'spin_1000': 'totalSpins',
    'spin_5000': 'totalSpins',
    'spin_10000': 'totalSpins',
    // Winning
    'win_100': 'wins',
    'win_500': 'wins',
    'win_1000': 'wins',
    // Social
    'transfer_1000': 'totalTransferred',
    'transfer_10000': 'totalTransferred',
    'duel_win_10': 'duelsWon',
    'duel_win_50': 'duelsWon',
    'duel_win_100': 'duelsWon',
    // Dedication
    'daily_7': 'dailysClaimed',
    'daily_14': 'dailysClaimed',
    'daily_21': 'dailysClaimed',
    'daily_28': 'dailysClaimed',
    // Shopping
    'shop_10': 'shopPurchases',
    'shop_50': 'shopPurchases',
    'shop_100': 'shopPurchases'
  };
  return mapping[achievementId] || null;
}

/**
 * Helper: Create JSON response
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}
