/**
 * Profile Page Handler and Renderer
 */

import type { Env, LoggedInUser, PlayerStats, CustomMessages } from '../../types/index.d.ts';
import { getPlayerAchievements, getStats, getPrestigeRank, hasAcceptedDisclaimer, getLastActive, getAchievementStats, isSelfBanned, hasUnlock, getCustomMessages } from '../../database.js';
import { isDuelOptedOut, getDuelHistory } from '../../database/duels.js';
import { isLeaderboardHidden } from '../../database/core.js';
import { getTwitchProfileData } from '../twitch.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES, getStatKeyForAchievement } from '../../constants.js';
import { isAdmin } from '../../utils.js';
import { escapeHtml, formatNumber } from './utils.js';
import { CATEGORY_ICONS, CATEGORY_NAMES, PRESTIGE_RANK_NAMES, ROLE_BADGES, ADMIN_ROLE_OVERRIDES } from './ui-config.js';
import { baseTemplate, htmlResponse } from './template.js';
import { renderHomePage } from './home.js';
import { renderNotFoundPage } from './errors.js';

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  reward?: number;
  requirement?: number;
  hidden?: boolean;
}

interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlockedAt: number | null;
  progress: { current: number; required: number; percent: number } | null;
  rarity: { percent: number; count: number; total: number };
}

interface DuelHistoryEntry {
  challenger: string;
  target: string;
  challengerGrid: string[];
  targetGrid: string[];
  challengerScore: number;
  targetScore: number;
  winner: string | null;
  pot: number;
  amount: number;
  createdAt: number;
}

interface TwitchData {
  avatar?: string;
  displayName?: string;
  role?: string;
}

interface ProfileData {
  username: string;
  balance: number;
  rank: string | null;
  stats: Partial<PlayerStats & { duelsWon?: number; duelsLost?: number }>;
  achievements: AchievementWithStatus[];
  byCategory: Record<string, AchievementWithStatus[]>;
  pendingRewards?: number;
  lastActive: number | null;
  duelOptOut: boolean;
  selfBanned: boolean;
  leaderboardHidden: boolean;
  hasDisclaimer: boolean;
  twitchData: TwitchData | null;
  loggedInUser: LoggedInUser | null;
  hasCustomMsgUnlock: boolean;
  customMessages: CustomMessages | null;
  duelHistory: DuelHistoryEntry[];
}

/**
 * Profile page handler
 */
export async function handleProfilePage(url: URL, env: Env, loggedInUser: LoggedInUser | null = null): Promise<Response> {
  const username = url.searchParams.get('user');

  if (!username) {
    return htmlResponse(renderHomePage('Bitte gib einen Spielernamen ein.', loggedInUser));
  }

  // Check if user exists without auto-creating (getBalance creates ghost users)
  const [hasDisclaimer, rawBalance] = await Promise.all([
    hasAcceptedDisclaimer(username, env),
    env.SLOTS_KV.get(`user:${username}`)
  ]);

  if (!hasDisclaimer && rawBalance === null) {
    return htmlResponse(renderNotFoundPage(username, loggedInUser));
  }
  const balance = rawBalance !== null ? parseInt(rawBalance, 10) || 0 : 0;

  // Fetch remaining data in parallel with error fallback
  let rank: string | null, stats: Partial<PlayerStats & { duelsWon?: number; duelsLost?: number }>, achievementData: { unlockedAt: Record<string, number>; stats: Record<string, number>; pendingRewards: number }, lastActive: number | null, achievementStats: { totalPlayers: number; counts: Record<string, number> }, duelOptOut: boolean, selfBanned: boolean, leaderboardHidden: boolean, twitchData: TwitchData | null, hasCustomMsgUnlock: boolean, customMessages: CustomMessages | null, duelHistory: DuelHistoryEntry[];
  try {
    [rank, stats, achievementData, lastActive, achievementStats, duelOptOut, selfBanned, leaderboardHidden, twitchData, hasCustomMsgUnlock, customMessages, duelHistory] = await Promise.all([
      getPrestigeRank(username, env).catch(() => null),
      getStats(username, env).catch(() => ({})),
      getPlayerAchievements(username, env).catch(() => ({ unlockedAt: {}, stats: {}, pendingRewards: 0 })),
      getLastActive(username, env).catch(() => null),
      getAchievementStats(env).catch(() => ({ totalPlayers: 0, counts: {} })),
      isDuelOptedOut(username, env).catch(() => false),
      isSelfBanned(username, env).catch(() => false),
      isLeaderboardHidden(username, env).catch(() => false),
      getTwitchProfileData(username, env).catch(() => null),
      hasUnlock(username, 'custom_message', env).catch(() => false),
      getCustomMessages(username, env).catch(() => null),
      getDuelHistory(username, 10, env).catch(() => [])
    ]);
  } catch {
    rank = null; stats = {}; achievementData = { unlockedAt: {}, stats: {}, pendingRewards: 0 };
    lastActive = null; achievementStats = { totalPlayers: 0, counts: {} };
    duelOptOut = false; selfBanned = false; leaderboardHidden = false; twitchData = null;
    hasCustomMsgUnlock = false; customMessages = null; duelHistory = [];
  }

  const allAchievements = getAllAchievements();

  // Build achievements with unlock status and rarity
  const { totalPlayers, counts } = achievementStats;
  const achievements: AchievementWithStatus[] = allAchievements.map(ach => {
    const unlocked = !!achievementData.unlockedAt[ach.id];
    const unlockedAt = achievementData.unlockedAt[ach.id] || null;

    // Calculate progress
    let progress: { current: number; required: number; percent: number } | null = null;
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
  const byCategory: Record<string, AchievementWithStatus[]> = {};
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
    loggedInUser,
    hasCustomMsgUnlock,
    customMessages,
    duelHistory
  }));
}

/**
 * Profile page renderer
 */
export function renderProfilePage(data: ProfileData): string {
  const { username, balance, rank, stats, achievements, byCategory, lastActive, duelOptOut, selfBanned, leaderboardHidden, hasDisclaimer, twitchData, loggedInUser, hasCustomMsgUnlock, customMessages, duelHistory = [] } = data;

  // Check if logged-in user is admin
  const showAdminPanel = loggedInUser && isAdmin(loggedInUser.username);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  // Format last active time
  const formatLastActive = (timestamp: number | null): string | null => {
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
      <div class="stat-box stat-win">
        <div class="stat-value">${formatNumber(stats.wins || 0)}</div>
        <div class="stat-label">Gewinne</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatNumber(stats.biggestWin || 0)}</div>
        <div class="stat-label">Höchster Gewinn</div>
      </div>
      <div class="stat-box stat-win">
        <div class="stat-value">${formatNumber(stats.totalWon || 0)}</div>
        <div class="stat-label">Gesamt gewonnen</div>
      </div>
      <div class="stat-box stat-loss">
        <div class="stat-value">${formatNumber(stats.totalLost || 0)}</div>
        <div class="stat-label">Gesamt verloren</div>
      </div>
      <div class="stat-box stat-win">
        <div class="stat-value">${formatNumber(stats.duelsWon || 0)}</div>
        <div class="stat-label">Duelle gewonnen</div>
      </div>
      <div class="stat-box stat-loss">
        <div class="stat-value">${formatNumber(stats.duelsLost || 0)}</div>
        <div class="stat-label">Duelle verloren</div>
      </div>
    </div>
  `;

  // Custom Messages Editor (visible to profile owner with unlock, or admin)
  const isOwnProfile = loggedInUser && loggedInUser.username.toLowerCase() === username.toLowerCase();
  const showCustomMsgEditor = isOwnProfile && hasCustomMsgUnlock;
  const winMsgs = customMessages?.win || [];
  const lossMsgs = customMessages?.loss || [];

  const customMessagesHtml = showCustomMsgEditor ? `
    <div class="custom-messages-editor">
      <div class="custom-messages-header">
        <h3>💬 Custom Messages</h3>
        <span class="custom-messages-hint">Wird zufällig an dein Spin-Ergebnis angehängt</span>
      </div>
      <div class="custom-messages-section">
        <div class="custom-messages-type">
          <label class="custom-messages-label">Win-Nachrichten (bei Gewinn):</label>
          <div class="custom-messages-list" id="winMessages">
            ${winMsgs.map((msg) => `
              <div class="custom-message-row">
                <input type="text" class="custom-message-input" value="${escapeHtml(msg)}" maxlength="50" placeholder="Nachricht..." oninput="updateCharCount(this)">
                <span class="custom-message-chars">${50 - msg.length}</span>
                <button class="custom-message-remove" onclick="removeMessageRow(this)" title="Entfernen">&times;</button>
              </div>
            `).join('')}
          </div>
          <div class="custom-messages-actions">
            <button class="custom-message-add" onclick="addMessageRow('win')" ${winMsgs.length >= 5 ? 'disabled' : ''}>+ Nachricht hinzufügen</button>
            <span class="custom-messages-counter" id="winCounter">${winMsgs.length}/5</span>
          </div>
        </div>
        <div class="custom-messages-type">
          <label class="custom-messages-label">Lose-Nachrichten (bei Verlust):</label>
          <div class="custom-messages-list" id="lossMessages">
            ${lossMsgs.map((msg) => `
              <div class="custom-message-row">
                <input type="text" class="custom-message-input" value="${escapeHtml(msg)}" maxlength="50" placeholder="Nachricht..." oninput="updateCharCount(this)">
                <span class="custom-message-chars">${50 - msg.length}</span>
                <button class="custom-message-remove" onclick="removeMessageRow(this)" title="Entfernen">&times;</button>
              </div>
            `).join('')}
          </div>
          <div class="custom-messages-actions">
            <button class="custom-message-add" onclick="addMessageRow('loss')" ${lossMsgs.length >= 5 ? 'disabled' : ''}>+ Nachricht hinzufügen</button>
            <span class="custom-messages-counter" id="lossCounter">${lossMsgs.length}/5</span>
          </div>
        </div>
      </div>
      <div class="custom-messages-footer">
        <span class="custom-messages-charlimit">Max. 50 Zeichen pro Nachricht</span>
        <button class="custom-messages-save" onclick="saveCustomMessages()">💾 Speichern</button>
      </div>
      <div class="custom-messages-status" id="customMsgStatus"></div>
    </div>
  ` : '';

  // Duel History HTML
  const formatDuelDate = (timestamp: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const duelHistoryHtml = duelHistory.length > 0 ? `
    <div class="duel-history">
      <h3>⚔️ Duell-Historie</h3>
      <div class="duel-history-list">
        ${duelHistory.map(duel => {
          const isChallenger = duel.challenger === username.toLowerCase();
          const opponent = isChallenger ? duel.target : duel.challenger;
          const myGrid = isChallenger ? duel.challengerGrid : duel.targetGrid;
          const opponentGrid = isChallenger ? duel.targetGrid : duel.challengerGrid;
          const myScore = isChallenger ? duel.challengerScore : duel.targetScore;
          const opponentScore = isChallenger ? duel.targetScore : duel.challengerScore;
          const isWinner = duel.winner === username.toLowerCase();
          const isTie = duel.winner === null;
          const resultClass = isTie ? 'tie' : (isWinner ? 'win' : 'loss');
          const resultText = isTie ? 'Unentschieden' : (isWinner ? `+${formatNumber(duel.pot)} DT` : `-${formatNumber(duel.amount)} DT`);
          const resultIcon = isTie ? '🤝' : (isWinner ? '🏆' : '💀');

          return `
            <div class="duel-entry ${resultClass}">
              <div class="duel-date">${formatDuelDate(duel.createdAt)}</div>
              <div class="duel-players">
                <span class="duel-player me">${escapeHtml(username)}</span>
                <span class="duel-vs">vs</span>
                <span class="duel-player opponent">${escapeHtml(opponent)}</span>
              </div>
              <div class="duel-grids">
                <span class="duel-grid">${myGrid.join(' ')}</span>
                <span class="duel-score">${myScore}</span>
                <span class="duel-separator">:</span>
                <span class="duel-score">${opponentScore}</span>
                <span class="duel-grid">${opponentGrid.join(' ')}</span>
              </div>
              <div class="duel-result ${resultClass}">
                <span class="duel-result-icon">${resultIcon}</span>
                <span class="duel-result-text">${resultText}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

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
          <div class="achievement-progress-inline">
            <div class="achievement-progress-bar-track">
              <div class="achievement-progress-bar-fill" style="width: ${ach.progress.percent}%"></div>
            </div>
            <span class="achievement-progress-label">${formatNumber(ach.progress.current)} / ${formatNumber(ach.progress.required)}</span>
          </div>
        `;
      }

      // Rarity display with color coding
      const getRarityClass = (percent: number): string => {
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
            ${progressHtml}
            ${rarityHtml}
          </div>
          ${ach.reward ? `<div class="achievement-reward">+${formatNumber(ach.reward)} DT</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="category ${catClass}">
        <div class="category-header" onclick="toggleCategory(this)">
          <div class="category-title">
            <div class="category-icon">${CATEGORY_ICONS[category] || '🎯'}</div>
            <span>${CATEGORY_NAMES[category] || category}</span>
          </div>
          <div class="category-header-right">
            <div class="category-progress">${catUnlocked}/${catTotal}</div>
            <div class="category-progress-bar">
              <div class="category-progress-fill${catUnlocked === catTotal ? ' complete' : ''}" style="width: ${Math.round((catUnlocked / catTotal) * 100)}%"></div>
            </div>
            <span class="collapse-icon">▼</span>
          </div>
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
  const roleBadges: Array<{ icon: string; label: string; color: string }> = [];

  // Admin/special user badge overrides
  if (ADMIN_ROLE_OVERRIDES[lowerUsername]) {
    for (const role of ADMIN_ROLE_OVERRIDES[lowerUsername]) {
      if (ROLE_BADGES[role]) roleBadges.push({ ...ROLE_BADGES[role] });
    }
  } else if (twitchData?.role && ROLE_BADGES[twitchData.role]) {
    roleBadges.push({ ...ROLE_BADGES[twitchData.role] });
  }

  // Generate role badges HTML
  const roleBadgesHtml = roleBadges.map(badge =>
    `<span class="profile-role-badge" style="--role-color: ${badge.color}">
      <img src="${badge.icon}" alt="${badge.label}" class="profile-role-icon" loading="lazy" width="18" height="18">
      <span>${badge.label}</span>
    </span>`
  ).join('');

  const isComplete = progressPercent === 100;
  const completeBadgeHtml = isComplete ? '<span class="complete-badge">🏆 100% Complete!</span>' : '';

  // Admin panel HTML
  const adminPanelHtml = showAdminPanel ? `
    <div class="admin-panel collapsed" id="adminPanel" data-username="${escapeHtml(username)}">
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
              <input type="number" id="adminBalance" value="${balance}" min="0" max="1000000" class="admin-input">
              <button class="btn admin-btn" onclick="adminSetBalance()">Setzen</button>
            </div>
          </div>
          <div class="admin-control">
            <label>Disclaimer</label>
            <div class="admin-toggle-group">
              <span class="admin-status ${hasDisclaimer ? 'active' : ''}">${hasDisclaimer ? '✓ Akzeptiert' : '✗ Nicht akzeptiert'}</span>
              <button class="btn admin-btn ${hasDisclaimer ? 'danger' : 'success'}" onclick="adminSetDisclaimer(${!hasDisclaimer})">${hasDisclaimer ? 'Entfernen' : 'Setzen'}</button>
            </div>
          </div>
          <div class="admin-control">
            <label>Self-Ban</label>
            <div class="admin-toggle-group">
              <span class="admin-status ${selfBanned ? 'active danger' : ''}">${selfBanned ? '🚫 Gesperrt' : '✓ Nicht gesperrt'}</span>
              <button class="btn admin-btn ${selfBanned ? 'success' : 'danger'}" onclick="adminSetSelfBan(${!selfBanned})">${selfBanned ? 'Entsperren' : 'Sperren'}</button>
            </div>
          </div>
          <div class="admin-control">
            <label>Duelle</label>
            <div class="admin-toggle-group">
              <span class="admin-status ${duelOptOut ? 'danger' : 'active'}">${duelOptOut ? '✗ Deaktiviert' : '✓ Aktiviert'}</span>
              <button class="btn admin-btn" onclick="adminSetDuelOpt(${!duelOptOut})">${duelOptOut ? 'Aktivieren' : 'Deaktivieren'}</button>
            </div>
          </div>
          <div class="admin-control">
            <label>Leaderboard</label>
            <div class="admin-toggle-group">
              <span class="admin-status ${leaderboardHidden ? 'danger' : 'active'}">${leaderboardHidden ? '✗ Versteckt' : '✓ Sichtbar'}</span>
              <button class="btn admin-btn" onclick="adminSetLeaderboardHidden(${!leaderboardHidden})">${leaderboardHidden ? 'Anzeigen' : 'Verstecken'}</button>
            </div>
          </div>
          <div class="admin-control admin-control-wide">
            <label>Achievement</label>
            <div class="admin-input-group">
              <select id="adminAchievement" class="admin-input admin-select">
                ${achievements.map(a => `<option value="${a.id}" data-unlocked="${a.unlocked}">${a.unlocked ? '✓' : '○'} ${escapeHtml(a.name)}</option>`).join('')}
              </select>
              <button class="btn admin-btn success" onclick="adminSetAchievement(true)">Freischalten</button>
              <button class="btn admin-btn danger" onclick="adminSetAchievement(false)">Sperren</button>
            </div>
          </div>
          <div class="admin-control admin-control-wide">
            <label>💸 Shop-Refund</label>
            <div class="admin-refund-section">
              <button class="btn admin-btn" onclick="loadRefundableItems()">Refund-Items laden</button>
              <div id="refundItemsContainer" class="admin-refund-items" style="display: none;"></div>
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
  ` : '';

  const content = `
    ${isComplete ? '<div class="confetti-container" id="confetti"></div>' : ''}
    <div class="profile-header${isComplete ? ' complete' : ''}">
      <div class="profile-top">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}" class="profile-avatar" loading="lazy" width="80" height="80">` : ''}
        <div class="profile-info">
          <div class="profile-name">
            ${escapeHtml(displayName)}
            ${completeBadgeHtml}
          </div>
          <div class="profile-badges">
            ${roleBadgesHtml}
            ${rank && PRESTIGE_RANK_NAMES[rank] ? `<span class="profile-prestige-badge" style="--prestige-color: ${PRESTIGE_RANK_NAMES[rank].color}">Prestige Rang: ${rank} ${PRESTIGE_RANK_NAMES[rank].name}</span>` : ''}
            <span class="profile-duel-status ${duelOptOut ? 'opted-out' : 'opted-in'}">⚔️ ${duelOptOut ? 'Duelle deaktiviert' : 'Offen für Duelle'}</span>
            <span class="profile-duel-hint">Duelle an/aus: <code>!slots duelopt</code></span>
            ${selfBanned ? `<span class="profile-selfban-status banned">🚫 Selbst-gesperrt</span>` : ''}
          </div>
          ${lastActiveText ? `<div class="profile-last-active">🕐 Zuletzt aktiv: ${lastActiveText}</div>` : ''}
        </div>
      </div>
      ${statsHtml}
      ${customMessagesHtml}
      ${duelHistoryHtml}
      <div class="achievement-summary">
        <div class="achievement-count">
          <span class="achievement-count-label">🏆 Achievements</span>
          <span class="achievement-count-value"><strong>${unlockedCount}</strong> / ${totalCount}</span>
          <span class="achievement-count-percent">(${progressPercent}%)</span>
        </div>
        <div class="progress-bar achievement-progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
      </div>
    </div>
    ${adminPanelHtml}
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
      <div class="achievement-collapse-controls" role="group" aria-label="Kategorien ein-/ausklappen">
        <button class="collapse-all-btn" onclick="collapseAllCategories()">Alle einklappen</button>
        <button class="collapse-all-btn" onclick="expandAllCategories()">Alle ausklappen</button>
      </div>
    </div>
    <div class="categories">
      ${categoriesHtml}
    </div>
  `;

  return baseTemplate(`${username}'s Profil`, content, 'profile', loggedInUser);
}
