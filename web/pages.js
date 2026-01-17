/**
 * HTML Page Generators for Achievement Website
 * Server-side rendered pages with inline CSS
 */

import { CSS } from './styles.js';
import { getPlayerAchievements, getStats, getBalance, getPrestigeRank, hasAcceptedDisclaimer } from '../database.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES, SHOP_ITEMS } from '../constants.js';
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
      case 'info':
        return htmlResponse(renderInfoPage());
      case 'shop':
        return htmlResponse(renderShopPage());
      case 'changelog':
        return htmlResponse(renderChangelogPage());
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

  // Check if user exists (check both disclaimer AND balance for legacy players)
  const [hasDisclaimer, balance] = await Promise.all([
    hasAcceptedDisclaimer(username, env),
    getBalance(username, env)
  ]);

  // User exists if they accepted disclaimer OR have a balance (legacy players)
  const userExists = hasDisclaimer || balance > 0;
  if (!userExists) {
    return htmlResponse(renderNotFoundPage(username));
  }

  // Fetch remaining data in parallel (balance already fetched above)
  const [rank, stats, achievementData] = await Promise.all([
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
          const username = batch[j].name.replace('user:', '');
          // Filter out DachsBank (not a real player)
          if (!isNaN(balance) && balance > 0 && username.toLowerCase() !== 'dachsbank') {
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

// ==================== DISCLAIMER ====================

const DISCLAIMER_HTML = `
<div class="disclaimer">
  <div class="disclaimer-icon">⚠️</div>
  <div class="disclaimer-content">
    <p><strong>Dachsbau Slots ist ein reines Unterhaltungsspiel.</strong> Es werden keine echten Geldbeträge verwendet.</p>
    <p><strong>DachsTaler (DT)</strong> sind eine rein virtuelle Währung ohne jeglichen realen Geldwert. Sie können nicht in echtes Geld umgetauscht werden.</p>
    <p>Die Streamerin <strong>frechhdachs</strong> distanziert sich ausdrücklich von echtem Glücksspiel und übernimmt keine Haftung. Spiel lieber hier im Dachsbau - du kannst nicht ins Minus rutschen! 🦡</p>
  </div>
</div>
`;

// ==================== HTML RENDERERS ====================

/**
 * Base HTML template with navigation
 */
function baseTemplate(title, content, activePage = '') {
  const navItems = [
    { page: 'home', label: 'Start', icon: '🏠' },
    { page: 'info', label: 'Info', icon: 'ℹ️' },
    { page: 'shop', label: 'Shop', icon: '🛒' },
    { page: 'changelog', label: 'Changelog', icon: '📜' },
    { page: 'leaderboard', label: 'Leaderboard', icon: '🏆' }
  ];

  const navHtml = navItems.map(item => {
    const isActive = activePage === item.page ? ' active' : '';
    return `<a href="?page=${item.page}" class="nav-item${isActive}">${item.icon} ${item.label}</a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Dachsbau Slots</title>
  <style>${CSS}</style>
  <script>
    // Theme handling - check localStorage, default to dark
    (function() {
      const theme = localStorage.getItem('theme') || 'dark';
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  </script>
</head>
<body>
  <header class="header">
    <div class="header-content">
      <a href="?page=home" class="logo">
        <span class="logo-emoji">🦡</span>
        <span class="logo-text">Dachsbau Slots</span>
      </a>
      <nav class="nav-bar">
        ${navHtml}
      </nav>
      <form class="search-form" action="" method="get">
        <input type="hidden" name="page" value="profile">
        <input type="text" name="user" placeholder="Spielername..." class="search-input" required>
        <button type="submit" class="btn">Suchen</button>
      </form>
      <button class="theme-toggle" onclick="toggleTheme()" title="Theme wechseln">
        <span class="theme-toggle-icon">🌙</span>
        <span class="theme-toggle-label">Dark</span>
      </button>
    </div>
  </header>
  <main class="container">
    ${DISCLAIMER_HTML}
    ${content}
  </main>
  <footer class="footer">
    <p>Dachsbau Slots - Made by Exaint für <a href="https://www.twitch.tv/frechhdachs" target="_blank" rel="noopener" class="footer-link">@frechhdachs</a></p>
  </footer>
  <script>
    // Theme toggle function
    function toggleTheme() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      if (newTheme === 'light') {
        html.setAttribute('data-theme', 'light');
      } else {
        html.removeAttribute('data-theme');
      }

      localStorage.setItem('theme', newTheme);
      updateThemeButton(newTheme);
    }

    function updateThemeButton(theme) {
      const icon = document.querySelector('.theme-toggle-icon');
      const label = document.querySelector('.theme-toggle-label');
      if (icon && label) {
        icon.textContent = theme === 'light' ? '☀️' : '🌙';
        label.textContent = theme === 'light' ? 'Light' : 'Dark';
      }
    }

    // Update button on load
    document.addEventListener('DOMContentLoaded', function() {
      const theme = localStorage.getItem('theme') || 'dark';
      updateThemeButton(theme);

      // Achievement filter functionality
      const filterBtns = document.querySelectorAll('.filter-btn');
      if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
          btn.addEventListener('click', function() {
            const filter = this.dataset.filter;

            // Update active button
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Filter achievements
            const achievements = document.querySelectorAll('.achievement');
            achievements.forEach(ach => {
              const isUnlocked = ach.classList.contains('unlocked');
              const isLocked = ach.classList.contains('locked');

              if (filter === 'all') {
                ach.style.display = '';
              } else if (filter === 'unlocked') {
                ach.style.display = isUnlocked ? '' : 'none';
              } else if (filter === 'locked') {
                ach.style.display = isLocked ? '' : 'none';
              }
            });

            // Hide empty categories
            const categories = document.querySelectorAll('.category');
            categories.forEach(cat => {
              const visibleAchievements = cat.querySelectorAll('.achievement:not([style*="display: none"])');
              cat.style.display = visibleAchievements.length > 0 ? '' : 'none';
            });
          });
        });
      }
    });
  </script>
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

  return baseTemplate('Home', content, 'home');
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

  // Special badges for admins
  const lowerUsername = username.toLowerCase();
  let badgeHtml = '';
  if (lowerUsername === 'exaint_') {
    badgeHtml = `<img src="https://assets.help.twitch.tv/article/img/000002212-07.png" alt="Lead-Mod" class="profile-badge" title="Lead-Mod"><span class="profile-title">Head-Mod / Dachsbau-Slots Admin</span>`;
  } else if (lowerUsername === 'frechhdachs') {
    badgeHtml = `<img src="https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1" alt="Broadcaster" class="profile-badge" title="Broadcaster"><span class="profile-title">Streamerin / Dachsbau-Slots Admin</span>`;
  }

  const content = `
    <div class="profile-header">
      <div class="profile-name">
        ${escapeHtml(username)}
        ${badgeHtml}
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
    <div class="achievement-filter">
      <span class="filter-label">Filter:</span>
      <button class="filter-btn active" data-filter="all">Alle</button>
      <button class="filter-btn" data-filter="unlocked">Freigeschaltet</button>
      <button class="filter-btn" data-filter="locked">Gesperrt</button>
    </div>
    <div class="categories">
      ${categoriesHtml}
    </div>
  `;

  return baseTemplate(`${username}'s Profil`, content, 'profile');
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

  return baseTemplate('Leaderboard', content, 'leaderboard');
}

/**
 * Info page
 */
function renderInfoPage() {
  const content = `
    <div class="content-page">
      <h1 class="page-title">ℹ️ Info & Commands</h1>

      <section class="content-section">
        <h2>🚀 Schnellstart</h2>
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

      <section class="content-section">
        <h2>📋 Haupt-Commands</h2>
        <div class="command-list">
          <div class="command-item">
            <code>!slots</code>
            <span>Spin fuer 10 DachsTaler (30 Sek Cooldown)</span>
          </div>
          <div class="command-item">
            <code>!slots [20/30/50/100/all]</code>
            <span>Hoehere Einsaetze (benoetigtt Unlock)</span>
          </div>
          <div class="command-item">
            <code>!slots daily</code>
            <span>Taeglicher Bonus (+50 DachsTaler)</span>
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
            <code>!slots lb</code>
            <span>Top 5 Leaderboard</span>
          </div>
        </div>
      </section>

      <section class="content-section">
        <h2>🛒 Shop & Transfer</h2>
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
      </section>

      <section class="content-section">
        <h2>⚔️ Duell-Commands</h2>
        <div class="command-list">
          <div class="command-item">
            <code>!slots duel @user [Betrag]</code>
            <span>Fordere jemanden zum Duell heraus (min. 100 DT)</span>
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
            <code>!slots duelopt out/in</code>
            <span>Duelle deaktivieren/aktivieren</span>
          </div>
        </div>
      </section>

      <section class="content-section">
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
      </section>

      <section class="content-section">
        <h2>📞 Hilfe bei Glücksspielproblemen</h2>
        <div class="help-table">
          <div class="help-row">
            <span>🇩🇪 Deutschland</span>
            <span>0800 - 1 37 27 00</span>
            <a href="https://check-dein-spiel.de" target="_blank" rel="noopener">check-dein-spiel.de</a>
          </div>
          <div class="help-row">
            <span>🇦🇹 Oesterreich</span>
            <span>0800 - 20 20 11</span>
            <a href="https://spielsuchthilfe.at" target="_blank" rel="noopener">spielsuchthilfe.at</a>
          </div>
          <div class="help-row">
            <span>🇨🇭 Schweiz</span>
            <span>0800 - 040 080</span>
            <a href="https://sos-spielsucht.ch" target="_blank" rel="noopener">sos-spielsucht.ch</a>
          </div>
        </div>
        <p style="margin-top: 16px; color: var(--text-secondary);">
          Du kannst dich jederzeit mit <code>!slots selfban</code> selbst vom Spielen ausschliessen.
          Nur Admins koennen den Selfban wieder aufheben.
        </p>
      </section>
    </div>
  `;

  return baseTemplate('Info & Commands', content, 'info');
}

/**
 * Shop page
 */
function renderShopPage() {
  // Group items by type
  const itemsByType = {
    instant: [],
    boost: [],
    timed: [],
    uses: [],
    unlock: [],
    prestige: []
  };

  Object.entries(SHOP_ITEMS).forEach(([id, item]) => {
    const type = item.type || 'instant';
    if (itemsByType[type]) {
      itemsByType[type].push({ id: parseInt(id, 10), ...item });
    }
  });

  const renderItemGroup = (title, icon, items) => {
    if (items.length === 0) return '';

    const itemsHtml = items.map(item => `
      <div class="shop-item">
        <div class="shop-item-header">
          <span class="shop-item-id">#${item.id}</span>
          <span class="shop-item-name">${escapeHtml(item.name)}</span>
          <span class="shop-item-price">${formatNumber(item.price)} DT</span>
        </div>
        <div class="shop-item-command">!shop buy ${item.id}</div>
      </div>
    `).join('');

    return `
      <div class="shop-category">
        <h3 class="shop-category-title">${icon} ${title}</h3>
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

      ${renderItemGroup('Instant Items', '⚡', itemsByType.instant)}
      ${renderItemGroup('Symbol-Boosts', '🔥', itemsByType.boost)}
      ${renderItemGroup('Timed Buffs', '⏰', itemsByType.timed)}
      ${renderItemGroup('Uses Items', '🔢', itemsByType.uses)}
      ${renderItemGroup('Unlocks', '🔓', itemsByType.unlock)}
      ${renderItemGroup('Prestige Raenge', '👑', itemsByType.prestige)}
    </div>
  `;

  return baseTemplate('Shop', content, 'shop');
}

/**
 * Changelog page
 */
function renderChangelogPage() {
  const content = `
    <div class="content-page">
      <h1 class="page-title">📜 Changelog</h1>
      <p class="page-subtitle">Aktuelle Version: 1.6.0 - "Duell-System"</p>

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
            <li>DachsTaler Waehrung</li>
            <li>Shop-System mit 30+ Items</li>
            <li>Prestige-Raenge</li>
          </ul>
        </div>
      </section>
    </div>
  `;

  return baseTemplate('Changelog', content, 'changelog');
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
