/**
 * API Handlers for Achievement Website
 * Returns JSON responses for frontend consumption
 */

import {
  getPlayerAchievements,
  getStats,
  getBalance,
  setBalance,
  getPrestigeRank,
  hasAcceptedDisclaimer,
  setDisclaimerAccepted,
  setSelfBan,
  removeSelfBan,
  setDuelOptOut,
  unlockAchievement,
  lockAchievement,
  isLeaderboardHidden,
  setLeaderboardHidden
} from '../database.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES, getStatKeyForAchievement, LEADERBOARD_LIMIT } from '../constants.js';
import { logError, isAdmin, sanitizeUsername } from '../utils.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': 'https://dachsbau-slots.exaint.workers.dev'
};

/**
 * Handle API requests
 * @param {string} api - API endpoint name
 * @param {URL} url - Request URL
 * @param {object} env - Environment bindings
 * @param {object|null} loggedInUser - Logged in user from JWT (optional)
 * @param {Request} request - Original request (for POST body)
 */
export async function handleApi(api, url, env, loggedInUser = null, request = null) {
  const username = url.searchParams.get('user');

  try {
    switch (api) {
      case 'achievements':
        return await handleAchievementsApi(username, env);
      case 'profile':
        return await handleProfileApi(username, env);
      case 'leaderboard':
        return await handleLeaderboardApi(env);
      case 'search':
        return await handleSearchApi(url.searchParams.get('q'), env);
      // Admin endpoints
      case 'admin':
        return await handleAdminApi(url, env, loggedInUser, request);
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
  const cleanUsername = sanitizeUsername(username);
  if (!cleanUsername) {
    return jsonResponse({ error: 'Username required or invalid' }, 400);
  }

  // Check if user exists (check both disclaimer AND balance for legacy players)
  const [hasDisclaimer, balance] = await Promise.all([
    hasAcceptedDisclaimer(cleanUsername, env),
    getBalance(cleanUsername, env)
  ]);
  if (!hasDisclaimer && balance <= 0) {
    return jsonResponse({ error: 'Player not found', username: cleanUsername }, 404);
  }

  const data = await getPlayerAchievements(cleanUsername, env);
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
  const cleanUsername = sanitizeUsername(username);
  if (!cleanUsername) {
    return jsonResponse({ error: 'Username required or invalid' }, 400);
  }

  // Check if user exists and fetch data in parallel
  const [hasDisclaimer, balance, rank, stats, achievementData] = await Promise.all([
    hasAcceptedDisclaimer(cleanUsername, env),
    getBalance(cleanUsername, env),
    getPrestigeRank(cleanUsername, env),
    getStats(cleanUsername, env),
    getPlayerAchievements(cleanUsername, env)
  ]);

  // User exists if they accepted disclaimer OR have a balance (legacy players)
  if (!hasDisclaimer && balance <= 0) {
    return jsonResponse({ error: 'Player not found', username: cleanUsername }, 404);
  }

  const allAchievements = getAllAchievements();
  const unlockedCount = Object.keys(achievementData.unlockedAt).length;

  return jsonResponse({
    username: cleanUsername,
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
  const BATCH_SIZE = 100;

  try {
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

    if (!listResult.keys || listResult.keys.length === 0) {
      return jsonResponse({ players: [] });
    }

    const users = [];

    // Batch fetch balances and check visibility
    for (let i = 0; i < listResult.keys.length; i += BATCH_SIZE) {
      const batch = listResult.keys.slice(i, i + BATCH_SIZE);
      const usernames = batch.map(key => key.name.replace('user:', ''));

      // Fetch balances and hidden status in parallel
      const [balances, hiddenStatuses] = await Promise.all([
        Promise.all(batch.map(key => env.SLOTS_KV.get(key.name))),
        Promise.all(usernames.map(username => isLeaderboardHidden(username, env)))
      ]);

      for (let j = 0; j < batch.length; j++) {
        if (balances[j]) {
          const balance = parseInt(balances[j], 10);
          const username = usernames[j];
          const lowerUsername = username.toLowerCase();
          const isHidden = hiddenStatuses[j];

          // Filter out DachsBank, "Spieler", and hidden users
          if (!isNaN(balance) && balance > 0 && lowerUsername !== 'dachsbank' && lowerUsername !== 'spieler' && !isHidden) {
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

    // Return top 100 with 60s cache
    return jsonResponse({
      players: users.slice(0, 100),
      total: users.length
    }, 200, 60);
  } catch (error) {
    logError('handleLeaderboardApi', error);
    return jsonResponse({ error: 'Failed to load leaderboard' }, 500);
  }
}

/**
 * Search for players by username prefix
 */
async function handleSearchApi(query, env) {
  if (!query || query.length < 2) {
    return jsonResponse({ players: [] });
  }

  // Sanitize search query - only allow valid username characters
  const searchQuery = query.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const SEARCH_LIMIT = 500;

  try {
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: SEARCH_LIMIT });

    if (!listResult.keys || listResult.keys.length === 0) {
      return jsonResponse({ players: [] });
    }

    // Filter usernames that match the search query
    const matches = [];
    for (const key of listResult.keys) {
      const username = key.name.replace('user:', '');
      if (username.toLowerCase().startsWith(searchQuery) && username.toLowerCase() !== 'dachsbank') {
        matches.push(username);
        if (matches.length >= 10) break; // Limit to 10 suggestions
      }
    }

    return jsonResponse({ players: matches });
  } catch (error) {
    logError('handleSearchApi', error, { query });
    return jsonResponse({ players: [] });
  }
}

/**
 * Helper: Create JSON response
 */
function jsonResponse(data, status = 200, cacheSeconds = 0) {
  const headers = { ...JSON_HEADERS };
  if (cacheSeconds > 0) {
    headers['Cache-Control'] = `public, max-age=${cacheSeconds}`;
  }
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

// ==================== ADMIN API ====================

/**
 * Handle admin API requests
 * All admin actions require authentication and admin privileges
 */
async function handleAdminApi(url, env, loggedInUser, request) {
  // Check authentication
  if (!loggedInUser) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  // Check admin privileges
  if (!isAdmin(loggedInUser.username)) {
    return jsonResponse({ error: 'Not authorized' }, 403);
  }

  // Get action from URL
  const action = url.searchParams.get('action');

  // Only allow POST for mutations
  if (request && request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Parse JSON body
    let body = {};
    if (request) {
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }
    }

    const targetUser = sanitizeUsername(body.username || '');
    if (!targetUser) {
      return jsonResponse({ error: 'Target username required' }, 400);
    }

    switch (action) {
      case 'setBalance':
        return await handleAdminSetBalance(targetUser, body.balance, env);
      case 'setDisclaimer':
        return await handleAdminSetDisclaimer(targetUser, body.accepted, env);
      case 'setSelfBan':
        return await handleAdminSetSelfBan(targetUser, body.banned, env);
      case 'setDuelOpt':
        return await handleAdminSetDuelOpt(targetUser, body.optedOut, env);
      case 'setLeaderboardHidden':
        return await handleAdminSetLeaderboardHidden(targetUser, body.hidden, env);
      case 'setAchievement':
        return await handleAdminSetAchievement(targetUser, body.achievementId, body.unlocked, env);
      default:
        return jsonResponse({ error: 'Unknown admin action' }, 400);
    }
  } catch (error) {
    logError('handleAdminApi', error, { action: url.searchParams.get('action') });
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Admin: Set user balance
 */
async function handleAdminSetBalance(username, balance, env) {
  if (typeof balance !== 'number' || balance < 0) {
    return jsonResponse({ error: 'Invalid balance value' }, 400);
  }

  await setBalance(username, Math.floor(balance), env);
  return jsonResponse({ success: true, username, balance: Math.floor(balance) });
}

/**
 * Admin: Set disclaimer status
 */
async function handleAdminSetDisclaimer(username, accepted, env) {
  if (typeof accepted !== 'boolean') {
    return jsonResponse({ error: 'Invalid accepted value' }, 400);
  }

  if (accepted) {
    await setDisclaimerAccepted(username, env);
  } else {
    // Remove disclaimer - direct KV delete
    await env.SLOTS_KV.delete(`disclaimer:${username.toLowerCase()}`);
  }
  return jsonResponse({ success: true, username, accepted });
}

/**
 * Admin: Set self-ban status
 */
async function handleAdminSetSelfBan(username, banned, env) {
  if (typeof banned !== 'boolean') {
    return jsonResponse({ error: 'Invalid banned value' }, 400);
  }

  if (banned) {
    await setSelfBan(username, env);
  } else {
    await removeSelfBan(username, env);
  }
  return jsonResponse({ success: true, username, banned });
}

/**
 * Admin: Set duel opt-out status
 */
async function handleAdminSetDuelOpt(username, optedOut, env) {
  if (typeof optedOut !== 'boolean') {
    return jsonResponse({ error: 'Invalid optedOut value' }, 400);
  }

  await setDuelOptOut(username, optedOut, env);
  return jsonResponse({ success: true, username, optedOut });
}

/**
 * Admin: Set leaderboard visibility
 */
async function handleAdminSetLeaderboardHidden(username, hidden, env) {
  if (typeof hidden !== 'boolean') {
    return jsonResponse({ error: 'Invalid hidden value' }, 400);
  }

  await setLeaderboardHidden(username, hidden, env);
  return jsonResponse({ success: true, username, hidden });
}

/**
 * Admin: Set achievement status (unlock/lock)
 */
async function handleAdminSetAchievement(username, achievementId, unlocked, env) {
  if (!achievementId || typeof achievementId !== 'string') {
    return jsonResponse({ error: 'Invalid achievementId' }, 400);
  }
  if (typeof unlocked !== 'boolean') {
    return jsonResponse({ error: 'Invalid unlocked value' }, 400);
  }

  if (unlocked) {
    const result = await unlockAchievement(username, achievementId, env);
    if (!result.achievement) {
      return jsonResponse({ error: 'Achievement not found' }, 404);
    }
    return jsonResponse({ success: true, username, achievementId, unlocked: true, newlyUnlocked: result.unlocked });
  } else {
    const result = await lockAchievement(username, achievementId, env);
    return jsonResponse({ success: true, username, achievementId, unlocked: false, wasUnlocked: result.wasUnlocked });
  }
}
