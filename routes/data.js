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
  setPrestigeRank,
  removePrestigeRank,
  hasUnlock,
  removeUnlock,
  hasAcceptedDisclaimer,
  setDisclaimerAccepted,
  setSelfBan,
  removeSelfBan,
  setDuelOptOut,
  unlockAchievement,
  lockAchievement,
  isLeaderboardHidden,
  setLeaderboardHidden,
  syncAllPlayerAchievementStats
} from '../database.js';
import { REFUNDABLE_ITEMS, getPreviousPrestigeRank } from '../constants/refund.js';
import {
  migrateAllUsersToD1,
  verifyMigration,
  getMigrationStatus,
  migrateAchievementsToD1,
  migrateUnlocksToD1,
  migrateMonthlyLoginToD1,
  runFullMigration,
  getFullMigrationStatus
} from '../database/migration.js';
import { getLeaderboard as getD1Leaderboard, D1_ENABLED } from '../database/d1.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES, getStatKeyForAchievement, LEADERBOARD_LIMIT } from '../constants.js';
import { logError, isAdmin, sanitizeUsername, checkRateLimit } from '../utils.js';
import { RATE_LIMIT_SEARCH, RATE_LIMIT_WINDOW_SECONDS } from '../constants/config.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8'
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
        return await handleSearchApi(url.searchParams.get('q'), env, request);
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

  // Check if user exists without auto-creating (getBalance creates ghost users)
  const [hasDisclaimer, rawBalance] = await Promise.all([
    hasAcceptedDisclaimer(cleanUsername, env),
    env.SLOTS_KV.get(`user:${cleanUsername}`)
  ]);
  if (!hasDisclaimer && rawBalance === null) {
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

  // Check if user exists without auto-creating (getBalance creates ghost users)
  const [hasDisclaimer, rawBalance, rank, stats, achievementData] = await Promise.all([
    hasAcceptedDisclaimer(cleanUsername, env),
    env.SLOTS_KV.get(`user:${cleanUsername}`),
    getPrestigeRank(cleanUsername, env),
    getStats(cleanUsername, env),
    getPlayerAchievements(cleanUsername, env)
  ]);

  if (!hasDisclaimer && rawBalance === null) {
    return jsonResponse({ error: 'Player not found', username: cleanUsername }, 404);
  }
  const balance = rawBalance !== null ? parseInt(rawBalance, 10) || 0 : 0;

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
 * Uses D1 for efficient single-query leaderboard (replaces 2500+ KV operations)
 */
async function handleLeaderboardApi(env) {
  try {
    // Try D1 first (single query, much faster)
    if (D1_ENABLED && env.DB) {
      const players = await getD1Leaderboard(100, env);
      if (players !== null) {
        return jsonResponse({
          players,
          total: players.length,
          source: 'd1'
        }, 200, 60);
      }
    }

    // Fallback to KV if D1 is disabled or fails
    const BATCH_SIZE = 100;
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

    if (!listResult.keys || listResult.keys.length === 0) {
      return jsonResponse({ players: [], source: 'kv' });
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
      total: users.length,
      source: 'kv'
    }, 200, 60);
  } catch (error) {
    logError('handleLeaderboardApi', error);
    return jsonResponse({ error: 'Failed to load leaderboard' }, 500);
  }
}

/**
 * Search for players by username prefix
 */
async function handleSearchApi(query, env, request) {
  if (!query || query.length < 2) {
    return jsonResponse({ players: [] });
  }

  // Rate-Limit per IP
  const ip = request?.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(`search:${ip}`, RATE_LIMIT_SEARCH, RATE_LIMIT_WINDOW_SECONDS, env);
  if (!allowed) {
    return jsonResponse({ error: 'Rate limit exceeded' }, 429);
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
      if (username.toLowerCase().includes(searchQuery) && username.toLowerCase() !== 'dachsbank') {
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
    headers['Cache-Control'] = `private, max-age=${cacheSeconds}`;
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

    // D1 migration actions don't require a target user
    const d1Actions = ['d1-migrate', 'd1-status', 'd1-verify', 'd1-migrate-achievements', 'd1-migrate-unlocks', 'd1-migrate-monthly', 'd1-migrate-full', 'd1-full-status', 'sync-achievement-stats'];
    if (d1Actions.includes(action)) {
      // Handle D1 actions without targetUser requirement
    } else {
      const targetUser = sanitizeUsername(body.username || '');
      if (!targetUser) {
        return jsonResponse({ error: 'Target username required' }, 400);
      }
      // Re-assign for use in switch
      body._targetUser = targetUser;
    }

    const targetUser = body._targetUser || '';

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
      case 'refund':
        return await handleAdminRefund(targetUser, body.itemKey, env);
      case 'getRefundableItems':
        return await handleAdminGetRefundableItems(targetUser, env);
      // D1 Migration endpoints (no targetUser required)
      case 'd1-migrate':
        return await handleD1Migrate(body, env);
      case 'd1-status':
        return await handleD1Status(env);
      case 'd1-verify':
        return await handleD1Verify(body, env);
      case 'd1-migrate-achievements':
        return await handleD1MigrateAchievements(body, env);
      case 'd1-migrate-unlocks':
        return await handleD1MigrateUnlocks(body, env);
      case 'd1-migrate-monthly':
        return await handleD1MigrateMonthly(body, env);
      case 'd1-migrate-full':
        return await handleD1MigrateFull(body, env);
      case 'd1-full-status':
        return await handleD1FullStatus(env);
      case 'sync-achievement-stats':
        const syncResults = await syncAllPlayerAchievementStats(env);
        return jsonResponse({ success: true, ...syncResults });
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

// ==================== D1 MIGRATION API ====================

/**
 * Admin: Migrate users from KV to D1
 */
async function handleD1Migrate(body, env) {
  const { batchSize = 100, maxUsers = null, dryRun = false } = body;

  const result = await migrateAllUsersToD1(env, { batchSize, maxUsers, dryRun });
  return jsonResponse(result);
}

/**
 * Admin: Get D1 migration status
 */
async function handleD1Status(env) {
  // Debug: Check what bindings are available
  const bindings = {
    hasDB: !!env.DB,
    hasKV: !!env.SLOTS_KV,
    envKeys: Object.keys(env || {})
  };

  if (!env.DB) {
    return jsonResponse({
      success: false,
      error: 'D1 database not bound to worker',
      debug: bindings,
      d1Enabled: D1_ENABLED
    });
  }

  const status = await getMigrationStatus(env);
  return jsonResponse({
    ...status,
    d1Enabled: D1_ENABLED,
    debug: bindings
  });
}

/**
 * Admin: Verify D1 migration
 */
async function handleD1Verify(body, env) {
  const { sampleSize = 50 } = body;

  const result = await verifyMigration(env, sampleSize);
  return jsonResponse(result);
}

/**
 * Admin: Migrate achievements from KV to D1
 */
async function handleD1MigrateAchievements(body, env) {
  const { batchSize = 50, maxUsers = null, dryRun = false } = body;

  const result = await migrateAchievementsToD1(env, { batchSize, maxUsers, dryRun });
  return jsonResponse(result);
}

/**
 * Admin: Migrate unlocks from KV to D1
 */
async function handleD1MigrateUnlocks(body, env) {
  const { dryRun = false } = body;

  const result = await migrateUnlocksToD1(env, { dryRun });
  return jsonResponse(result);
}

/**
 * Admin: Migrate monthly login from KV to D1
 */
async function handleD1MigrateMonthly(body, env) {
  const { dryRun = false } = body;

  const result = await migrateMonthlyLoginToD1(env, { dryRun });
  return jsonResponse(result);
}

/**
 * Admin: Run full migration (users + achievements + unlocks + monthly)
 */
async function handleD1MigrateFull(body, env) {
  const { batchSize = 50, dryRun = false } = body;

  const result = await runFullMigration(env, { batchSize, dryRun });
  return jsonResponse(result);
}

/**
 * Admin: Get comprehensive D1 migration status
 */
async function handleD1FullStatus(env) {
  const result = await getFullMigrationStatus(env);
  return jsonResponse(result);
}

// ==================== REFUND API ====================

/**
 * Admin: Get refundable items for a user
 * Returns items the user owns and whether they can be refunded
 */
async function handleAdminGetRefundableItems(username, env) {
  const [currentRank, balance] = await Promise.all([
    getPrestigeRank(username, env),
    getBalance(username, env)
  ]);

  // Check all unlocks in parallel
  const unlockKeys = ['slots_20', 'slots_30', 'slots_50', 'slots_100', 'slots_all', 'daily_boost', 'custom_message'];
  const unlockChecks = await Promise.all(
    unlockKeys.map(key => hasUnlock(username, key, env))
  );

  const ownedUnlocks = {};
  unlockKeys.forEach((key, i) => {
    ownedUnlocks[key] = unlockChecks[i];
  });

  // Build list of refundable items with status
  const items = [];

  // Add prestige ranks
  const rankOrder = ['🥉', '🥈', '🥇', '💎', '👑'];
  const currentRankIndex = rankOrder.indexOf(currentRank);

  for (const [itemKey, item] of Object.entries(REFUNDABLE_ITEMS)) {
    if (item.type === 'prestige') {
      const itemRankIndex = rankOrder.indexOf(item.rank);
      // User owns this rank if their current rank is equal or higher
      const owned = currentRankIndex >= itemRankIndex && currentRankIndex !== -1;
      // Can only refund the current (highest) rank
      const canRefund = currentRank === item.rank;

      items.push({
        key: itemKey,
        ...item,
        owned,
        canRefund,
        blockedReason: owned && !canRefund ? `Muss zuerst höheren Rang refunden` : null
      });
    } else if (item.type === 'unlock') {
      const owned = ownedUnlocks[item.unlockKey] || false;
      // Check if blocked by higher unlock
      const blockedByHigherUnlock = item.blockedBy.some(higherKey => ownedUnlocks[higherKey]);

      items.push({
        key: itemKey,
        ...item,
        owned,
        canRefund: owned && !blockedByHigherUnlock,
        blockedReason: owned && blockedByHigherUnlock ? `Muss zuerst höheres Unlock refunden` : null
      });
    }
  }

  return jsonResponse({
    success: true,
    username,
    balance,
    currentRank,
    items
  });
}

/**
 * Admin: Refund an item to a user
 * Removes the item and refunds the purchase price
 */
async function handleAdminRefund(username, itemKey, env) {
  if (!itemKey || typeof itemKey !== 'string') {
    return jsonResponse({ error: 'Invalid itemKey' }, 400);
  }

  const item = REFUNDABLE_ITEMS[itemKey];
  if (!item) {
    return jsonResponse({ error: 'Item not found' }, 404);
  }

  // Get current state
  const [currentRank, currentBalance] = await Promise.all([
    getPrestigeRank(username, env),
    getBalance(username, env)
  ]);

  // Validate based on item type
  if (item.type === 'prestige') {
    // Check if user has this rank
    if (currentRank !== item.rank) {
      return jsonResponse({
        error: 'User does not have this rank',
        currentRank,
        requestedRank: item.rank
      }, 400);
    }

    // Check if blocked by higher rank
    const rankOrder = ['🥉', '🥈', '🥇', '💎', '👑'];
    const currentIndex = rankOrder.indexOf(currentRank);
    for (const higherRank of item.blockedBy) {
      const higherIndex = rankOrder.indexOf(higherRank);
      if (currentIndex >= higherIndex) {
        return jsonResponse({
          error: `Cannot refund: User still has higher rank ${higherRank}`,
          blockedBy: higherRank
        }, 400);
      }
    }

    // Perform refund: Set to previous rank or remove entirely
    const previousRank = getPreviousPrestigeRank(item.rank);
    if (previousRank) {
      await setPrestigeRank(username, previousRank, env);
    } else {
      await removePrestigeRank(username, env);
    }

  } else if (item.type === 'unlock') {
    // Check if user has this unlock
    const hasThisUnlock = await hasUnlock(username, item.unlockKey, env);
    if (!hasThisUnlock) {
      return jsonResponse({
        error: 'User does not have this unlock',
        unlockKey: item.unlockKey
      }, 400);
    }

    // Check if blocked by higher unlock
    for (const higherKey of item.blockedBy) {
      const hasHigher = await hasUnlock(username, higherKey, env);
      if (hasHigher) {
        return jsonResponse({
          error: `Cannot refund: User still has higher unlock ${higherKey}`,
          blockedBy: higherKey
        }, 400);
      }
    }

    // Perform refund: Remove the unlock
    await removeUnlock(username, item.unlockKey, env);

    // Also delete custom messages data when custom_message unlock is refunded
    if (item.unlockKey === 'custom_message') {
      env.SLOTS_KV.delete(`custom_messages:${username.toLowerCase()}`).catch(() => {});
    }
  }

  // Add refund amount to balance
  const newBalance = currentBalance + item.price;
  await setBalance(username, newBalance, env);

  return jsonResponse({
    success: true,
    username,
    refundedItem: item.name,
    refundAmount: item.price,
    oldBalance: currentBalance,
    newBalance
  });
}
