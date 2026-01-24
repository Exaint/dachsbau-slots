/**
 * V2 Shop Page Renderer
 * "Luxury Woodland Lodge" aesthetic redesign
 */

import { getBalance, getPrestigeRank, hasUnlock } from '../../../database.js';
import { SHOP_ITEMS } from '../../../constants.js';
import { isWebPurchasable } from '../../../routes/shop.js';
import { escapeHtml, formatNumber } from '../utils.js';
import { baseTemplateV2 } from './template.js';

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
  25: 'Schaltet freie Einsätze frei - !slots 1 bis !slots all (jeder Betrag)',
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

// R2 base URL for assets
const R2_BASE = 'https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev';

// Item icons for shop
const ITEM_ICONS = {
  1: `<img src="${R2_BASE}/Peek.png" alt="Peek Token" class="v2-shop-item-img">`,
  2: '🍒', 3: '🍋', 4: '🍊', 5: '🍇', 6: '🍉', 7: '⭐', 8: '🦡',
  9: `<img src="${R2_BASE}/Hingabe.png" alt="Insurance" class="v2-shop-item-img">`,
  10: '✖️',
  11: `<img src="${R2_BASE}/Chaos.png" alt="Chaos Spin" class="v2-shop-item-img">`,
  12: '🎡', 13: '🔓', 14: '🎉', 15: '📦',
  16: `<img src="${R2_BASE}/Mystery.png" alt="Mystery Box" class="v2-shop-item-img">`,
  17: '🥉', 18: '📊', 19: '🔓', 20: '🍀', 21: '🔓', 22: '🥈',
  23: '🔓',
  24: `<img src="${R2_BASE}/HappyHour.png" alt="Happy Hour" class="v2-shop-item-img">`,
  25: '🔓', 26: '🥇', 27: '💰', 28: '💬', 29: '💎',
  30: '👑',
  31: `<img src="${R2_BASE}/Reverse.png" alt="Reverse Spin" class="v2-shop-item-img">`,
  32: '🌟', 33: '🦡',
  34: `<img src="${R2_BASE}/Rage.png" alt="Rage Mode" class="v2-shop-item-img">`,
  35: '📈', 36: '💎',
  37: '🎯', 38: '🃏', 39: '💎'
};

/**
 * V2 Shop page renderer
 */
export async function renderShopPageV2(env, user = null) {
  // If user is logged in, fetch their balance, unlocks and prestige rank
  let userBalanceHtml = '';
  let userUnlocks = new Set();
  let userPrestigeRank = null;
  let userBalance = 0;

  if (user) {
    // Fetch all user data in parallel
    const unlockKeys = ['slots_20', 'slots_30', 'slots_50', 'slots_100', 'slots_all', 'daily_boost', 'custom_message'];
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
      <div class="v2-shop-user-info">
        <div class="v2-shop-user-balance">
          <span class="v2-balance-label">Dein Kontostand:</span>
          <span class="v2-balance-value" id="userBalance">${formatNumber(balance)} DT</span>
        </div>
      </div>
      <div id="purchaseFeedback" class="v2-purchase-feedback"></div>
    `;
  } else {
    userBalanceHtml = `
      <div class="v2-shop-login-prompt">
        <a href="/auth/login" class="v2-btn-twitch-login">
          <svg viewBox="0 0 256 268" class="v2-twitch-icon" width="16" height="16">
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

  const renderCategory = (cat, tip = '') => {
    if (cat.items.length === 0) return '';

    // Sort items by price
    cat.items.sort((a, b) => a.price - b.price);

    const itemsHtml = cat.items.map(item => {
      const icon = ITEM_ICONS[item.id] || '📦';
      const desc = ITEM_DESCRIPTIONS[item.id] || '';
      const requiresHtml = item.requires ? `<span class="v2-shop-item-requires">Benötigt: ${item.requires.replace('slots_', '!slots ')}</span>` : '';
      const requiresRankHtml = item.requiresRank ? `<span class="v2-shop-item-requires">Benötigt: ${item.requiresRank}</span>` : '';
      const weeklyHtml = item.weeklyLimit ? '<span class="v2-shop-item-limit">1x/Woche</span>' : '';

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

      const ownedBadge = isOwned ? '<span class="v2-shop-item-owned">✓ Gekauft</span>' : '';
      const ownedClass = isOwned ? ' v2-shop-item-is-owned' : '';

      // Web purchase button (only for logged-in users and web-purchasable items)
      let buyButtonHtml = '';
      if (user && isWebPurchasable(item.id) && !isOwned) {
        const canAfford = userBalance >= item.price;
        const disabledAttr = canAfford ? '' : ' disabled';
        const disabledTitle = canAfford ? '' : ` title="Nicht genug DachsTaler"`;
        buyButtonHtml = `
          <button class="v2-btn-buy${canAfford ? '' : ' v2-btn-buy-disabled'}"${disabledAttr}${disabledTitle}
            onclick="buyItem(${item.id})">
            Kaufen
          </button>
        `;
      } else if (user && !isWebPurchasable(item.id) && !isOwned) {
        buyButtonHtml = `<span class="v2-shop-item-chat-only" title="Dieses Item kann nur im Chat gekauft werden">Nur Chat</span>`;
      }

      return `
        <div class="v2-shop-item${ownedClass}" data-item-id="${item.id}">
          <div class="v2-shop-item-icon">${icon}</div>
          <div class="v2-shop-item-content">
            <div class="v2-shop-item-header">
              <span class="v2-shop-item-name">${escapeHtml(item.name)}</span>
              ${ownedBadge}
              <span class="v2-shop-item-price">${formatNumber(item.price)} DT</span>
            </div>
            <div class="v2-shop-item-desc">${desc}</div>
            <div class="v2-shop-item-meta">
              <code class="v2-shop-item-cmd">!shop buy ${item.id}</code>
              ${requiresHtml}${requiresRankHtml}${weeklyHtml}
              ${buyButtonHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="v2-shop-category" data-category="${cat.title}">
        <div class="v2-shop-category-header" onclick="toggleShopCategory(this)">
          <div class="v2-shop-category-header-left">
            <h3 class="v2-shop-category-title">${cat.icon} ${cat.title}</h3>
            <p class="v2-shop-category-desc">${cat.desc}</p>
          </div>
          <span class="v2-shop-collapse-icon">▼</span>
        </div>
        <div class="v2-shop-category-content">
          <div class="v2-shop-items">
            ${itemsHtml}
          </div>
          ${tip ? `<div class="v2-section-note v2-shop-pro-tip">${tip}</div>` : ''}
        </div>
      </div>
    `;
  };

  const content = `
    <div class="v2-content-page">
      <h1 class="v2-page-title">Shop</h1>
      <p class="v2-page-subtitle">Kaufe Items mit <code>!shop buy [Nummer]</code> im Twitch Chat</p>

      ${userBalanceHtml}

      <!-- Inhaltsverzeichnis -->
      <nav class="v2-info-toc v2-shop-toc" aria-label="Shop-Navigation">
        <div class="v2-toc-grid">
          <a href="#kaufanleitung" class="v2-toc-item" onclick="scrollToShopSection(event, 'kaufanleitung')">📋 Kaufanleitung</a>
          <a href="#boosts" class="v2-toc-item" onclick="scrollToShopSection(event, 'boosts')">🎰 Symbol-Boosts</a>
          <a href="#instant" class="v2-toc-item" onclick="scrollToShopSection(event, 'instant')">⚡ Sofort-Items</a>
          <a href="#timed" class="v2-toc-item" onclick="scrollToShopSection(event, 'timed')">⏰ Timed Buffs</a>
          <a href="#unlocks" class="v2-toc-item" onclick="scrollToShopSection(event, 'unlocks')">🔓 Freischaltungen</a>
          <a href="#prestige" class="v2-toc-item" onclick="scrollToShopSection(event, 'prestige')">👑 Prestige-Ränge</a>
        </div>
        <div class="v2-shop-collapse-controls">
          <button class="v2-btn-collapse-all" onclick="expandAllShopCategories()">Alle ausklappen</button>
          <button class="v2-btn-collapse-all" onclick="collapseAllShopCategories()">Alle einklappen</button>
        </div>
      </nav>

      <!-- Kaufanleitung (einklappbar, collapsed by default) -->
      <section id="kaufanleitung" class="v2-collapsible-section">
        <h2 class="v2-collapsible-header" onclick="toggleSection(this)">
          <span>📋 Kaufanleitung</span>
          <span class="v2-shop-collapse-icon">▼</span>
        </h2>
        <div class="v2-collapsible-content" style="display: none;">
        <div class="v2-duel-steps">
          <div class="v2-duel-step">
            <span class="v2-step-number">1</span>
            <div class="v2-step-content">
              <strong>Item auswählen</strong>
              <p>Schau dir die Shop-Liste an und finde das passende Item.</p>
            </div>
          </div>
          <div class="v2-duel-step">
            <span class="v2-step-number">2</span>
            <div class="v2-step-content">
              <strong>Nummer notieren</strong>
              <p>Jedes Item hat eine eindeutige Nummer (z.B. #38 für Wild Card).</p>
            </div>
          </div>
          <div class="v2-duel-step">
            <span class="v2-step-number">3</span>
            <div class="v2-step-content">
              <strong>Kaufen</strong>
              <p><strong>Website:</strong> Klick auf "Kaufen" (wenn eingeloggt)<br>
              <strong>Chat:</strong> <code>!shop buy [Nummer]</code></p>
            </div>
          </div>
        </div>
        <div class="v2-tip-list">
          <div class="v2-tip-item">
            <span class="v2-tip-icon">ℹ️</span>
            <div>
              <strong>Wichtige Infos</strong>
              <p>• Einige Items sind einmalig (Unlocks & Prestige)<br>
              • Timed Buffs laufen nach Kauf-Zeitpunkt ab<br>
              • Spin Bundle: Max 3x/Woche (Reset: Montag 00:00 UTC)<br>
              • Dachs-Boost: Max 1x/Woche (Reset: Montag 00:00 UTC)</p>
            </div>
          </div>
          <div class="v2-tip-item">
            <span class="v2-tip-icon">💬</span>
            <div>
              <strong>Nur im Chat kaufbar</strong>
              <p>Einige Items benötigen direkte Chat-Interaktion und sind daher nicht über die Website kaufbar:<br>
              • <strong>Peek Token</strong> - Zeigt das nächste Ergebnis im Chat<br>
              • <strong>Chaos/Reverse Chaos</strong> - Startet sofort einen Spin<br>
              • <strong>Glücksrad</strong> - Dreht sofort das Rad<br>
              • <strong>Mystery Box</strong> - Öffnet sofort die Box<br>
              • <strong>Diamond Mine</strong> - Startet sofort die Mine</p>
            </div>
          </div>
        </div>
        </div>
      </section>

      <div id="boosts">${renderCategory(categories.boosts, '💡 <strong>Pro-Tipp:</strong> Kombiniere Boosts mit hohen Multipliers für massive Gewinne!<br><strong>Beispiel:</strong> 🦡 Dachs-Boost + <code>!slots 100</code> = bis zu 300.000 DT möglich! (15.000 × 2 × 10)')}</div>

      <div id="instant">${renderCategory(categories.instant, '💡 <strong>Pro-Tipp:</strong> Peek Token ist perfekt um zu testen ob Lucky Charm oder andere Buffs wirken!')}</div>

      <div id="timed">${renderCategory(categories.timed)}</div>

      <div id="unlocks">${renderCategory(categories.unlocks)}</div>

      <div id="prestige">${renderCategory(categories.prestige)}</div>

    </div>
  `;

  return baseTemplateV2('Shop', content, 'shop', user);
}
