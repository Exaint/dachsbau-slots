/**
 * HTML Page Generators for Achievement Website
 * Server-side rendered pages with inline CSS
 */

import { CSS } from './styles.js';
import { getPlayerAchievements, getStats, getBalance, getPrestigeRank, hasAcceptedDisclaimer, getLastActive, getAchievementStats } from '../database.js';
import { isDuelOptedOut } from '../database/duels.js';
import { getTwitchProfileData } from './twitch.js';
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

// Prestige rank names for display
const PRESTIGE_RANK_NAMES = {
  '🥉': 'Bronze',
  '🥈': 'Silber',
  '🥇': 'Gold',
  '💎': 'Diamant',
  '👑': 'Legende'
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
      case 'stats':
        return await handleGlobalStatsPage(env);
      case 'impressum':
        return htmlResponse(renderImpressumPage());
      case 'datenschutz':
        return htmlResponse(renderDatenschutzPage());
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
  const [rank, stats, achievementData, lastActive, achievementStats, duelOptOut, twitchData] = await Promise.all([
    getPrestigeRank(username, env),
    getStats(username, env),
    getPlayerAchievements(username, env),
    getLastActive(username, env),
    getAchievementStats(env),
    isDuelOptedOut(username, env),
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
    twitchData
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
    { page: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { page: 'stats', label: 'Statistiken', icon: '📊' }
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
      <button class="hamburger" onclick="toggleMobileNav()" aria-label="Menü">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </header>
  <nav class="mobile-nav" id="mobileNav">
    ${navHtml}
  </nav>
  <main class="container">
    ${DISCLAIMER_HTML}
    ${content}
  </main>
  <footer class="footer">
    <p>Dachsbau Slots - Made by Exaint für <a href="https://www.twitch.tv/frechhdachs" target="_blank" rel="noopener" class="footer-link">@frechhdachs</a></p>
    <p class="footer-legal"><a href="?page=impressum">Impressum</a> · <a href="?page=datenschutz">Datenschutz</a></p>
  </footer>

  <!-- Achievement Detail Modal -->
  <div class="modal-overlay" id="achievementModal" onclick="closeAchievementModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeAchievementModal()">&times;</button>
      <div class="modal-header">
        <div class="modal-icon" id="modalIcon"></div>
        <h2 id="modalName"></h2>
      </div>
      <p class="modal-desc" id="modalDesc"></p>
      <div class="modal-details">
        <div class="modal-detail" id="modalCategory"></div>
        <div class="modal-detail" id="modalRarity"></div>
        <div class="modal-detail" id="modalStatus"></div>
        <div class="modal-detail" id="modalProgress"></div>
      </div>
    </div>
  </div>

  <script>
    // Achievement detail modal
    function showAchievementDetail(el) {
      const modal = document.getElementById('achievementModal');
      const name = el.dataset.name;
      const desc = el.dataset.desc;
      const category = el.dataset.category;
      const rarity = el.dataset.rarity;
      const rarityCount = el.dataset.rarityCount;
      const rarityTotal = el.dataset.rarityTotal;
      const unlocked = el.dataset.unlocked === 'true';
      const unlockedAt = el.dataset.unlockedAt;
      const progressCurrent = el.dataset.progressCurrent;
      const progressRequired = el.dataset.progressRequired;

      document.getElementById('modalIcon').textContent = unlocked ? '✅' : '🔒';
      document.getElementById('modalName').textContent = name;
      document.getElementById('modalDesc').textContent = desc;
      document.getElementById('modalCategory').innerHTML = '<strong>Kategorie:</strong> ' + category;
      document.getElementById('modalRarity').innerHTML = '<strong>Seltenheit:</strong> ' + rarity + '% (' + rarityCount + ' von ' + rarityTotal + ' Spielern)';

      if (unlocked && unlockedAt) {
        document.getElementById('modalStatus').innerHTML = '<strong>Freigeschaltet:</strong> ' + unlockedAt;
        document.getElementById('modalStatus').style.display = 'block';
      } else {
        document.getElementById('modalStatus').style.display = 'none';
      }

      if (!unlocked && progressCurrent && progressRequired) {
        document.getElementById('modalProgress').innerHTML = '<strong>Fortschritt:</strong> ' + progressCurrent + ' / ' + progressRequired;
        document.getElementById('modalProgress').style.display = 'block';
      } else {
        document.getElementById('modalProgress').style.display = 'none';
      }

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeAchievementModal(event) {
      if (event && event.target !== event.currentTarget) return;
      const modal = document.getElementById('achievementModal');
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeAchievementModal();
    });

    // Mobile navigation toggle
    function toggleMobileNav() {
      const hamburger = document.querySelector('.hamburger');
      const mobileNav = document.getElementById('mobileNav');
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active');
      document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
    }

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

      // Achievement sort functionality
      const sortBtns = document.querySelectorAll('.sort-btn');
      const categoriesContainer = document.querySelector('.categories');
      if (sortBtns.length > 0 && categoriesContainer) {
        sortBtns.forEach(btn => {
          btn.addEventListener('click', function() {
            const sortType = this.dataset.sort;

            // Update active button
            sortBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            if (sortType === 'category') {
              // Restore original category view
              document.querySelectorAll('.category').forEach(cat => {
                cat.style.display = '';
              });
              const sortedList = document.getElementById('sortedAchievements');
              if (sortedList) sortedList.remove();
            } else {
              // Hide categories and show sorted list
              document.querySelectorAll('.category').forEach(cat => {
                cat.style.display = 'none';
              });

              // Collect all achievements
              const achievements = Array.from(document.querySelectorAll('.achievement'));
              const sorted = achievements.sort((a, b) => {
                const rarityA = parseInt(a.dataset.rarity) || 0;
                const rarityB = parseInt(b.dataset.rarity) || 0;
                return sortType === 'rarity-asc' ? rarityA - rarityB : rarityB - rarityA;
              });

              // Remove existing sorted list
              const existingList = document.getElementById('sortedAchievements');
              if (existingList) existingList.remove();

              // Create new sorted list
              const sortedContainer = document.createElement('div');
              sortedContainer.id = 'sortedAchievements';
              sortedContainer.className = 'sorted-achievements';
              sorted.forEach(ach => {
                const clone = ach.cloneNode(true);
                sortedContainer.appendChild(clone);
              });
              categoriesContainer.appendChild(sortedContainer);
            }
          });
        });
      }

      // Search suggestions functionality
      const searchInputs = document.querySelectorAll('.search-input');
      searchInputs.forEach(input => {
        let suggestionsContainer = null;
        let debounceTimer = null;

        // Create suggestions container
        const wrapper = document.createElement('div');
        wrapper.className = 'search-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'search-suggestions';
        wrapper.appendChild(suggestionsContainer);

        input.addEventListener('input', function() {
          const query = this.value.trim();

          clearTimeout(debounceTimer);
          if (query.length < 2) {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
            return;
          }

          debounceTimer = setTimeout(async () => {
            try {
              const response = await fetch('?api=search&q=' + encodeURIComponent(query));
              const data = await response.json();

              if (data.players && data.players.length > 0) {
                suggestionsContainer.innerHTML = data.players.map(player =>
                  '<div class="suggestion-item" data-username="' + player + '">' + player + '</div>'
                ).join('');
                suggestionsContainer.style.display = 'block';
              } else {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
              }
            } catch (e) {
              suggestionsContainer.style.display = 'none';
            }
          }, 200);
        });

        // Handle suggestion click
        suggestionsContainer.addEventListener('click', function(e) {
          if (e.target.classList.contains('suggestion-item')) {
            input.value = e.target.dataset.username;
            suggestionsContainer.style.display = 'none';
            input.closest('form').submit();
          }
        });

        // Hide suggestions on blur
        input.addEventListener('blur', function() {
          setTimeout(() => {
            suggestionsContainer.style.display = 'none';
          }, 200);
        });
      });

      // Confetti effect for 100% completion
      const confettiContainer = document.getElementById('confetti');
      if (confettiContainer) {
        const colors = ['#ffd700', '#ff6b9d', '#00f593', '#9147ff', '#00bfff', '#ff7f50'];
        const shapes = ['■', '●', '▲', '★', '♦'];

        for (let i = 0; i < 100; i++) {
          const confetti = document.createElement('div');
          confetti.className = 'confetti';
          confetti.style.left = Math.random() * 100 + '%';
          confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
          confetti.style.animationDelay = Math.random() * 3 + 's';
          confetti.style.animationDuration = (3 + Math.random() * 2) + 's';
          confetti.textContent = shapes[Math.floor(Math.random() * shapes.length)];
          confetti.style.fontSize = (8 + Math.random() * 12) + 'px';
          confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
          confettiContainer.appendChild(confetti);
        }

        // Remove confetti after animation
        setTimeout(() => {
          confettiContainer.remove();
        }, 6000);
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

// Role badge info
const ROLE_BADGES = {
  broadcaster: {
    icon: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1',
    label: 'Broadcaster',
    class: 'role-broadcaster'
  },
  moderator: {
    icon: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1',
    label: 'Moderator',
    class: 'role-moderator'
  },
  vip: {
    icon: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3',
    label: 'VIP',
    class: 'role-vip'
  }
};

/**
 * Profile page
 */
function renderProfilePage(data) {
  const { username, balance, rank, stats, achievements, byCategory, lastActive, duelOptOut, twitchData } = data;

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

  // Role badge from Twitch API
  const lowerUsername = username.toLowerCase();
  let roleBadgeHtml = '';
  let roleTitle = '';

  // Special admin overrides
  if (lowerUsername === 'exaint_') {
    roleBadgeHtml = `<img src="https://assets.help.twitch.tv/article/img/000002212-07.png" alt="Lead-Mod" class="profile-badge" title="Lead-Mod">`;
    roleTitle = 'Head-Mod / Dachsbau-Slots Admin';
  } else if (lowerUsername === 'frechhdachs') {
    roleBadgeHtml = `<img src="${ROLE_BADGES.broadcaster.icon}" alt="Broadcaster" class="profile-badge" title="Broadcaster">`;
    roleTitle = 'Streamerin / Dachsbau-Slots Admin';
  } else if (twitchData?.role && ROLE_BADGES[twitchData.role]) {
    const badge = ROLE_BADGES[twitchData.role];
    roleBadgeHtml = `<img src="${badge.icon}" alt="${badge.label}" class="profile-badge" title="${badge.label}">`;
    roleTitle = badge.label;
  }

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
            ${roleBadgeHtml}
            ${roleTitle ? `<span class="profile-title">${roleTitle}</span>` : ''}
            ${completeBadgeHtml}
          </div>
          <div class="profile-badges">
            ${rank ? `<span class="profile-rank">Prestige Rang: ${escapeHtml(rank)} ${PRESTIGE_RANK_NAMES[rank] || ''}</span>` : ''}
            <span class="profile-duel-status ${duelOptOut ? 'opted-out' : 'opted-in'}">⚔️ ${duelOptOut ? 'Duelle deaktiviert' : 'Offen für Duelle'}<span class="duel-info-icon" data-tooltip="Du möchtest dich von Duellen ausschließen? Schreib &quot;!slots duelopt out&quot; im Chat.">ⓘ</span></span>
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
    <div class="achievement-controls">
      <div class="achievement-filter">
        <span class="filter-label">Filter:</span>
        <button class="filter-btn active" data-filter="all">Alle</button>
        <button class="filter-btn" data-filter="unlocked">Freigeschaltet</button>
        <button class="filter-btn" data-filter="locked">Gesperrt</button>
      </div>
      <div class="achievement-sort">
        <span class="filter-label">Sortierung:</span>
        <button class="sort-btn active" data-sort="category">Kategorie</button>
        <button class="sort-btn" data-sort="rarity-asc">Seltenste</button>
        <button class="sort-btn" data-sort="rarity-desc">Häufigste</button>
      </div>
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
        <h2>🌐 Website & Erfolge</h2>
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
          Nur Admins können den Selfban wieder aufheben.
        </p>
      </section>
    </div>
  `;

  return baseTemplate('Info & Commands', content, 'info');
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
  22: 'Silber Prestige-Rang mit 🥈 Badge (benötigt Bronze)',
  23: 'Schaltet !slots 100 frei - setze bis zu 100 DT pro Spin',
  24: '1 Stunde lang +100% auf alle Gewinne',
  25: 'Schaltet !slots all frei - setze alles auf einen Spin',
  26: 'Gold Prestige-Rang mit 🥇 Badge (benötigt Silber)',
  27: 'Permanenter Bonus auf tägliche Belohnungen',
  28: 'Eigene Gewinn-Nachricht bei großen Wins',
  29: 'Diamant Prestige-Rang mit 💎 Badge (benötigt Gold)',
  30: 'Legendärer Prestige-Rang mit 👑 Badge (benötigt Diamant)',
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
  30: '👑', 31: '🔄', 32: '🌟', 33: '🦡', 34: '🔥', 35: '📈', 36: '💎',
  37: '🎯', 38: '🃏', 39: '💎'
};

function renderShopPage() {
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

      return `
        <div class="shop-item">
          <div class="shop-item-icon">${icon}</div>
          <div class="shop-item-content">
            <div class="shop-item-header">
              <span class="shop-item-name">${escapeHtml(item.name)}</span>
              <span class="shop-item-price">${formatNumber(item.price)} DT</span>
            </div>
            <div class="shop-item-desc">${desc}</div>
            <div class="shop-item-meta">
              <span class="shop-item-id">#${item.id}</span>
              ${requiresHtml}${requiresRankHtml}${weeklyHtml}
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

<<<<<<< Updated upstream
      ${renderItemGroup('Instant Items', '⚡', itemsByType.instant)}
      ${renderItemGroup('Symbol-Boosts', '🔥', itemsByType.boost)}
      ${renderItemGroup('Timed Buffs', '⏰', itemsByType.timed)}
      ${renderItemGroup('Uses Items', '🔢', itemsByType.uses)}
      ${renderItemGroup('Unlocks', '🔓', itemsByType.unlock)}
      ${renderItemGroup('Prestige Ränge', '👑', itemsByType.prestige)}
=======
      <div class="shop-tip">
        💡 <strong>Tipp:</strong> Schreibe <code>!shop</code> im Chat um den aktuellen Shop-Link zu sehen
      </div>

      ${renderCategory(categories.boosts)}
      ${renderCategory(categories.instant)}
      ${renderCategory(categories.timed)}
      ${renderCategory(categories.unlocks)}
      ${renderCategory(categories.prestige)}
>>>>>>> Stashed changes
    </div>
  `;

  return baseTemplate('Shop', content, 'shop');
}

/**
 * Global Statistics page handler
 */
async function handleGlobalStatsPage(env) {
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
  }));
}

/**
 * Global Statistics page renderer
 */
function renderGlobalStatsPage(data) {
  const { totalPlayers, totalAchievements, totalUnlocked, rarestAchievements, mostCommonAchievements, achievementsWithCounts } = data;

  const avgAchievementsPerPlayer = totalPlayers > 0 ? (totalUnlocked / totalPlayers).toFixed(1) : 0;

  // Rarest achievements HTML
  const rarestHtml = rarestAchievements.map((ach, index) => `
    <div class="stat-achievement">
      <span class="stat-rank">#${index + 1}</span>
      <span class="stat-ach-name">${escapeHtml(ach.name)}</span>
      <span class="stat-ach-count">${ach.count} Spieler (${ach.percent}%)</span>
    </div>
  `).join('');

  // Most common achievements HTML
  const commonHtml = mostCommonAchievements.map((ach, index) => `
    <div class="stat-achievement">
      <span class="stat-rank">#${index + 1}</span>
      <span class="stat-ach-name">${escapeHtml(ach.name)}</span>
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

  const content = `
    <div class="content-page">
      <h1 class="page-title">📊 Globale Statistiken</h1>
      <p class="page-subtitle">Übersicht aller Spielerdaten</p>

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
          <div class="global-stat-label">Achievements freigeschaltet</div>
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

  return baseTemplate('Statistiken', content, 'stats');
}

/**
 * Changelog page
 */
function renderChangelogPage() {
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

  return baseTemplate('Changelog', content, 'changelog');
}

/**
 * Impressum page (TMG §5)
 */
function renderImpressumPage() {
  const content = `
    <div class="legal-page">
      <h1>Impressum</h1>
      <p class="legal-subtitle">Angaben gemäß § 5 TMG</p>

      <section class="legal-section">
        <h2>Verantwortlich für den Inhalt</h2>
        <address>
          <strong>Exaint</strong><br>
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
          <strong>Exaint</strong><br>
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

  return baseTemplate('Impressum', content, 'impressum');
}

/**
 * Datenschutz page (DSGVO)
 */
function renderDatenschutzPage() {
  const content = `
    <div class="legal-page">
      <h1>Datenschutzerklärung</h1>
      <p class="legal-subtitle">Stand: Januar 2026</p>

      <section class="legal-section">
        <h2>1. Verantwortlicher</h2>
        <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO):</p>
        <address>
          <strong>Exaint c/o OOE-Esports</strong><br>
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

        <h3>4.2 Twitch-API-Daten</h3>
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

        <h3>4.3 Server-Log-Dateien</h3>
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

        <h3>4.4 Lokaler Speicher (LocalStorage)</h3>
        <p>
          Diese Website speichert deine Theme-Einstellung (Hell/Dunkel-Modus) im lokalen Speicher
          deines Browsers. Dies dient ausschließlich deinem Komfort und wird nicht an uns übertragen.
        </p>
      </section>

      <section class="legal-section">
        <h2>5. Cookies</h2>
        <p>
          Diese Website verwendet <strong>keine Cookies</strong> zu Tracking- oder Werbezwecken.
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

  return baseTemplate('Datenschutzerklärung', content, 'datenschutz');
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
