/**
 * HTML Page Generators for Achievement Website
 * Server-side rendered pages with inline CSS
 */

import { CSS } from './styles.js';
import { getPlayerAchievements, getStats, getBalance, getPrestigeRank, hasAcceptedDisclaimer } from '../database.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES } from '../constants.js';
import { logError } from '../utils.js';

const CATEGORY_ICONS = {
  [ACHIEVEMENT_CATEGORIES.SPINNING]: '🎰',
  [ACHIEVEMENT_CATEGORIES.WINNING]: '🏆',
  [ACHIEVEMENT_CATEGORIES.COLLECTING]: '💰',
  [ACHIEVEMENT_CATEGORIES.SOCIAL]: '👥',
  [ACHIEVEMENT_CATEGORIES.DEDICATION]: '📅',
  [ACHIEVEMENT_CATEGORIES.SHOPPING]: '🛒',
  [ACHIEVEMENT_CATEGORIES.SPECIAL]: '⭐'
};

const CATEGORY_NAMES = {
  [ACHIEVEMENT_CATEGORIES.SPINNING]: 'Spinning',
  [ACHIEVEMENT_CATEGORIES.WINNING]: 'Winning',
  [ACHIEVEMENT_CATEGORIES.COLLECTING]: 'Sammeln',
  [ACHIEVEMENT_CATEGORIES.SOCIAL]: 'Social',
  [ACHIEVEMENT_CATEGORIES.DEDICATION]: 'Hingabe',
  [ACHIEVEMENT_CATEGORIES.SHOPPING]: 'Shopping',
  [ACHIEVEMENT_CATEGORIES.SPECIAL]: 'Spezial'
};

/**
 * Handle web page requests
 */
export async function handleWebPage(page, url, env) {
  try {
    switch (page) {
      case 'home':
        return htmlResponse(renderHomePage());
      case 'profile':
        return await handleProfilePage(url, env);
      case 'leaderboard':
        return await handleLeaderboardPage(env);
      default:
        return htmlResponse(renderNotFoundPage());
    }
  } catch (error) {
    logError('handleWebPage', error, { page });
    return htmlResponse(renderErrorPage());
  }
}

/**
 * Profile page handler
 */
async function handleProfilePage(url, env) {
  const username = url.searchParams.get('user');

  if (!username) {
    return htmlResponse(renderHomePage('Bitte gib einen Spielernamen ein.'));
  }

  // Check if user exists
  const hasPlayed = await hasAcceptedDisclaimer(username, env);
  if (!hasPlayed) {
    return htmlResponse(renderNotFoundPage(username));
  }

  // Fetch all data in parallel
  const [balance, rank, stats, achievementData] = await Promise.all([
    getBalance(username, env),
    getPrestigeRank(username, env),
    getStats(username, env),
    getPlayerAchievements(username, env)
  ]);

  const allAchievements = getAllAchievements();

  // Build achievements with unlock status
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

    return {
      ...ach,
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

  return htmlResponse(renderProfilePage({
    username,
    balance,
    rank,
    stats,
    achievements,
    byCategory,
    pendingRewards: achievementData.pendingRewards
  }));
}

/**
 * Leaderboard page handler
 */
async function handleLeaderboardPage(env) {
  const LEADERBOARD_LIMIT = 1000;
  const BATCH_SIZE = 100;

  try {
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

    if (!listResult.keys || listResult.keys.length === 0) {
      return htmlResponse(renderLeaderboardPage([]));
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
          if (!isNaN(balance) && balance > 0) {
            users.push({
              username: batch[j].name.replace('user:', ''),
              balance
            });
          }
        }
      }
    }

    // Sort by balance descending
    users.sort((a, b) => b.balance - a.balance);

    return htmlResponse(renderLeaderboardPage(users.slice(0, 100)));
  } catch (error) {
    logError('handleLeaderboardPage', error);
    return htmlResponse(renderErrorPage());
  }
}

/**
 * Map achievement IDs to stat keys
 */
function getStatKeyForAchievement(achievementId) {
  const mapping = {
    'spin_100': 'totalSpins',
    'spin_500': 'totalSpins',
    'spin_1000': 'totalSpins',
    'spin_5000': 'totalSpins',
    'spin_10000': 'totalSpins',
    'win_100': 'wins',
    'win_500': 'wins',
    'win_1000': 'wins',
    'transfer_1000': 'totalTransferred',
    'transfer_10000': 'totalTransferred',
    'duel_win_10': 'duelsWon',
    'duel_win_50': 'duelsWon',
    'duel_win_100': 'duelsWon',
    'daily_7': 'dailysClaimed',
    'daily_14': 'dailysClaimed',
    'daily_21': 'dailysClaimed',
    'daily_28': 'dailysClaimed',
    'shop_10': 'shopPurchases',
    'shop_50': 'shopPurchases',
    'shop_100': 'shopPurchases'
  };
  return mapping[achievementId] || null;
}

// ==================== HTML RENDERERS ====================

/**
 * Base HTML template
 */
function baseTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Dachsbau Slots</title>
  <style>${CSS}</style>
</head>
<body>
  <header class="header">
    <div class="header-content">
      <a href="?page=home" class="logo">
        <span class="logo-emoji">🦡</span>
        <span>Dachsbau Slots</span>
      </a>
      <form class="search-form" action="" method="get">
        <input type="hidden" name="page" value="profile">
        <input type="text" name="user" placeholder="Spielername..." class="search-input" required>
        <button type="submit" class="btn">Suchen</button>
      </form>
    </div>
  </header>
  <main class="container">
    ${content}
  </main>
  <footer class="footer">
    <p>Dachsbau Slots - Ein Twitch Chat Spiel</p>
  </footer>
</body>
</html>`;
}

/**
 * Home page
 */
function renderHomePage(errorMessage = null) {
  const errorHtml = errorMessage
    ? `<p style="color: var(--error); margin-bottom: 16px;">${escapeHtml(errorMessage)}</p>`
    : '';

  const content = `
    <div class="hero">
      <h1 class="hero-title">🦡 Dachsbau Slots</h1>
      <p class="hero-subtitle">Schau dir die Achievements und Stats von Spielern an!</p>
      ${errorHtml}
      <div class="hero-search">
        <form class="search-form" action="" method="get">
          <input type="hidden" name="page" value="profile">
          <input type="text" name="user" placeholder="Spielername eingeben..." class="search-input" required autofocus>
          <button type="submit" class="btn">Profil anzeigen</button>
        </form>
      </div>
      <div style="margin-top: 32px;">
        <a href="?page=leaderboard" class="btn btn-secondary">Leaderboard anzeigen</a>
      </div>
    </div>
  `;

  return baseTemplate('Home', content);
}

/**
 * Profile page
 */
function renderProfilePage(data) {
  const { username, balance, rank, stats, achievements, byCategory, pendingRewards } = data;

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

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
        <div class="stat-label">Bester Gewinn</div>
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

      return `
        <div class="achievement ${statusClass}">
          <div class="achievement-icon">${icon}</div>
          <div class="achievement-info">
            <div class="achievement-name">${escapeHtml(ach.name)}</div>
            <div class="achievement-desc">${escapeHtml(ach.description)}</div>
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

  const content = `
    <div class="profile-header">
      <div class="profile-name">
        ${escapeHtml(username)}
        ${rank ? `<span class="profile-rank">${escapeHtml(rank)}</span>` : ''}
      </div>
      ${statsHtml}
      <div class="achievement-summary">
        <div class="achievement-count">
          <strong>${unlockedCount}</strong> / ${totalCount} Achievements
          ${pendingRewards > 0 ? `<span style="color: var(--dachs-gold);"> (${formatNumber(pendingRewards)} DT ausstehend)</span>` : ''}
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
      </div>
    </div>
    <div class="categories">
      ${categoriesHtml}
    </div>
  `;

  return baseTemplate(`${username}'s Profil`, content);
}

/**
 * Leaderboard page
 */
function renderLeaderboardPage(players) {
  const getRankDisplay = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const playersHtml = players.length === 0
    ? '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Noch keine Spieler gefunden.</p>'
    : players.map((player, index) => `
        <a href="?page=profile&user=${encodeURIComponent(player.username)}" class="leaderboard-item">
          <div class="leaderboard-rank">${getRankDisplay(index)}</div>
          <div class="leaderboard-user">
            <span class="leaderboard-username">${escapeHtml(player.username)}</span>
          </div>
          <div class="leaderboard-balance">${formatNumber(player.balance)} DT</div>
        </a>
      `).join('');

  const content = `
    <div class="leaderboard">
      <div class="leaderboard-header">
        <h1 class="leaderboard-title">🏆 Leaderboard</h1>
      </div>
      <div class="leaderboard-list">
        ${playersHtml}
      </div>
    </div>
  `;

  return baseTemplate('Leaderboard', content);
}

/**
 * Not found page
 */
function renderNotFoundPage(username = null) {
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

  return baseTemplate('Nicht gefunden', content);
}

/**
 * Error page
 */
function renderErrorPage() {
  const content = `
    <div class="not-found">
      <div class="not-found-emoji">🦡💥</div>
      <h1 class="not-found-title">Fehler</h1>
      <p class="not-found-text">Ein unerwarteter Fehler ist aufgetreten.</p>
      <a href="?page=home" class="btn">Zur Startseite</a>
    </div>
  `;

  return baseTemplate('Fehler', content);
}

// ==================== HELPERS ====================

/**
 * Create HTML response
 */
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format numbers with thousand separators
 */
function formatNumber(num) {
  return new Intl.NumberFormat('de-DE').format(num);
}
