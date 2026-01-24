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
    // Theme handling - check localStorage, then system preference, default to dark
    (function() {
      const stored = localStorage.getItem('theme');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = stored || (systemPrefersDark ? 'dark' : 'light');
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
          <button type="submit" class="btn btn-search" aria-label="Suchen"><img src="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Suche.png" alt="" class="search-icon" aria-hidden="true" loading="lazy" width="16" height="16"></button>
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
  <div class="mobile-nav-overlay" id="mobileNavOverlay" onclick="closeMobileNav()"></div>
  <nav class="mobile-nav" id="mobileNav" aria-label="Mobile Navigation">
    <div class="mobile-nav-content">
      ${navHtml}
      <div class="mobile-nav-divider"></div>
      ${user ? `<a href="?page=profile&user=${encodeURIComponent(user.username)}" class="nav-item">👤 Mein Profil</a><a href="/auth/logout" class="nav-item">🚪 Logout</a>` : `<a href="/auth/login" class="nav-item">🟣 Mit Twitch einloggen</a>`}
      <div class="mobile-nav-divider"></div>
      <button class="nav-item mobile-theme-toggle" onclick="toggleTheme(); closeMobileNav();">
        <span class="mobile-theme-icon">🌙</span>
        <span class="mobile-theme-label">Theme wechseln</span>
      </button>
    </div>
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
      <span class="theme-toggle-label">Dark</span>
    </button>
  </footer>

  <!-- Toast Notification Container -->
  <div class="toast-container" id="toastContainer" aria-live="polite"></div>

  <!-- Confirm Dialog -->
  <div class="confirm-overlay" id="confirmOverlay" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="confirm-dialog">
      <div class="confirm-message" id="confirmMessage"></div>
      <div class="confirm-actions">
        <button class="btn confirm-btn-cancel" id="confirmCancel">Abbrechen</button>
        <button class="btn confirm-btn-ok" id="confirmOk">Bestätigen</button>
      </div>
    </div>
  </div>

  <!-- Keyboard Shortcuts Help Modal -->
  <div class="shortcuts-overlay" id="shortcutsOverlay" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="shortcuts-dialog">
      <div class="shortcuts-header">
        <h3>⌨️ Keyboard Shortcuts</h3>
        <button class="modal-close" onclick="closeShortcutsModal()" aria-label="Schließen">&times;</button>
      </div>
      <div class="shortcuts-grid">
        <div class="shortcut-item"><kbd>/</kbd><span>Suche fokussieren</span></div>
        <div class="shortcut-item"><kbd>h</kbd><span>Startseite</span></div>
        <div class="shortcut-item"><kbd>l</kbd><span>Leaderboard</span></div>
        <div class="shortcut-item"><kbd>s</kbd><span>Shop</span></div>
        <div class="shortcut-item"><kbd>t</kbd><span>Theme wechseln</span></div>
        <div class="shortcut-item"><kbd>?</kbd><span>Diese Hilfe</span></div>
        <div class="shortcut-item"><kbd>Esc</kbd><span>Dialoge schließen</span></div>
      </div>
    </div>
  </div>

  <!-- Offline Indicator -->
  <div class="offline-banner" id="offlineBanner" aria-live="assertive">
    <span>⚡ Keine Internetverbindung</span>
  </div>

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
        <div class="modal-detail"><strong>Kategorie:</strong> <span id="modalCategory"></span></div>
        <div class="modal-detail"><strong>Seltenheit:</strong> <span id="modalRarity"></span></div>
        <div class="modal-detail" id="modalStatusRow" style="display:none"><strong>Freigeschaltet:</strong> <span id="modalStatus"></span></div>
        <div class="modal-detail" id="modalProgressRow" style="display:none"><strong>Fortschritt:</strong> <span id="modalProgress"></span></div>
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
      document.getElementById('modalCategory').textContent = category;
      document.getElementById('modalRarity').textContent = rarity + '% (' + rarityCount + ' von ' + rarityTotal + ' Spielern)';

      if (unlocked && unlockedAt) {
        document.getElementById('modalStatus').textContent = unlockedAt;
        document.getElementById('modalStatusRow').style.display = 'block';
      } else {
        document.getElementById('modalStatusRow').style.display = 'none';
      }

      if (!unlocked && progressCurrent && progressRequired) {
        const percent = Math.min(100, Math.round((parseInt(progressCurrent) / parseInt(progressRequired)) * 100));
        document.getElementById('modalProgress').innerHTML = '<div class="modal-progress-bar"><div class="progress-bar"><div class="progress-fill" style="width: ' + percent + '%"></div></div><span>' + progressCurrent + ' / ' + progressRequired + ' (' + percent + '%)</span></div>';
        document.getElementById('modalProgressRow').style.display = 'block';
      } else {
        document.getElementById('modalProgressRow').style.display = 'none';
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

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // Skip if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        // Allow Escape to blur input
        if (e.key === 'Escape') {
          e.target.blur();
          closeMobileNav();
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          closeAchievementModal();
          closeMobileNav();
          closeShortcutsModal();
          const confirmOverlay = document.getElementById('confirmOverlay');
          if (confirmOverlay && confirmOverlay.classList.contains('active')) {
            document.getElementById('confirmCancel').click();
          }
          break;
        case '/':
          e.preventDefault();
          const searchInput = document.querySelector('.search-input');
          if (searchInput) searchInput.focus();
          break;
        case '?':
          e.preventDefault();
          toggleShortcutsModal();
          break;
        case 'h':
          window.location.href = '?page=home';
          break;
        case 'l':
          window.location.href = '?page=leaderboard';
          break;
        case 's':
          window.location.href = '?page=shop';
          break;
        case 't':
          toggleTheme();
          break;
      }
    });

    // Mobile navigation toggle
    function toggleMobileNav() {
      const hamburger = document.querySelector('.hamburger');
      const mobileNav = document.getElementById('mobileNav');
      const overlay = document.getElementById('mobileNavOverlay');
      const isOpening = !mobileNav.classList.contains('active');

      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active');
      overlay.classList.toggle('active');
      document.body.style.overflow = isOpening ? 'hidden' : '';

      // Update mobile theme icon
      if (isOpening) {
        const theme = getEffectiveTheme();
        const icon = mobileNav.querySelector('.mobile-theme-icon');
        if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
      }
    }

    function closeMobileNav() {
      const hamburger = document.querySelector('.hamburger');
      const mobileNav = document.getElementById('mobileNav');
      const overlay = document.getElementById('mobileNavOverlay');
      hamburger.classList.remove('active');
      mobileNav.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Close mobile nav on nav link click
    document.addEventListener('DOMContentLoaded', function() {
      const mobileNav = document.getElementById('mobileNav');
      if (mobileNav) {
        mobileNav.querySelectorAll('.nav-item:not(.mobile-theme-toggle)').forEach(link => {
          link.addEventListener('click', closeMobileNav);
        });
      }
    });

    // Toast notification system
    function showToast(message, type = 'error', duration = 4000) {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.textContent = message;
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('visible'));
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    // Styled confirm dialog
    function showConfirm(message) {
      return new Promise((resolve) => {
        const overlay = document.getElementById('confirmOverlay');
        const msgEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');
        msgEl.textContent = message;
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');

        function cleanup(result) {
          overlay.classList.remove('active');
          overlay.setAttribute('aria-hidden', 'true');
          okBtn.removeEventListener('click', onOk);
          cancelBtn.removeEventListener('click', onCancel);
          overlay.removeEventListener('click', onOverlay);
          resolve(result);
        }
        function onOk() { cleanup(true); }
        function onCancel() { cleanup(false); }
        function onOverlay(e) { if (e.target === overlay) cleanup(false); }
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        overlay.addEventListener('click', onOverlay);
      });
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
          showToast(data.error || 'Fehler beim Akzeptieren des Disclaimers');
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Disclaimer akzeptieren';
          }
        }
      } catch (error) {
        showToast('Netzwerkfehler. Bitte versuche es erneut.');
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
        label.textContent = theme === 'light' ? 'Light Mode' : 'Dark Mode';
      }
      const footer = document.querySelector('.theme-toggle-footer');
      if (footer) footer.setAttribute('data-theme-active', theme);
    }

    // Get effective theme (localStorage > system preference > dark)
    function getEffectiveTheme() {
      const stored = localStorage.getItem('theme');
      if (stored) return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Update button on load
    document.addEventListener('DOMContentLoaded', function() {
      const theme = getEffectiveTheme();
      updateThemeButton(theme);

      // Listen for system theme changes (only applies if no localStorage preference)
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('theme')) {
          const newTheme = e.matches ? 'dark' : 'light';
          if (newTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
          updateThemeButton(newTheme);
        }
      });

      // Achievement filter functionality with counts
      const filterBtns = document.querySelectorAll('.filter-btn');
      if (filterBtns.length > 0) {
        // Update filter button counts
        const allAchievements = document.querySelectorAll('.achievement');
        const unlockedCount = document.querySelectorAll('.achievement.unlocked').length;
        const lockedCount = document.querySelectorAll('.achievement.locked').length;
        filterBtns.forEach(btn => {
          const f = btn.dataset.filter;
          if (f === 'all') btn.textContent = 'Alle (' + allAchievements.length + ')';
          else if (f === 'unlocked') btn.textContent = 'Freigeschaltet (' + unlockedCount + ')';
          else if (f === 'locked') btn.textContent = 'Gesperrt (' + lockedCount + ')';
        });

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

      // Restore category collapse state from localStorage
      const savedCollapseState = localStorage.getItem('categoryCollapseState');
      if (savedCollapseState) {
        try {
          const state = JSON.parse(savedCollapseState);
          document.querySelectorAll('.category').forEach(cat => {
            const catName = cat.querySelector('.category-title span')?.textContent;
            if (catName && state[catName]) {
              cat.classList.add('collapsed');
            }
          });
        } catch (e) {}
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
              if (!response.ok) {
                suggestionsContainer.style.display = 'none';
                return;
              }
              const data = await response.json();

              if (data.players && data.players.length > 0) {
                suggestionsContainer.innerHTML = '';
                data.players.forEach(player => {
                  const div = document.createElement('div');
                  div.className = 'suggestion-item';
                  div.dataset.username = player;
                  div.textContent = player;
                  suggestionsContainer.appendChild(div);
                });
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
    function escAdm(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    const MAX_BALANCE = 1000000;

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

        if (result.success) {
          showToast('Erfolgreich aktualisiert!', 'success');
          if (msgEl) {
            msgEl.className = 'admin-message success';
            msgEl.textContent = '✓ Erfolgreich aktualisiert!';
          }
          setTimeout(() => location.reload(), 1500);
        } else {
          const errMsg = result.error || 'Unbekannter Fehler';
          showToast('Fehler: ' + errMsg, 'error');
          if (msgEl) {
            msgEl.className = 'admin-message error';
            msgEl.textContent = '✗ Fehler: ' + errMsg;
          }
        }

        return result;
      } catch (e) {
        showToast('Netzwerkfehler', 'error');
        if (msgEl) {
          msgEl.className = 'admin-message error';
          msgEl.textContent = '✗ Netzwerkfehler';
        }
        return { error: e.message };
      }
    }

    function getAdminUsername() {
      const panel = document.getElementById('adminPanel');
      return panel ? panel.dataset.username : null;
    }

    function adminSetBalance() {
      const username = getAdminUsername();
      const balance = parseInt(document.getElementById('adminBalance').value, 10);
      if (isNaN(balance) || balance < 0) {
        showToast('Ungültiger Betrag (min: 0)', 'error');
        return;
      }
      if (balance > MAX_BALANCE) {
        showToast('Maximaler Betrag: ' + MAX_BALANCE.toLocaleString('de-DE') + ' DT', 'error');
        return;
      }
      adminApiCall('setBalance', { username, balance });
    }

    function adminSetDisclaimer(accepted) {
      adminApiCall('setDisclaimer', { username: getAdminUsername(), accepted });
    }

    async function adminSetSelfBan(banned) {
      if (banned) {
        const confirmed = await showConfirm('Diesen Spieler wirklich sperren?');
        if (!confirmed) return;
      }
      adminApiCall('setSelfBan', { username: getAdminUsername(), banned });
    }

    function adminSetDuelOpt(optedOut) {
      adminApiCall('setDuelOpt', { username: getAdminUsername(), optedOut });
    }

    function adminSetLeaderboardHidden(hidden) {
      adminApiCall('setLeaderboardHidden', { username: getAdminUsername(), hidden });
    }

    async function adminSetAchievement(unlocked) {
      const username = getAdminUsername();
      const select = document.getElementById('adminAchievement');
      const achievementId = select.value;
      const achievementName = select.options[select.selectedIndex].text;
      const action = unlocked ? 'freischalten' : 'sperren';
      const confirmed = await showConfirm('Achievement "' + achievementName.substring(2) + '" wirklich ' + action + '?');
      if (!confirmed) return;
      adminApiCall('setAchievement', { username, achievementId, unlocked }).then(() => {
        const option = select.options[select.selectedIndex];
        option.dataset.unlocked = unlocked ? 'true' : 'false';
        option.text = (unlocked ? '✓' : '○') + option.text.substring(1);
      });
    }

    // Refund functions
    async function loadRefundableItems() {
      const username = getAdminUsername();
      const container = document.getElementById('refundItemsContainer');
      container.innerHTML = '<div class="admin-loading">Lade Items...</div>';
      container.style.display = 'block';

      try {
        const response = await fetch('?api=admin&action=getRefundableItems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        const result = await response.json();

        if (!result.success) {
          container.innerHTML = '<div class="admin-error">Fehler: ' + escAdm(result.error || 'Unbekannt') + '</div>';
          return;
        }

        const prestigeItems = result.items.filter(i => i.type === 'prestige');
        const unlockItems = result.items.filter(i => i.type === 'unlock');

        let html = '<div class="refund-groups">';

        html += '<div class="refund-group"><h4>Prestige Ränge</h4><div class="refund-items">';
        for (const item of prestigeItems) {
          const statusClass = item.owned ? (item.canRefund ? 'refundable' : 'blocked') : 'not-owned';
          html += '<div class="refund-item ' + statusClass + '">';
          html += '<span class="refund-item-name">' + escAdm(item.symbol) + ' ' + escAdm(item.name) + '</span>';
          html += '<span class="refund-item-price">+' + item.price.toLocaleString('de-DE') + ' DT</span>';
          if (item.owned && item.canRefund) {
            html += '<button class="btn admin-btn danger btn-sm btn-refund" data-key="' + escAdm(item.key) + '" data-name="' + escAdm(item.name) + '" data-price="' + item.price + '">Refund</button>';
          } else if (item.owned) {
            html += '<span class="refund-blocked">' + escAdm(item.blockedReason) + '</span>';
          } else {
            html += '<span class="refund-not-owned">Nicht gekauft</span>';
          }
          html += '</div>';
        }
        html += '</div></div>';

        html += '<div class="refund-group"><h4>Slot Unlocks</h4><div class="refund-items">';
        for (const item of unlockItems) {
          const statusClass = item.owned ? (item.canRefund ? 'refundable' : 'blocked') : 'not-owned';
          html += '<div class="refund-item ' + statusClass + '">';
          html += '<span class="refund-item-name">' + escAdm(item.symbol) + ' ' + escAdm(item.name) + '</span>';
          html += '<span class="refund-item-price">+' + item.price.toLocaleString('de-DE') + ' DT</span>';
          if (item.owned && item.canRefund) {
            html += '<button class="btn admin-btn danger btn-sm btn-refund" data-key="' + escAdm(item.key) + '" data-name="' + escAdm(item.name) + '" data-price="' + item.price + '">Refund</button>';
          } else if (item.owned) {
            html += '<span class="refund-blocked">' + escAdm(item.blockedReason) + '</span>';
          } else {
            html += '<span class="refund-not-owned">Nicht gekauft</span>';
          }
          html += '</div>';
        }
        html += '</div></div></div>';

        container.innerHTML = html;

        // Event delegation for refund buttons
        container.querySelectorAll('.btn-refund').forEach(btn => {
          btn.addEventListener('click', async function() {
            const itemKey = this.dataset.key;
            const itemName = this.dataset.name;
            const price = parseInt(this.dataset.price, 10);
            await refundItem(itemKey, itemName, price);
          });
        });
      } catch (e) {
        container.innerHTML = '<div class="admin-error">Netzwerkfehler</div>';
      }
    }

    async function refundItem(itemKey, itemName, price) {
      const username = getAdminUsername();
      const confirmed = await showConfirm('"' + itemName + '" wirklich refunden? Der Spieler erhält ' + price.toLocaleString('de-DE') + ' DT zurück.');
      if (!confirmed) return;

      const result = await adminApiCall('refund', { username, itemKey });
      if (result && result.success) {
        loadRefundableItems();
        const balanceEl = document.querySelector('.stat-value');
        if (balanceEl && result.newBalance !== undefined) {
          balanceEl.textContent = result.newBalance.toLocaleString('de-DE');
        }
      }
    }

    // Collapsible section toggle
    function toggleSection(header) {
      const section = header.closest('.collapsible-section');
      const content = section.querySelector('.collapsible-content');
      const isExpanded = section.classList.contains('expanded');

      if (isExpanded) {
        section.classList.remove('expanded');
        content.style.display = 'none';
      } else {
        section.classList.add('expanded');
        content.style.display = 'block';
      }
    }

    // Shop category collapse toggle
    function toggleShopCategory(header) {
      const category = header.closest('.shop-category');
      category.classList.toggle('shop-cat-expanded');
    }

    function expandAllShopCategories() {
      document.querySelectorAll('.shop-category').forEach(cat => cat.classList.add('shop-cat-expanded'));
    }

    function collapseAllShopCategories() {
      document.querySelectorAll('.shop-category').forEach(cat => cat.classList.remove('shop-cat-expanded'));
    }

    function scrollToShopSection(event, sectionId) {
      event.preventDefault();
      const target = document.getElementById(sectionId);
      if (!target) return;

      // If it's a shop category wrapper, expand the category inside
      const category = target.querySelector('.shop-category');
      if (category) {
        category.classList.add('shop-cat-expanded');
      }

      // For the collapsible Kaufanleitung section
      if (sectionId === 'kaufanleitung') {
        const section = target.closest('.collapsible-section') || target;
        if (!section.classList.contains('expanded')) {
          section.classList.add('expanded');
          const content = section.querySelector('.collapsible-content');
          if (content) content.style.display = 'block';
        }
      }

      // Scroll to element
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Flash animation
      const flashTarget = category || target;
      flashTarget.classList.add('shop-flash');
      setTimeout(() => flashTarget.classList.remove('shop-flash'), 1500);
    }

    // Category collapse toggle (profile achievements) with localStorage persistence
    function toggleCategory(header) {
      const category = header.closest('.category');
      category.classList.toggle('collapsed');
      saveCategoryCollapseState();
    }

    // Collapse/expand all categories
    function collapseAllCategories() {
      document.querySelectorAll('.category').forEach(cat => cat.classList.add('collapsed'));
      saveCategoryCollapseState();
    }

    function expandAllCategories() {
      document.querySelectorAll('.category').forEach(cat => cat.classList.remove('collapsed'));
      saveCategoryCollapseState();
    }

    function saveCategoryCollapseState() {
      const state = {};
      document.querySelectorAll('.category').forEach(cat => {
        const catName = cat.querySelector('.category-title span')?.textContent;
        if (catName) state[catName] = cat.classList.contains('collapsed');
      });
      localStorage.setItem('categoryCollapseState', JSON.stringify(state));
    }

    // Keyboard shortcuts help modal
    function toggleShortcutsModal() {
      const overlay = document.getElementById('shortcutsOverlay');
      if (overlay.classList.contains('active')) {
        closeShortcutsModal();
      } else {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
      }
    }

    function closeShortcutsModal() {
      const overlay = document.getElementById('shortcutsOverlay');
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }

    // Close shortcuts on overlay click
    document.getElementById('shortcutsOverlay').addEventListener('click', function(e) {
      if (e.target === this) closeShortcutsModal();
    });

    // Offline/Online connection status
    function updateConnectionStatus() {
      const banner = document.getElementById('offlineBanner');
      if (!navigator.onLine) {
        banner.classList.add('visible');
      } else {
        banner.classList.remove('visible');
      }
    }
    window.addEventListener('offline', updateConnectionStatus);
    window.addEventListener('online', function() {
      const banner = document.getElementById('offlineBanner');
      banner.classList.remove('visible');
      showToast('Verbindung wiederhergestellt', 'success', 2000);
    });
    updateConnectionStatus();

    // Shop purchase function
    async function buyItem(itemId, itemName, price) {
      const feedback = document.getElementById('purchaseFeedback');
      const btn = event.target;

      // Disable button during purchase
      btn.disabled = true;
      btn.textContent = '...';

      try {
        const response = await fetch('/api/shop/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ itemId })
        });

        const result = await response.json();

        if (result.success) {
          // Update balance display
          const balanceEl = document.getElementById('userBalance');
          if (balanceEl && result.newBalance !== undefined) {
            balanceEl.textContent = result.newBalance.toLocaleString('de-DE') + ' DT';
          }

          // Show success message
          if (feedback) {
            feedback.className = 'purchase-feedback success';
            feedback.textContent = '✓ ' + result.message;
            feedback.style.display = 'block';
            setTimeout(() => { feedback.style.display = 'none'; }, 4000);
          }

          // Update button to show purchased (for one-time items)
          const itemEl = document.querySelector('[data-item-id="' + itemId + '"]');
          if (itemEl) {
            const isUnlockOrPrestige = itemEl.closest('#unlocks, #prestige');
            if (isUnlockOrPrestige) {
              btn.remove();
              const header = itemEl.querySelector('.shop-item-header');
              if (header) {
                const badge = document.createElement('span');
                badge.className = 'shop-item-owned';
                badge.textContent = '✓ Gekauft';
                header.insertBefore(badge, header.querySelector('.shop-item-price'));
              }
              itemEl.classList.add('shop-item-is-owned');
            } else {
              // For repeatable items, re-enable button
              btn.disabled = false;
              btn.textContent = 'Kaufen';

              // Check if user can still afford it
              if (result.newBalance < price) {
                btn.disabled = true;
                btn.classList.add('btn-buy-disabled');
                btn.title = 'Nicht genug DachsTaler';
              }
            }
          }

          // Update all buy buttons based on new balance
          updateBuyButtons(result.newBalance);
        } else {
          // Show error message near the item
          showItemError(btn, result.error || 'Fehler beim Kauf');
          btn.disabled = false;
          btn.textContent = 'Kaufen';
        }
      } catch (error) {
        showItemError(btn, 'Netzwerkfehler');
        btn.disabled = false;
        btn.textContent = 'Kaufen';
      }
    }

    // Show error message directly at the item
    function showItemError(btn, message) {
      const itemEl = btn.closest('.shop-item');
      if (!itemEl) return;

      // Remove existing error if any
      const existingError = itemEl.querySelector('.item-error');
      if (existingError) existingError.remove();

      // Create error element
      const errorEl = document.createElement('div');
      errorEl.className = 'item-error';
      errorEl.textContent = '✗ ' + message;

      // Insert after the meta section
      const meta = itemEl.querySelector('.shop-item-meta');
      if (meta) {
        meta.parentNode.insertBefore(errorEl, meta.nextSibling);
      } else {
        itemEl.appendChild(errorEl);
      }

      // Auto-remove after 4 seconds
      setTimeout(() => { errorEl.remove(); }, 4000);
    }

    // Update all buy buttons based on new balance
    function updateBuyButtons(newBalance) {
      document.querySelectorAll('.btn-buy').forEach(btn => {
        const itemEl = btn.closest('.shop-item');
        if (!itemEl) return;

        const priceText = itemEl.querySelector('.shop-item-price')?.textContent || '';
        const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10);

        if (price && newBalance < price) {
          btn.disabled = true;
          btn.classList.add('btn-buy-disabled');
          btn.title = 'Nicht genug DachsTaler';
        }
      });
    }

    // Bet level toggle for payout display
    document.querySelectorAll('.bet-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bet-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const multiplier = parseInt(btn.dataset.multiplier, 10);
        document.querySelectorAll('.payout-value').forEach(el => {
          const base = parseInt(el.dataset.base, 10);
          const value = base * multiplier;
          el.textContent = value.toLocaleString('de-DE') + ' DT';
        });
      });
    });
  </script>`;
}

/**
 * Create HTML response with security headers
 * @param {string} html - HTML content
 * @param {number} status - HTTP status code
 * @param {object} options - Additional options
 * @param {number} options.cacheSeconds - Cache-Control max-age in seconds (0 = no-cache)
 */
export function htmlResponse(html, status = 200, options = {}) {
  const cacheSeconds = options.cacheSeconds || 0;
  const cacheControl = cacheSeconds > 0
    ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
    : 'no-cache';

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cacheControl,
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://static-cdn.jtvnw.net https://assets.help.twitch.tv https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  });
}
