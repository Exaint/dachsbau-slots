/**
 * Leaderboard Page Handler and Renderer
 */

import { hasAcceptedDisclaimer } from '../../database.js';
import { isSelfBanned } from '../../database.js';
import { isLeaderboardHidden } from '../../database/core.js';
import { getUserRole, getTwitchUser } from '../twitch.js';
import { LEADERBOARD_LIMIT } from '../../constants.js';
import { isAdmin, logError } from '../../utils.js';
import { escapeHtml, formatNumber } from './utils.js';
import { ROLE_BADGES } from './constants.js';
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

    // Get top 100 for display
    const top100 = users.slice(0, 100);

    // Fetch Twitch roles and avatars for all top 100 players in parallel
    const [roles, twitchUsers] = await Promise.all([
      Promise.all(top100.map(user => getUserRole(user.username, env))),
      Promise.all(top100.map(user => getTwitchUser(user.username, env)))
    ]);

    // Add roles and avatars to user objects
    const playersWithRoles = top100.map((user, index) => ({
      ...user,
      role: roles[index],
      avatar: twitchUsers[index]?.avatar || null
    }));

    return htmlResponse(renderLeaderboardPage(playersWithRoles, loggedInUser, actualShowAll, isAdminUser));
  } catch (error) {
    logError('handleLeaderboardPage', error);
    const { renderErrorPage } = await import('./errors.js');
    return htmlResponse(renderErrorPage(loggedInUser));
  }
}

/**
 * Leaderboard page renderer
 */
export function renderLeaderboardPage(players, user = null, showAll = false, isAdminUser = false) {
  const getRankDisplay = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
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

  const playersHtml = players.length === 0
    ? '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Noch keine Spieler gefunden.</p>'
    : players.map((player, index) => {
        const roleBadgeHtml = getRoleBadge(player.username, player.role);
        const avatarHtml = player.avatar
          ? `<img src="${player.avatar}" alt="" class="leaderboard-avatar">`
          : `<div class="leaderboard-avatar-placeholder">👤</div>`;
        // Show warning icon for users without disclaimer (only visible in admin showAll mode)
        const noDisclaimerBadge = showAll && !player.hasDisclaimer
          ? '<span class="no-disclaimer-badge" title="Kein Disclaimer akzeptiert">⚠️</span>'
          : '';
        return `
        <div class="leaderboard-item${showAll && !player.hasDisclaimer ? ' no-disclaimer' : ''}">
          <div class="leaderboard-rank">${getRankDisplay(index)}</div>
          ${avatarHtml}
          <div class="leaderboard-user">
            <a href="?page=profile&user=${encodeURIComponent(player.username)}" class="leaderboard-username-link">${escapeHtml(player.username)}</a>
            ${noDisclaimerBadge}
            ${roleBadgeHtml ? `<span class="leaderboard-role">${roleBadgeHtml}</span>` : ''}
          </div>
          <div class="leaderboard-balance">${formatNumber(player.balance)} DT</div>
        </div>
      `;
      }).join('');

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
    </div>
  `;

  return baseTemplate('Leaderboard', content, 'leaderboard', user);
}
