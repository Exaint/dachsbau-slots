/**
 * Changelog Page Renderer
 */

import type { LoggedInUser } from '../../types/index.js';
import { baseTemplate } from './template.js';

/**
 * Changelog page
 */
export function renderChangelogPage(user: LoggedInUser | null = null): string {
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
