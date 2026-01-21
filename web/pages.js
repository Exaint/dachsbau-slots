/**
 * HTML Page Generators for Achievement Website
 * Server-side rendered pages with inline CSS
 *
 * REFACTORING STATUS:
 * - [x] Utilities extracted to ./pages/utils.js (escapeHtml, formatNumber)
 * - [x] Constants extracted to ./pages/constants.js (CATEGORY_ICONS, ROLE_BADGES, etc.)
 * - [x] Template extracted to ./pages/template.js (baseTemplate, htmlResponse)
 * - [ ] Individual page renderers remain here (too large to split without risk)
 */

import { getPlayerAchievements, getStats, getBalance, getPrestigeRank, hasAcceptedDisclaimer, getLastActive, getAchievementStats, isSelfBanned, hasUnlock } from '../database.js';
import { isDuelOptedOut } from '../database/duels.js';
import { isLeaderboardHidden } from '../database/core.js';
import { getTwitchProfileData, getUserRole, getTwitchUser } from './twitch.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES, SHOP_ITEMS, getStatKeyForAchievement, LEADERBOARD_LIMIT } from '../constants.js';
import { isWebPurchasable } from './shop-api.js';
import { logError, isAdmin } from '../utils.js';

// Import extracted modules
import { escapeHtml, formatNumber } from './pages/utils.js';
import { CATEGORY_ICONS, CATEGORY_NAMES, PRESTIGE_RANK_NAMES, ROLE_BADGES } from './pages/constants.js';
import { baseTemplate, htmlResponse } from './pages/template.js';

/**
 * Handle web page requests
 * @param {string} page - Page name
 * @param {URL} url - Request URL
 * @param {object} env - Environment bindings
 * @param {object|null} loggedInUser - Logged in user from JWT cookie
 */
export async function handleWebPage(page, url, env, loggedInUser = null) {
  try {
    // Check if logged-in user has accepted disclaimer
    if (loggedInUser) {
      const userHasDisclaimer = await hasAcceptedDisclaimer(loggedInUser.username, env);
      loggedInUser = { ...loggedInUser, hasDisclaimer: userHasDisclaimer };
    }

    switch (page) {
      case 'home':
        return htmlResponse(renderHomePage(null, loggedInUser));
      case 'profile':
        return await handleProfilePage(url, env, loggedInUser);
      case 'leaderboard':
        const showAll = url.searchParams.get('showAll') === 'true';
        return await handleLeaderboardPage(env, loggedInUser, showAll);
      case 'info':
        return htmlResponse(renderInfoPage(loggedInUser));
      case 'shop':
        return htmlResponse(await renderShopPage(env, loggedInUser));
      case 'changelog':
        return htmlResponse(renderChangelogPage(loggedInUser));
      case 'stats':
        return await handleGlobalStatsPage(env, loggedInUser);
      case 'impressum':
        return htmlResponse(renderImpressumPage(loggedInUser));
      case 'datenschutz':
        return htmlResponse(renderDatenschutzPage(loggedInUser));
      default:
        return htmlResponse(renderNotFoundPage(null, loggedInUser));
    }
  } catch (error) {
    logError('handleWebPage', error, { page });
    return htmlResponse(renderErrorPage(loggedInUser));
  }
}

/**
 * Profile page handler
 */
async function handleProfilePage(url, env, loggedInUser = null) {
  const username = url.searchParams.get('user');

  if (!username) {
    return htmlResponse(renderHomePage('Bitte gib einen Spielernamen ein.', loggedInUser));
  }

  // Check if user exists (check both disclaimer AND balance for legacy players)
  const [hasDisclaimer, balance] = await Promise.all([
    hasAcceptedDisclaimer(username, env),
    getBalance(username, env)
  ]);

  // User exists if they accepted disclaimer OR have a balance (legacy players)
  const userExists = hasDisclaimer || balance > 0;
  if (!userExists) {
    return htmlResponse(renderNotFoundPage(username, loggedInUser));
  }

  // Fetch remaining data in parallel (balance already fetched above)
  const [rank, stats, achievementData, lastActive, achievementStats, duelOptOut, selfBanned, leaderboardHidden, twitchData] = await Promise.all([
    getPrestigeRank(username, env),
    getStats(username, env),
    getPlayerAchievements(username, env),
    getLastActive(username, env),
    getAchievementStats(env),
    isDuelOptedOut(username, env),
    isSelfBanned(username, env),
    isLeaderboardHidden(username, env),
    getTwitchProfileData(username, env)
  ]);

  const allAchievements = getAllAchievements();

  // Build achievements with unlock status and rarity
  const { totalPlayers, counts } = achievementStats;
  const achievements = allAchievements.map(ach => {
    const unlocked = !!achievementData.unlockedAt[ach.id];
    const unlockedAt = achievementData.unlockedAt[ach.id] || null;

    // Calculate progress
    let progress = null;
    if (ach.requirement && !unlocked) {
      const statKey = getStatKeyForAchievement(ach.id);
      if (statKey && achievementData.stats[statKey] !== undefined) {
        progress = {
          current: achievementData.stats[statKey],
          required: ach.requirement,
          percent: Math.min(100, Math.round((achievementData.stats[statKey] / ach.requirement) * 100))
        };
      }
    }

    // Calculate rarity percentage
    const unlockCount = counts[ach.id] || 0;
    const rarityPercent = totalPlayers > 0 ? Math.round((unlockCount / totalPlayers) * 100) : 0;

    return {
      ...ach,
      unlocked,
      unlockedAt,
      progress,
      rarity: {
        percent: rarityPercent,
        count: unlockCount,
        total: totalPlayers
      }
    };
  });

  // Group by category
  const byCategory = {};
  for (const cat of Object.values(ACHIEVEMENT_CATEGORIES)) {
    byCategory[cat] = achievements.filter(a => a.category === cat);
  }

  return htmlResponse(renderProfilePage({
    username,
    balance,
    rank,
    stats,
    achievements,
    byCategory,
    pendingRewards: achievementData.pendingRewards,
    lastActive,
    duelOptOut,
    selfBanned,
    leaderboardHidden,
    hasDisclaimer,
    twitchData,
    loggedInUser
  }));
}

/**
 * Leaderboard page handler
 */
async function handleLeaderboardPage(env, loggedInUser = null, showAll = false) {
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
    return htmlResponse(renderErrorPage(loggedInUser));
  }
}

// ==================== HTML RENDERERS ====================
// Note: baseTemplate, htmlResponse, escapeHtml, formatNumber imported from ./pages/

/**
 * Home page
 */
function renderHomePage(errorMessage = null, user = null) {
  const errorHtml = errorMessage
    ? `<p style="color: var(--error); margin-bottom: 16px;">${escapeHtml(errorMessage)}</p>`
    : '';

  const content = `
    <div class="hero">
      <h1 class="hero-title">🦡 Dachsbau Slots</h1>
      <p class="hero-subtitle">Schau dir die Achievements und Stats von Spielern an!</p>
      ${errorHtml}
      <div class="hero-search">
        <form class="search-form" action="" method="get" role="search" aria-label="Spielersuche">
          <input type="hidden" name="page" value="profile">
          <input type="text" name="user" placeholder="Spielername eingeben..." class="search-input" required autofocus aria-label="Spielername eingeben">
          <button type="submit" class="btn">Profil anzeigen</button>
        </form>
      </div>
      <div style="margin-top: 32px;">
        <a href="?page=leaderboard" class="btn btn-secondary">Leaderboard anzeigen</a>
      </div>
    </div>
  `;

  return baseTemplate('Home', content, 'home', user);
}

/**
 * Profile page
 */
function renderProfilePage(data) {
  const { username, balance, rank, stats, achievements, byCategory, lastActive, duelOptOut, selfBanned, leaderboardHidden, hasDisclaimer, twitchData, loggedInUser } = data;

  // Check if logged-in user is admin
  const showAdminPanel = loggedInUser && isAdmin(loggedInUser.username);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  // Format last active time
  const formatLastActive = (timestamp) => {
    if (!timestamp) return null;
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Gerade eben';
    if (minutes < 60) return `Vor ${minutes} Minute${minutes !== 1 ? 'n' : ''}`;
    if (hours < 24) return `Vor ${hours} Stunde${hours !== 1 ? 'n' : ''}`;
    if (days < 7) return `Vor ${days} Tag${days !== 1 ? 'en' : ''}`;

    // Format as date for older entries
    const date = new Date(timestamp);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const lastActiveText = formatLastActive(lastActive);

  // Stats display
  const statsHtml = `
    <div class="profile-stats">
      <div class="stat-box">
        <div class="stat-value">${formatNumber(balance)}</div>
        <div class="stat-label">DachsTaler</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatNumber(stats.totalSpins || 0)}</div>
        <div class="stat-label">Spins</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatNumber(stats.wins || 0)}</div>
        <div class="stat-label">Gewinne</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatNumber(stats.biggestWin || 0)}</div>
        <div class="stat-label">Höchster Gewinn</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatNumber(stats.totalWon || 0)}</div>
        <div class="stat-label">Gesamt gewonnen</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatNumber(stats.totalLost || 0)}</div>
        <div class="stat-label">Gesamt verloren</div>
      </div>
    </div>
  `;

  // Categories HTML
  const categoriesHtml = Object.entries(byCategory).map(([category, achs]) => {
    const catUnlocked = achs.filter(a => a.unlocked).length;
    const catTotal = achs.length;
    const catClass = `category-${category.toLowerCase()}`;

    const achievementsHtml = achs.map(ach => {
      // Skip hidden achievements that aren't unlocked
      if (ach.hidden && !ach.unlocked) {
        return `
          <div class="achievement locked hidden">
            <div class="achievement-icon">❓</div>
            <div class="achievement-info">
              <div class="achievement-name">Verstecktes Achievement</div>
              <div class="achievement-desc">Spiele weiter um es zu entdecken...</div>
            </div>
          </div>
        `;
      }

      const statusClass = ach.unlocked ? 'unlocked' : 'locked';
      const icon = ach.unlocked ? '✅' : '🔒';

      let progressHtml = '';
      if (ach.progress && !ach.unlocked) {
        progressHtml = `
          <div class="achievement-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${ach.progress.percent}%"></div>
            </div>
            <div class="achievement-progress-text">${formatNumber(ach.progress.current)}/${formatNumber(ach.progress.required)}</div>
          </div>
        `;
      }

      // Rarity display with color coding
      // < 5% = legendary (orange), < 15% = epic (purple), < 30% = rare (blue), >= 30% = common (gray)
      const getRarityClass = (percent) => {
        if (percent < 5) return 'rarity-legendary';
        if (percent < 15) return 'rarity-epic';
        if (percent < 30) return 'rarity-rare';
        return 'rarity-common';
      };
      const rarityClass = ach.rarity && ach.rarity.total > 0 ? getRarityClass(ach.rarity.percent) : '';
      const rarityHtml = ach.rarity && ach.rarity.total > 0
        ? `<div class="achievement-rarity ${rarityClass}">${ach.rarity.percent}% der Spieler</div>`
        : '';

      // Format unlock date
      const unlockedDateStr = ach.unlockedAt
        ? new Date(ach.unlockedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

      return `
        <div class="achievement ${statusClass}" onclick="showAchievementDetail(this)"
          data-name="${escapeHtml(ach.name)}"
          data-desc="${escapeHtml(ach.description)}"
          data-category="${ach.category}"
          data-rarity="${ach.rarity?.percent || 0}"
          data-rarity-count="${ach.rarity?.count || 0}"
          data-rarity-total="${ach.rarity?.total || 0}"
          data-unlocked="${ach.unlocked}"
          data-unlocked-at="${unlockedDateStr}"
          data-progress-current="${ach.progress?.current || ''}"
          data-progress-required="${ach.progress?.required || ''}">
          <div class="achievement-icon">${icon}</div>
          <div class="achievement-info">
            <div class="achievement-name">${escapeHtml(ach.name)}</div>
            <div class="achievement-desc">${escapeHtml(ach.description)}</div>
            ${rarityHtml}
          </div>
          ${ach.reward ? `<div class="achievement-reward">+${formatNumber(ach.reward)} DT</div>` : ''}
          ${progressHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="category ${catClass}">
        <div class="category-header">
          <div class="category-title">
            <div class="category-icon">${CATEGORY_ICONS[category] || '🎯'}</div>
            <span>${CATEGORY_NAMES[category] || category}</span>
          </div>
          <div class="category-progress">${catUnlocked}/${catTotal}</div>
        </div>
        <div class="category-content">
          <div class="achievement-list">
            ${achievementsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Avatar from Twitch (or default)
  const avatarUrl = twitchData?.avatar || null;
  const displayName = twitchData?.displayName || username;

  // Build role badges array
  const lowerUsername = username.toLowerCase();
  const roleBadges = [];

  // Special admin overrides - multiple badges
  if (lowerUsername === 'exaint_') {
    roleBadges.push({ ...ROLE_BADGES.leadmod });
    roleBadges.push({ ...ROLE_BADGES.admin });
  } else if (lowerUsername === 'frechhdachs') {
    roleBadges.push({ ...ROLE_BADGES.broadcaster });
    roleBadges.push({ ...ROLE_BADGES.admin });
  } else if (twitchData?.role && ROLE_BADGES[twitchData.role]) {
    roleBadges.push({ ...ROLE_BADGES[twitchData.role] });
  }

  // Generate role badges HTML
  const roleBadgesHtml = roleBadges.map(badge =>
    `<span class="profile-role-badge" style="--role-color: ${badge.color}">
      <img src="${badge.icon}" alt="${badge.label}" class="profile-role-icon">
      <span>${badge.label}</span>
    </span>`
  ).join('');

  const isComplete = progressPercent === 100;
  const completeBadgeHtml = isComplete ? '<span class="complete-badge">🏆 100% Complete!</span>' : '';

  const content = `
    ${isComplete ? '<div class="confetti-container" id="confetti"></div>' : ''}
    <div class="profile-header${isComplete ? ' complete' : ''}">
      <div class="profile-top">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}" class="profile-avatar">` : ''}
        <div class="profile-info">
          <div class="profile-name">
            ${escapeHtml(displayName)}
            ${completeBadgeHtml}
          </div>
          <div class="profile-badges">
            ${roleBadgesHtml}
            ${rank && PRESTIGE_RANK_NAMES[rank] ? `<span class="profile-prestige-badge" style="--prestige-color: ${PRESTIGE_RANK_NAMES[rank].color}">${rank} ${PRESTIGE_RANK_NAMES[rank].name}</span>` : ''}
            <span class="profile-duel-status ${duelOptOut ? 'opted-out' : 'opted-in'}">⚔️ ${duelOptOut ? 'Duelle deaktiviert' : 'Offen für Duelle'}</span>
            <span class="profile-duel-hint">Duelle an/aus: <code>!slots duelopt</code></span>
            ${selfBanned ? `<span class="profile-selfban-status banned">🚫 Selbst-gesperrt</span>` : ''}
          </div>
          ${lastActiveText ? `<div class="profile-last-active">🕐 Zuletzt aktiv: ${lastActiveText}</div>` : ''}
        </div>
      </div>
      ${statsHtml}
      <div class="achievement-summary">
        <div class="achievement-count">
          <strong>${unlockedCount}</strong> / ${totalCount} Achievements
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
      </div>
    </div>
    ${showAdminPanel ? `
    <div class="admin-panel collapsed" id="adminPanel">
      <div class="admin-panel-header" onclick="toggleAdminPanel()">
        <h3>🔧 Admin Panel</h3>
        <span class="admin-panel-user">Spieler: <strong>${escapeHtml(username)}</strong></span>
        <span class="admin-panel-toggle" id="adminPanelToggle">▼</span>
      </div>
      <div class="admin-panel-content" id="adminPanelContent">
        <div class="admin-panel-grid">
          <div class="admin-control">
            <label>Balance</label>
            <div class="admin-input-group">
              <input type="number" id="adminBalance" value="${balance}" min="0" class="admin-input">
              <button class="btn admin-btn" onclick="adminSetBalance('${escapeHtml(username)}')">Setzen</button>
            </div>
          </div>
          <div class="admin-control">
            <label>Disclaimer</label>
            <div class="admin-toggle-group">
              <span class="admin-status ${hasDisclaimer ? 'active' : ''}">${hasDisclaimer ? '✓ Akzeptiert' : '✗ Nicht akzeptiert'}</span>
              <button class="btn admin-btn ${hasDisclaimer ? 'danger' : 'success'}" onclick="adminSetDisclaimer('${escapeHtml(username)}', ${!hasDisclaimer})">${hasDisclaimer ? 'Entfernen' : 'Setzen'}</button>
            </div>
          </div>
          <div class="admin-control">
            <label>Self-Ban</label>
            <div class="admin-toggle-group">
              <span class="admin-status ${selfBanned ? 'active danger' : ''}">${selfBanned ? '🚫 Gesperrt' : '✓ Nicht gesperrt'}</span>
              <button class="btn admin-btn ${selfBanned ? 'success' : 'danger'}" onclick="adminSetSelfBan('${escapeHtml(username)}', ${!selfBanned})">${selfBanned ? 'Entsperren' : 'Sperren'}</button>
            </div>
          </div>
          <div class="admin-control">
            <label>Duelle</label>
            <div class="admin-toggle-group">
              <span class="admin-status ${duelOptOut ? 'danger' : 'active'}">${duelOptOut ? '✗ Deaktiviert' : '✓ Aktiviert'}</span>
              <button class="btn admin-btn" onclick="adminSetDuelOpt('${escapeHtml(username)}', ${!duelOptOut})">${duelOptOut ? 'Aktivieren' : 'Deaktivieren'}</button>
            </div>
          </div>
          <div class="admin-control">
            <label>Leaderboard</label>
            <div class="admin-toggle-group">
              <span class="admin-status ${leaderboardHidden ? 'danger' : 'active'}">${leaderboardHidden ? '✗ Versteckt' : '✓ Sichtbar'}</span>
              <button class="btn admin-btn" onclick="adminSetLeaderboardHidden('${escapeHtml(username)}', ${!leaderboardHidden})">${leaderboardHidden ? 'Anzeigen' : 'Verstecken'}</button>
            </div>
          </div>
          <div class="admin-control admin-control-wide">
            <label>Achievement</label>
            <div class="admin-input-group">
              <select id="adminAchievement" class="admin-input admin-select">
                ${achievements.map(a => `<option value="${a.id}" data-unlocked="${a.unlocked}">${a.unlocked ? '✓' : '○'} ${escapeHtml(a.name)}</option>`).join('')}
              </select>
              <button class="btn admin-btn success" onclick="adminSetAchievement('${escapeHtml(username)}', true)">Freischalten</button>
              <button class="btn admin-btn danger" onclick="adminSetAchievement('${escapeHtml(username)}', false)">Sperren</button>
            </div>
          </div>
        </div>
        <div id="adminMessage" class="admin-message"></div>
      </div>
    </div>
    <script>
      function toggleAdminPanel() {
        const panel = document.getElementById('adminPanel');
        const toggle = document.getElementById('adminPanelToggle');
        panel.classList.toggle('collapsed');
        toggle.textContent = panel.classList.contains('collapsed') ? '▼' : '▲';
      }
    </script>
    ` : ''}
    <div class="achievement-controls">
      <div class="achievement-filter" role="group" aria-label="Achievement Filter">
        <span class="filter-label" id="filter-label">Filter:</span>
        <button class="filter-btn active" data-filter="all" aria-pressed="true">Alle</button>
        <button class="filter-btn" data-filter="unlocked" aria-pressed="false">Freigeschaltet</button>
        <button class="filter-btn" data-filter="locked" aria-pressed="false">Gesperrt</button>
      </div>
      <div class="achievement-sort" role="group" aria-label="Achievement Sortierung">
        <span class="filter-label" id="sort-label">Sortierung:</span>
        <button class="sort-btn active" data-sort="category" aria-pressed="true">Kategorie</button>
        <button class="sort-btn" data-sort="rarity-asc" aria-pressed="false">Seltenste</button>
        <button class="sort-btn" data-sort="rarity-desc" aria-pressed="false">Häufigste</button>
      </div>
    </div>
    <div class="categories">
      ${categoriesHtml}
    </div>
  `;

  return baseTemplate(`${username}'s Profil`, content, 'profile', loggedInUser);
}

/**
 * Leaderboard page
 */
function renderLeaderboardPage(players, user = null, showAll = false, isAdminUser = false) {
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

/**
 * Info page
 */
function renderInfoPage(user = null) {
  const content = `
    <div class="content-page">
      <h1 class="page-title">ℹ️ Info & Commands</h1>

      <!-- Inhaltsverzeichnis -->
      <nav class="info-toc" aria-label="Inhaltsverzeichnis">
        <h2>📑 Inhalt</h2>
        <div class="toc-grid">
          <a href="#schnellstart" class="toc-item">🚀 Schnellstart</a>
          <a href="#wichtig" class="toc-item">⚠️ Wichtig zu wissen</a>
          <a href="#commands" class="toc-item">📋 Commands</a>
          <a href="#gewinne" class="toc-item">💎 Gewinne & Chancen</a>
          <a href="#multiplier" class="toc-item">📈 Multiplier-System</a>
          <a href="#bonus" class="toc-item">🎁 Bonus-Systeme</a>
          <a href="#duell" class="toc-item">⚔️ Duell-System</a>
          <a href="#bank" class="toc-item">🏦 DachsBank</a>
          <a href="#faq" class="toc-item">❓ FAQ</a>
          <a href="#hilfe" class="toc-item">📞 Hilfe</a>
        </div>
      </nav>

      <!-- Schnellstart -->
      <section id="schnellstart" class="content-section">
        <h2>🚀 Schnellstart</h2>
        <p class="section-intro">Neu hier? In 4 Schritten loslegen:</p>
        <div class="info-table">
          <div class="info-row">
            <span class="info-step">1. Starten</span>
            <code>!slots</code>
            <span>Zeigt Willkommensnachricht & Disclaimer</span>
          </div>
          <div class="info-row">
            <span class="info-step">2. Akzeptieren</span>
            <code>!slots accept</code>
            <span>Disclaimer akzeptieren, Account erstellen (100 DT)</span>
          </div>
          <div class="info-row">
            <span class="info-step">3. Spielen</span>
            <code>!slots</code>
            <span>Dein erster Spin!</span>
          </div>
          <div class="info-row">
            <span class="info-step">4. Daily holen</span>
            <code>!slots daily</code>
            <span>+50 DachsTaler alle 24 Stunden</span>
          </div>
        </div>
      </section>

      <!-- Wichtig zu wissen -->
      <section id="wichtig" class="content-section">
        <h2>⚠️ Wichtig zu wissen</h2>
        <p class="section-intro">Diese Infos solltest du kennen, bevor du loslegst!</p>

        <h3>💰 Einsatz & Kosten</h3>
        <div class="info-grid compact">
          <div class="info-card">
            <span class="info-label">Mindesteinsatz</span>
            <span class="info-value">10 DachsTaler pro Spin</span>
          </div>
          <div class="info-card">
            <span class="info-label">Startguthaben</span>
            <span class="info-value">100 DachsTaler (neue Spieler)</span>
          </div>
          <div class="info-card">
            <span class="info-label">Bei 0 DachsTaler</span>
            <span class="info-value">Warte auf Daily oder bitte um Transfer</span>
          </div>
        </div>

        <h3>⏱️ Cooldowns</h3>
        <div class="command-list compact">
          <div class="command-item">
            <code>!slots / !slots [Einsatz]</code>
            <span>30 Sekunden</span>
          </div>
          <div class="command-item">
            <code>!slots daily</code>
            <span>24 Stunden (UTC Mitternacht)</span>
          </div>
          <div class="command-item">
            <span>Alle anderen Commands</span>
            <span>Kein Cooldown</span>
          </div>
        </div>

        <h3>🤖 Fossabot-Besonderheiten</h3>
        <div class="tip-list">
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <div>
              <strong>Keine doppelten Nachrichten</strong>
              <p>Schreibe zwischen zwei <code>!slots</code> immer eine andere Nachricht! Fossabot ignoriert identische aufeinanderfolgende Befehle.</p>
            </div>
          </div>
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <div>
              <strong>Keine Leerzeichen nach @</strong>
              <p><code>!transfer @user 100</code> ✅ nicht <code>!transfer @ user 100</code> ❌</p>
            </div>
          </div>
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <div>
              <strong>Groß/Kleinschreibung egal</strong>
              <p><code>!SLOTS</code>, <code>!Slots</code>, <code>!slots</code> funktionieren alle</p>
            </div>
          </div>
        </div>

        <h3>🎰 Höhere Einsätze freischalten</h3>
        <p>Höhere Einsätze müssen <strong>zuerst im Shop gekauft</strong> werden:</p>
        <div class="unlock-list">
          <div class="unlock-item">
            <code>!shop buy 13</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 20</code>
            <span class="unlock-price">500 DT</span>
          </div>
          <div class="unlock-item">
            <code>!shop buy 19</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 30</code>
            <span class="unlock-price">2.000 DT</span>
          </div>
          <div class="unlock-item">
            <code>!shop buy 21</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 50</code>
            <span class="unlock-price">2.500 DT</span>
          </div>
          <div class="unlock-item">
            <code>!shop buy 23</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 100</code>
            <span class="unlock-price">3.250 DT</span>
          </div>
          <div class="unlock-item">
            <code>!shop buy 25</code>
            <span class="unlock-arrow">→</span>
            <code>!slots all</code>
            <span class="unlock-price">4.444 DT</span>
          </div>
        </div>
        <p class="section-note">Gesamt: <strong>12.694 DachsTaler</strong> für alle Unlocks</p>
      </section>

      <!-- Commands -->
      <section id="commands" class="content-section">
        <h2>📋 Commands</h2>

        <h3>Haupt-Commands</h3>
        <div class="command-list">
          <div class="command-item">
            <code>!slots</code>
            <span>Spin für 10 DachsTaler (30 Sek Cooldown)</span>
          </div>
          <div class="command-item">
            <code>!slots [20/30/50/100/all]</code>
            <span>Höhere Einsätze (benötigt Unlock)</span>
          </div>
          <div class="command-item">
            <code>!slots daily</code>
            <span>Täglicher Bonus (+50 DachsTaler)</span>
          </div>
          <div class="command-item">
            <code>!slots balance</code>
            <span>Kontostand & Free Spins anzeigen</span>
          </div>
          <div class="command-item">
            <code>!slots buffs</code>
            <span>Alle aktiven Buffs anzeigen</span>
          </div>
          <div class="command-item">
            <code>!slots lb / rank / ranking</code>
            <span>Top 5 Leaderboard</span>
          </div>
        </div>

        <h3>Shop & Transfer</h3>
        <div class="command-list">
          <div class="command-item">
            <code>!shop</code>
            <span>Shop-Link anzeigen</span>
          </div>
          <div class="command-item">
            <code>!shop buy [Nr]</code>
            <span>Item kaufen (z.B. !shop buy 38)</span>
          </div>
          <div class="command-item">
            <code>!transfer @user [Betrag]</code>
            <span>DachsTaler senden (1-100.000)</span>
          </div>
          <div class="command-item">
            <code>!transfer @dachsbank [Betrag]</code>
            <span>An Bank spenden</span>
          </div>
        </div>

        <h3>Website & Erfolge</h3>
        <div class="command-list">
          <div class="command-item">
            <code>!slots website / site / seite</code>
            <span>Link zur Dachsbau Slots Website</span>
          </div>
          <div class="command-item">
            <code>!slots erfolge / achievements</code>
            <span>Link zu deinen Erfolgen</span>
          </div>
          <div class="command-item">
            <code>!slots erfolge @user</code>
            <span>Link zu Erfolgen eines anderen Spielers</span>
          </div>
        </div>

        <h3>Weitere Commands</h3>
        <div class="command-list">
          <div class="command-item">
            <code>!slots stats</code>
            <span>Persönliche Statistiken (benötigt Stats Tracker #18)</span>
          </div>
          <div class="command-item">
            <code>!slots bank</code>
            <span>DachsBank Kontostand anzeigen</span>
          </div>
          <div class="command-item">
            <code>!slots info / help / commands</code>
            <span>Link zu dieser Seite</span>
          </div>
          <div class="command-item">
            <code>!slots disclaimer</code>
            <span>Glücksspiel-Warnung anzeigen</span>
          </div>
          <div class="command-item">
            <code>!slots selfban</code>
            <span>Selbstausschluss vom Spielen</span>
          </div>
        </div>

        <h3>Duell-Commands</h3>
        <div class="command-list">
          <div class="command-item">
            <code>!slots duel @user [Betrag]</code>
            <span>Fordere jemanden zum Duell heraus</span>
          </div>
          <div class="command-item">
            <code>!slots duelaccept</code>
            <span>Nimm eine Herausforderung an</span>
          </div>
          <div class="command-item">
            <code>!slots dueldecline</code>
            <span>Lehne eine Herausforderung ab</span>
          </div>
          <div class="command-item">
            <code>!slots duelopt out</code>
            <span>Duelle deaktivieren</span>
          </div>
          <div class="command-item">
            <code>!slots duelopt in</code>
            <span>Duelle wieder aktivieren</span>
          </div>
        </div>
      </section>

      <!-- Gewinne & Chancen -->
      <section id="gewinne" class="content-section">
        <h2>💎 Gewinne & Symbole</h2>
        <p class="section-intro">Je höher das Symbol in der Liste, desto wertvoller! Der Dachs ist das seltenste und wertvollste Symbol.</p>
        <div class="symbol-grid">
          <div class="symbol-card jackpot">
            <div class="symbol-icon">🦡</div>
            <div class="symbol-name">Dachs</div>
            <div class="symbol-rarity">JACKPOT</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🦡🦡🦡</span><span class="win-amount gold">15.000 DT</span></div>
              <div class="win-row"><span class="win-combo">🦡🦡</span><span class="win-amount">2.500 DT</span></div>
              <div class="win-row"><span class="win-combo">🦡</span><span class="win-amount">100 DT</span></div>
            </div>
          </div>
          <div class="symbol-card special">
            <div class="symbol-icon">💎</div>
            <div class="symbol-name">Diamant</div>
            <div class="symbol-rarity">FREE SPINS</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">💎💎💎</span><span class="win-amount">5 Free Spins</span></div>
              <div class="win-row"><span class="win-combo">💎💎</span><span class="win-amount">1 Free Spin</span></div>
            </div>
            <p class="symbol-note">Free Spins behalten den Multiplier!</p>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">⭐</div>
            <div class="symbol-name">Stern</div>
            <div class="symbol-rarity">Sehr selten</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">⭐⭐⭐</span><span class="win-amount">500 DT</span></div>
              <div class="win-row"><span class="win-combo">⭐⭐</span><span class="win-amount">50 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍉</div>
            <div class="symbol-name">Melone</div>
            <div class="symbol-rarity">Selten</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍉🍉🍉</span><span class="win-amount">250 DT</span></div>
              <div class="win-row"><span class="win-combo">🍉🍉</span><span class="win-amount">25 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍇</div>
            <div class="symbol-name">Trauben</div>
            <div class="symbol-rarity">Ungewöhnlich</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍇🍇🍇</span><span class="win-amount">150 DT</span></div>
              <div class="win-row"><span class="win-combo">🍇🍇</span><span class="win-amount">15 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍊</div>
            <div class="symbol-name">Orange</div>
            <div class="symbol-rarity">Gewöhnlich</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍊🍊🍊</span><span class="win-amount">100 DT</span></div>
              <div class="win-row"><span class="win-combo">🍊🍊</span><span class="win-amount">10 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍋</div>
            <div class="symbol-name">Zitrone</div>
            <div class="symbol-rarity">Gewöhnlich</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍋🍋🍋</span><span class="win-amount">75 DT</span></div>
              <div class="win-row"><span class="win-combo">🍋🍋</span><span class="win-amount">8 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍒</div>
            <div class="symbol-name">Kirsche</div>
            <div class="symbol-rarity">Häufig</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍒🍒🍒</span><span class="win-amount">50 DT</span></div>
              <div class="win-row"><span class="win-combo">🍒🍒</span><span class="win-amount">5 DT</span></div>
            </div>
          </div>
        </div>
        <p class="section-note"><strong>Beispiel:</strong> Triple-Dachs mit <code>!slots 100</code> = 15.000 × 10 = <strong>150.000 DachsTaler!</strong></p>

        <h3>🎲 Gewinnchancen</h3>
        <details class="faq-item">
          <summary>Alle Gewinnchancen anzeigen</summary>
          <div class="faq-content">
            <div class="chances-table">
              <div class="chances-row header">
                <span>Kombination</span>
                <span>Gewinn</span>
                <span>Chance</span>
              </div>
              <div class="chances-row jackpot-row">
                <span>🦡🦡🦡 Triple-Dachs</span>
                <span class="gold">15.000 DT</span>
                <span>~1 in 140.000</span>
              </div>
              <div class="chances-row">
                <span>🦡🦡 Doppel-Dachs</span>
                <span>2.500 DT</span>
                <span>~1 in 5.000</span>
              </div>
              <div class="chances-row">
                <span>🦡 Einzel-Dachs</span>
                <span>100 DT</span>
                <span>~1 in 50</span>
              </div>
              <div class="chances-row special-row">
                <span>💎💎💎 Triple-Diamant</span>
                <span>5 Free Spins</span>
                <span>~1 in 740</span>
              </div>
              <div class="chances-row">
                <span>💎💎 Doppel-Diamant</span>
                <span>1 Free Spin</span>
                <span>~1 in 34</span>
              </div>
              <div class="chances-row fruit-row">
                <span>⭐⭐⭐ Triple-Stern</span>
                <span>500 DT</span>
                <span>~1 in 1.728</span>
              </div>
              <div class="chances-row">
                <span>⭐⭐ Doppel-Stern</span>
                <span>50 DT</span>
                <span>~1 in 144</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍉🍉🍉 Triple-Melone</span>
                <span>250 DT</span>
                <span>~1 in 1.331</span>
              </div>
              <div class="chances-row">
                <span>🍉🍉 Doppel-Melone</span>
                <span>25 DT</span>
                <span>~1 in 100</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍇🍇🍇 Triple-Trauben</span>
                <span>150 DT</span>
                <span>~1 in 512</span>
              </div>
              <div class="chances-row">
                <span>🍇🍇 Doppel-Trauben</span>
                <span>15 DT</span>
                <span>~1 in 53</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍊🍊🍊 Triple-Orange</span>
                <span>100 DT</span>
                <span>~1 in 248</span>
              </div>
              <div class="chances-row">
                <span>🍊🍊 Doppel-Orange</span>
                <span>10 DT</span>
                <span>~1 in 40</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍋🍋🍋 Triple-Zitrone</span>
                <span>75 DT</span>
                <span>~1 in 216</span>
              </div>
              <div class="chances-row">
                <span>🍋🍋 Doppel-Zitrone</span>
                <span>8 DT</span>
                <span>~1 in 36</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍒🍒🍒 Triple-Kirsche</span>
                <span>50 DT</span>
                <span>~1 in 125</span>
              </div>
              <div class="chances-row">
                <span>🍒🍒 Doppel-Kirsche</span>
                <span>5 DT</span>
                <span>~1 in 25</span>
              </div>
            </div>
          </div>
        </details>
      </section>

      <!-- Multiplier-System -->
      <section id="multiplier" class="content-section">
        <h2>📈 Multiplier-System</h2>

        <h3>🔥 Streak-Multiplier (Kostenlos!)</h3>
        <p>Jeder Gewinn in Folge erhöht deinen Multiplier automatisch:</p>
        <div class="streak-table">
          <div class="streak-row header">
            <span>Wins</span>
            <span>Multiplier</span>
            <span>Boost</span>
          </div>
          <div class="streak-row">
            <span>1</span>
            <span>1.0×</span>
            <span>—</span>
          </div>
          <div class="streak-row">
            <span>2</span>
            <span>1.1×</span>
            <span>+10%</span>
          </div>
          <div class="streak-row">
            <span>5</span>
            <span>1.4×</span>
            <span>+40%</span>
          </div>
          <div class="streak-row hot">
            <span>10</span>
            <span>2.0×</span>
            <span>+100% 🔥</span>
          </div>
          <div class="streak-row hot">
            <span>20+</span>
            <span>3.0×</span>
            <span>+200% ✨</span>
          </div>
        </div>
        <p class="section-warning">⚠️ Bei Verlust: Reset auf 1.0×</p>
      </section>

      <!-- Bonus-Systeme -->
      <section id="bonus" class="content-section">
        <h2>🎁 Bonus-Systeme</h2>

        <h3>📅 Monthly Login</h3>
        <p>Sammle Login-Tage im Monat (keine Streak nötig!):</p>
        <div class="bonus-table">
          <div class="bonus-row header">
            <span>Tage</span>
            <span>Bonus</span>
            <span>Gesamt</span>
          </div>
          <div class="bonus-row">
            <span>1</span>
            <span>+50 DT</span>
            <span>100 DT</span>
          </div>
          <div class="bonus-row">
            <span>5</span>
            <span>+150 DT</span>
            <span>400 DT</span>
          </div>
          <div class="bonus-row">
            <span>10</span>
            <span>+400 DT</span>
            <span>950 DT</span>
          </div>
          <div class="bonus-row">
            <span>15</span>
            <span>+750 DT</span>
            <span>1.700 DT</span>
          </div>
          <div class="bonus-row highlight">
            <span>20</span>
            <span>+1.500 DT</span>
            <span><strong>3.250 DT</strong> 🎉</span>
          </div>
        </div>

        <h3>🔥 Combo-Boni</h3>
        <p>Gewinne in Folge geben extra Boni:</p>
        <div class="combo-list">
          <div class="combo-item">
            <span class="combo-wins">2 Wins</span>
            <span class="combo-bonus">+10 DT</span>
          </div>
          <div class="combo-item">
            <span class="combo-wins">3 Wins</span>
            <span class="combo-bonus">+30 DT</span>
          </div>
          <div class="combo-item">
            <span class="combo-wins">4 Wins</span>
            <span class="combo-bonus">+100 DT</span>
          </div>
          <div class="combo-item hot">
            <span class="combo-wins">5 Wins</span>
            <span class="combo-bonus">+500 DT (Hot Streak!) 🔥</span>
          </div>
        </div>

        <h3>Weitere Boni</h3>
        <div class="bonus-cards">
          <div class="bonus-card">
            <span class="bonus-icon">👑</span>
            <div class="bonus-info">
              <strong>Comeback King</strong>
              <p>Nach 5+ Verlusten gewinnen = +150 DT</p>
            </div>
          </div>
          <div class="bonus-card">
            <span class="bonus-icon">⏰</span>
            <div class="bonus-info">
              <strong>Hourly Jackpot</strong>
              <p>Zufällige "Lucky Second" pro Stunde = +100 DT</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Duell-System -->
      <section id="duell" class="content-section">
        <h2>⚔️ Duell-System</h2>
        <p class="section-intro">Fordere andere Spieler zum direkten Slot-Duell heraus!</p>

        <h3>So funktioniert's</h3>
        <div class="duel-steps">
          <div class="duel-step">
            <span class="step-number">1</span>
            <div class="step-content">
              <strong>Herausfordern</strong>
              <code>!slots duel @spieler 500</code>
              <p>Du forderst @spieler zu einem Duell um 500 DT heraus.</p>
            </div>
          </div>
          <div class="duel-step">
            <span class="step-number">2</span>
            <div class="step-content">
              <strong>Annehmen oder Ablehnen</strong>
              <p>Der herausgeforderte Spieler hat <strong>60 Sekunden</strong> Zeit:</p>
              <code>!slots duelaccept</code> oder <code>!slots dueldecline</code>
            </div>
          </div>
          <div class="duel-step">
            <span class="step-number">3</span>
            <div class="step-content">
              <strong>Duell-Ablauf</strong>
              <p>Beide Spieler spinnen gleichzeitig – ohne Buffs, ohne Items. Ein faires 1v1!</p>
            </div>
          </div>
        </div>

        <h3>Regeln</h3>
        <div class="command-list compact">
          <div class="command-item">
            <span>Mindesteinsatz</span>
            <span>100 DachsTaler</span>
          </div>
          <div class="command-item">
            <span>Maximaleinsatz</span>
            <span>Unbegrenzt (beide müssen genug haben)</span>
          </div>
          <div class="command-item">
            <span>Buffs/Items</span>
            <span>Deaktiviert – faire Kämpfe!</span>
          </div>
          <div class="command-item">
            <span>Timeout</span>
            <span>60 Sekunden zum Antworten</span>
          </div>
          <div class="command-item">
            <span>Limit</span>
            <span>Eine aktive Herausforderung pro Spieler</span>
          </div>
        </div>

        <h3>Wer gewinnt?</h3>
        <div class="duel-win-order">
          <div class="win-tier">
            <span class="tier-medal">🥇</span>
            <div>
              <strong>Triple</strong>
              <p>3 gleiche Symbole schlägt alles</p>
            </div>
          </div>
          <div class="win-tier">
            <span class="tier-medal">🥈</span>
            <div>
              <strong>Paar</strong>
              <p>2 gleiche Symbole schlägt Einzelne</p>
            </div>
          </div>
          <div class="win-tier">
            <span class="tier-medal">🥉</span>
            <div>
              <strong>Punkte</strong>
              <p>Bei Gleichstand zählt die Symbolsumme</p>
            </div>
          </div>
        </div>

        <h3>Symbol-Werte für Tiebreaker</h3>
        <div class="symbol-values">
          <span class="symbol-value"><span>🦡</span> 500</span>
          <span class="symbol-value"><span>💎</span> 100</span>
          <span class="symbol-value"><span>⭐</span> 25</span>
          <span class="symbol-value"><span>🍉</span> 13</span>
          <span class="symbol-value"><span>🍇</span> 8</span>
          <span class="symbol-value"><span>🍊</span> 5</span>
          <span class="symbol-value"><span>🍋</span> 4</span>
          <span class="symbol-value"><span>🍒</span> 3</span>
        </div>
        <p class="section-note"><strong>Beispiel:</strong> [ 🍒 🍉 ⭐ ] = 3 + 13 + 25 = <strong>41 Punkte</strong></p>

        <h3>Tipps</h3>
        <div class="tip-list">
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <p><strong>Kein Risiko:</strong> Dein Einsatz wird erst abgezogen wenn das Duell stattfindet</p>
          </div>
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <p><strong>Fair:</strong> Beide müssen den Betrag haben, sonst kein Duell</p>
          </div>
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <p><strong>Opt-Out:</strong> Mit <code>!slots duelopt out</code> keine Herausforderungen mehr</p>
          </div>
        </div>
      </section>

      <!-- DachsBank -->
      <section id="bank" class="content-section">
        <h2>🏦 DachsBank</h2>
        <p class="section-intro">Die DachsBank trackt die gesamte Casino-Ökonomie.</p>

        <div class="bank-grid">
          <div class="bank-card income">
            <h4>Bank erhält</h4>
            <ul>
              <li>✅ Jeden Spin-Einsatz</li>
              <li>✅ Jeden Shop-Kauf</li>
              <li>✅ Spenden von Spielern</li>
            </ul>
          </div>
          <div class="bank-card expense">
            <h4>Bank zahlt</h4>
            <ul>
              <li>✅ Jeden Gewinn</li>
              <li>✅ Alle Boni</li>
            </ul>
          </div>
        </div>

        <h3>Commands</h3>
        <div class="command-list compact">
          <div class="command-item">
            <code>!slots bank</code>
            <span>Kontostand anzeigen</span>
          </div>
          <div class="command-item">
            <code>!transfer @dachsbank [Betrag]</code>
            <span>Spenden</span>
          </div>
        </div>
        <p class="section-note"><strong>Startguthaben:</strong> 444.444 DachsTaler • Kann ins Minus gehen!</p>
      </section>

      <!-- FAQ -->
      <section id="faq" class="content-section">
        <h2>❓ FAQ</h2>

        <details class="faq-item">
          <summary>💰 Wie bekomme ich mehr DachsTaler?</summary>
          <div class="faq-content">
            <ol>
              <li>🎰 <strong>Gewinnen</strong> – Spiele und gewinne!</li>
              <li>🎁 <strong>Daily</strong> – <code>!slots daily</code> (+50 DT alle 24h)</li>
              <li>📅 <strong>Monthly Login</strong> – Bis zu 3.250 DT/Monat</li>
              <li>💸 <strong>Transfer</strong> – Andere Spieler können dir DT senden</li>
              <li>🎯 <strong>Boni</strong> – Combo, Hot Streak, Comeback King</li>
            </ol>
            <p><strong>Bei 0 DachsTaler?</strong> Warte auf Daily oder bitte um Transfer.</p>
          </div>
        </details>

        <details class="faq-item">
          <summary>🎰 Was sind Free Spins?</summary>
          <div class="faq-content">
            <p>Kostenlose Spins die du durch 💎💎 oder 💎💎💎 gewinnst.</p>
            <p><strong>Besonderheit:</strong> Free Spins behalten den Multiplier!</p>
            <p><strong>Beispiel:</strong> <code>!slots 100</code> → 💎💎💎 → 5 Free Spins mit je <strong>10× Multiplier</strong></p>
            <p>Werden automatisch beim nächsten <code>!slots</code> genutzt.</p>
          </div>
        </details>

        <details class="faq-item">
          <summary>🔓 Wie schalte ich höhere Einsätze frei?</summary>
          <div class="faq-content">
            <p>Im Shop kaufen! Reihenfolge:</p>
            <p><code>!shop buy 13</code> (20) → <code>!shop buy 19</code> (30) → <code>!shop buy 21</code> (50) → <code>!shop buy 23</code> (100) → <code>!shop buy 25</code> (all)</p>
            <p><strong>Gesamt:</strong> 12.694 DachsTaler</p>
          </div>
        </details>

        <details class="faq-item">
          <summary>📊 Wie sehe ich meine Stats?</summary>
          <div class="faq-content">
            <ol>
              <li><strong>Kaufen:</strong> <code>!shop buy 18</code> (1.250 DT)</li>
              <li><strong>Nutzen:</strong> <code>!slots stats</code></li>
            </ol>
            <p>Zeigt: Spins, Win-Rate, Biggest Win, Total Won/Lost</p>
          </div>
        </details>

        <details class="faq-item">
          <summary>🔥 Was ist der Unterschied: Buffs vs Boosts?</summary>
          <div class="faq-content">
            <p><strong>Buffs</strong> = Zeitbasiert (z.B. 1 Stunde)</p>
            <ul>
              <li>Happy Hour, Profit Doubler, Rage Mode...</li>
              <li>Siehe mit <code>!slots buffs</code></li>
            </ul>
            <p><strong>Boosts</strong> = Einmalig pro Symbol</p>
            <ul>
              <li>🍒🍋🍊🍇🍉⭐🦡 Boosts (50–150 DT)</li>
              <li>Wird beim nächsten Gewinn verbraucht</li>
            </ul>
            <p><strong>Beide kombinierbar!</strong></p>
          </div>
        </details>

        <details class="faq-item">
          <summary>🃏 Wie funktioniert die Wild Card?</summary>
          <div class="faq-content">
            <p><code>!shop buy 38</code> (250 DT) → Nächster Spin enthält 🃏</p>
            <p>Das Wild ersetzt <strong>jedes Symbol</strong> für den besten Outcome:</p>
            <ul>
              <li><code>🦡 🃏 🦡</code> = Triple-Dachs (15.000 DT!)</li>
              <li><code>🍒 🃏 🍒</code> = Triple-Kirsche (50 DT)</li>
            </ul>
            <p>⚠️ Wild zählt <strong>nicht</strong> für 💎 Free Spins</p>
          </div>
        </details>
      </section>

      <!-- Hilfe -->
      <section id="hilfe" class="content-section">
        <h2>📞 Hilfe bei Glücksspielproblemen</h2>
        <div class="help-table">
          <div class="help-row">
            <span>🇩🇪 Deutschland</span>
            <span>0800 - 1 37 27 00</span>
            <a href="https://check-dein-spiel.de" target="_blank" rel="noopener">check-dein-spiel.de</a>
          </div>
          <div class="help-row">
            <span>🇦🇹 Österreich</span>
            <span>0800 - 20 20 11</span>
            <a href="https://spielsuchthilfe.at" target="_blank" rel="noopener">spielsuchthilfe.at</a>
          </div>
          <div class="help-row">
            <span>🇨🇭 Schweiz</span>
            <span>0800 - 040 080</span>
            <a href="https://sos-spielsucht.ch" target="_blank" rel="noopener">sos-spielsucht.ch</a>
          </div>
        </div>

        <h3>🚫 Selbstausschluss (Selfban)</h3>
        <div class="selfban-info">
          <code>!slots selfban</code>
          <p>Du wirst sofort vom Spielen ausgeschlossen. <strong>Nur Admins</strong> (exaint_, frechhdachs) können dich wieder freischalten. Der Zeitpunkt wird gespeichert.</p>
        </div>
      </section>
    </div>
  `;

  return baseTemplate('Info & Commands', content, 'info', user);
}

/**
 * Shop page
 */
// Item descriptions for shop
const ITEM_DESCRIPTIONS = {
  1: 'Zeigt dir das nächste Symbol bevor du spinnst',
  2: 'Erhöht die Chance auf 🍒 Kirschen für den nächsten Spin',
  3: 'Erhöht die Chance auf 🍋 Zitronen für den nächsten Spin',
  4: 'Erhöht die Chance auf 🍊 Orangen für den nächsten Spin',
  5: 'Erhöht die Chance auf 🍇 Trauben für den nächsten Spin',
  6: 'Erhöht die Chance auf 🍉 Wassermelonen für den nächsten Spin',
  7: 'Erhöht die Chance auf ⭐ Sterne für den nächsten Spin',
  8: 'Erhöht die Chance auf 🦡 Dachs für den nächsten Spin (1x/Woche)',
  9: '3x Versicherung: Bei Verlust bekommst du deinen Einsatz zurück',
  10: '3x Gewinn-Multiplikator: Verdoppelt deinen nächsten Gewinn',
  11: 'Mischt alle Symbole zufällig durch - alles kann passieren!',
  12: 'Drehe das Glücksrad für zufällige Preise von 10-1000 DT',
  13: 'Schaltet !slots 20 frei - setze bis zu 20 DT pro Spin',
  14: '1 Stunde lang +50% auf alle Gewinne',
  15: '10 Spins zum Preis von 9 (1x/Woche, max 3x)',
  16: 'Öffne eine Mystery Box mit zufälligem Inhalt',
  17: 'Bronze Prestige-Rang mit 🥉 Badge',
  18: 'Schaltet !slots stats frei - tracke deine Statistiken',
  19: 'Schaltet !slots 30 frei - setze bis zu 30 DT pro Spin',
  20: '1 Stunde lang höhere Chance auf seltene Symbole',
  21: 'Schaltet !slots 50 frei - setze bis zu 50 DT pro Spin',
  22: 'Silber Prestige-Rang mit 🥈 Badge',
  23: 'Schaltet !slots 100 frei - setze bis zu 100 DT pro Spin',
  24: '1 Stunde lang +100% auf alle Gewinne',
  25: 'Schaltet !slots all frei - setze alles auf einen Spin',
  26: 'Gold Prestige-Rang mit 🥇 Badge',
  27: 'Permanenter Bonus auf tägliche Belohnungen',
  28: 'Eigene Gewinn-Nachricht bei großen Wins',
  29: 'Diamant Prestige-Rang mit 💎 Badge',
  30: 'Legendärer Prestige-Rang mit 👑 Badge',
  31: 'Kehrt den letzten Chaos Spin um',
  32: '1 Stunde lang erhöhte ⭐ Stern-Chance',
  33: '10 Spins mit erhöhter 🦡 Dachs-Chance',
  34: '30 Minuten Rage Mode: Höhere Gewinne, aber auch Verluste',
  35: '24 Stunden lang werden alle Gewinne verdoppelt',
  36: 'Sofortiger Bonus basierend auf deiner Spin-Anzahl',
  37: 'Garantiert mindestens ein Paar beim nächsten Spin',
  38: 'Ersetzt ein Symbol durch Wild 🃏 (zählt als jedes Symbol)',
  39: '1 Stunde lang erhöhte 💎 Diamant-Chance für Free Spins'
};

// Item icons for shop
const ITEM_ICONS = {
  1: '👁️', 2: '🍒', 3: '🍋', 4: '🍊', 5: '🍇', 6: '🍉', 7: '⭐', 8: '🦡',
  9: '🛡️', 10: '✖️', 11: '🌀', 12: '🎡', 13: '🔓', 14: '🎉', 15: '📦',
  16: '🎁', 17: '🥉', 18: '📊', 19: '🔓', 20: '🍀', 21: '🔓', 22: '🥈',
  23: '🔓', 24: '✨', 25: '🔓', 26: '🥇', 27: '💰', 28: '💬', 29: '💎',
  30: '👑', 31: '🔄', 32: '🌟', 33: '🦡', 34: '<img src="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Rage.png" alt="Rage Mode" class="shop-item-img">', 35: '📈', 36: '💎',
  37: '🎯', 38: '🃏', 39: '💎'
};

async function renderShopPage(env, user = null) {
  // If user is logged in, fetch their balance, unlocks and prestige rank
  let userBalanceHtml = '';
  let userUnlocks = new Set();
  let userPrestigeRank = null;
  let userBalance = 0;

  if (user) {
    // Fetch all user data in parallel
    const unlockKeys = ['slots_20', 'slots_30', 'slots_50', 'slots_100', 'slots_all', 'stats_tracker', 'daily_boost', 'custom_message'];
    const [balance, prestigeRank, ...unlockResults] = await Promise.all([
      getBalance(user.username, env),
      getPrestigeRank(user.username, env),
      ...unlockKeys.map(key => hasUnlock(user.username, key, env))
    ]);

    // Build set of owned unlocks
    unlockKeys.forEach((key, index) => {
      if (unlockResults[index]) userUnlocks.add(key);
    });
    userPrestigeRank = prestigeRank;
    userBalance = balance;

    userBalanceHtml = `
      <div class="shop-user-info">
        <div class="shop-user-balance">
          <span class="balance-label">Dein Kontostand:</span>
          <span class="balance-value" id="userBalance">${formatNumber(balance)} DT</span>
        </div>
        <a href="?page=profile&user=${encodeURIComponent(user.username)}" class="btn btn-secondary">Mein Profil</a>
      </div>
      <div id="purchaseFeedback" class="purchase-feedback"></div>
    `;
  } else {
    userBalanceHtml = `
      <div class="shop-login-prompt">
        <a href="/auth/login" class="btn-twitch-login">
          <svg viewBox="0 0 256 268" class="twitch-icon" width="16" height="16">
            <path fill="currentColor" d="M17.458 0L0 46.556v186.2h63.983v34.934h34.931l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.617H128L93.113 226.5v-34.91H40.717V23.263zm69.4 106.292h23.24V58.325h-23.24v71.23zm63.986 0h23.24V58.325h-23.24v71.23z"/>
          </svg>
          <span>Mit Twitch einloggen um deinen Kontostand zu sehen</span>
        </a>
      </div>
    `;
  }

  // Group items by category
  const categories = {
    boosts: { title: 'Symbol-Boosts', icon: '🎰', desc: 'Erhöhe die Chance auf bestimmte Symbole', items: [] },
    instant: { title: 'Sofort-Items', icon: '⚡', desc: 'Einmalige Effekte die sofort wirken', items: [] },
    timed: { title: 'Timed Buffs', icon: '⏰', desc: 'Zeitlich begrenzte Boni', items: [] },
    unlocks: { title: 'Freischaltungen', icon: '🔓', desc: 'Schalte neue Features dauerhaft frei', items: [] },
    prestige: { title: 'Prestige-Ränge', icon: '👑', desc: 'Zeige deinen Status mit exklusiven Badges', items: [] }
  };

  Object.entries(SHOP_ITEMS).forEach(([id, item]) => {
    const numId = parseInt(id, 10);
    const itemData = { id: numId, ...item };

    if (item.type === 'boost') {
      categories.boosts.items.push(itemData);
    } else if (item.type === 'prestige') {
      categories.prestige.items.push(itemData);
    } else if (item.type === 'unlock') {
      categories.unlocks.items.push(itemData);
    } else if (item.type === 'timed') {
      categories.timed.items.push(itemData);
    } else {
      categories.instant.items.push(itemData);
    }
  });

  // Prestige rank hierarchy for checking owned status
  const RANK_HIERARCHY = ['🥉', '🥈', '🥇', '💎', '👑'];

  const renderCategory = (cat) => {
    if (cat.items.length === 0) return '';

    // Sort items by price
    cat.items.sort((a, b) => a.price - b.price);

    const itemsHtml = cat.items.map(item => {
      const icon = ITEM_ICONS[item.id] || '📦';
      const desc = ITEM_DESCRIPTIONS[item.id] || '';
      const requiresHtml = item.requires ? `<span class="shop-item-requires">Benötigt: ${item.requires.replace('slots_', '!slots ')}</span>` : '';
      const requiresRankHtml = item.requiresRank ? `<span class="shop-item-requires">Benötigt: ${item.requiresRank}</span>` : '';
      const weeklyHtml = item.weeklyLimit ? '<span class="shop-item-limit">1x/Woche</span>' : '';

      // Check if user owns this item (only for unlocks and prestige)
      let isOwned = false;
      if (user && item.type === 'unlock' && item.unlockKey) {
        isOwned = userUnlocks.has(item.unlockKey);
      } else if (user && item.type === 'prestige' && item.rank && userPrestigeRank) {
        // User owns this rank if their current rank is >= this item's rank
        const userRankIndex = RANK_HIERARCHY.indexOf(userPrestigeRank);
        const itemRankIndex = RANK_HIERARCHY.indexOf(item.rank);
        isOwned = userRankIndex >= itemRankIndex && itemRankIndex !== -1;
      }

      const ownedBadge = isOwned ? '<span class="shop-item-owned">✓ Gekauft</span>' : '';
      const ownedClass = isOwned ? ' shop-item-is-owned' : '';

      // Web purchase button (only for logged-in users and web-purchasable items)
      let buyButtonHtml = '';
      if (user && isWebPurchasable(item.id) && !isOwned) {
        const canAfford = userBalance >= item.price;
        const disabledAttr = canAfford ? '' : ' disabled';
        const disabledTitle = canAfford ? '' : ` title="Nicht genug DachsTaler"`;
        buyButtonHtml = `
          <button class="btn-buy${canAfford ? '' : ' btn-buy-disabled'}"${disabledAttr}${disabledTitle}
            onclick="buyItem(${item.id}, '${escapeHtml(item.name)}', ${item.price})">
            Kaufen
          </button>
        `;
      } else if (user && !isWebPurchasable(item.id) && !isOwned) {
        buyButtonHtml = `<span class="shop-item-chat-only" title="Dieses Item kann nur im Chat gekauft werden">Nur Chat</span>`;
      }

      return `
        <div class="shop-item${ownedClass}" data-item-id="${item.id}">
          <div class="shop-item-icon">${icon}</div>
          <div class="shop-item-content">
            <div class="shop-item-header">
              <span class="shop-item-name">${escapeHtml(item.name)}</span>
              ${ownedBadge}
              <span class="shop-item-price">${formatNumber(item.price)} DT</span>
            </div>
            <div class="shop-item-desc">${desc}</div>
            <div class="shop-item-meta">
              <code class="shop-item-cmd">!shop buy ${item.id}</code>
              ${requiresHtml}${requiresRankHtml}${weeklyHtml}
              ${buyButtonHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="shop-category">
        <div class="shop-category-header">
          <h3 class="shop-category-title">${cat.icon} ${cat.title}</h3>
          <p class="shop-category-desc">${cat.desc}</p>
        </div>
        <div class="shop-items">
          ${itemsHtml}
        </div>
      </div>
    `;
  };

  const content = `
    <div class="content-page">
      <h1 class="page-title">🛒 Shop</h1>
      <p class="page-subtitle">Kaufe Items mit <code>!shop buy [Nummer]</code> im Twitch Chat</p>

      ${userBalanceHtml}

      <!-- Inhaltsverzeichnis -->
      <nav class="info-toc shop-toc" aria-label="Shop-Navigation">
        <div class="toc-grid">
          <a href="#kaufanleitung" class="toc-item">📋 Kaufanleitung</a>
          <a href="#boosts" class="toc-item">🎰 Symbol-Boosts</a>
          <a href="#instant" class="toc-item">⚡ Sofort-Items</a>
          <a href="#timed" class="toc-item">⏰ Timed Buffs</a>
          <a href="#unlocks" class="toc-item">🔓 Freischaltungen</a>
          <a href="#prestige" class="toc-item">👑 Prestige-Ränge</a>
          <a href="#combos" class="toc-item">💡 Buff-Kombinationen</a>
          <a href="#guide" class="toc-item">📈 Investment-Guide</a>
        </div>
      </nav>

      <!-- Kaufanleitung -->
      <section id="kaufanleitung" class="content-section">
        <h2>📋 Kaufanleitung</h2>
        <div class="duel-steps">
          <div class="duel-step">
            <span class="step-number">1</span>
            <div class="step-content">
              <strong>Item auswählen</strong>
              <p>Schau dir die Shop-Liste an und finde das passende Item.</p>
            </div>
          </div>
          <div class="duel-step">
            <span class="step-number">2</span>
            <div class="step-content">
              <strong>Nummer notieren</strong>
              <p>Jedes Item hat eine eindeutige Nummer (z.B. #38 für Wild Card).</p>
            </div>
          </div>
          <div class="duel-step">
            <span class="step-number">3</span>
            <div class="step-content">
              <strong>Im Chat kaufen</strong>
              <code>!shop buy [Nummer]</code>
              <p>Beispiel: <code>!shop buy 38</code> kauft die Wild Card.</p>
            </div>
          </div>
        </div>
        <div class="tip-list">
          <div class="tip-item">
            <span class="tip-icon">ℹ️</span>
            <div>
              <strong>Wichtige Infos</strong>
              <p>• Einige Items sind einmalig (Unlocks & Prestige)<br>
              • Timed Buffs laufen nach Kauf-Zeitpunkt ab<br>
              • Spin Bundle: Max 3x/Woche (Reset: Montag 00:00 UTC)<br>
              • Dachs-Boost: Max 1x/Woche (Reset: Montag 00:00 UTC)</p>
            </div>
          </div>
        </div>
      </section>

      <div id="boosts">${renderCategory(categories.boosts)}</div>
      <div class="section-note shop-pro-tip">
        💡 <strong>Pro-Tipp:</strong> Kombiniere Boosts mit hohen Multipliers für massive Gewinne!<br>
        <strong>Beispiel:</strong> 🦡 Dachs-Boost + <code>!slots 100</code> = bis zu 300.000 DT möglich! (15.000 × 2 × 10)
      </div>

      <div id="instant">${renderCategory(categories.instant)}</div>
      <div class="section-note shop-pro-tip">
        💡 <strong>Pro-Tipp:</strong> Peek Token ist perfekt um zu testen ob Lucky Charm oder andere Buffs wirken!
      </div>

      <div id="timed">${renderCategory(categories.timed)}</div>

      <div id="unlocks">${renderCategory(categories.unlocks)}</div>

      <div id="prestige">${renderCategory(categories.prestige)}</div>
      <div class="section-note">
        <strong>🏆 Prestige-Progression:</strong><br>
        🥉 Bronze (1.200 DT) → 🥈 Silber (+3.000 = 4.200 DT) → 🥇 Gold (+8.000 = 12.200 DT) → 💎 Platin (+25.000 = 37.200 DT) → 👑 Legendary (+44.444 = <strong>81.644 DT</strong>)
      </div>

      <!-- Buff-Kombinationen -->
      <section id="combos" class="content-section">
        <h2>💡 Buff-Kombinationen</h2>
        <p class="section-intro">Diese Kombinationen sind besonders effektiv:</p>
        <div class="combo-cards">
          <div class="combo-card">
            <div class="combo-card-title">🌟 + 🌅 Stern-Combo</div>
            <div class="combo-card-items">Star Magnet + Golden Hour</div>
            <div class="combo-card-effect">Massive Stern-Gewinne mit +30% Bonus!</div>
          </div>
          <div class="combo-card">
            <div class="combo-card-title">🦡 + 🍀 Dachs-Hunter</div>
            <div class="combo-card-items">Dachs Locator + Lucky Charm</div>
            <div class="combo-card-effect">6× Dachs-Chance! (Insane Combo!)</div>
          </div>
          <div class="combo-card">
            <div class="combo-card-title">💎 + 📈 Free Spin Master</div>
            <div class="combo-card-items">Diamond Rush + Profit Doubler</div>
            <div class="combo-card-effect">Mehr Free Spins + doppelte Gewinne!</div>
          </div>
        </div>
      </section>

      <!-- Investment-Guide -->
      <section id="guide" class="content-section">
        <h2>📈 Investment-Guide</h2>
        <p class="section-intro">Empfohlene Kauf-Reihenfolge für maximalen Nutzen:</p>
        <div class="investment-guide">
          <div class="investment-tier">
            <span class="tier-label">🌱 Start</span>
            <div class="tier-content">
              <strong>Stats Tracker (#18)</strong> - 1.250 DT
              <p>Verfolge deinen Fortschritt von Anfang an!</p>
            </div>
          </div>
          <div class="investment-tier">
            <span class="tier-label">🌿 Early Game</span>
            <div class="tier-content">
              <strong>!slots 20 & 30 (#13, #19)</strong> - 2.500 DT gesamt
              <p>2×-3× Gewinne - der erste große Sprung!</p>
            </div>
          </div>
          <div class="investment-tier">
            <span class="tier-label">🌳 Mid Game</span>
            <div class="tier-content">
              <strong>!slots 50 & 100 (#21, #23)</strong> - 5.750 DT gesamt
              <p>5×-10× Gewinne - jetzt wird's interessant!</p>
            </div>
          </div>
          <div class="investment-tier">
            <span class="tier-label">🔥 End Game</span>
            <div class="tier-content">
              <strong>!slots all (#25)</strong> - 4.444 DT
              <p>All-In Power - für die mutigen Spieler!</p>
            </div>
          </div>
          <div class="investment-tier">
            <span class="tier-label">👑 Late Game</span>
            <div class="tier-content">
              <strong>Daily Boost (#27)</strong> - 10.000 DT
              <p>5× Daily Bonus - passives Einkommen!</p>
            </div>
          </div>
        </div>
        <p class="section-note"><strong>Gesamt-Kosten alle Multiplier-Unlocks:</strong> 12.694 DachsTaler</p>
      </section>
    </div>
  `;

  return baseTemplate('Shop', content, 'shop', user);
}

/**
 * Global Statistics page handler
 */
async function handleGlobalStatsPage(env, loggedInUser = null) {
  // Fetch achievement stats and player data
  const achievementStats = await getAchievementStats(env);
  const { totalPlayers, counts } = achievementStats;

  // Get all achievements
  const allAchievements = getAllAchievements();

  // Calculate total achievements unlocked
  const totalUnlocked = Object.values(counts).reduce((sum, count) => sum + count, 0);

  // Find rarest and most common achievements
  const achievementsWithCounts = allAchievements.map(ach => ({
    ...ach,
    count: counts[ach.id] || 0,
    percent: totalPlayers > 0 ? Math.round((counts[ach.id] || 0) / totalPlayers * 100) : 0
  }));

  // Sort by rarity (ascending count = rarer)
  const rarestAchievements = [...achievementsWithCounts]
    .filter(a => a.count > 0)
    .sort((a, b) => a.count - b.count)
    .slice(0, 5);

  const mostCommonAchievements = [...achievementsWithCounts]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return htmlResponse(renderGlobalStatsPage({
    totalPlayers,
    totalAchievements: allAchievements.length,
    totalUnlocked,
    rarestAchievements,
    mostCommonAchievements,
    achievementsWithCounts
  }, loggedInUser));
}

/**
 * Global Statistics page renderer
 */
function renderGlobalStatsPage(data, user = null) {
  const { totalPlayers, totalAchievements, totalUnlocked, rarestAchievements, mostCommonAchievements, achievementsWithCounts } = data;

  const avgAchievementsPerPlayer = totalPlayers > 0 ? (totalUnlocked / totalPlayers).toFixed(1) : 0;

  // Rarest achievements HTML (with description)
  const rarestHtml = rarestAchievements.map((ach, index) => `
    <div class="stat-achievement">
      <span class="stat-rank">#${index + 1}</span>
      <div class="stat-ach-info">
        <span class="stat-ach-name">${escapeHtml(ach.name)}</span>
        <span class="stat-ach-desc">${escapeHtml(ach.description)}</span>
      </div>
      <span class="stat-ach-count">${ach.count} Spieler (${ach.percent}%)</span>
    </div>
  `).join('');

  // Most common achievements HTML (with description)
  const commonHtml = mostCommonAchievements.map((ach, index) => `
    <div class="stat-achievement">
      <span class="stat-rank">#${index + 1}</span>
      <div class="stat-ach-info">
        <span class="stat-ach-name">${escapeHtml(ach.name)}</span>
        <span class="stat-ach-desc">${escapeHtml(ach.description)}</span>
      </div>
      <span class="stat-ach-count">${ach.count} Spieler (${ach.percent}%)</span>
    </div>
  `).join('');

  // Category breakdown
  const categoryStats = {};
  for (const cat of Object.values(ACHIEVEMENT_CATEGORIES)) {
    const catAchievements = achievementsWithCounts.filter(a => a.category === cat);
    const catUnlocked = catAchievements.reduce((sum, a) => sum + a.count, 0);
    categoryStats[cat] = {
      total: catAchievements.length,
      unlocked: catUnlocked,
      avgPercent: catAchievements.length > 0 && totalPlayers > 0
        ? Math.round(catUnlocked / (catAchievements.length * totalPlayers) * 100)
        : 0
    };
  }

  const categoryHtml = Object.entries(categoryStats).map(([cat, stats]) => `
    <div class="stat-category">
      <span class="stat-cat-icon">${CATEGORY_ICONS[cat] || '🎯'}</span>
      <span class="stat-cat-name">${CATEGORY_NAMES[cat] || cat}</span>
      <span class="stat-cat-value">${stats.avgPercent}% durchschnittlich</span>
    </div>
  `).join('');

  // Profile link for logged-in users
  const profileLinkHtml = user ? `
    <div class="stats-profile-link">
      <a href="/?page=profile&user=${encodeURIComponent(user.username)}" class="btn btn-primary">
        🏆 Meine Erfolge anzeigen
      </a>
    </div>
  ` : '';

  const content = `
    <div class="content-page">
      <h1 class="page-title">📊 Globale Statistiken</h1>
      <p class="page-subtitle">Übersicht aller Spielerdaten</p>
      ${profileLinkHtml}

      <div class="global-stats-grid">
        <div class="global-stat-card">
          <div class="global-stat-value">${formatNumber(totalPlayers)}</div>
          <div class="global-stat-label">Spieler gesamt</div>
        </div>
        <div class="global-stat-card">
          <div class="global-stat-value">${totalAchievements}</div>
          <div class="global-stat-label">Achievements verfügbar</div>
        </div>
        <div class="global-stat-card">
          <div class="global-stat-value">${formatNumber(totalUnlocked)}</div>
          <div class="global-stat-label">Freischaltungen insgesamt</div>
          <div class="global-stat-hint">von allen Spielern</div>
        </div>
        <div class="global-stat-card">
          <div class="global-stat-value">${avgAchievementsPerPlayer}</div>
          <div class="global-stat-label">Ø pro Spieler</div>
        </div>
      </div>

      <div class="stats-section">
        <h2>💎 Seltenste Achievements</h2>
        <div class="stat-achievement-list">
          ${rarestHtml || '<p class="text-muted">Noch keine Daten verfügbar</p>'}
        </div>
      </div>

      <div class="stats-section">
        <h2>👥 Häufigste Achievements</h2>
        <div class="stat-achievement-list">
          ${commonHtml || '<p class="text-muted">Noch keine Daten verfügbar</p>'}
        </div>
      </div>

      <div class="stats-section">
        <h2>📈 Kategorien-Übersicht</h2>
        <div class="stat-category-list">
          ${categoryHtml}
        </div>
      </div>
    </div>
  `;

  return baseTemplate('Statistiken', content, 'stats', user);
}

/**
 * Changelog page
 */
function renderChangelogPage(user = null) {
  const content = `
    <div class="content-page">
      <h1 class="page-title">📜 Changelog</h1>
      <p class="page-subtitle">Aktuelle Version: 1.7.0 - "Achievement-Website"</p>

      <section class="changelog-entry">
        <h2>Version 1.7.0 - "Achievement-Website" <span class="changelog-date">18. Januar 2026</span></h2>
        <div class="changelog-content">
          <h3>🌐 Öffentliche Website</h3>
          <ul>
            <li>Spieler-Profile mit Stats und Erfolgen online einsehen</li>
            <li>Leaderboard auf der Website</li>
            <li>Globale Statistiken (seltenste Achievements, etc.)</li>
            <li>Dark/Light Theme Toggle</li>
            <li>Mobile-optimiertes Design</li>
          </ul>
          <h3>🏆 Achievement-System</h3>
          <ul>
            <li>50+ freischaltbare Erfolge in 7 Kategorien</li>
            <li>Seltenheits-Anzeige (% der Spieler)</li>
            <li>Fortschritts-Tracking für alle Achievements</li>
            <li>Konfetti-Effekt bei 100% Completion</li>
          </ul>
          <h3>🔗 Neue Commands</h3>
          <ul>
            <li><code>!slots website / site / seite</code> - Link zur Website</li>
            <li><code>!slots erfolge / achievements</code> - Link zu deinen Erfolgen</li>
            <li><code>!slots erfolge @user</code> - Erfolge eines anderen Spielers</li>
          </ul>
        </div>
      </section>

      <section class="changelog-entry">
        <h2>Version 1.6.0 - "Duell-System" <span class="changelog-date">17. Januar 2026</span></h2>
        <div class="changelog-content">
          <h3>⚔️ Neues Feature: Duell-System</h3>
          <ul>
            <li>Fordere andere Spieler zum direkten Slot-Duell heraus</li>
            <li>Faire 1v1 Battles ohne Buffs oder Items</li>
            <li>Mindesteinsatz: 100 DachsTaler</li>
            <li>60 Sekunden Zeit zum Antworten</li>
          </ul>
          <h3>🎮 Neue Commands</h3>
          <ul>
            <li><code>!slots duel @user [Betrag]</code> - Duell starten</li>
            <li><code>!slots duelaccept</code> - Annehmen</li>
            <li><code>!slots dueldecline</code> - Ablehnen</li>
            <li><code>!slots duelopt out/in</code> - Opt-Out</li>
          </ul>
        </div>
      </section>

      <section class="changelog-entry">
        <h2>Version 1.5.3 - "Bug Fixes" <span class="changelog-date">6. Januar 2026</span></h2>
        <div class="changelog-content">
          <ul>
            <li>Bank-Balance bei Random-Reward-Items korrigiert</li>
            <li>Mystery Box Rollback bei Fehlern</li>
            <li>Balance-Protection gegen negative Werte</li>
          </ul>
        </div>
      </section>

      <section class="changelog-entry">
        <h2>Version 1.5.0 - "Modular Architecture" <span class="changelog-date">5. Januar 2026</span></h2>
        <div class="changelog-content">
          <ul>
            <li>40-50% schnellere Response-Zeit</li>
            <li>Modulares Code-System</li>
            <li>Optimierte KV-Operationen</li>
          </ul>
        </div>
      </section>

      <section class="changelog-entry">
        <h2>Version 1.4.0 - "Winter Update" <span class="changelog-date">27. Dezember 2025</span></h2>
        <div class="changelog-content">
          <ul>
            <li>Streak Multiplier System (kostenlos!)</li>
            <li>Wild Card System (Item #38)</li>
            <li>Guaranteed Pair (Item #37)</li>
            <li>Diamond Rush (Item #39)</li>
          </ul>
        </div>
      </section>

      <section class="changelog-entry">
        <h2>Version 1.3.0 - "Monthly Login Update" <span class="changelog-date">26. Dezember 2025</span></h2>
        <div class="changelog-content">
          <ul>
            <li>Monthly Login System mit Milestone-Boni</li>
            <li>Bis zu 3.250 DT extra pro Monat</li>
          </ul>
        </div>
      </section>

      <section class="changelog-entry">
        <h2>Version 1.0.0 - "Initial Release" <span class="changelog-date">21. Dezember 2025</span></h2>
        <div class="changelog-content">
          <ul>
            <li>Slot Machine mit 3x3 Grid</li>
            <li>DachsTaler Währung</li>
            <li>Shop-System mit 30+ Items</li>
            <li>Prestige-Ränge</li>
          </ul>
        </div>
      </section>
    </div>
  `;

  return baseTemplate('Changelog', content, 'changelog', user);
}

/**
 * Impressum page (TMG §5)
 */
function renderImpressumPage(user = null) {
  const content = `
    <div class="legal-page">
      <h1>Impressum</h1>
      <p class="legal-subtitle">Angaben gemäß § 5 TMG</p>

      <section class="legal-section">
        <h2>Verantwortlich für den Inhalt</h2>
        <address>
          <strong>Exaint i. A. frechhdachs (Maria Kellner)</strong><br>
          c/o OOE-Esports<br>
          Lastenstr. 42<br>
          4020 Linz<br>
          Österreich
        </address>
      </section>

      <section class="legal-section">
        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href="mailto:tulpe_salbei6s@icloud.com">tulpe_salbei6s@icloud.com</a>
        </p>
      </section>

      <section class="legal-section">
        <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
        <address>
          <strong>Exaint i. A. frechhdachs (Maria Kellner)</strong><br>
          c/o OOE-Esports<br>
          Lastenstr. 42<br>
          4020 Linz
        </address>
      </section>

      <section class="legal-section">
        <h2>Haftungsausschluss</h2>

        <h3>Haftung für Inhalte</h3>
        <p>
          Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
          Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
          Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten
          nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
          Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
          Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen.
        </p>

        <h3>Haftung für Links</h3>
        <p>
          Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
          Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
          Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
          Seiten verantwortlich.
        </p>

        <h3>Urheberrecht</h3>
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
          dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art
          der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen
          Zustimmung des jeweiligen Autors bzw. Erstellers.
        </p>
      </section>

      <section class="legal-section">
        <h2>Hinweis zu Glücksspiel</h2>
        <p>
          <strong>Dachsbau Slots ist ein reines Unterhaltungsangebot.</strong> Es werden keine
          Echtgeld-Beträge eingesetzt oder gewonnen. Die verwendete virtuelle Währung
          ("DachsTaler") hat keinen realen Geldwert und kann nicht in echtes Geld umgetauscht
          werden. Dieses Angebot stellt kein Glücksspiel im Sinne des Glücksspielstaatsvertrags dar.
        </p>
        <p>
          Solltest du dennoch Probleme mit Glücksspiel haben, findest du Hilfe bei:
        </p>
        <ul>
          <li><a href="https://www.spielen-mit-verantwortung.de" target="_blank" rel="noopener">Spielen mit Verantwortung</a></li>
          <li><a href="https://www.bzga.de" target="_blank" rel="noopener">Bundeszentrale für gesundheitliche Aufklärung</a></li>
          <li>Telefonberatung: 0800 1 37 27 00 (kostenlos)</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">https://ec.europa.eu/consumers/odr</a>
        </p>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <div class="legal-footer">
        <p><a href="?page=datenschutz">→ Zur Datenschutzerklärung</a></p>
      </div>
    </div>
  `;

  return baseTemplate('Impressum', content, 'impressum', user);
}

/**
 * Datenschutz page (DSGVO)
 */
function renderDatenschutzPage(user = null) {
  const content = `
    <div class="legal-page">
      <h1>Datenschutzerklärung</h1>
      <p class="legal-subtitle">Stand: Januar 2026</p>

      <section class="legal-section">
        <h2>1. Verantwortlicher</h2>
        <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO):</p>
        <address>
          <strong>Exaint i. A. frechhdachs (Maria Kellner) c/o OOE-Esports</strong><br>
          Lastenstr. 42<br>
          4020 Linz<br>
          E-Mail: <a href="mailto:tulpe_salbei6s@icloud.com">tulpe_salbei6s@icloud.com</a>
        </address>
      </section>

      <section class="legal-section">
        <h2>2. Übersicht der Verarbeitungen</h2>
        <p>
          Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung einer
          funktionsfähigen Website sowie unserer Inhalte und Leistungen erforderlich ist.
        </p>
        <h3>Verarbeitete Datenarten:</h3>
        <ul>
          <li>Nutzungsdaten (Twitch-Benutzername, Spielstatistiken)</li>
          <li>Meta-/Kommunikationsdaten (IP-Adressen, Zeitpunkt des Zugriffs)</li>
          <li>Profilbilder und Kanalrollen von Twitch (öffentlich verfügbare Daten)</li>
        </ul>
        <h3>Betroffene Personen:</h3>
        <ul>
          <li>Nutzer des Twitch-Chats, die am Dachsbau Slots Spiel teilnehmen</li>
          <li>Besucher dieser Website</li>
        </ul>
        <h3>Zwecke der Verarbeitung:</h3>
        <ul>
          <li>Bereitstellung des Spiels "Dachsbau Slots" im Twitch-Chat</li>
          <li>Anzeige von Spielerprofilen und Ranglisten auf dieser Website</li>
          <li>Anzeige von Twitch-Profilbildern und Kanalrollen</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>3. Rechtsgrundlagen</h2>
        <p>Die Verarbeitung erfolgt auf Grundlage von:</p>
        <ul>
          <li><strong>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</strong> – Durch die aktive Nutzung des Spiels
          via Chat-Befehl willigst du in die Verarbeitung deines Twitch-Benutzernamens ein.</li>
          <li><strong>Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</strong> – Wir haben ein berechtigtes
          Interesse an der technisch fehlerfreien Darstellung und Optimierung unserer Website.</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>4. Datenerhebung auf dieser Website</h2>

        <h3>4.1 Spielerdaten (Twitch-Chat)</h3>
        <p>
          Wenn du im Twitch-Chat von <a href="https://www.twitch.tv/frechhdachs" target="_blank" rel="noopener">@frechhdachs</a>
          einen Spielbefehl verwendest (z.B. <code>!slots</code>), wird dein Twitch-Benutzername gespeichert,
          um dein Spielerkonto zu verwalten.
        </p>
        <p><strong>Gespeicherte Daten:</strong></p>
        <ul>
          <li>Twitch-Benutzername (kleingeschrieben)</li>
          <li>Virtueller Kontostand (DachsTaler)</li>
          <li>Spielstatistiken (Anzahl Spins, Gewinne, etc.)</li>
          <li>Freigeschaltete Erfolge (Achievements)</li>
          <li>Zeitpunkt der letzten Aktivität</li>
        </ul>
        <p><strong>Speicherdauer:</strong> Die Daten werden unbefristet gespeichert, solange das Spielerkonto aktiv ist.</p>
        <p><strong>Löschung:</strong> Du kannst die Löschung deiner Daten jederzeit per E-Mail an den Verantwortlichen beantragen.</p>

        <h3>4.2 Twitch-Login (OAuth)</h3>
        <p>
          Du kannst dich optional mit deinem Twitch-Konto anmelden. Dabei werden folgende Daten
          von Twitch abgerufen und in deinem Session-Cookie gespeichert:
        </p>
        <ul>
          <li>Twitch-Benutzer-ID</li>
          <li>Twitch-Benutzername</li>
          <li>Anzeigename</li>
          <li>Profilbild-URL</li>
        </ul>
        <p>
          Diese Daten werden <strong>nicht</strong> dauerhaft auf unseren Servern gespeichert,
          sondern nur im verschlüsselten Session-Cookie in deinem Browser.
        </p>

        <h3>4.3 Twitch-API-Daten</h3>
        <p>
          Zur Anzeige von Profilbildern und Kanalrollen (Moderator, VIP) rufen wir öffentlich
          verfügbare Daten über die offizielle Twitch-API ab.
        </p>
        <p><strong>Abgerufene Daten:</strong></p>
        <ul>
          <li>Profilbild-URL (öffentlich auf Twitch sichtbar)</li>
          <li>Kanalrolle im Kanal von @frechhdachs (Moderator, VIP, oder keine)</li>
        </ul>
        <p><strong>Caching:</strong> Diese Daten werden temporär zwischengespeichert:</p>
        <ul>
          <li>Profilbilder: 24 Stunden</li>
          <li>Kanalrollen: 1 Stunde</li>
        </ul>
        <p>
          Die Twitch-API unterliegt den <a href="https://www.twitch.tv/p/legal/privacy-notice/" target="_blank" rel="noopener">Datenschutzrichtlinien von Twitch</a>.
          Es werden nur öffentlich verfügbare Informationen abgerufen.
        </p>

        <h3>4.4 Server-Log-Dateien</h3>
        <p>
          Der Hosting-Provider (Cloudflare) erhebt automatisch Informationen in Server-Log-Dateien:
        </p>
        <ul>
          <li>IP-Adresse (anonymisiert)</li>
          <li>Datum und Uhrzeit der Anfrage</li>
          <li>Angeforderte URL</li>
          <li>Browsertyp und -version</li>
          <li>Verwendetes Betriebssystem</li>
        </ul>
        <p>
          Diese Daten werden von Cloudflare gemäß deren
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">Datenschutzerklärung</a>
          verarbeitet und nicht mit anderen Datenquellen zusammengeführt.
        </p>

        <h3>4.5 Lokaler Speicher (LocalStorage)</h3>
        <p>
          Diese Website speichert deine Theme-Einstellung (Hell/Dunkel-Modus) im lokalen Speicher
          deines Browsers. Dies dient ausschließlich deinem Komfort und wird nicht an uns übertragen.
        </p>
      </section>

      <section class="legal-section">
        <h2>5. Cookies</h2>
        <p>
          Diese Website verwendet <strong>keine Cookies</strong> zu Tracking- oder Werbezwecken.
        </p>
        <h3>5.1 Session-Cookie (optionaler Login)</h3>
        <p>
          Wenn du dich mit deinem Twitch-Konto anmeldest, wird ein Session-Cookie gesetzt:
        </p>
        <ul>
          <li><strong>Name:</strong> dachsbau_session</li>
          <li><strong>Zweck:</strong> Speicherung der Login-Session</li>
          <li><strong>Inhalt:</strong> Verschlüsselter Token mit Twitch-ID, Benutzername und Profilbild-URL</li>
          <li><strong>Gültigkeit:</strong> 7 Tage</li>
          <li><strong>Flags:</strong> HttpOnly, Secure, SameSite=Lax</li>
        </ul>
        <p>
          Dieser Cookie wird nur gesetzt, wenn du dich aktiv einloggst. Du kannst dich jederzeit
          ausloggen, wodurch der Cookie gelöscht wird.
        </p>
        <h3>5.2 Technische Cookies</h3>
        <p>
          Cloudflare kann technisch notwendige Cookies setzen, um die Sicherheit und Performance
          der Website zu gewährleisten (z.B. DDoS-Schutz).
        </p>
      </section>

      <section class="legal-section">
        <h2>6. Hosting</h2>
        <p>Diese Website wird bei Cloudflare, Inc. gehostet:</p>
        <address>
          Cloudflare, Inc.<br>
          101 Townsend St<br>
          San Francisco, CA 94107, USA
        </address>
        <p>
          Cloudflare ist unter dem EU-US Data Privacy Framework zertifiziert.
          Weitere Informationen: <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">Cloudflare Datenschutzerklärung</a>
        </p>
      </section>

      <section class="legal-section">
        <h2>7. Deine Rechte</h2>
        <p>Du hast gemäß DSGVO folgende Rechte:</p>
        <ul>
          <li><strong>Auskunftsrecht (Art. 15 DSGVO)</strong> – Du kannst Auskunft über deine gespeicherten Daten verlangen.</li>
          <li><strong>Berichtigungsrecht (Art. 16 DSGVO)</strong> – Du kannst die Berichtigung unrichtiger Daten verlangen.</li>
          <li><strong>Löschungsrecht (Art. 17 DSGVO)</strong> – Du kannst die Löschung deiner Daten verlangen.</li>
          <li><strong>Einschränkung der Verarbeitung (Art. 18 DSGVO)</strong> – Du kannst die Einschränkung der Verarbeitung verlangen.</li>
          <li><strong>Datenübertragbarkeit (Art. 20 DSGVO)</strong> – Du kannst deine Daten in einem gängigen Format erhalten.</li>
          <li><strong>Widerspruchsrecht (Art. 21 DSGVO)</strong> – Du kannst der Verarbeitung widersprechen.</li>
          <li><strong>Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO)</strong> – Du kannst deine Einwilligung jederzeit widerrufen.</li>
        </ul>
        <p>
          Zur Ausübung deiner Rechte wende dich an: <a href="mailto:tulpe_salbei6s@icloud.com">tulpe_salbei6s@icloud.com</a>
        </p>
        <p>
          Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
        </p>
      </section>

      <section class="legal-section">
        <h2>8. Datensicherheit</h2>
        <p>
          Diese Website nutzt aus Sicherheitsgründen eine SSL- bzw. TLS-Verschlüsselung.
          Eine verschlüsselte Verbindung erkennst du an "https://" in der Adresszeile.
        </p>
      </section>

      <section class="legal-section">
        <h2>9. Aktualität und Änderung dieser Datenschutzerklärung</h2>
        <p>
          Diese Datenschutzerklärung ist aktuell gültig und hat den Stand Januar 2026.
          Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den
          aktuellen rechtlichen Anforderungen entspricht.
        </p>
      </section>

      <div class="legal-footer">
        <p><a href="?page=impressum">→ Zum Impressum</a></p>
      </div>
    </div>
  `;

  return baseTemplate('Datenschutzerklärung', content, 'datenschutz', user);
}

/**
 * Not found page
 */
function renderNotFoundPage(username = null, user = null) {
  const message = username
    ? `Spieler "${escapeHtml(username)}" wurde nicht gefunden.`
    : 'Die angeforderte Seite wurde nicht gefunden.';

  const content = `
    <div class="not-found">
      <div class="not-found-emoji">🦡❓</div>
      <h1 class="not-found-title">Nicht gefunden</h1>
      <p class="not-found-text">${message}</p>
      <a href="?page=home" class="btn">Zur Startseite</a>
    </div>
  `;

  return baseTemplate('Nicht gefunden', content, '', user);
}

/**
 * Error page
 */
function renderErrorPage(user = null) {
  const content = `
    <div class="not-found">
      <div class="not-found-emoji">🦡💥</div>
      <h1 class="not-found-title">Fehler</h1>
      <p class="not-found-text">Ein unerwarteter Fehler ist aufgetreten.</p>
      <a href="?page=home" class="btn">Zur Startseite</a>
    </div>
  `;

  return baseTemplate('Fehler', content, '', user);
}
