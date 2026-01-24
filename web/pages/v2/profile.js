/**
 * V2 Profile Page Handler and Renderer
 */

import { getPlayerAchievements, getStats, getPrestigeRank, hasAcceptedDisclaimer, getLastActive, getAchievementStats, isSelfBanned } from '../../database.js';
import { isDuelOptedOut } from '../../database/duels.js';
import { isLeaderboardHidden } from '../../database/core.js';
import { getTwitchProfileData } from '../twitch.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES, getStatKeyForAchievement } from '../../constants.js';
import { isAdmin } from '../../utils.js';
import { escapeHtml, formatNumber } from '../utils.js';
import { CATEGORY_ICONS, CATEGORY_NAMES, PRESTIGE_RANK_NAMES, ROLE_BADGES, ADMIN_ROLE_OVERRIDES } from '../ui-config.js';
import { baseTemplateV2, htmlResponse } from './template.js';
import { renderHomePageV2 } from './home.js';
import { renderNotFoundPageV2 } from './errors.js';

/**
 * V2 Profile page handler
 */
export async function handleProfilePageV2(url, env, loggedInUser = null) {
  const username = url.searchParams.get('user');

  if (!username) {
    return htmlResponse(renderHomePageV2('Bitte gib einen Spielernamen ein.', loggedInUser));
  }

  // Check if user exists without auto-creating
  const [hasDisclaimer, rawBalance] = await Promise.all([
    hasAcceptedDisclaimer(username, env),
    env.SLOTS_KV.get(`user:${username}`)
  ]);

  if (!hasDisclaimer && rawBalance === null) {
    return htmlResponse(renderNotFoundPageV2(username, loggedInUser));
  }
  const balance = rawBalance !== null ? parseInt(rawBalance, 10) || 0 : 0;

  // Fetch remaining data in parallel with error fallback
  let rank, stats, achievementData, lastActive, achievementStats, duelOptOut, selfBanned, leaderboardHidden, twitchData;
  try {
    [rank, stats, achievementData, lastActive, achievementStats, duelOptOut, selfBanned, leaderboardHidden, twitchData] = await Promise.all([
      getPrestigeRank(username, env).catch(() => null),
      getStats(username, env).catch(() => ({})),
      getPlayerAchievements(username, env).catch(() => ({ unlockedAt: {}, stats: {}, pendingRewards: 0 })),
      getLastActive(username, env).catch(() => null),
      getAchievementStats(env).catch(() => ({ totalPlayers: 0, counts: {} })),
      isDuelOptedOut(username, env).catch(() => false),
      isSelfBanned(username, env).catch(() => false),
      isLeaderboardHidden(username, env).catch(() => false),
      getTwitchProfileData(username, env).catch(() => null)
    ]);
  } catch (e) {
    rank = null; stats = {}; achievementData = { unlockedAt: {}, stats: {}, pendingRewards: 0 };
    lastActive = null; achievementStats = { totalPlayers: 0, counts: {} };
    duelOptOut = false; selfBanned = false; leaderboardHidden = false; twitchData = null;
  }

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

  const content = renderProfileContentV2({
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
  });

  const rendered = baseTemplateV2(`${username}'s Profil`, content, 'profile', loggedInUser);
  return htmlResponse(rendered);
}

/**
 * V2 Profile page content renderer
 */
function renderProfileContentV2(data) {
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

  // Avatar from Twitch (or default)
  const avatarUrl = twitchData?.avatar || null;
  const displayName = twitchData?.displayName || username;

  // Build role badges array
  const lowerUsername = username.toLowerCase();
  const roleBadges = [];

  if (ADMIN_ROLE_OVERRIDES[lowerUsername]) {
    for (const role of ADMIN_ROLE_OVERRIDES[lowerUsername]) {
      if (ROLE_BADGES[role]) roleBadges.push({ ...ROLE_BADGES[role] });
    }
  } else if (twitchData?.role && ROLE_BADGES[twitchData.role]) {
    roleBadges.push({ ...ROLE_BADGES[twitchData.role] });
  }

  // Generate role badges HTML
  const roleBadgesHtml = roleBadges.map(badge =>
    `<span class="v2-profile-role-badge" style="--role-color: ${badge.color}">
      <img src="${badge.icon}" alt="${badge.label}" class="v2-profile-role-icon" loading="lazy" width="18" height="18">
      <span>${badge.label}</span>
    </span>`
  ).join('');

  const isComplete = progressPercent === 100;
  const completeBadgeHtml = isComplete ? '<span class="v2-complete-badge">🏆 100% Complete!</span>' : '';

  // Stats HTML
  const statsHtml = `
    <div class="v2-profile-stats">
      <div class="v2-stat-box">
        <div class="v2-stat-value">${formatNumber(balance)}</div>
        <div class="v2-stat-label">DachsTaler</div>
      </div>
      <div class="v2-stat-box">
        <div class="v2-stat-value">${formatNumber(stats.totalSpins || 0)}</div>
        <div class="v2-stat-label">Spins</div>
      </div>
      <div class="v2-stat-box">
        <div class="v2-stat-value">${formatNumber(stats.wins || 0)}</div>
        <div class="v2-stat-label">Gewinne</div>
      </div>
      <div class="v2-stat-box">
        <div class="v2-stat-value">${formatNumber(stats.biggestWin || 0)}</div>
        <div class="v2-stat-label">Höchster Gewinn</div>
      </div>
      <div class="v2-stat-box">
        <div class="v2-stat-value">${formatNumber(stats.totalWon || 0)}</div>
        <div class="v2-stat-label">Gesamt gewonnen</div>
      </div>
      <div class="v2-stat-box">
        <div class="v2-stat-value">${formatNumber(stats.totalLost || 0)}</div>
        <div class="v2-stat-label">Gesamt verloren</div>
      </div>
    </div>
  `;

  // Categories HTML
  const categoriesHtml = Object.entries(byCategory).map(([category, achs]) => {
    const catUnlocked = achs.filter(a => a.unlocked).length;
    const catTotal = achs.length;

    const achievementsHtml = achs.map(ach => {
      // Hidden achievements that aren't unlocked
      if (ach.hidden && !ach.unlocked) {
        return `
          <div class="v2-achievement locked hidden">
            <div class="v2-achievement-icon">❓</div>
            <div class="v2-achievement-info">
              <div class="v2-achievement-name">Verstecktes Achievement</div>
              <div class="v2-achievement-desc">Spiele weiter um es zu entdecken...</div>
            </div>
          </div>
        `;
      }

      const statusClass = ach.unlocked ? 'unlocked' : 'locked';
      const icon = ach.unlocked ? '✅' : '🔒';

      let progressHtml = '';
      if (ach.progress && !ach.unlocked) {
        progressHtml = `
          <div class="v2-achievement-progress-inline">
            <div class="v2-achievement-progress-bar-track">
              <div class="v2-achievement-progress-bar-fill" style="width: ${ach.progress.percent}%"></div>
            </div>
            <span class="v2-achievement-progress-label">${formatNumber(ach.progress.current)} / ${formatNumber(ach.progress.required)}</span>
          </div>
        `;
      }

      // Rarity display with color coding
      const getRarityClass = (percent) => {
        if (percent < 5) return 'v2-rarity-legendary';
        if (percent < 15) return 'v2-rarity-epic';
        if (percent < 30) return 'v2-rarity-rare';
        return 'v2-rarity-common';
      };
      const rarityClass = ach.rarity && ach.rarity.total > 0 ? getRarityClass(ach.rarity.percent) : '';
      const rarityHtml = ach.rarity && ach.rarity.total > 0
        ? `<div class="v2-achievement-rarity ${rarityClass}">${ach.rarity.percent}% der Spieler</div>`
        : '';

      // Format unlock date
      const unlockedDateStr = ach.unlockedAt
        ? new Date(ach.unlockedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

      return `
        <div class="v2-achievement ${statusClass}" onclick="showAchievementDetail(this)"
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
          <div class="v2-achievement-icon">${icon}</div>
          <div class="v2-achievement-info">
            <div class="v2-achievement-name">${escapeHtml(ach.name)}</div>
            <div class="v2-achievement-desc">${escapeHtml(ach.description)}</div>
            ${progressHtml}
            ${rarityHtml}
          </div>
          ${ach.reward ? `<div class="v2-achievement-reward">+${formatNumber(ach.reward)} DT</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="v2-category">
        <div class="v2-category-header" onclick="toggleCategory(this)">
          <div class="v2-category-title">
            <div class="v2-category-icon">${CATEGORY_ICONS[category] || '🎯'}</div>
            <span>${CATEGORY_NAMES[category] || category}</span>
          </div>
          <div class="v2-category-header-right">
            <div class="v2-category-progress">${catUnlocked}/${catTotal}</div>
            <div class="v2-category-progress-bar">
              <div class="v2-category-progress-fill${catUnlocked === catTotal ? ' complete' : ''}" style="width: ${Math.round((catUnlocked / catTotal) * 100)}%"></div>
            </div>
            <span class="v2-collapse-icon">▼</span>
          </div>
        </div>
        <div class="v2-category-content">
          <div class="v2-achievement-list">
            ${achievementsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Admin panel HTML
  const adminPanelHtml = showAdminPanel ? `
    <div class="v2-admin-panel collapsed" id="adminPanel" data-username="${escapeHtml(username)}">
      <div class="v2-admin-panel-header" onclick="toggleAdminPanel()">
        <h3>🔧 Admin Panel</h3>
        <span class="v2-admin-panel-user">Spieler: <strong>${escapeHtml(username)}</strong></span>
        <span class="v2-admin-panel-toggle" id="adminPanelToggle">▼</span>
      </div>
      <div class="v2-admin-panel-content" id="adminPanelContent">
        <div class="v2-admin-panel-grid">
          <div class="v2-admin-control">
            <label>Balance</label>
            <div class="v2-admin-input-group">
              <input type="number" id="adminBalance" value="${balance}" min="0" max="1000000" class="v2-admin-input">
              <button class="v2-admin-btn" onclick="adminSetBalance()">Setzen</button>
            </div>
          </div>
          <div class="v2-admin-control">
            <label>Disclaimer</label>
            <div class="v2-admin-toggle-group">
              <span class="v2-admin-status ${hasDisclaimer ? 'active' : ''}">${hasDisclaimer ? '✓ Akzeptiert' : '✗ Nicht akzeptiert'}</span>
              <button class="v2-admin-btn ${hasDisclaimer ? 'danger' : 'success'}" onclick="adminSetDisclaimer(${!hasDisclaimer})">${hasDisclaimer ? 'Entfernen' : 'Setzen'}</button>
            </div>
          </div>
          <div class="v2-admin-control">
            <label>Self-Ban</label>
            <div class="v2-admin-toggle-group">
              <span class="v2-admin-status ${selfBanned ? 'active danger' : ''}">${selfBanned ? '🚫 Gesperrt' : '✓ Nicht gesperrt'}</span>
              <button class="v2-admin-btn ${selfBanned ? 'success' : 'danger'}" onclick="adminSetSelfBan(${!selfBanned})">${selfBanned ? 'Entsperren' : 'Sperren'}</button>
            </div>
          </div>
          <div class="v2-admin-control">
            <label>Duelle</label>
            <div class="v2-admin-toggle-group">
              <span class="v2-admin-status ${duelOptOut ? 'danger' : 'active'}">${duelOptOut ? '✗ Deaktiviert' : '✓ Aktiviert'}</span>
              <button class="v2-admin-btn" onclick="adminSetDuelOpt(${!duelOptOut})">${duelOptOut ? 'Aktivieren' : 'Deaktivieren'}</button>
            </div>
          </div>
          <div class="v2-admin-control">
            <label>Leaderboard</label>
            <div class="v2-admin-toggle-group">
              <span class="v2-admin-status ${leaderboardHidden ? 'danger' : 'active'}">${leaderboardHidden ? '✗ Versteckt' : '✓ Sichtbar'}</span>
              <button class="v2-admin-btn" onclick="adminSetLeaderboardHidden(${!leaderboardHidden})">${leaderboardHidden ? 'Anzeigen' : 'Verstecken'}</button>
            </div>
          </div>
          <div class="v2-admin-control v2-admin-control-wide">
            <label>Achievement</label>
            <div class="v2-admin-input-group">
              <select id="adminAchievement" class="v2-admin-input v2-admin-select">
                ${achievements.map(a => `<option value="${a.id}" data-unlocked="${a.unlocked}">${a.unlocked ? '✓' : '○'} ${escapeHtml(a.name)}</option>`).join('')}
              </select>
              <button class="v2-admin-btn success" onclick="adminSetAchievement(true)">Freischalten</button>
              <button class="v2-admin-btn danger" onclick="adminSetAchievement(false)">Sperren</button>
            </div>
          </div>
          <div class="v2-admin-control v2-admin-control-wide">
            <label>💸 Shop-Refund</label>
            <div class="v2-admin-refund-section">
              <button class="v2-admin-btn" onclick="loadRefundableItems()">Refund-Items laden</button>
              <div id="refundItemsContainer" class="v2-admin-refund-items" style="display: none;"></div>
            </div>
          </div>
        </div>
        <div id="adminMessage" class="v2-admin-message"></div>
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
  ` : '';

  const content = `
    ${isComplete ? '<div class="v2-confetti-container" id="confetti"></div>' : ''}
    <div class="v2-profile-header${isComplete ? ' complete' : ''}">
      <div class="v2-profile-top">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}" class="v2-profile-avatar" loading="lazy" width="80" height="80">` : ''}
        <div class="v2-profile-info">
          <div class="v2-profile-name">
            ${escapeHtml(displayName)}
            ${completeBadgeHtml}
          </div>
          <div class="v2-profile-badges">
            ${roleBadgesHtml}
            ${rank && PRESTIGE_RANK_NAMES[rank] ? `<span class="v2-profile-prestige-badge" style="--prestige-color: ${PRESTIGE_RANK_NAMES[rank].color}">${rank} ${PRESTIGE_RANK_NAMES[rank].name}</span>` : ''}
            <span class="v2-profile-duel-status ${duelOptOut ? 'opted-out' : 'opted-in'}">⚔️ ${duelOptOut ? 'Duelle deaktiviert' : 'Offen für Duelle'}</span>
            <span class="v2-profile-duel-hint">Duelle an/aus: <code>!slots duelopt</code></span>
            ${selfBanned ? `<span class="v2-profile-selfban-status banned">🚫 Selbst-gesperrt</span>` : ''}
          </div>
          ${lastActiveText ? `<div class="v2-profile-last-active">🕐 Zuletzt aktiv: ${lastActiveText}</div>` : ''}
        </div>
      </div>
      ${statsHtml}
      <div class="v2-achievement-summary">
        <div class="v2-achievement-count">
          <span class="v2-achievement-count-label">🏆 Achievements</span>
          <span class="v2-achievement-count-value"><strong>${unlockedCount}</strong> / ${totalCount}</span>
          <span class="v2-achievement-count-percent">(${progressPercent}%)</span>
        </div>
        <div class="v2-progress-bar">
          <div class="v2-progress-fill" style="width: ${progressPercent}%"></div>
        </div>
      </div>
    </div>
    ${adminPanelHtml}
    <div class="v2-achievement-controls">
      <div class="v2-achievement-filter" role="group" aria-label="Achievement Filter">
        <button class="v2-filter-btn active" data-filter="all" aria-pressed="true">Alle</button>
        <button class="v2-filter-btn" data-filter="unlocked" aria-pressed="false">Freigeschaltet</button>
        <button class="v2-filter-btn" data-filter="locked" aria-pressed="false">Gesperrt</button>
      </div>
      <div class="v2-achievement-sort" role="group" aria-label="Achievement Sortierung">
        <button class="v2-sort-btn active" data-sort="category" aria-pressed="true">Kategorie</button>
        <button class="v2-sort-btn" data-sort="rarity-asc" aria-pressed="false">Seltenste</button>
        <button class="v2-sort-btn" data-sort="rarity-desc" aria-pressed="false">Häufigste</button>
      </div>
      <div class="v2-achievement-collapse-controls" role="group" aria-label="Kategorien ein-/ausklappen">
        <button class="v2-collapse-all-btn" onclick="collapseAllCategories()">Alle einklappen</button>
        <button class="v2-collapse-all-btn" onclick="expandAllCategories()">Alle ausklappen</button>
      </div>
    </div>
    <div class="v2-categories">
      ${categoriesHtml}
    </div>
  `;

  return content;
}
