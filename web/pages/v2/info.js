/**
 * V2 Info Page Renderer
 */

import { isAdmin } from '../../../utils.js';
import { baseTemplateV2 } from './template.js';

export function renderInfoPageV2(user = null) {
  const content = `
    <div class="v2-content-page">
      <h1 class="v2-page-title">Info & Commands</h1>
      <p class="v2-page-subtitle">Alles was du uber Dachsbau Slots wissen musst</p>

      <!-- Inhaltsverzeichnis -->
      <nav class="v2-info-toc" aria-label="Inhaltsverzeichnis">
        <div class="v2-toc-grid">
          <a href="#schnellstart" class="v2-toc-item">Schnellstart</a>
          <a href="#wichtig" class="v2-toc-item">Wichtig zu wissen</a>
          <a href="#commands" class="v2-toc-item">Commands</a>
          ${user && isAdmin(user.username) ? '<a href="#admin" class="v2-toc-item v2-toc-admin">Admin Commands</a>' : ''}
          <a href="#gewinne" class="v2-toc-item">Gewinne & Symbole</a>
          <a href="#multiplier" class="v2-toc-item">Multiplier-System</a>
          <a href="#bonus" class="v2-toc-item">Bonus-Systeme</a>
          <a href="#duell" class="v2-toc-item">Duell-System</a>
          <a href="#bank" class="v2-toc-item">DachsBank</a>
          <a href="#faq" class="v2-toc-item">FAQ</a>
          <a href="#hilfe" class="v2-toc-item">Hilfe</a>
          <a href="#shortcuts" class="v2-toc-item v2-desktop-only">Tastaturkurzel</a>
        </div>
      </nav>

      <!-- Schnellstart -->
      <details class="v2-info-accordion" id="schnellstart">
        <summary class="v2-accordion-header">Schnellstart</summary>
        <div class="v2-accordion-content">
          <p class="v2-section-intro">Neu hier? In 4 Schritten loslegen:</p>
          <div class="v2-info-grid">
            <div class="v2-info-card">
              <span class="v2-info-label">1. Starten</span>
              <span class="v2-info-value"><code>!slots</code> — Zeigt Willkommensnachricht & Disclaimer</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">2. Akzeptieren</span>
              <span class="v2-info-value"><code>!slots accept</code> — Disclaimer akzeptieren, Account erstellen (100 DT)</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">3. Spielen</span>
              <span class="v2-info-value"><code>!slots</code> — Dein erster Spin!</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">4. Daily holen</span>
              <span class="v2-info-value"><code>!slots daily</code> — +50 DachsTaler alle 24 Stunden</span>
            </div>
          </div>
        </div>
      </details>

      <!-- Wichtig zu wissen -->
      <details class="v2-info-accordion" id="wichtig" open>
        <summary class="v2-accordion-header">Wichtig zu wissen</summary>
        <div class="v2-accordion-content">
          <p class="v2-section-intro">Diese Infos solltest du kennen, bevor du loslegst!</p>

          <h3>Einsatz & Kosten</h3>
          <div class="v2-info-grid">
            <div class="v2-info-card">
              <span class="v2-info-label">Mindesteinsatz</span>
              <span class="v2-info-value">10 DachsTaler pro Spin</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">Startguthaben</span>
              <span class="v2-info-value">100 DachsTaler (neue Spieler)</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">Bei 0 DachsTaler</span>
              <span class="v2-info-value">Warte auf Daily oder bitte um Transfer</span>
            </div>
          </div>

          <h3>Cooldowns</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!slots / !slots [Einsatz]</code>
              <span>30 Sekunden</span>
            </div>
            <div class="v2-command-item">
              <code>!slots daily</code>
              <span>24 Stunden (UTC Mitternacht)</span>
            </div>
            <div class="v2-command-item">
              <span>Alle anderen Commands</span>
              <span>Kein Cooldown</span>
            </div>
          </div>

          <h3>Fossabot-Besonderheiten</h3>
          <div class="v2-tip-list">
            <div class="v2-tip-item">
              <span class="v2-tip-icon">💡</span>
              <div>
                <strong>Keine doppelten Nachrichten</strong>
                <p>Schreibe zwischen zwei <code>!slots</code> immer eine andere Nachricht! Fossabot ignoriert identische aufeinanderfolgende Befehle.</p>
              </div>
            </div>
          </div>

          <h3>Hoehere Einsaetze freischalten</h3>
          <p>Hoehere Einsaetze muessen <strong>zuerst im Shop gekauft</strong> werden:</p>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!shop buy 13</code>
              <span>→ <code>!slots 20</code> (500 DT)</span>
            </div>
            <div class="v2-command-item">
              <code>!shop buy 19</code>
              <span>→ <code>!slots 30</code> (2.000 DT)</span>
            </div>
            <div class="v2-command-item">
              <code>!shop buy 21</code>
              <span>→ <code>!slots 50</code> (2.500 DT)</span>
            </div>
            <div class="v2-command-item">
              <code>!shop buy 23</code>
              <span>→ <code>!slots 100</code> (3.250 DT)</span>
            </div>
            <div class="v2-command-item">
              <code>!shop buy 25</code>
              <span>→ <code>!slots 1-∞</code> (4.444 DT)</span>
            </div>
          </div>
        </div>
      </details>

      <!-- Commands -->
      <details class="v2-info-accordion" id="commands" open>
        <summary class="v2-accordion-header">Commands</summary>
        <div class="v2-accordion-content">
          <h3>Haupt-Commands</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!slots</code>
              <span>Spin für 10 DachsTaler (30 Sek Cooldown)</span>
            </div>
            <div class="v2-command-item">
              <code>!slots [20/30/50/100]</code>
              <span>Höhere Einsätze (benötigt Unlock)</span>
            </div>
            <div class="v2-command-item">
              <code>!slots [1-∞] / !slots all</code>
              <span>Freie Beträge (benötigt !slots all Unlock)</span>
            </div>
            <div class="v2-command-item">
              <code>!slots daily</code>
              <span>Täglicher Bonus (+50 DachsTaler)</span>
            </div>
            <div class="v2-command-item">
              <code>!slots balance</code>
              <span>Kontostand & Free Spins anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots buffs</code>
              <span>Alle aktiven Buffs anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots lb / rank / ranking</code>
              <span>Top 5 Leaderboard</span>
            </div>
          </div>

          <h3>Shop & Transfer</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!shop</code>
              <span>Shop-Link anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!shop buy [Nr]</code>
              <span>Item kaufen (z.B. !shop buy 38)</span>
            </div>
            <div class="v2-command-item">
              <code>!transfer @user [Betrag]</code>
              <span>DachsTaler senden (1-100.000)</span>
            </div>
            <div class="v2-command-item">
              <code>!transfer @dachsbank [Betrag]</code>
              <span>An Bank spenden</span>
            </div>
          </div>

          <h3>Website & Erfolge</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!slots website / site / seite</code>
              <span>Link zur Dachsbau Slots Website</span>
            </div>
            <div class="v2-command-item">
              <code>!slots erfolge / achievements</code>
              <span>Link zu deinen Erfolgen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots erfolge @user</code>
              <span>Link zu Erfolgen eines anderen Spielers</span>
            </div>
          </div>

          <h3>Weitere Commands</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!slots stats</code>
              <span>Persönliche Statistiken anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots bank</code>
              <span>DachsBank Kontostand anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots info / help / commands</code>
              <span>Link zu dieser Seite</span>
            </div>
            <div class="v2-command-item">
              <code>!slots disclaimer</code>
              <span>Glücksspiel-Warnung anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots selfban</code>
              <span>Selbstausschluss vom Spielen</span>
            </div>
          </div>

          <h3>Duell-Commands</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!slots duel @user [Betrag]</code>
              <span>Fordere jemanden zum Duell heraus</span>
            </div>
            <div class="v2-command-item">
              <code>!slots duelaccept</code>
              <span>Nimm eine Herausforderung an</span>
            </div>
            <div class="v2-command-item">
              <code>!slots dueldecline</code>
              <span>Lehne eine Herausforderung ab</span>
            </div>
            <div class="v2-command-item">
              <code>!slots duelopt out</code>
              <span>Duelle deaktivieren</span>
            </div>
            <div class="v2-command-item">
              <code>!slots duelopt in</code>
              <span>Duelle wieder aktivieren</span>
            </div>
          </div>
        </div>
      </details>

      ${user && isAdmin(user.username) ? `
      <!-- Admin Commands -->
      <details class="v2-info-accordion v2-admin-section" id="admin">
        <summary class="v2-accordion-header">Admin Commands</summary>
        <div class="v2-accordion-content">
          <p class="v2-section-intro v2-admin-warning">Diese Commands sind nur für Admins verfügbar.</p>

          <h3>Moderation</h3>
          <div class="v2-command-list v2-admin-commands">
            <div class="v2-command-item">
              <code>!slots ban @user</code>
              <span>Spieler vom Slots-Spiel ausschließen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots unban @user</code>
              <span>Spieler wieder freischalten</span>
            </div>
            <div class="v2-command-item">
              <code>!slots freeze @user</code>
              <span>Account einfrieren (kann nicht spielen)</span>
            </div>
            <div class="v2-command-item">
              <code>!slots unfreeze @user</code>
              <span>Account wieder freigeben</span>
            </div>
            <div class="v2-command-item">
              <code>!slots maintenance [on/off]</code>
              <span>Wartungsmodus aktivieren/deaktivieren</span>
            </div>
          </div>

          <h3>Economy</h3>
          <div class="v2-command-list v2-admin-commands">
            <div class="v2-command-item">
              <code>!slots give @user [Betrag]</code>
              <span>DachsTaler an Spieler geben</span>
            </div>
            <div class="v2-command-item">
              <code>!slots setbalance @user [Betrag]</code>
              <span>Kontostand direkt setzen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots reset @user</code>
              <span>Spieler-Account komplett zurücksetzen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots wipe @user</code>
              <span>Alle Daten eines Spielers löschen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots bankset [Betrag]</code>
              <span>DachsBank Kontostand setzen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots bankreset</code>
              <span>DachsBank auf Startwert zurücksetzen</span>
            </div>
          </div>

          <h3>Buffs & Items</h3>
          <div class="v2-command-list v2-admin-commands">
            <div class="v2-command-item">
              <code>!slots givebuff @user [buff] [dauer]</code>
              <span>Buff an Spieler geben (z.B. happy_hour 3600)</span>
            </div>
            <div class="v2-command-item">
              <code>!slots removebuff @user [buff]</code>
              <span>Buff von Spieler entfernen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots clearallbuffs @user</code>
              <span>Alle Buffs eines Spielers entfernen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots givefreespins @user [anzahl] [multi]</code>
              <span>Free Spins geben (optional mit Multiplier)</span>
            </div>
            <div class="v2-command-item">
              <code>!slots giveinsurance @user [anzahl]</code>
              <span>Insurance-Ladungen geben</span>
            </div>
            <div class="v2-command-item">
              <code>!slots givewinmulti @user</code>
              <span>Win-Multiplier geben</span>
            </div>
          </div>

          <h3>Info & Debug</h3>
          <div class="v2-command-list v2-admin-commands">
            <div class="v2-command-item">
              <code>!slots getstats @user</code>
              <span>Detaillierte Stats eines Spielers anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots getdaily @user</code>
              <span>Daily-Status eines Spielers prüfen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots resetdaily @user</code>
              <span>Daily-Cooldown zurücksetzen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots getmonthlylogin @user</code>
              <span>Monthly Login Status anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots resetweeklylimits @user</code>
              <span>Wöchentliche Kauflimits zurücksetzen</span>
            </div>
            <div class="v2-command-item">
              <code>!slots removefromlb @user</code>
              <span>Spieler vom Leaderboard ausblenden</span>
            </div>
          </div>
        </div>
      </details>
      ` : ''}

      <!-- Gewinne & Symbole -->
      <details class="v2-info-accordion" id="gewinne">
        <summary class="v2-accordion-header">Gewinne & Symbole</summary>
        <div class="v2-accordion-content">
          <p class="v2-section-intro">Je höher das Symbol in der Liste, desto wertvoller! Der Dachs ist das seltenste und wertvollste Symbol.</p>
          <div class="v2-bet-toggle">
            <button class="v2-bet-toggle-btn active" data-multiplier="1" data-bet="10">!slots</button>
            <button class="v2-bet-toggle-btn" data-multiplier="2" data-bet="20">!slots 20</button>
            <button class="v2-bet-toggle-btn" data-multiplier="3" data-bet="30">!slots 30</button>
            <button class="v2-bet-toggle-btn" data-multiplier="5" data-bet="50">!slots 50</button>
            <button class="v2-bet-toggle-btn" data-multiplier="10" data-bet="100">!slots 100</button>
          </div>
          <div class="v2-symbol-grid">
            <div class="v2-symbol-card jackpot">
              <div class="symbol-icon">🦡</div>
              <div class="symbol-name">Dachs</div>
              <div class="symbol-rarity">JACKPOT</div>
              <div class="symbol-wins">
                <div class="win-row"><span class="win-combo">🦡🦡🦡</span><span class="win-amount gold payout-value" data-base="15000">15.000 DT</span></div>
                <div class="win-row"><span class="win-combo">🦡🦡</span><span class="win-amount payout-value" data-base="2500">2.500 DT</span></div>
                <div class="win-row"><span class="win-combo">🦡</span><span class="win-amount payout-value" data-base="100">100 DT</span></div>
              </div>
            </div>
            <div class="v2-symbol-card special">
              <div class="symbol-icon">💎</div>
              <div class="symbol-name">Diamant</div>
              <div class="symbol-rarity">FREE SPINS</div>
              <div class="symbol-wins">
                <div class="win-row"><span class="win-combo">💎💎💎</span><span class="win-amount">5 Free Spins</span></div>
                <div class="win-row"><span class="win-combo">💎💎</span><span class="win-amount">1 Free Spin</span></div>
              </div>
              <p class="symbol-note">Free Spins behalten den Multiplier!</p>
            </div>
            <div class="v2-symbol-card">
              <div class="symbol-icon">⭐</div>
              <div class="symbol-name">Stern</div>
              <div class="symbol-rarity">Sehr selten</div>
              <div class="symbol-wins">
                <div class="win-row"><span class="win-combo">⭐⭐⭐</span><span class="win-amount payout-value" data-base="500">500 DT</span></div>
                <div class="win-row"><span class="win-combo">⭐⭐</span><span class="win-amount payout-value" data-base="50">50 DT</span></div>
              </div>
            </div>
            <div class="v2-symbol-card">
              <div class="symbol-icon">🍉</div>
              <div class="symbol-name">Melone</div>
              <div class="symbol-rarity">Selten</div>
              <div class="symbol-wins">
                <div class="win-row"><span class="win-combo">🍉🍉🍉</span><span class="win-amount payout-value" data-base="250">250 DT</span></div>
                <div class="win-row"><span class="win-combo">🍉🍉</span><span class="win-amount payout-value" data-base="25">25 DT</span></div>
              </div>
            </div>
            <div class="v2-symbol-card">
              <div class="symbol-icon">🍇</div>
              <div class="symbol-name">Trauben</div>
              <div class="symbol-rarity">Ungewöhnlich</div>
              <div class="symbol-wins">
                <div class="win-row"><span class="win-combo">🍇🍇🍇</span><span class="win-amount payout-value" data-base="150">150 DT</span></div>
                <div class="win-row"><span class="win-combo">🍇🍇</span><span class="win-amount payout-value" data-base="15">15 DT</span></div>
              </div>
            </div>
            <div class="v2-symbol-card">
              <div class="symbol-icon">🍊</div>
              <div class="symbol-name">Orange</div>
              <div class="symbol-rarity">Gewöhnlich</div>
              <div class="symbol-wins">
                <div class="win-row"><span class="win-combo">🍊🍊🍊</span><span class="win-amount payout-value" data-base="100">100 DT</span></div>
                <div class="win-row"><span class="win-combo">🍊🍊</span><span class="win-amount payout-value" data-base="10">10 DT</span></div>
              </div>
            </div>
            <div class="v2-symbol-card">
              <div class="symbol-icon">🍋</div>
              <div class="symbol-name">Zitrone</div>
              <div class="symbol-rarity">Gewöhnlich</div>
              <div class="symbol-wins">
                <div class="win-row"><span class="win-combo">🍋🍋🍋</span><span class="win-amount payout-value" data-base="75">75 DT</span></div>
                <div class="win-row"><span class="win-combo">🍋🍋</span><span class="win-amount payout-value" data-base="8">8 DT</span></div>
              </div>
            </div>
            <div class="v2-symbol-card">
              <div class="symbol-icon">🍒</div>
              <div class="symbol-name">Kirsche</div>
              <div class="symbol-rarity">Häufig</div>
              <div class="symbol-wins">
                <div class="win-row"><span class="win-combo">🍒🍒🍒</span><span class="win-amount payout-value" data-base="50">50 DT</span></div>
                <div class="win-row"><span class="win-combo">🍒🍒</span><span class="win-amount payout-value" data-base="5">5 DT</span></div>
              </div>
            </div>
          </div>
          <p class="v2-section-note"><strong>Tipp:</strong> Nutze die Buttons oben um die Gewinne für verschiedene Einsätze zu sehen!</p>

          <h3>Gewinnchancen</h3>
          <details class="v2-faq-item">
            <summary>Alle Gewinnchancen anzeigen</summary>
            <div class="v2-faq-content">
              <div class="v2-chances-table">
                <div class="v2-chances-row header">
                  <span>Kombination</span>
                  <span>Gewinn</span>
                  <span>Chance</span>
                </div>
                <div class="v2-chances-row jackpot-row">
                  <span>🦡🦡🦡 Triple-Dachs</span>
                  <span class="gold payout-value" data-base="15000">15.000 DT</span>
                  <span>~1 in 140.000</span>
                </div>
                <div class="v2-chances-row">
                  <span>🦡🦡 Doppel-Dachs</span>
                  <span class="payout-value" data-base="2500">2.500 DT</span>
                  <span>~1 in 5.000</span>
                </div>
                <div class="v2-chances-row">
                  <span>🦡 Einzel-Dachs</span>
                  <span class="payout-value" data-base="100">100 DT</span>
                  <span>~1 in 50</span>
                </div>
                <div class="v2-chances-row special-row">
                  <span>💎💎💎 Triple-Diamant</span>
                  <span>5 Free Spins</span>
                  <span>~1 in 740</span>
                </div>
                <div class="v2-chances-row">
                  <span>💎💎 Doppel-Diamant</span>
                  <span>1 Free Spin</span>
                  <span>~1 in 34</span>
                </div>
                <div class="v2-chances-row fruit-row">
                  <span>⭐⭐⭐ Triple-Stern</span>
                  <span class="payout-value" data-base="500">500 DT</span>
                  <span>~1 in 1.728</span>
                </div>
                <div class="v2-chances-row">
                  <span>⭐⭐ Doppel-Stern</span>
                  <span class="payout-value" data-base="50">50 DT</span>
                  <span>~1 in 144</span>
                </div>
                <div class="v2-chances-row fruit-row">
                  <span>🍉🍉🍉 Triple-Melone</span>
                  <span class="payout-value" data-base="250">250 DT</span>
                  <span>~1 in 1.331</span>
                </div>
                <div class="v2-chances-row">
                  <span>🍉🍉 Doppel-Melone</span>
                  <span class="payout-value" data-base="25">25 DT</span>
                  <span>~1 in 100</span>
                </div>
                <div class="v2-chances-row fruit-row">
                  <span>🍇🍇🍇 Triple-Trauben</span>
                  <span class="payout-value" data-base="150">150 DT</span>
                  <span>~1 in 512</span>
                </div>
                <div class="v2-chances-row">
                  <span>🍇🍇 Doppel-Trauben</span>
                  <span class="payout-value" data-base="15">15 DT</span>
                  <span>~1 in 53</span>
                </div>
                <div class="v2-chances-row fruit-row">
                  <span>🍊🍊🍊 Triple-Orange</span>
                  <span class="payout-value" data-base="100">100 DT</span>
                  <span>~1 in 248</span>
                </div>
                <div class="v2-chances-row">
                  <span>🍊🍊 Doppel-Orange</span>
                  <span class="payout-value" data-base="10">10 DT</span>
                  <span>~1 in 40</span>
                </div>
                <div class="v2-chances-row fruit-row">
                  <span>🍋🍋🍋 Triple-Zitrone</span>
                  <span class="payout-value" data-base="75">75 DT</span>
                  <span>~1 in 216</span>
                </div>
                <div class="v2-chances-row">
                  <span>🍋🍋 Doppel-Zitrone</span>
                  <span class="payout-value" data-base="8">8 DT</span>
                  <span>~1 in 36</span>
                </div>
                <div class="v2-chances-row fruit-row">
                  <span>🍒🍒🍒 Triple-Kirsche</span>
                  <span class="payout-value" data-base="50">50 DT</span>
                  <span>~1 in 125</span>
                </div>
                <div class="v2-chances-row">
                  <span>🍒🍒 Doppel-Kirsche</span>
                  <span class="payout-value" data-base="5">5 DT</span>
                  <span>~1 in 25</span>
                </div>
              </div>
            </div>
          </details>
        </div>
      </details>

      <!-- Multiplier-System -->
      <details class="v2-info-accordion" id="multiplier">
        <summary class="v2-accordion-header">Multiplier-System</summary>
        <div class="v2-accordion-content">
          <h3>Streak-Multiplier (Kostenlos!)</h3>
          <p>Jeder Gewinn in Folge erhöht deinen Multiplier automatisch:</p>
          <div class="v2-streak-table">
            <div class="v2-streak-row header">
              <span>Wins</span>
              <span>Multiplier</span>
              <span>Boost</span>
            </div>
            <div class="v2-streak-row">
              <span>1</span>
              <span>1.0x</span>
              <span>—</span>
            </div>
            <div class="v2-streak-row">
              <span>2</span>
              <span>1.1x</span>
              <span>+10%</span>
            </div>
            <div class="v2-streak-row">
              <span>5</span>
              <span>1.4x</span>
              <span>+40%</span>
            </div>
            <div class="v2-streak-row hot">
              <span>10</span>
              <span>2.0x</span>
              <span>+100% 🔥</span>
            </div>
            <div class="v2-streak-row hot">
              <span>20+</span>
              <span>3.0x</span>
              <span>+200% ✨</span>
            </div>
          </div>
          <p class="v2-section-note">Bei Verlust: Reset auf 1.0x</p>
        </div>
      </details>

      <!-- Bonus-Systeme -->
      <details class="v2-info-accordion" id="bonus">
        <summary class="v2-accordion-header">Bonus-Systeme</summary>
        <div class="v2-accordion-content">
          <h3>Monthly Login</h3>
          <p>Sammle Login-Tage im Monat (keine Streak nötig!):</p>
          <div class="v2-bonus-table">
            <div class="v2-bonus-row header">
              <span>Tage</span>
              <span>Bonus</span>
              <span>Gesamt</span>
            </div>
            <div class="v2-bonus-row">
              <span>1</span>
              <span>+50 DT</span>
              <span>100 DT</span>
            </div>
            <div class="v2-bonus-row">
              <span>5</span>
              <span>+150 DT</span>
              <span>400 DT</span>
            </div>
            <div class="v2-bonus-row">
              <span>10</span>
              <span>+400 DT</span>
              <span>950 DT</span>
            </div>
            <div class="v2-bonus-row">
              <span>15</span>
              <span>+750 DT</span>
              <span>1.700 DT</span>
            </div>
            <div class="v2-bonus-row highlight">
              <span>20</span>
              <span>+1.500 DT</span>
              <span><strong>3.250 DT</strong> 🎉</span>
            </div>
          </div>

          <h3>Combo-Boni</h3>
          <p>Gewinne in Folge geben extra Boni:</p>
          <div class="v2-bonus-table">
            <div class="v2-bonus-row header">
              <span>Wins</span>
              <span>Bonus</span>
              <span></span>
            </div>
            <div class="v2-bonus-row">
              <span>2 Wins</span>
              <span>+10 DT</span>
              <span></span>
            </div>
            <div class="v2-bonus-row">
              <span>3 Wins</span>
              <span>+30 DT</span>
              <span></span>
            </div>
            <div class="v2-bonus-row">
              <span>4 Wins</span>
              <span>+100 DT</span>
              <span></span>
            </div>
            <div class="v2-bonus-row hot">
              <span>5 Wins</span>
              <span>+500 DT (Hot Streak!) 🔥</span>
              <span></span>
            </div>
          </div>

          <h3>Weitere Boni</h3>
          <div class="v2-info-grid">
            <div class="v2-info-card">
              <span class="v2-info-label">👑 Comeback King</span>
              <span class="v2-info-value">Nach 5+ Verlusten gewinnen = +150 DT</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">⏰ Hourly Jackpot</span>
              <span class="v2-info-value">Zufällige "Lucky Second" pro Stunde = +100 DT</span>
            </div>
          </div>
        </div>
      </details>

      <!-- Duell-System -->
      <details class="v2-info-accordion" id="duell">
        <summary class="v2-accordion-header">Duell-System</summary>
        <div class="v2-accordion-content">
          <p class="v2-section-intro">Fordere andere Spieler zum direkten Slot-Duell heraus!</p>

          <h3>So funktioniert's</h3>
          <div class="v2-duel-steps">
            <div class="v2-duel-step">
              <span class="step-number">1</span>
              <div class="step-content">
                <strong>Herausfordern</strong>
                <code>!slots duel @spieler 500</code>
                <p>Du forderst @spieler zu einem Duell um 500 DT heraus.</p>
              </div>
            </div>
            <div class="v2-duel-step">
              <span class="step-number">2</span>
              <div class="step-content">
                <strong>Annehmen oder Ablehnen</strong>
                <p>Der herausgeforderte Spieler hat <strong>60 Sekunden</strong> Zeit:</p>
                <code>!slots duelaccept</code> oder <code>!slots dueldecline</code>
              </div>
            </div>
            <div class="v2-duel-step">
              <span class="step-number">3</span>
              <div class="step-content">
                <strong>Duell-Ablauf</strong>
                <p>Beide Spieler spinnen gleichzeitig – ohne Buffs, ohne Items. Ein faires 1v1!</p>
              </div>
            </div>
          </div>

          <h3>Regeln</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <span>Mindesteinsatz</span>
              <span>100 DachsTaler</span>
            </div>
            <div class="v2-command-item">
              <span>Maximaleinsatz</span>
              <span>Unbegrenzt (beide müssen genug haben)</span>
            </div>
            <div class="v2-command-item">
              <span>Buffs/Items</span>
              <span>Deaktiviert – faire Kämpfe!</span>
            </div>
            <div class="v2-command-item">
              <span>Timeout</span>
              <span>60 Sekunden zum Antworten</span>
            </div>
            <div class="v2-command-item">
              <span>Limit</span>
              <span>Eine aktive Herausforderung pro Spieler</span>
            </div>
            <div class="v2-command-item">
              <span>Cooldown</span>
              <span>60 Sekunden nach dem Erstellen eines Duells</span>
            </div>
          </div>

          <h3>Wer gewinnt?</h3>
          <div class="v2-info-grid">
            <div class="v2-info-card">
              <span class="v2-info-label">🥇 Triple</span>
              <span class="v2-info-value">3 gleiche Symbole schlägt alles</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">🥈 Paar</span>
              <span class="v2-info-value">2 gleiche Symbole schlägt Einzelne</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">🥉 Punkte</span>
              <span class="v2-info-value">Bei Gleichstand zählt die Symbolsumme</span>
            </div>
          </div>

          <h3>Symbol-Werte für Tiebreaker</h3>
          <div class="v2-command-list">
            <div class="v2-command-item"><span>🦡 Dachs</span><span>500</span></div>
            <div class="v2-command-item"><span>💎 Diamant</span><span>100</span></div>
            <div class="v2-command-item"><span>⭐ Stern</span><span>25</span></div>
            <div class="v2-command-item"><span>🍉 Melone</span><span>13</span></div>
            <div class="v2-command-item"><span>🍇 Trauben</span><span>8</span></div>
            <div class="v2-command-item"><span>🍊 Orange</span><span>5</span></div>
            <div class="v2-command-item"><span>🍋 Zitrone</span><span>4</span></div>
            <div class="v2-command-item"><span>🍒 Kirsche</span><span>3</span></div>
          </div>
          <p class="v2-section-note"><strong>Beispiel:</strong> [ 🍒 🍉 ⭐ ] = 3 + 13 + 25 = <strong>41 Punkte</strong></p>

          <h3>Tipps</h3>
          <div class="v2-tip-list">
            <div class="v2-tip-item">
              <span class="v2-tip-icon">💡</span>
              <p><strong>Kein Risiko:</strong> Dein Einsatz wird erst abgezogen wenn das Duell stattfindet</p>
            </div>
            <div class="v2-tip-item">
              <span class="v2-tip-icon">💡</span>
              <p><strong>Fair:</strong> Beide müssen den Betrag haben, sonst kein Duell</p>
            </div>
            <div class="v2-tip-item">
              <span class="v2-tip-icon">💡</span>
              <p><strong>Opt-Out:</strong> Mit <code>!slots duelopt out</code> keine Herausforderungen mehr</p>
            </div>
            <div class="v2-tip-item">
              <span class="v2-tip-icon">⏳</span>
              <p><strong>Cooldown:</strong> Nach einem Duell musst du 60 Sekunden warten bevor du ein neues starten kannst</p>
            </div>
          </div>
        </div>
      </details>

      <!-- DachsBank -->
      <details class="v2-info-accordion" id="bank">
        <summary class="v2-accordion-header">DachsBank</summary>
        <div class="v2-accordion-content">
          <p class="v2-section-intro">Die DachsBank trackt die gesamte Casino-Ökonomie.</p>

          <div class="v2-info-grid">
            <div class="v2-info-card">
              <span class="v2-info-label">Bank erhält</span>
              <span class="v2-info-value">Jeden Spin-Einsatz, jeden Shop-Kauf, Spenden von Spielern</span>
            </div>
            <div class="v2-info-card">
              <span class="v2-info-label">Bank zahlt</span>
              <span class="v2-info-value">Jeden Gewinn, alle Boni</span>
            </div>
          </div>

          <h3>Commands</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!slots bank</code>
              <span>Kontostand anzeigen</span>
            </div>
            <div class="v2-command-item">
              <code>!transfer @dachsbank [Betrag]</code>
              <span>Spenden</span>
            </div>
          </div>
          <p class="v2-section-note"><strong>Startguthaben:</strong> 444.444 DachsTaler • Kann ins Minus gehen!</p>
        </div>
      </details>

      <!-- FAQ -->
      <details class="v2-info-accordion" id="faq">
        <summary class="v2-accordion-header">FAQ</summary>
        <div class="v2-accordion-content">
          <details class="v2-faq-item">
            <summary>Wie bekomme ich mehr DachsTaler?</summary>
            <div class="v2-faq-content">
              <ol>
                <li>🎰 <strong>Gewinnen</strong> – Spiele und gewinne!</li>
                <li>🎁 <strong>Daily</strong> – <code>!slots daily</code> (+50 DT alle 24h)</li>
                <li>📅 <strong>Monthly Login</strong> – Bis zu 3.250 DT/Monat</li>
                <li>💸 <strong>Transfer</strong> – Andere Spieler können dir DT senden</li>
                <li>🎯 <strong>Boni</strong> – Combo, Hot Streak, Comeback King</li>
              </ol>
              <p><strong>Bei 0 DachsTaler?</strong> Warte auf Daily oder bitte um Transfer.</p>
            </div>
          </details>

          <details class="v2-faq-item">
            <summary>Was sind Free Spins?</summary>
            <div class="v2-faq-content">
              <p>Kostenlose Spins die du durch 💎💎 oder 💎💎💎 gewinnst.</p>
              <p><strong>Besonderheit:</strong> Free Spins behalten den Multiplier!</p>
              <p><strong>Beispiel:</strong> <code>!slots 100</code> → 💎💎💎 → 5 Free Spins mit je <strong>10x Multiplier</strong></p>
              <p>Werden automatisch beim nächsten <code>!slots</code> genutzt.</p>
            </div>
          </details>

          <details class="v2-faq-item">
            <summary>Wie schalte ich höhere Einsätze frei?</summary>
            <div class="v2-faq-content">
              <p>Im Shop kaufen! Reihenfolge:</p>
              <p><code>!shop buy 13</code> (20) → <code>!shop buy 19</code> (30) → <code>!shop buy 21</code> (50) → <code>!shop buy 23</code> (100) → <code>!shop buy 25</code> (all)</p>
              <p><strong>Gesamt:</strong> 12.694 DachsTaler</p>
            </div>
          </details>

          <details class="v2-faq-item">
            <summary>Wie sehe ich meine Stats?</summary>
            <div class="v2-faq-content">
              <p>Nutze <code>!slots stats</code> im Chat!</p>
              <p>Zeigt: Spins, Win-Rate, Biggest Win, Total Won/Lost</p>
            </div>
          </details>

          <details class="v2-faq-item">
            <summary>Was ist der Unterschied: Buffs vs Boosts?</summary>
            <div class="v2-faq-content">
              <p><strong>Buffs</strong> = Zeitbasiert (z.B. 1 Stunde)</p>
              <ul>
                <li>Happy Hour, Profit Doubler, Rage Mode...</li>
                <li>Siehe mit <code>!slots buffs</code></li>
              </ul>
              <p><strong>Boosts</strong> = Einmalig pro Symbol</p>
              <ul>
                <li>🍒🍋🍊🍇🍉⭐🦡 Boosts (50–150 DT)</li>
                <li>Wird beim nächsten Gewinn verbraucht</li>
              </ul>
              <p><strong>Beide kombinierbar!</strong></p>
            </div>
          </details>

          <details class="v2-faq-item">
            <summary>Wie funktioniert die Wild Card?</summary>
            <div class="v2-faq-content">
              <p><code>!shop buy 38</code> (250 DT) → Nächster Spin enthält 🃏</p>
              <p>Das Wild ersetzt <strong>jedes Symbol</strong> für den besten Outcome:</p>
              <ul>
                <li><code>🦡 🃏 🦡</code> = Triple-Dachs (15.000 DT!)</li>
                <li><code>🍒 🃏 🍒</code> = Triple-Kirsche (50 DT)</li>
              </ul>
              <p>Wild zählt <strong>nicht</strong> für 💎 Free Spins</p>
            </div>
          </details>
        </div>
      </details>

      <!-- Hilfe bei Glücksspielproblemen -->
      <details class="v2-info-accordion" id="hilfe">
        <summary class="v2-accordion-header">Hilfe bei Glücksspielproblemen</summary>
        <div class="v2-accordion-content">
          <div class="v2-help-table">
            <div class="v2-help-row">
              <span>🇩🇪 Deutschland</span>
              <span>0800 - 1 37 27 00</span>
              <a href="https://check-dein-spiel.de" target="_blank" rel="noopener">check-dein-spiel.de</a>
            </div>
            <div class="v2-help-row">
              <span>🇦🇹 Österreich</span>
              <span>0800 - 20 20 11</span>
              <a href="https://spielsuchthilfe.at" target="_blank" rel="noopener">spielsuchthilfe.at</a>
            </div>
            <div class="v2-help-row">
              <span>🇨🇭 Schweiz</span>
              <span>0800 - 040 080</span>
              <a href="https://sos-spielsucht.ch" target="_blank" rel="noopener">sos-spielsucht.ch</a>
            </div>
          </div>

          <h3>Selbstausschluss (Selfban)</h3>
          <div class="v2-command-list">
            <div class="v2-command-item">
              <code>!slots selfban</code>
              <span>Du wirst sofort vom Spielen ausgeschlossen. Nur Admins (exaint_, frechhdachs) können dich wieder freischalten.</span>
            </div>
          </div>
        </div>
      </details>

      <!-- Tastaturkürzel (Desktop only) -->
      <details class="v2-info-accordion v2-desktop-only" id="shortcuts">
        <summary class="v2-accordion-header">Tastaturkürzel</summary>
        <div class="v2-accordion-content">
          <p class="v2-section-intro">Navigiere schneller mit der Tastatur!</p>

          <div class="v2-command-list">
            <div class="v2-command-item">
              <kbd>/</kbd>
              <span>Suche fokussieren</span>
            </div>
            <div class="v2-command-item">
              <kbd>H</kbd>
              <span>Zur Startseite</span>
            </div>
            <div class="v2-command-item">
              <kbd>L</kbd>
              <span>Zum Leaderboard</span>
            </div>
            <div class="v2-command-item">
              <kbd>S</kbd>
              <span>Zum Shop</span>
            </div>
            <div class="v2-command-item">
              <kbd>T</kbd>
              <span>Theme wechseln</span>
            </div>
            <div class="v2-command-item">
              <kbd>Shift + ?</kbd>
              <span>Diese Info-Seite öffnen</span>
            </div>
            <div class="v2-command-item">
              <kbd>Esc</kbd>
              <span>Modal/Menü schließen</span>
            </div>
          </div>
        </div>
      </details>
    </div>
  `;

  return baseTemplateV2('Info & Commands', content, 'info', user);
}
