/**
 * V2 Base HTML Template
 * "Luxury Woodland Lodge" aesthetic - modern, sophisticated, Dachs-themed
 */

import { CSS_V2 } from '../../styles-v2.js';
import { escapeHtml } from '../utils.js';
import { htmlResponse } from '../template.js';
import { isAdmin } from '../../../utils.js';

// Re-export htmlResponse for V2 pages
export { htmlResponse };

const DISCLAIMER_HTML = `
<div class="v2-disclaimer" id="disclaimer">
  <div class="v2-disclaimer-icon">&#9888;&#65039;</div>
  <div class="v2-disclaimer-content">
    <p><strong>Disclaimer</strong></p>
    <p>Dachsbau Slots ist ein reines Unterhaltungsspiel. Es werden keine echten Geldbetr\u00e4ge verwendet.</p>
    <p><strong>DachsTaler (DT)</strong> sind eine rein virtuelle W\u00e4hrung ohne jeglichen realen Geldwert. Sie k\u00f6nnen nicht in echtes Geld umgetauscht werden.</p>
    <p>Die Streamerin <strong>frechhdachs</strong> distanziert sich ausdr\u00fccklich von echtem Gl\u00fccksspiel und \u00fcbernimmt keine Haftung. <a href="/?page=info#hilfe">Hilfsangebote bei Spielsucht findest du hier.</a></p>
  </div>
</div>
`;

/**
 * V2 Base Template
 * @param {string} title - Page title
 * @param {string} content - Page content HTML
 * @param {string} activePage - Current active page for nav highlighting
 * @param {object|null} user - Logged in user object or null
 */
export function baseTemplateV2(title, content, activePage = '', user = null) {
  const navItems = [
    { page: 'home', label: 'Start' },
    { page: 'info', label: 'Info' },
    { page: 'shop', label: 'Shop' },
    { page: 'leaderboard', label: 'Leaderboard' },
    { page: 'stats', label: 'Statistiken' }
  ];

  const navHtml = navItems.map(item => {
    const isActive = activePage === item.page ? ' active' : '';
    return `<a href="?page=${item.page}" class="v2-nav-item${isActive}">${item.label}</a>`;
  }).join('');

  const mobileNavHtml = navItems.map(item => {
    const isActive = activePage === item.page ? ' active' : '';
    return `<a href="?page=${item.page}" class="v2-nav-item${isActive}">${item.label}</a>`;
  }).join('');

  const userSectionHtml = user
    ? `
      <div class="v2-user-section">
        <a href="?page=profile&user=${encodeURIComponent(user.username)}" class="v2-user-profile-link">
          ${user.avatar ? `<img src="${user.avatar}" alt="" class="v2-user-avatar-small">` : ''}
          <span class="v2-user-display-name">${escapeHtml(user.displayName || user.username)}</span>
        </a>
        <a href="/auth/logout" class="v2-btn-logout" title="Ausloggen">Logout</a>
      </div>
    `
    : `
      <a href="/auth/login" class="v2-btn-twitch-login">
        <svg viewBox="0 0 256 268" class="v2-twitch-icon" width="16" height="16">
          <path fill="currentColor" d="M17.458 0L0 46.556v186.2h63.983v34.934h34.931l34.898-34.934h52.36L256 162.954V0H17.458zm23.259 23.263H232.73v128.029l-40.739 40.617H128L93.113 226.5v-34.91H40.717V23.263zm69.4 106.292h23.24V58.325h-23.24v71.23zm63.986 0h23.24V58.325h-23.24v71.23z"/>
        </svg>
        <span>Mit Twitch einloggen</span>
      </a>
    `;

  const disclaimerWarningHtml = (user && user.hasDisclaimer === false)
    ? `
      <div class="v2-disclaimer-warning">
        <div class="v2-disclaimer-icon">&#9888;&#65039;</div>
        <div>
          <strong>Disclaimer nicht akzeptiert</strong>
          <p style="margin-top:4px;font-size:0.85rem;color:var(--v2-text-secondary)">Du musst den <a href="#disclaimer" style="color:var(--v2-gold);text-decoration:underline">Disclaimer</a> akzeptieren, um Slots zu spielen.</p>
          <button class="v2-btn v2-btn-primary v2-btn-sm" style="margin-top:8px" onclick="acceptDisclaimer()">Disclaimer akzeptieren</button>
        </div>
      </div>
    `
    : '';

  const isAdminUser = user && isAdmin(user.username);
  const designToggleHtml = isAdminUser
    ? `<button class="v2-design-toggle" onclick="toggleDesignVersion('v1')">&#8592; Zur\u00fcck zu V1</button>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Dachsbau Slots</title>
  <link rel="icon" type="image/png" href="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Slots.png">
  <style>${CSS_V2}</style>
</head>
<body>
  <header class="v2-header">
    <div class="v2-header-inner">
      <a href="?page=home" class="v2-logo">
        <img src="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Slots.png" alt="Logo" class="v2-logo-img">
        <span class="v2-logo-text">Dachsbau Slots</span>
      </a>
      <nav class="v2-nav" aria-label="Hauptnavigation">
        ${navHtml}
      </nav>
      <div class="v2-header-right">
        <form class="v2-search-form" action="" method="get" role="search" aria-label="Spielersuche">
          <input type="hidden" name="page" value="profile">
          <input type="text" name="user" placeholder="Spieler suchen..." class="v2-search-input" required aria-label="Spielername eingeben">
          <button type="submit" class="v2-search-btn" aria-label="Suchen">
            <img src="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Suche.png" alt="" class="v2-search-icon" width="16" height="16">
          </button>
        </form>
        ${userSectionHtml}
      </div>
      <button class="v2-hamburger" onclick="toggleMobileNav()" aria-label="Men\u00fc">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </header>

  <div class="v2-mobile-nav-overlay" id="mobileNavOverlay" onclick="closeMobileNav()"></div>
  <nav class="v2-mobile-nav" id="mobileNav" aria-label="Mobile Navigation">
    ${mobileNavHtml}
    <div class="v2-mobile-nav-divider"></div>
    ${user ? `<a href="?page=profile&user=${encodeURIComponent(user.username)}" class="v2-nav-item">Mein Profil</a><a href="/auth/logout" class="v2-nav-item">Logout</a>` : `<a href="/auth/login" class="v2-nav-item">Mit Twitch einloggen</a>`}
  </nav>

  <main class="v2-main">
    <div class="v2-container">
      ${DISCLAIMER_HTML}
      ${disclaimerWarningHtml}
      ${content}
    </div>
  </main>

  <footer class="v2-footer">
    <p>Dachsbau Slots &mdash; Made by Exaint f\u00fcr <a href="https://www.twitch.tv/frechhdachs" target="_blank" rel="noopener">@frechhdachs</a></p>
    <p class="v2-footer-legal"><a href="?page=changelog">Changelog</a> &middot; <a href="?page=impressum">Impressum</a> &middot; <a href="?page=datenschutz">Datenschutz</a></p>
    <p style="font-size:0.75rem;color:var(--v2-text-muted);margin-top:8px">This website is not affiliated with or endorsed by Twitch.</p>
    ${designToggleHtml}
  </footer>

  <!-- Toast Container -->
  <div class="v2-toast-container" id="toastContainer" aria-live="polite"></div>

  <!-- Confirm Dialog -->
  <div class="v2-confirm-overlay" id="confirmOverlay" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="v2-confirm-dialog">
      <div class="v2-confirm-message" id="confirmMessage"></div>
      <div class="v2-confirm-actions">
        <button class="v2-btn v2-btn-secondary" id="confirmCancel">Abbrechen</button>
        <button class="v2-btn v2-btn-primary" id="confirmOk">Best\u00e4tigen</button>
      </div>
    </div>
  </div>

  <!-- Keyboard Shortcuts Modal -->
  <div class="v2-shortcuts-overlay" id="shortcutsOverlay" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="v2-shortcuts-dialog">
      <div class="v2-shortcuts-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="v2-modal-close" onclick="closeShortcutsModal()" aria-label="Schlie\u00dfen">&times;</button>
      </div>
      <div class="v2-shortcuts-grid">
        <div class="v2-shortcut-item"><kbd>/</kbd><span>Suche fokussieren</span></div>
        <div class="v2-shortcut-item"><kbd>h</kbd><span>Startseite</span></div>
        <div class="v2-shortcut-item"><kbd>l</kbd><span>Leaderboard</span></div>
        <div class="v2-shortcut-item"><kbd>s</kbd><span>Shop</span></div>
        <div class="v2-shortcut-item"><kbd>?</kbd><span>Diese Hilfe</span></div>
        <div class="v2-shortcut-item"><kbd>Esc</kbd><span>Dialoge schlie\u00dfen</span></div>
      </div>
    </div>
  </div>

  <!-- Offline Indicator -->
  <div class="v2-offline-banner" id="offlineBanner" aria-live="assertive">
    <span>Keine Internetverbindung</span>
  </div>

  <!-- Achievement Detail Modal -->
  <div class="v2-modal-overlay" id="achievementModal" onclick="closeAchievementModal(event)" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="v2-modal-content" onclick="event.stopPropagation()">
      <button class="v2-modal-close" onclick="closeAchievementModal()" aria-label="Schlie\u00dfen">&times;</button>
      <div class="v2-modal-header">
        <div class="v2-modal-icon" id="modalIcon"></div>
        <h2 id="modalName"></h2>
      </div>
      <p class="v2-modal-desc" id="modalDesc"></p>
      <div class="v2-modal-details">
        <div class="v2-modal-detail"><strong>Kategorie</strong><span id="modalCategory"></span></div>
        <div class="v2-modal-detail"><strong>Seltenheit</strong><span id="modalRarity"></span></div>
        <div class="v2-modal-detail" id="modalStatusRow" style="display:none"><strong>Freigeschaltet</strong><span id="modalStatus"></span></div>
        <div class="v2-modal-detail" id="modalProgressRow" style="display:none"><strong>Fortschritt</strong><span id="modalProgress"></span></div>
      </div>
    </div>
  </div>

  ${getClientScriptsV2()}
</body>
</html>`;
}

/**
 * Client-side JavaScript for V2
 */
function getClientScriptsV2() {
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

      document.getElementById('modalIcon').textContent = unlocked ? '\\u2705' : '\\uD83D\\uDD12';
      document.getElementById('modalName').textContent = name;
      document.getElementById('modalDesc').textContent = desc;
      document.getElementById('modalCategory').textContent = category;
      document.getElementById('modalRarity').textContent = rarity + '% (' + rarityCount + ' von ' + rarityTotal + ' Spielern)';

      if (unlocked && unlockedAt) {
        document.getElementById('modalStatus').textContent = unlockedAt;
        document.getElementById('modalStatusRow').style.display = 'flex';
      } else {
        document.getElementById('modalStatusRow').style.display = 'none';
      }

      if (!unlocked && progressCurrent && progressRequired) {
        var percent = Math.min(100, Math.round((parseInt(progressCurrent) / parseInt(progressRequired)) * 100));
        document.getElementById('modalProgress').innerHTML = '<div class="v2-modal-progress-bar"><div class="v2-progress-bar"><div class="v2-progress-fill" style="width:' + percent + '%"></div></div><span>' + progressCurrent + ' / ' + progressRequired + ' (' + percent + '%)</span></div>';
        document.getElementById('modalProgressRow').style.display = 'flex';
      } else {
        document.getElementById('modalProgressRow').style.display = 'none';
      }

      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeAchievementModal(event) {
      if (event && event.target !== event.currentTarget) return;
      var modal = document.getElementById('achievementModal');
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
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
          var co = document.getElementById('confirmOverlay');
          if (co && co.classList.contains('active')) document.getElementById('confirmCancel').click();
          break;
        case '/':
          e.preventDefault();
          var si = document.querySelector('.v2-search-input');
          if (si) si.focus();
          break;
        case '?':
          e.preventDefault();
          toggleShortcutsModal();
          break;
        case 'h': window.location.href = '?page=home'; break;
        case 'l': window.location.href = '?page=leaderboard'; break;
        case 's': window.location.href = '?page=shop'; break;
      }
    });

    // Mobile navigation
    function toggleMobileNav() {
      var hamburger = document.querySelector('.v2-hamburger');
      var mobileNav = document.getElementById('mobileNav');
      var overlay = document.getElementById('mobileNavOverlay');
      var isOpening = !mobileNav.classList.contains('active');
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active');
      overlay.classList.toggle('active');
      document.body.style.overflow = isOpening ? 'hidden' : '';
    }

    function closeMobileNav() {
      var hamburger = document.querySelector('.v2-hamburger');
      var mobileNav = document.getElementById('mobileNav');
      var overlay = document.getElementById('mobileNavOverlay');
      if (hamburger) hamburger.classList.remove('active');
      if (mobileNav) mobileNav.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Toast notifications
    function showToast(message, type, duration) {
      type = type || 'error';
      duration = duration || 4000;
      var container = document.getElementById('toastContainer');
      var toast = document.createElement('div');
      toast.className = 'v2-toast v2-toast-' + type;
      toast.textContent = message;
      container.appendChild(toast);
      requestAnimationFrame(function() { toast.classList.add('visible'); });
      setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { toast.remove(); }, 300);
      }, duration);
    }

    // Confirm dialog
    function showConfirm(message) {
      return new Promise(function(resolve) {
        var overlay = document.getElementById('confirmOverlay');
        var msgEl = document.getElementById('confirmMessage');
        var okBtn = document.getElementById('confirmOk');
        var cancelBtn = document.getElementById('confirmCancel');
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

    // Accept disclaimer
    async function acceptDisclaimer() {
      var btn = document.querySelector('.v2-btn-primary[onclick*="acceptDisclaimer"]') || event.target;
      if (btn) { btn.disabled = true; btn.textContent = 'Wird akzeptiert...'; }
      try {
        var response = await fetch('/api/disclaimer/accept', { method: 'POST', credentials: 'same-origin' });
        if (response.ok) {
          window.location.reload();
        } else {
          var data = await response.json();
          showToast(data.error || 'Fehler beim Akzeptieren', 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Disclaimer akzeptieren'; }
        }
      } catch (e) {
        showToast('Netzwerkfehler', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Disclaimer akzeptieren'; }
      }
    }

    // Shortcuts modal
    function toggleShortcutsModal() {
      var overlay = document.getElementById('shortcutsOverlay');
      overlay.classList.toggle('active');
    }
    function closeShortcutsModal() {
      document.getElementById('shortcutsOverlay').classList.remove('active');
    }

    // Design version toggle (admin only)
    async function toggleDesignVersion(version) {
      try {
        var response = await fetch('?api=design-toggle&version=' + version, { method: 'POST', credentials: 'same-origin' });
        if (response.ok) {
          window.location.reload();
        } else {
          showToast('Fehler beim Wechseln', 'error');
        }
      } catch (e) {
        showToast('Netzwerkfehler', 'error');
      }
    }

    // Search suggestions
    document.addEventListener('DOMContentLoaded', function() {
      var searchInputs = document.querySelectorAll('.v2-search-input');
      searchInputs.forEach(function(input) {
        var suggestionsContainer = null;
        var debounceTimer = null;

        var wrapper = document.createElement('div');
        wrapper.className = 'v2-search-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'v2-search-suggestions';
        wrapper.appendChild(suggestionsContainer);

        input.addEventListener('input', function() {
          var query = this.value.trim();
          clearTimeout(debounceTimer);
          if (query.length < 2) {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
            return;
          }
          debounceTimer = setTimeout(async function() {
            try {
              var response = await fetch('?api=search&q=' + encodeURIComponent(query));
              if (!response.ok) { suggestionsContainer.style.display = 'none'; return; }
              var data = await response.json();
              if (data.players && data.players.length > 0) {
                suggestionsContainer.innerHTML = '';
                data.players.forEach(function(player) {
                  var div = document.createElement('div');
                  div.className = 'v2-suggestion-item';
                  div.dataset.username = player;
                  div.textContent = player;
                  suggestionsContainer.appendChild(div);
                });
                suggestionsContainer.style.display = 'block';
              } else {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
              }
            } catch (e) { suggestionsContainer.style.display = 'none'; }
          }, 200);
        });

        suggestionsContainer.addEventListener('click', function(e) {
          if (e.target.classList.contains('v2-suggestion-item')) {
            input.value = e.target.dataset.username;
            suggestionsContainer.style.display = 'none';
            input.closest('form').submit();
          }
        });

        input.addEventListener('blur', function() {
          setTimeout(function() { suggestionsContainer.style.display = 'none'; }, 200);
        });
      });

      // Close mobile nav on link click
      var mobileNav = document.getElementById('mobileNav');
      if (mobileNav) {
        mobileNav.querySelectorAll('.v2-nav-item').forEach(function(link) {
          link.addEventListener('click', closeMobileNav);
        });
      }

      // Achievement filter
      var filterBtns = document.querySelectorAll('.v2-filter-btn');
      if (filterBtns.length > 0) {
        var allAch = document.querySelectorAll('.v2-achievement');
        var unlocked = document.querySelectorAll('.v2-achievement.unlocked').length;
        var locked = document.querySelectorAll('.v2-achievement.locked').length;
        filterBtns.forEach(function(btn) {
          var f = btn.dataset.filter;
          if (f === 'all') btn.textContent = 'Alle (' + allAch.length + ')';
          else if (f === 'unlocked') btn.textContent = 'Freigeschaltet (' + unlocked + ')';
          else if (f === 'locked') btn.textContent = 'Gesperrt (' + locked + ')';
        });
        filterBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var filter = this.dataset.filter;
            filterBtns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
            this.classList.add('active');
            this.setAttribute('aria-pressed','true');
            document.querySelectorAll('.v2-achievement').forEach(function(ach) {
              if (filter === 'all') ach.style.display = '';
              else if (filter === 'unlocked') ach.style.display = ach.classList.contains('unlocked') ? '' : 'none';
              else if (filter === 'locked') ach.style.display = ach.classList.contains('locked') ? '' : 'none';
            });
            document.querySelectorAll('.v2-category').forEach(function(cat) {
              var visible = cat.querySelectorAll('.v2-achievement:not([style*="display: none"])');
              cat.style.display = visible.length > 0 ? '' : 'none';
            });
          });
        });
      }

      // Sort buttons
      var sortBtns = document.querySelectorAll('.v2-sort-btn');
      var categoriesContainer = document.querySelector('.v2-categories');
      if (sortBtns.length > 0 && categoriesContainer) {
        sortBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var sortType = this.dataset.sort;
            sortBtns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
            this.classList.add('active');
            this.setAttribute('aria-pressed','true');
            if (sortType === 'category') {
              document.querySelectorAll('.v2-category').forEach(function(cat) { cat.style.display = ''; });
              var sl = document.getElementById('sortedAchievements');
              if (sl) sl.remove();
            } else {
              document.querySelectorAll('.v2-category').forEach(function(cat) { cat.style.display = 'none'; });
              var achievements = Array.from(document.querySelectorAll('.v2-achievement'));
              var sorted = achievements.sort(function(a, b) {
                var ra = parseInt(a.dataset.rarity) || 0;
                var rb = parseInt(b.dataset.rarity) || 0;
                return sortType === 'rarity-asc' ? ra - rb : rb - ra;
              });
              var existing = document.getElementById('sortedAchievements');
              if (existing) existing.remove();
              var container = document.createElement('div');
              container.id = 'sortedAchievements';
              container.className = 'v2-sorted-achievements';
              sorted.forEach(function(ach) { container.appendChild(ach.cloneNode(true)); });
              categoriesContainer.appendChild(container);
            }
          });
        });
      }

      // Category collapse
      var savedState = localStorage.getItem('v2_categoryCollapseState');
      if (savedState) {
        try {
          var state = JSON.parse(savedState);
          document.querySelectorAll('.v2-category').forEach(function(cat) {
            var name = cat.querySelector('.v2-category-title span');
            if (name && state[name.textContent]) cat.classList.add('collapsed');
          });
        } catch (e) {}
      }

      // Confetti
      var confettiContainer = document.getElementById('confetti');
      if (confettiContainer) {
        var colors = ['#c9a84c', '#5a9e6a', '#b86b8a', '#5a8ab8', '#c78050', '#dbb960'];
        for (var i = 0; i < 80; i++) {
          var c = document.createElement('div');
          c.className = 'v2-confetti';
          c.style.left = Math.random() * 100 + '%';
          c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
          c.style.animationDelay = Math.random() * 3 + 's';
          c.style.animationDuration = (3 + Math.random() * 2) + 's';
          c.style.fontSize = (8 + Math.random() * 10) + 'px';
          confettiContainer.appendChild(c);
        }
        setTimeout(function() { confettiContainer.remove(); }, 6000);
      }
    });

    // Admin Panel Functions
    function escAdm(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    var MAX_BALANCE = 1000000;

    async function adminApiCall(action, data) {
      var msgEl = document.getElementById('adminMessage');
      if (msgEl) { msgEl.className = 'v2-admin-message'; msgEl.textContent = ''; }
      try {
        var response = await fetch('?api=admin&action=' + action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        var result = await response.json();
        if (result.success) {
          showToast('Erfolgreich aktualisiert!', 'success');
          if (msgEl) { msgEl.className = 'v2-admin-message success'; msgEl.textContent = 'Erfolgreich!'; }
          setTimeout(function() { location.reload(); }, 1500);
        } else {
          var err = result.error || 'Unbekannter Fehler';
          showToast('Fehler: ' + err, 'error');
          if (msgEl) { msgEl.className = 'v2-admin-message error'; msgEl.textContent = 'Fehler: ' + err; }
        }
        return result;
      } catch (e) {
        showToast('Netzwerkfehler', 'error');
        if (msgEl) { msgEl.className = 'v2-admin-message error'; msgEl.textContent = 'Netzwerkfehler'; }
        return { error: e.message };
      }
    }

    function getAdminUsername() {
      var panel = document.getElementById('adminPanel');
      return panel ? panel.dataset.username : null;
    }

    function adminSetBalance() {
      var username = getAdminUsername();
      var balance = parseInt(document.getElementById('adminBalance').value, 10);
      if (isNaN(balance) || balance < 0) { showToast('Ung\\u00fcltiger Betrag', 'error'); return; }
      if (balance > MAX_BALANCE) { showToast('Max: ' + MAX_BALANCE.toLocaleString('de-DE') + ' DT', 'error'); return; }
      adminApiCall('setBalance', { username: username, balance: balance });
    }

    function adminSetDisclaimer(accepted) { adminApiCall('setDisclaimer', { username: getAdminUsername(), accepted: accepted }); }

    async function adminSetSelfBan(banned) {
      if (banned) { var ok = await showConfirm('Spieler wirklich sperren?'); if (!ok) return; }
      adminApiCall('setSelfBan', { username: getAdminUsername(), banned: banned });
    }

    function adminSetDuelOpt(optedOut) { adminApiCall('setDuelOpt', { username: getAdminUsername(), optedOut: optedOut }); }
    function adminSetLeaderboardHidden(hidden) { adminApiCall('setLeaderboardHidden', { username: getAdminUsername(), hidden: hidden }); }

    async function adminSetAchievement(unlocked) {
      var username = getAdminUsername();
      var select = document.getElementById('adminAchievement');
      var id = select.value;
      var name = select.options[select.selectedIndex].text;
      var action = unlocked ? 'freischalten' : 'sperren';
      var ok = await showConfirm('"' + name.substring(2) + '" ' + action + '?');
      if (!ok) return;
      adminApiCall('setAchievement', { username: username, achievementId: id, unlocked: unlocked }).then(function() {
        var opt = select.options[select.selectedIndex];
        opt.dataset.unlocked = unlocked ? 'true' : 'false';
        opt.text = (unlocked ? '\\u2713' : '\\u25CB') + opt.text.substring(1);
      });
    }

    async function loadRefundableItems() {
      var username = getAdminUsername();
      var container = document.getElementById('refundItemsContainer');
      container.innerHTML = '<div style="color:var(--v2-text-muted);font-size:0.85rem">Lade...</div>';
      container.style.display = 'block';
      try {
        var response = await fetch('?api=admin&action=getRefundableItems', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:username})
        });
        var result = await response.json();
        if (!result.success) { container.innerHTML = '<div style="color:var(--v2-error)">Fehler: ' + escAdm(result.error) + '</div>'; return; }
        var html = '<div class="v2-refund-groups">';
        var groups = [{title:'Prestige R\\u00e4nge',items:result.items.filter(function(i){return i.type==='prestige';})},{title:'Slot Unlocks',items:result.items.filter(function(i){return i.type==='unlock';})}];
        groups.forEach(function(g) {
          html += '<div class="v2-refund-group"><h4>' + g.title + '</h4>';
          g.items.forEach(function(item) {
            var cls = item.owned ? (item.canRefund ? 'refundable' : 'blocked') : 'not-owned';
            html += '<div class="v2-refund-item ' + cls + '"><span class="v2-refund-item-name">' + escAdm(item.symbol) + ' ' + escAdm(item.name) + '</span><span class="v2-refund-item-price">+' + item.price.toLocaleString('de-DE') + ' DT</span>';
            if (item.owned && item.canRefund) html += '<button class="v2-btn v2-btn-danger v2-btn-sm btn-refund" data-key="' + escAdm(item.key) + '" data-name="' + escAdm(item.name) + '" data-price="' + item.price + '">Refund</button>';
            else if (item.owned) html += '<span class="v2-refund-blocked">' + escAdm(item.blockedReason) + '</span>';
            else html += '<span class="v2-refund-not-owned">Nicht gekauft</span>';
            html += '</div>';
          });
          html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
        container.querySelectorAll('.btn-refund').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            await refundItem(this.dataset.key, this.dataset.name, parseInt(this.dataset.price, 10));
          });
        });
      } catch (e) { container.innerHTML = '<div style="color:var(--v2-error)">Netzwerkfehler</div>'; }
    }

    async function refundItem(itemKey, itemName, price) {
      var username = getAdminUsername();
      var ok = await showConfirm('"' + itemName + '" refunden? +' + price.toLocaleString('de-DE') + ' DT');
      if (!ok) return;
      var result = await adminApiCall('refund', { username: username, itemKey: itemKey });
      if (result && result.success) loadRefundableItems();
    }

    // Collapsible sections
    function toggleSection(header) {
      var section = header.closest('.v2-collapsible-section');
      section.classList.toggle('expanded');
    }

    // Shop categories
    function toggleShopCategory(header) {
      var category = header.closest('.v2-shop-category');
      category.classList.toggle('v2-shop-cat-expanded');
    }

    function expandAllShopCategories() {
      document.querySelectorAll('.v2-shop-category').forEach(function(c) { c.classList.add('v2-shop-cat-expanded'); });
    }

    function collapseAllShopCategories() {
      document.querySelectorAll('.v2-shop-category').forEach(function(c) { c.classList.remove('v2-shop-cat-expanded'); });
    }

    function scrollToShopSection(event, sectionId) {
      event.preventDefault();
      var target = document.getElementById(sectionId);
      if (!target) return;
      var cat = target.querySelector('.v2-shop-category');
      if (cat) cat.classList.add('v2-shop-cat-expanded');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Category collapse toggle
    function toggleCategory(titleEl) {
      var cat = titleEl.closest('.v2-category');
      cat.classList.toggle('collapsed');
      var allStates = {};
      document.querySelectorAll('.v2-category').forEach(function(c) {
        var name = c.querySelector('.v2-category-title span');
        if (name) allStates[name.textContent] = c.classList.contains('collapsed');
      });
      localStorage.setItem('v2_categoryCollapseState', JSON.stringify(allStates));
    }

    // Shop buy
    async function buyItem(itemId) {
      var btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Kaufe...';
      try {
        var response = await fetch('/api/shop/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ itemId: itemId })
        });
        var result = await response.json();
        if (result.success) {
          showToast(result.message || 'Gekauft!', 'success');
          btn.textContent = 'Gekauft!';
          btn.classList.add('v2-btn-buy-disabled');
          updateBuyButtons(result.newBalance);
        } else {
          showToast(result.error || 'Kaufe fehlgeschlagen', 'error');
          btn.disabled = false;
          btn.textContent = 'Kaufen';
        }
      } catch (e) {
        showToast('Netzwerkfehler', 'error');
        btn.disabled = false;
        btn.textContent = 'Kaufen';
      }
    }

    function updateBuyButtons(newBalance) {
      document.querySelectorAll('.v2-btn-buy:not(.v2-btn-buy-disabled)').forEach(function(btn) {
        var item = btn.closest('.v2-shop-item');
        if (!item) return;
        var priceEl = item.querySelector('.v2-shop-item-price');
        if (!priceEl) return;
        var price = parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10);
        if (price && newBalance < price) {
          btn.disabled = true;
          btn.classList.add('v2-btn-buy-disabled');
          btn.title = 'Nicht genug DachsTaler';
        }
      });
    }

    // Bet toggle
    document.querySelectorAll('.v2-bet-toggle-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.v2-bet-toggle-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var multiplier = parseInt(btn.dataset.multiplier, 10);
        document.querySelectorAll('.payout-value').forEach(function(el) {
          var base = parseInt(el.dataset.base, 10);
          el.textContent = (base * multiplier).toLocaleString('de-DE') + ' DT';
        });
      });
    });

    // Offline detection
    window.addEventListener('offline', function() { document.getElementById('offlineBanner').style.display = 'block'; });
    window.addEventListener('online', function() { document.getElementById('offlineBanner').style.display = 'none'; });
  </script>`;
}
