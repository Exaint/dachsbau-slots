/**
 * Leaderboard Page Handler and Renderer
 */

import { hasAcceptedDisclaimer } from '../../database.js';
import { isSelfBanned } from '../../database.js';
import { isLeaderboardHidden } from '../../database/core.js';
import { getUserRole, getTwitchUser } from '../twitch.js';
import { LEADERBOARD_LIMIT, LEADERBOARD_DISPLAY_LIMIT } from '../../constants.js';
import { isAdmin, logError } from '../../utils.js';
import { escapeHtml, formatNumber } from './utils.js';
import { ROLE_BADGES, R2_BASE } from './constants.js';
import { baseTemplate, htmlResponse } from './template.js';

/**
 * Leaderboard page handler
 */
export async function handleLeaderboardPage(env, loggedInUser = null, showAll = false) {
  const BATCH_SIZE = 100;

  // Only admins can use showAll filter
  const isAdminUser = loggedInUser && isAdmin(loggedInUser.username);
  const actualShowAll = isAdminUser && showAll;

  try {
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

    if (!listResult.keys || listResult.keys.length === 0) {
      return htmlResponse(renderLeaderboardPage([], loggedInUser, actualShowAll, isAdminUser));
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

    return htmlResponse(renderLeaderboardPage(playersWithRoles, loggedInUser, actualShowAll, isAdminUser, currentUserRank));
  } catch (error) {
    logError('handleLeaderboardPage', error);
    const { renderErrorPage } = await import('./errors.js');
    return htmlResponse(renderErrorPage(loggedInUser));
  }
}

/**
 * Leaderboard page renderer
 * @param {Array} players - Top N players
 * @param {Object|null} user - Logged in user
 * @param {boolean} showAll - Admin show all mode
 * @param {boolean} isAdminUser - Is admin
 * @param {Object|null} currentUserRank - Current user's rank data if not in top N
 */
export function renderLeaderboardPage(players, user = null, showAll = false, isAdminUser = false, currentUserRank = null) {
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
      ? `<img src="${player.avatar}" alt="" class="leaderboard-avatar">`
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
    : players.map((player, index) => renderPlayerItem(player, index + 1)).join('');

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
      <div class="leaderboard-list">
        ${playersHtml}
      </div>
      ${currentUserHtml}
    </div>
  `;

  return baseTemplate('Leaderboard', content, 'leaderboard', user);
}
