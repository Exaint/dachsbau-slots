/**
 * Base HTML template with navigation, header, footer, and scripts
 * This is the main layout wrapper for all pages
 */

import { CSS } from '../styles.js';
import { escapeHtml } from './utils.js';

// Disclaimer HTML shown on all pages
const DISCLAIMER_HTML = `
<div class="disclaimer" id="disclaimer">
  <div class="disclaimer-icon">⚠️</div>
  <div class="disclaimer-content">
    <p><strong>Disclaimer</strong></p>
    <p>Dachsbau Slots ist ein reines Unterhaltungsspiel. Es werden keine echten Geldbeträge verwendet.</p>
    <p><strong>DachsTaler (DT)</strong> sind eine rein virtuelle Währung ohne jeglichen realen Geldwert. Sie können nicht in echtes Geld umgetauscht werden.</p>
    <p>Die Streamerin <strong>frechhdachs</strong> distanziert sich ausdrücklich von echtem Glücksspiel und übernimmt keine Haftung. <a href="/?page=info#hilfe" style="color: var(--warning); text-decoration: underline;">Hilfsangebote bei Spielsucht findest du hier.</a></p>
  </div>
</div>
`;

/**
 * Base HTML template with navigation
 * @param {string} title - Page title
 * @param {string} content - Page content HTML
 * @param {string} activePage - Current active page for nav highlighting
 * @param {object|null} user - Logged in user object or null
 */
export function baseTemplate(title, content, activePage = '', user = null) {
  const navItems = [
    { page: 'home', label: 'Start', icon: '🏠' },
    { page: 'info', label: 'Info', icon: 'ℹ️' },
    { page: 'shop', label: 'Shop', icon: '🛒' },
    { page: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { page: 'stats', label: 'Statistiken', icon: '📊' }
  ];

  const navHtml = navItems.map(item => {
    const isActive = activePage === item.page ? ' active' : '';
    return `<a href="?page=${item.page}" class="nav-item${isActive}">${item.icon} ${item.label}</a>`;
  }).join('');

  // User section - show login button or user info
  const userSectionHtml = user
    ? `
      <div class="user-section">
        <a href="?page=profile&user=${encodeURIComponent(user.username)}" class="user-profile-link">
          ${user.avatar ? `<img src="${user.avatar}" alt="" class="user-avatar-small">` : ''}
          <span class="user-display-name">${escapeHtml(user.displayName || user.username)}</span>
        </a>
        <a href="/auth/logout" class="btn-logout" title="Ausloggen">Logout</a>
      </div>
    `
    : `
      <a href="/auth/login" class="btn-twitch-login">
        <svg viewBox="0 0 256 268" class="twitch-icon" width="16" height="16">
          <path fill="currentColor" d="M17.458 0L0 46.556v186.2h63.983v34.934h34.931l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.617H128L93.113 226.5v-34.91H40.717V23.263zm69.4 106.292h23.24V58.325h-23.24v71.23zm63.986 0h23.24V58.325h-23.24v71.23z"/>
        </svg>
        <span>Mit Twitch einloggen</span>
      </a>
    `;

  // Disclaimer warning for logged-in users without disclaimer
  const disclaimerWarningHtml = (user && user.hasDisclaimer === false)
    ? `
      <div class="disclaimer-warning">
        <div class="disclaimer-warning-icon">⚠️</div>
        <div class="disclaimer-warning-content">
          <strong>Disclaimer nicht akzeptiert</strong>
          <p>Du musst den <a href="#disclaimer" style="color: inherit; text-decoration: underline;">Disclaimer</a> akzeptieren, um Slots zu spielen und im Leaderboard angezeigt zu werden.</p>
          <button class="btn btn-accept-disclaimer" onclick="acceptDisclaimer()">Disclaimer akzeptieren</button>
        </div>
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Dachsbau Slots</title>
  <link rel="icon" type="image/png" href="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Slots.png">
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
        <img src="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Slots.png" alt="Logo" class="logo-img">
        <span class="logo-text">Dachsbau Slots</span>
      </a>
      <nav class="nav-bar" aria-label="Hauptnavigation">
        ${navHtml}
      </nav>
      <div class="header-right">
        <form class="search-form" action="" method="get" role="search" aria-label="Spielersuche">
          <input type="hidden" name="page" value="profile">
          <input type="text" name="user" placeholder="Spieler..." class="search-input" required aria-label="Spielername eingeben">
          <button type="submit" class="btn btn-search" aria-label="Suchen"><img src="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Suche.png" alt="" class="search-icon" aria-hidden="true"></button>
        </form>
        ${userSectionHtml}
      </div>
      <button class="hamburger" onclick="toggleMobileNav()" aria-label="Menü">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </header>
  <nav class="mobile-nav" id="mobileNav" aria-label="Mobile Navigation">
    ${navHtml}
    ${user ? `<a href="?page=profile&user=${encodeURIComponent(user.username)}" class="nav-item">👤 Mein Profil</a><a href="/auth/logout" class="nav-item">🚪 Logout</a>` : `<a href="/auth/login" class="nav-item">🟣 Mit Twitch einloggen</a>`}
  </nav>
  <main class="container">
    ${DISCLAIMER_HTML}
    ${disclaimerWarningHtml}
    ${content}
  </main>
  <footer class="footer">
    <p>Dachsbau Slots - Made by Exaint für <a href="https://www.twitch.tv/frechhdachs" target="_blank" rel="noopener" class="footer-link">@frechhdachs</a></p>
    <p class="footer-legal"><a href="?page=changelog">Changelog</a> · <a href="?page=impressum">Impressum</a> · <a href="?page=datenschutz">Datenschutz</a></p>
    <p class="footer-disclaimer">This website is not affiliated with or endorsed by Twitch.</p>
    <button class="theme-toggle-footer" onclick="toggleTheme()" title="Theme wechseln" aria-label="Theme zwischen Hell und Dunkel wechseln">
      <span class="theme-toggle-icon" aria-hidden="true">🌙</span>
      <span class="theme-toggle-label">Theme</span>
    </button>
  </footer>

  <!-- Achievement Detail Modal -->
  <div class="modal-overlay" id="achievementModal" onclick="closeAchievementModal(event)" role="dialog" aria-modal="true" aria-labelledby="modalName" aria-hidden="true">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeAchievementModal()" aria-label="Schließen">&times;</button>
      <div class="modal-header">
        <div class="modal-icon" id="modalIcon" aria-hidden="true"></div>
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

  ${getClientScripts()}
</body>
</html>`;
}

/**
 * Client-side JavaScript for interactivity
 * Separated for readability
 */
function getClientScripts() {
  return `<script>
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
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeAchievementModal(event) {
      if (event && event.target !== event.currentTarget) return;
      const modal = document.getElementById('achievementModal');
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
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

    // Accept disclaimer function
    async function acceptDisclaimer() {
      const btn = document.querySelector('.btn-accept-disclaimer');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Wird akzeptiert...';
      }
      try {
        const response = await fetch('/api/disclaimer/accept', { method: 'POST', credentials: 'same-origin' });
        if (response.ok) {
          window.location.reload();
        } else {
          const data = await response.json();
          alert(data.error || 'Fehler beim Akzeptieren des Disclaimers');
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Disclaimer akzeptieren';
          }
        }
      } catch (error) {
        alert('Netzwerkfehler. Bitte versuche es erneut.');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Disclaimer akzeptieren';
        }
      }
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

            filterBtns.forEach(b => {
              b.classList.remove('active');
              b.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

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

            sortBtns.forEach(b => {
              b.classList.remove('active');
              b.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            if (sortType === 'category') {
              document.querySelectorAll('.category').forEach(cat => {
                cat.style.display = '';
              });
              const sortedList = document.getElementById('sortedAchievements');
              if (sortedList) sortedList.remove();
            } else {
              document.querySelectorAll('.category').forEach(cat => {
                cat.style.display = 'none';
              });

              const achievements = Array.from(document.querySelectorAll('.achievement'));
              const sorted = achievements.sort((a, b) => {
                const rarityA = parseInt(a.dataset.rarity) || 0;
                const rarityB = parseInt(b.dataset.rarity) || 0;
                return sortType === 'rarity-asc' ? rarityA - rarityB : rarityB - rarityA;
              });

              const existingList = document.getElementById('sortedAchievements');
              if (existingList) existingList.remove();

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

        suggestionsContainer.addEventListener('click', function(e) {
          if (e.target.classList.contains('suggestion-item')) {
            input.value = e.target.dataset.username;
            suggestionsContainer.style.display = 'none';
            input.closest('form').submit();
          }
        });

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

        setTimeout(() => {
          confettiContainer.remove();
        }, 6000);
      }
    });

    // Admin Panel Functions
    async function adminApiCall(action, data) {
      const msgEl = document.getElementById('adminMessage');
      if (msgEl) {
        msgEl.className = 'admin-message';
        msgEl.textContent = '';
      }

      try {
        const response = await fetch('?api=admin&action=' + action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (msgEl) {
          if (result.success) {
            msgEl.className = 'admin-message success';
            msgEl.textContent = '✓ Erfolgreich aktualisiert!';
            setTimeout(() => location.reload(), 1000);
          } else {
            msgEl.className = 'admin-message error';
            msgEl.textContent = '✗ Fehler: ' + (result.error || 'Unbekannter Fehler');
          }
        }

        return result;
      } catch (e) {
        if (msgEl) {
          msgEl.className = 'admin-message error';
          msgEl.textContent = '✗ Netzwerkfehler';
        }
        return { error: e.message };
      }
    }

    function adminSetBalance(username) {
      const balance = parseInt(document.getElementById('adminBalance').value, 10);
      if (isNaN(balance) || balance < 0) {
        alert('Ungültiger Betrag');
        return;
      }
      adminApiCall('setBalance', { username, balance });
    }

    function adminSetDisclaimer(username, accepted) {
      adminApiCall('setDisclaimer', { username, accepted });
    }

    function adminSetSelfBan(username, banned) {
      if (banned && !confirm('Diesen Spieler wirklich sperren?')) return;
      adminApiCall('setSelfBan', { username, banned });
    }

    function adminSetDuelOpt(username, optedOut) {
      adminApiCall('setDuelOpt', { username, optedOut });
    }

    function adminSetLeaderboardHidden(username, hidden) {
      adminApiCall('setLeaderboardHidden', { username, hidden });
    }

    function adminSetAchievement(username, unlocked) {
      const select = document.getElementById('adminAchievement');
      const achievementId = select.value;
      const achievementName = select.options[select.selectedIndex].text;
      const action = unlocked ? 'freischalten' : 'sperren';
      if (!confirm(\`Achievement "\${achievementName}" wirklich \${action}?\`)) return;
      adminApiCall('setAchievement', { username, achievementId, unlocked }).then(() => {
        const option = select.options[select.selectedIndex];
        option.dataset.unlocked = unlocked ? 'true' : 'false';
        option.text = (unlocked ? '✓' : '○') + option.text.substring(1);
      });
    }
  </script>`;
}

/**
 * Create HTML response with security headers
 */
export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://static-cdn.jtvnw.net https://assets.help.twitch.tv https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  });
}
