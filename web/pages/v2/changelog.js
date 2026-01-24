/**
 * V2 Changelog Page Renderer
 */

import { baseTemplateV2 } from './template.js';

/**
 * Changelog page
 */
export function renderChangelogPageV2(user = null) {
  const content = `
    <div>
      <h1 class="v2-page-title">Changelog</h1>
      <p class="v2-page-subtitle">Aktuelle Version: 1.7.0 \u2014 \u201eAchievement-Website\u201c</p>

      <div class="v2-changelog-entry" style="animation:v2SlideUp 0.4s ease both">
        <div class="v2-changelog-date">18. Januar 2026</div>
        <h2 class="v2-changelog-title">Version 1.7.0 \u2014 \u201eAchievement-Website\u201c</h2>
        <div class="v2-changelog-content">
          <h3 class="v2-section-title" style="font-size:1rem;margin-top:0">\u00d6ffentliche Website</h3>
          <ul>
            <li>Spieler-Profile mit Stats und Erfolgen online einsehen</li>
            <li>Leaderboard auf der Website</li>
            <li>Globale Statistiken (seltenste Achievements, etc.)</li>
            <li>Dark/Light Theme Toggle</li>
            <li>Mobile-optimiertes Design</li>
          </ul>
          <h3 class="v2-section-title" style="font-size:1rem">Achievement-System</h3>
          <ul>
            <li>50+ freischaltbare Erfolge in 7 Kategorien</li>
            <li>Seltenheits-Anzeige (% der Spieler)</li>
            <li>Fortschritts-Tracking f\u00fcr alle Achievements</li>
            <li>Konfetti-Effekt bei 100% Completion</li>
          </ul>
          <h3 class="v2-section-title" style="font-size:1rem">Neue Commands</h3>
          <ul>
            <li><code>!slots website / site / seite</code> \u2013 Link zur Website</li>
            <li><code>!slots erfolge / achievements</code> \u2013 Link zu deinen Erfolgen</li>
            <li><code>!slots erfolge @user</code> \u2013 Erfolge eines anderen Spielers</li>
          </ul>
        </div>
      </div>

      <div class="v2-changelog-entry" style="animation:v2SlideUp 0.4s ease 0.05s both">
        <div class="v2-changelog-date">17. Januar 2026</div>
        <h2 class="v2-changelog-title">Version 1.6.0 \u2014 \u201eDuell-System\u201c</h2>
        <div class="v2-changelog-content">
          <ul>
            <li>Fordere andere Spieler zum direkten Slot-Duell heraus</li>
            <li>Faire 1v1 Battles ohne Buffs oder Items</li>
            <li>Mindesteinsatz: 100 DachsTaler</li>
            <li>60 Sekunden Zeit zum Antworten</li>
          </ul>
        </div>
      </div>

      <div class="v2-changelog-entry" style="animation:v2SlideUp 0.4s ease 0.1s both">
        <div class="v2-changelog-date">6. Januar 2026</div>
        <h2 class="v2-changelog-title">Version 1.5.3 \u2014 \u201eBug Fixes\u201c</h2>
        <div class="v2-changelog-content">
          <ul>
            <li>Bank-Balance bei Random-Reward-Items korrigiert</li>
            <li>Mystery Box Rollback bei Fehlern</li>
            <li>Balance-Protection gegen negative Werte</li>
          </ul>
        </div>
      </div>

      <div class="v2-changelog-entry" style="animation:v2SlideUp 0.4s ease 0.15s both">
        <div class="v2-changelog-date">5. Januar 2026</div>
        <h2 class="v2-changelog-title">Version 1.5.0 \u2014 \u201eModular Architecture\u201c</h2>
        <div class="v2-changelog-content">
          <ul>
            <li>40-50% schnellere Response-Zeit</li>
            <li>Modulares Code-System</li>
            <li>Optimierte KV-Operationen</li>
          </ul>
        </div>
      </div>

      <div class="v2-changelog-entry" style="animation:v2SlideUp 0.4s ease 0.2s both">
        <div class="v2-changelog-date">27. Dezember 2025</div>
        <h2 class="v2-changelog-title">Version 1.4.0 \u2014 \u201eWinter Update\u201c</h2>
        <div class="v2-changelog-content">
          <ul>
            <li>Streak Multiplier System (kostenlos!)</li>
            <li>Wild Card System (Item #38)</li>
            <li>Guaranteed Pair (Item #37)</li>
            <li>Diamond Rush (Item #39)</li>
          </ul>
        </div>
      </div>

      <div class="v2-changelog-entry" style="animation:v2SlideUp 0.4s ease 0.25s both">
        <div class="v2-changelog-date">26. Dezember 2025</div>
        <h2 class="v2-changelog-title">Version 1.3.0 \u2014 \u201eMonthly Login Update\u201c</h2>
        <div class="v2-changelog-content">
          <ul>
            <li>Monthly Login System mit Milestone-Boni</li>
            <li>Bis zu 3.250 DT extra pro Monat</li>
          </ul>
        </div>
      </div>

      <div class="v2-changelog-entry" style="animation:v2SlideUp 0.4s ease 0.3s both">
        <div class="v2-changelog-date">21. Dezember 2025</div>
        <h2 class="v2-changelog-title">Version 1.0.0 \u2014 \u201eInitial Release\u201c</h2>
        <div class="v2-changelog-content">
          <ul>
            <li>Slot Machine mit 3x3 Grid</li>
            <li>DachsTaler W\u00e4hrung</li>
            <li>Shop-System mit 30+ Items</li>
            <li>Prestige-R\u00e4nge</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  return baseTemplateV2('Changelog', content, 'changelog', user);
}
