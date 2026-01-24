/**
 * V2 Leaderboard Page Handler and Renderer
 */

import { hasAcceptedDisclaimer } from '../../../database.js';
import { isSelfBanned } from '../../../database.js';
import { isLeaderboardHidden } from '../../../database/core.js';
import { getUserRole, getTwitchUser } from '../../twitch.js';
import { LEADERBOARD_LIMIT, LEADERBOARD_DISPLAY_LIMIT } from '../../../constants.js';
import { isAdmin, logError } from '../../../utils.js';
import { escapeHtml, formatNumber } from '../utils.js';
import { ROLE_BADGES, R2_BASE } from '../ui-config.js';
import { baseTemplateV2, htmlResponse } from './template.js';

/**
 * V2 Leaderboard page handler
 */
export async function handleLeaderboardPageV2(env, loggedInUser = null, showAll = false) {
  const BATCH_SIZE = 100;

  // Only admins can use showAll filter
  const isAdminUser = loggedInUser && isAdmin(loggedInUser.username);
  const actualShowAll = isAdminUser && showAll;

  try {
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

    if (!listResult.keys || listResult.keys.length === 0) {
      return htmlResponse(renderLeaderboardPageV2([], loggedInUser, actualShowAll, isAdminUser));
    }

    const users = [];

    // Batch fetch balances, disclaimer status, self-ban status, and leaderboard hidden status
    for (let i = 0; i < listResult.keys.length; i += BATCH_SIZE) {
      const batch = listResult.keys.slice(i, i + BATCH_SIZE);
      const usernames = batch.map(key => key.name.replace('user:', ''));

      // Fetch balances, disclaimer status, self-ban status, and hidden status in parallel
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

          // Base filter: valid balance, not system accounts, not hidden from leaderboard
          if (!isNaN(balance) && balance > 0 && lowerUsername !== 'dachsbank' && lowerUsername !== 'spieler' && !isHidden) {
            // Admin showAll: show all users (even without disclaimer), but still hide self-banned
            // Normal: show only users with disclaimer and not self-banned
            if (actualShowAll) {
              // Admin view: show all, mark those without disclaimer
              if (!isSelfBannedUser) {
                users.push({
                  username,
                  balance,
                  hasDisclaimer
                });
              }
            } else {
              // Normal view: only show users with disclaimer and not self-banned
              if (hasDisclaimer && !isSelfBannedUser) {
                users.push({
                  username,
                  balance,
                  hasDisclaimer: true
                });
              }
            }
          }
        }
      }
    }

    // Sort by balance descending
    users.sort((a, b) => b.balance - a.balance);

    // Get top N for display (LEADERBOARD_DISPLAY_LIMIT = 25)
    const topN = users.slice(0, LEADERBOARD_DISPLAY_LIMIT);

    // Find logged-in user's rank if they exist and are not in top N
    let currentUserRank = null;
    if (loggedInUser) {
      const userIndex = users.findIndex(u => u.username.toLowerCase() === loggedInUser.username.toLowerCase());
      if (userIndex >= LEADERBOARD_DISPLAY_LIMIT) {
        // User is not in top N, get their data
        currentUserRank = {
          ...users[userIndex],
          rank: userIndex + 1
        };
      }
    }

    // Fetch Twitch roles and avatars for top N players
    // Also fetch for current user if they're not in top N
    const usersToFetch = currentUserRank ? [...topN, currentUserRank] : topN;

    const [roles, twitchUsers] = await Promise.all([
      Promise.all(usersToFetch.map(user => getUserRole(user.username, env))),
      Promise.all(usersToFetch.map(user => getTwitchUser(user.username, env)))
    ]);

    // Add roles and avatars to top N
    const playersWithRoles = topN.map((user, index) => ({
      ...user,
      role: roles[index],
      avatar: twitchUsers[index]?.avatar || null
    }));

    // Add roles and avatar to current user if exists
    if (currentUserRank) {
      const userFetchIndex = topN.length; // Last item in usersToFetch
      currentUserRank.role = roles[userFetchIndex];
      currentUserRank.avatar = twitchUsers[userFetchIndex]?.avatar || null;
    }

    // Pass all users (username + balance + rank) for search functionality
    const allUsers = users.map((u, i) => ({ username: u.username, balance: u.balance, rank: i + 1 }));

    return htmlResponse(renderLeaderboardPageV2(playersWithRoles, loggedInUser, actualShowAll, isAdminUser, currentUserRank, allUsers));
  } catch (error) {
    logError('handleLeaderboardPageV2', error);
    const { renderErrorPageV2 } = await import('./errors.js');
    return htmlResponse(renderErrorPageV2(loggedInUser));
  }
}

/**
 * V2 Leaderboard page renderer
 * @param {Array} players - Top N players
 * @param {Object|null} user - Logged in user
 * @param {boolean} showAll - Admin show all mode
 * @param {boolean} isAdminUser - Is admin
 * @param {Object|null} currentUserRank - Current user's rank data if not in top N
 * @param {Array} allUsers - All users (username, balance, rank) for search
 */
export function renderLeaderboardPageV2(players, user = null, showAll = false, isAdminUser = false, currentUserRank = null, allUsers = []) {
  const getRankDisplay = (rank) => {
    if (rank >= 1 && rank <= 10) {
      return `<img src="${R2_BASE}/Platz${rank}.png" alt="#${rank}" class="v2-leaderboard-rank-img">`;
    }
    return `#${rank}`;
  };

  // Get role badge HTML for a player
  const getRoleBadge = (username, role) => {
    const lowerUsername = username.toLowerCase();

    // Special admin badges
    if (lowerUsername === 'exaint_') {
      const badge = ROLE_BADGES.leadmod;
      return `<img src="${badge.icon}" alt="${badge.label}" class="v2-leaderboard-badge" title="${badge.label}"><span class="v2-leaderboard-role-label">${badge.label}</span>`;
    }
    if (lowerUsername === 'frechhdachs') {
      const badge = ROLE_BADGES.broadcaster;
      return `<img src="${badge.icon}" alt="${badge.label}" class="v2-leaderboard-badge" title="${badge.label}"><span class="v2-leaderboard-role-label">${badge.label}</span>`;
    }

    // Regular Twitch roles
    if (role && ROLE_BADGES[role]) {
      const badge = ROLE_BADGES[role];
      return `<img src="${badge.icon}" alt="${badge.label}" class="v2-leaderboard-badge" title="${badge.label}"><span class="v2-leaderboard-role-label">${badge.label}</span>`;
    }

    return '';
  };

  // Helper to render a single leaderboard item
  const renderPlayerItem = (player, rank, extraClass = '') => {
    const roleBadgeHtml = getRoleBadge(player.username, player.role);
    const avatarHtml = player.avatar
      ? `<img src="${player.avatar}" alt="" class="v2-leaderboard-avatar" loading="lazy" width="32" height="32">`
      : `<div class="v2-leaderboard-avatar-placeholder"></div>`;
    const noDisclaimerBadge = showAll && !player.hasDisclaimer
      ? '<span class="v2-no-disclaimer-badge" title="Kein Disclaimer akzeptiert">&#9888;&#65039;</span>'
      : '';
    const noDisclaimerClass = showAll && !player.hasDisclaimer ? ' v2-no-disclaimer' : '';
    return `
      <div class="v2-leaderboard-item${noDisclaimerClass}${extraClass}">
        <div class="v2-leaderboard-rank">${getRankDisplay(rank)}</div>
        ${avatarHtml}
        <div class="v2-leaderboard-user">
          <a href="?page=profile&user=${encodeURIComponent(player.username)}" class="v2-leaderboard-username-link">${escapeHtml(player.username)}</a>
          ${noDisclaimerBadge}
          ${roleBadgeHtml ? `<span class="v2-leaderboard-role">${roleBadgeHtml}</span>` : ''}
        </div>
        <div class="v2-leaderboard-balance">${formatNumber(player.balance)} DT</div>
      </div>
    `;
  };

  const playersHtml = players.length === 0
    ? '<p style="text-align: center; color: var(--v2-text-muted); padding: 40px;">Noch keine Spieler gefunden.</p>'
    : players.map((player, index) => {
        const isCurrentUser = user && player.username.toLowerCase() === user.username.toLowerCase();
        return renderPlayerItem(player, index + 1, isCurrentUser ? ' current-user' : '');
      }).join('');

  // Render current user's rank section if they're not in top N
  const currentUserHtml = currentUserRank ? `
    <div class="v2-leaderboard-user-section">
      <div class="v2-leaderboard-user-divider">
        <span>Dein Rang</span>
      </div>
      ${renderPlayerItem(currentUserRank, currentUserRank.rank, ' current-user')}
    </div>
  ` : '';

  // Admin filter toggle (only shown to admins)
  const adminFilterHtml = isAdminUser ? `
    <div class="v2-admin-filter">
      <label class="v2-admin-filter-toggle">
        <input type="checkbox" id="v2ShowAllToggle" ${showAll ? 'checked' : ''} onchange="v2ToggleShowAll(this.checked)">
        <span class="v2-admin-filter-label">Alle User anzeigen (auch ohne Disclaimer)</span>
      </label>
    </div>
    <script>
      function v2ToggleShowAll(checked) {
        var url = new URL(window.location);
        if (checked) {
          url.searchParams.set('showAll', 'true');
        } else {
          url.searchParams.delete('showAll');
        }
        window.location.href = url.toString();
      }
    </script>
  ` : '';

  const content = `
    <div class="v2-leaderboard">
      <div class="v2-leaderboard-header">
        <h1 class="v2-leaderboard-title">Leaderboard</h1>
        ${adminFilterHtml}
      </div>
      <div class="v2-leaderboard-filter-bar">
        <input type="text" class="v2-leaderboard-search" placeholder="Spieler suchen..." aria-label="Leaderboard durchsuchen" id="v2LeaderboardSearch">
        <span class="v2-leaderboard-count" id="v2LeaderboardCount">${allUsers.length} Spieler</span>
      </div>
      <div class="v2-leaderboard-list" id="v2LeaderboardList">
        ${playersHtml}
      </div>
      <div class="v2-leaderboard-search-results" id="v2SearchResults" style="display: none;">
        <div class="v2-leaderboard-user-divider"><span>Weitere Treffer</span></div>
        <div id="v2SearchResultsList"></div>
      </div>
      ${currentUserHtml}
    </div>
    <script>
      function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
      var allUsers = ${JSON.stringify(allUsers.map(u => ({ u: u.username, b: u.balance, r: u.rank }))).replace(/</g, '\\u003c')};
      var topN = ${players.length};

      document.getElementById('v2LeaderboardSearch').addEventListener('input', function() {
        var query = this.value.toLowerCase().trim();
        var items = document.querySelectorAll('#v2LeaderboardList .v2-leaderboard-item');
        var searchResults = document.getElementById('v2SearchResults');
        var searchResultsList = document.getElementById('v2SearchResultsList');
        var visibleTop = 0;

        // Filter visible top N items
        items.forEach(function(item) {
          var username = item.querySelector('.v2-leaderboard-username-link');
          if (!username) return;
          var match = !query || username.textContent.toLowerCase().includes(query);
          item.style.display = match ? '' : 'none';
          if (match) visibleTop++;
        });

        // Search in full list for players outside top N
        if (query.length >= 2) {
          var extraResults = allUsers.filter(function(p) { return p.r > topN && p.u.toLowerCase().includes(query); });
          if (extraResults.length > 0) {
            searchResultsList.innerHTML = extraResults.slice(0, 10).map(function(p) {
              return '<div class="v2-leaderboard-item v2-leaderboard-search-result-item">' +
                '<div class="v2-leaderboard-rank">#' + p.r + '</div>' +
                '<div class="v2-leaderboard-avatar-placeholder"></div>' +
                '<div class="v2-leaderboard-user"><a href="?page=profile&user=' + encodeURIComponent(p.u) + '" class="v2-leaderboard-username-link">' + escHtml(p.u) + '</a></div>' +
                '<div class="v2-leaderboard-balance">' + p.b.toLocaleString('de-DE') + ' DT</div>' +
              '</div>';
            }).join('');
            searchResults.style.display = '';
          } else {
            searchResults.style.display = 'none';
          }
        } else {
          searchResults.style.display = 'none';
        }

        var totalVisible = visibleTop + (searchResults.style.display !== 'none' ? Math.min(allUsers.filter(function(p) { return p.r > topN && p.u.toLowerCase().includes(query); }).length, 10) : 0);
        document.getElementById('v2LeaderboardCount').textContent = query
          ? totalVisible + ' von ' + allUsers.length + ' Spieler (gefiltert)'
          : allUsers.length + ' Spieler';
      });
    </script>
  `;

  return baseTemplateV2('Leaderboard', content, 'leaderboard', user);
}
