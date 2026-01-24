/**
 * Leaderboard Page Handler and Renderer
 */

import { hasAcceptedDisclaimer } from '../../database.js';
import { isSelfBanned } from '../../database.js';
import { isLeaderboardHidden } from '../../database/core.js';
import { getUserRole, getTwitchUser } from '../twitch.js';
import { LEADERBOARD_LIMIT, LEADERBOARD_DISPLAY_LIMIT, WEB_LEADERBOARD_CACHE_TTL } from '../../constants.js';
import { isAdmin, logError } from '../../utils.js';

const CACHE_KEY = 'cache:web_leaderboard';
import { escapeHtml, formatNumber } from './utils.js';
import { ROLE_BADGES, R2_BASE } from './ui-config.js';
import { baseTemplate, htmlResponse } from './template.js';

/**
 * Compute leaderboard data (expensive: ~2000 KV operations)
 * Returns { topPlayers, allUsers, timestamp }
 */
async function computeLeaderboardData(env) {
  const BATCH_SIZE = 100;

  const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

  if (!listResult.keys || listResult.keys.length === 0) {
    return { topPlayers: [], allUsers: [], timestamp: Date.now() };
  }

  const users = [];

  for (let i = 0; i < listResult.keys.length; i += BATCH_SIZE) {
    const batch = listResult.keys.slice(i, i + BATCH_SIZE);
    const usernames = batch.map(key => key.name.replace('user:', ''));

    const [balances, disclaimerStatuses, selfBanStatuses, hiddenStatuses] = await Promise.all([
      Promise.all(batch.map(key => env.SLOTS_KV.get(key.name))),
      Promise.all(usernames.map(username => hasAcceptedDisclaimer(username, env))),
      Promise.all(usernames.map(username => isSelfBanned(username, env))),
      Promise.all(usernames.map(username => isLeaderboardHidden(username, env)))
    ]);

    for (let j = 0; j < batch.length; j++) {
      if (balances[j]) {
        const balance = parseInt(balances[j], 10);
        const username = usernames[j];
        const lowerUsername = username.toLowerCase();
        const hasDisclaimer = disclaimerStatuses[j];
        const isSelfBannedUser = selfBanStatuses[j];
        const isHidden = hiddenStatuses[j];

        if (!isNaN(balance) && balance > 0 && lowerUsername !== 'dachsbank' && lowerUsername !== 'spieler' && !isHidden) {
          if (hasDisclaimer && !isSelfBannedUser) {
            users.push({ username, balance, hasDisclaimer: true });
          }
        }
      }
    }
  }

  users.sort((a, b) => b.balance - a.balance);

  const topN = users.slice(0, LEADERBOARD_DISPLAY_LIMIT);

  // Fetch Twitch roles and avatars for top N
  const [roles, twitchUsers] = await Promise.all([
    Promise.all(topN.map(user => getUserRole(user.username, env))),
    Promise.all(topN.map(user => getTwitchUser(user.username, env)))
  ]);

  const topPlayers = topN.map((user, index) => ({
    ...user,
    role: roles[index],
    avatar: twitchUsers[index]?.avatar || null
  }));

  const allUsers = users.map((u, i) => ({ u: u.username, b: u.balance, r: i + 1 }));

  return { topPlayers, allUsers, timestamp: Date.now() };
}

/**
 * Compute and store leaderboard data in KV cache
 */
async function computeAndCache(env) {
  const data = await computeLeaderboardData(env);
  await env.SLOTS_KV.put(CACHE_KEY, JSON.stringify(data), {
    expirationTtl: WEB_LEADERBOARD_CACHE_TTL * 5
  });
  return data;
}

/**
 * Leaderboard page handler with stale-while-revalidate caching
 */
export async function handleLeaderboardPage(env, loggedInUser = null, showAll = false, ctx = null) {
  const isAdminUser = loggedInUser && isAdmin(loggedInUser.username);
  const actualShowAll = isAdminUser && showAll;

  try {
    // Admin showAll bypasses cache (rare, needs different data)
    if (actualShowAll) {
      return await handleLeaderboardUncached(env, loggedInUser, true, isAdminUser);
    }

    // Try cache
    const cached = await env.SLOTS_KV.get(CACHE_KEY);
    let data;

    if (cached) {
      try {
        data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;

        if (age > WEB_LEADERBOARD_CACHE_TTL * 1000 && ctx) {
          // Stale: serve immediately, revalidate in background
          ctx.waitUntil(computeAndCache(env).catch(err => logError('leaderboard.revalidate', err)));
        }
      } catch {
        data = null;
      }
    }

    if (!data) {
      // No cache or corrupt: compute synchronously
      data = await computeAndCache(env);
    }

    // Derive current user's rank from cached allUsers (cheap)
    let currentUserRank = null;
    if (loggedInUser && data.allUsers) {
      const userEntry = data.allUsers.find(u => u.u.toLowerCase() === loggedInUser.username.toLowerCase());
      if (userEntry && userEntry.r > LEADERBOARD_DISPLAY_LIMIT) {
        currentUserRank = {
          username: userEntry.u,
          balance: userEntry.b,
          rank: userEntry.r,
          hasDisclaimer: true,
          role: null,
          avatar: null
        };
      }
    }

    return htmlResponse(renderLeaderboardPage(data.topPlayers, loggedInUser, false, isAdminUser, currentUserRank, data.allUsers));
  } catch (error) {
    logError('handleLeaderboardPage', error);
    const { renderErrorPage } = await import('./errors.js');
    return htmlResponse(renderErrorPage(loggedInUser));
  }
}

/**
 * Uncached leaderboard handler (for admin showAll)
 */
async function handleLeaderboardUncached(env, loggedInUser, showAll, isAdminUser) {
  const BATCH_SIZE = 100;
  const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

  if (!listResult.keys || listResult.keys.length === 0) {
    return htmlResponse(renderLeaderboardPage([], loggedInUser, showAll, isAdminUser));
  }

  const users = [];

  for (let i = 0; i < listResult.keys.length; i += BATCH_SIZE) {
    const batch = listResult.keys.slice(i, i + BATCH_SIZE);
    const usernames = batch.map(key => key.name.replace('user:', ''));

    const [balances, disclaimerStatuses, selfBanStatuses, hiddenStatuses] = await Promise.all([
      Promise.all(batch.map(key => env.SLOTS_KV.get(key.name))),
      Promise.all(usernames.map(username => hasAcceptedDisclaimer(username, env))),
      Promise.all(usernames.map(username => isSelfBanned(username, env))),
      Promise.all(usernames.map(username => isLeaderboardHidden(username, env)))
    ]);

    for (let j = 0; j < batch.length; j++) {
      if (balances[j]) {
        const balance = parseInt(balances[j], 10);
        const username = usernames[j];
        const lowerUsername = username.toLowerCase();

        if (!isNaN(balance) && balance > 0 && lowerUsername !== 'dachsbank' && lowerUsername !== 'spieler' && !hiddenStatuses[j]) {
          if (!selfBanStatuses[j]) {
            users.push({ username, balance, hasDisclaimer: disclaimerStatuses[j] });
          }
        }
      }
    }
  }

  users.sort((a, b) => b.balance - a.balance);
  const topN = users.slice(0, LEADERBOARD_DISPLAY_LIMIT);

  const [roles, twitchUsers] = await Promise.all([
    Promise.all(topN.map(user => getUserRole(user.username, env))),
    Promise.all(topN.map(user => getTwitchUser(user.username, env)))
  ]);

  const topPlayers = topN.map((user, index) => ({
    ...user,
    role: roles[index],
    avatar: twitchUsers[index]?.avatar || null
  }));

  const allUsers = users.map((u, i) => ({ u: u.username, b: u.balance, r: i + 1 }));

  return htmlResponse(renderLeaderboardPage(topPlayers, loggedInUser, showAll, isAdminUser, null, allUsers));
}

/**
 * Leaderboard page renderer
 * @param {Array} players - Top N players
 * @param {Object|null} user - Logged in user
 * @param {boolean} showAll - Admin show all mode
 * @param {boolean} isAdminUser - Is admin
 * @param {Object|null} currentUserRank - Current user's rank data if not in top N
 * @param {Array} allUsers - All users (username, balance, rank) for search
 */
export function renderLeaderboardPage(players, user = null, showAll = false, isAdminUser = false, currentUserRank = null, allUsers = []) {
  const getRankDisplay = (rank) => {
    if (rank >= 1 && rank <= 10) {
      return `<img src="${R2_BASE}/Platz${rank}.png" alt="#${rank}" class="leaderboard-rank-img">`;
    }
    return `#${rank}`;
  };

  // Get role badge HTML for a player
  const getRoleBadge = (username, role) => {
    const lowerUsername = username.toLowerCase();

    // Special admin badges
    if (lowerUsername === 'exaint_') {
      const badge = ROLE_BADGES.leadmod;
      return `<img src="${badge.icon}" alt="${badge.label}" class="leaderboard-badge" title="${badge.label}"><span class="leaderboard-role-label">${badge.label}</span>`;
    }
    if (lowerUsername === 'frechhdachs') {
      const badge = ROLE_BADGES.broadcaster;
      return `<img src="${badge.icon}" alt="${badge.label}" class="leaderboard-badge" title="${badge.label}"><span class="leaderboard-role-label">${badge.label}</span>`;
    }

    // Regular Twitch roles
    if (role && ROLE_BADGES[role]) {
      const badge = ROLE_BADGES[role];
      return `<img src="${badge.icon}" alt="${badge.label}" class="leaderboard-badge" title="${badge.label}"><span class="leaderboard-role-label">${badge.label}</span>`;
    }

    return '';
  };

  // Helper to render a single leaderboard item
  const renderPlayerItem = (player, rank, extraClass = '') => {
    const roleBadgeHtml = getRoleBadge(player.username, player.role);
    const avatarHtml = player.avatar
      ? `<img src="${player.avatar}" alt="" class="leaderboard-avatar" loading="lazy" width="32" height="32">`
      : `<div class="leaderboard-avatar-placeholder">👤</div>`;
    const noDisclaimerBadge = showAll && !player.hasDisclaimer
      ? '<span class="no-disclaimer-badge" title="Kein Disclaimer akzeptiert">⚠️</span>'
      : '';
    const noDisclaimerClass = showAll && !player.hasDisclaimer ? ' no-disclaimer' : '';
    return `
      <div class="leaderboard-item${noDisclaimerClass}${extraClass}">
        <div class="leaderboard-rank">${getRankDisplay(rank)}</div>
        ${avatarHtml}
        <div class="leaderboard-user">
          <a href="?page=profile&user=${encodeURIComponent(player.username)}" class="leaderboard-username-link">${escapeHtml(player.username)}</a>
          ${noDisclaimerBadge}
          ${roleBadgeHtml ? `<span class="leaderboard-role">${roleBadgeHtml}</span>` : ''}
        </div>
        <div class="leaderboard-balance">${formatNumber(player.balance)} DT</div>
      </div>
    `;
  };

  const playersHtml = players.length === 0
    ? '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Noch keine Spieler gefunden.</p>'
    : players.map((player, index) => {
        const isCurrentUser = user && player.username.toLowerCase() === user.username.toLowerCase();
        return renderPlayerItem(player, index + 1, isCurrentUser ? ' current-user' : '');
      }).join('');

  // Render current user's rank section if they're not in top N
  const currentUserHtml = currentUserRank ? `
    <div class="leaderboard-user-section">
      <div class="leaderboard-user-divider">
        <span>Dein Rang</span>
      </div>
      ${renderPlayerItem(currentUserRank, currentUserRank.rank, ' current-user')}
    </div>
  ` : '';

  // Admin filter toggle (only shown to admins)
  const adminFilterHtml = isAdminUser ? `
    <div class="admin-filter">
      <label class="admin-filter-toggle">
        <input type="checkbox" id="showAllToggle" ${showAll ? 'checked' : ''} onchange="toggleShowAll(this.checked)">
        <span class="admin-filter-label">🔧 Alle User anzeigen (auch ohne Disclaimer)</span>
      </label>
    </div>
    <script>
      function toggleShowAll(checked) {
        const url = new URL(window.location);
        if (checked) {
          url.searchParams.set('showAll', 'true');
        } else {
          url.searchParams.delete('showAll');
        }
        window.location.href = url.toString();
      }
    </script>
  ` : '';

  const infoText = showAll
    ? 'Admin-Ansicht: Alle Spieler · ⚠️ = Kein Disclaimer'
    : 'Nur Spieler mit akzeptiertem Disclaimer · <code>!slots accept</code>';

  const content = `
    <div class="leaderboard">
      <div class="leaderboard-header">
        <h1 class="leaderboard-title">🏆 Leaderboard</h1>
        <span class="leaderboard-info">${infoText}</span>
        ${adminFilterHtml}
      </div>
      <div class="leaderboard-filter-bar">
        <input type="text" class="leaderboard-search" placeholder="Spieler suchen..." aria-label="Leaderboard durchsuchen" id="leaderboardSearch">
        <span class="leaderboard-count" id="leaderboardCount">${allUsers.length} Spieler</span>
      </div>
      <div class="leaderboard-list" id="leaderboardList">
        ${playersHtml}
      </div>
      <div class="leaderboard-search-results" id="searchResults" style="display: none;">
        <div class="leaderboard-user-divider"><span>Weitere Treffer</span></div>
        <div id="searchResultsList"></div>
      </div>
      ${currentUserHtml}
    </div>
    <script>
      function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
      const allUsers = ${JSON.stringify(allUsers).replace(/</g, '\\u003c')};
      const topN = ${players.length};

      document.getElementById('leaderboardSearch').addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        const items = document.querySelectorAll('#leaderboardList .leaderboard-item');
        const searchResults = document.getElementById('searchResults');
        const searchResultsList = document.getElementById('searchResultsList');
        let visibleTop = 0;

        // Filter visible top N items
        items.forEach(item => {
          const username = item.querySelector('.leaderboard-username-link');
          if (!username) return;
          const match = !query || username.textContent.toLowerCase().includes(query);
          item.style.display = match ? '' : 'none';
          if (match) visibleTop++;
        });

        // Search in full list for players outside top N
        if (query.length >= 2) {
          const extraResults = allUsers.filter(p => p.r > topN && p.u.toLowerCase().includes(query));
          if (extraResults.length > 0) {
            searchResultsList.innerHTML = extraResults.slice(0, 10).map(p =>
              '<div class="leaderboard-item search-result-item">' +
                '<div class="leaderboard-rank">#' + p.r + '</div>' +
                '<div class="leaderboard-avatar-placeholder">👤</div>' +
                '<div class="leaderboard-user"><a href="?page=profile&user=' + encodeURIComponent(p.u) + '" class="leaderboard-username-link">' + escHtml(p.u) + '</a></div>' +
                '<div class="leaderboard-balance">' + p.b.toLocaleString('de-DE') + ' DT</div>' +
              '</div>'
            ).join('');
            searchResults.style.display = '';
          } else {
            searchResults.style.display = 'none';
          }
        } else {
          searchResults.style.display = 'none';
        }

        const totalVisible = visibleTop + (searchResults.style.display !== 'none' ? Math.min(allUsers.filter(p => p.r > topN && p.u.toLowerCase().includes(query)).length, 10) : 0);
        document.getElementById('leaderboardCount').textContent = query
          ? totalVisible + ' von ' + allUsers.length + ' Spieler (gefiltert)'
          : allUsers.length + ' Spieler';
      });
    </script>
  `;

  return baseTemplate('Leaderboard', content, 'leaderboard', user);
}
