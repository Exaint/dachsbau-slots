/**
 * Info Page Renderer
 */

import type { LoggedInUser } from '../../types/index.d.ts';
import { isAdmin } from '../../utils.js';
import { baseTemplate } from './template.js';

/**
 * Info page
 */
export function renderInfoPage(user: LoggedInUser | null = null): string {
  const content = `
    <div class="content-page">
      <h1 class="page-title">ℹ️ Info & Commands</h1>

      <!-- Inhaltsverzeichnis -->
      <nav class="info-toc" aria-label="Inhaltsverzeichnis">
        <h2>📑 Inhalt</h2>
        <div class="toc-grid">
          <a href="#schnellstart" class="toc-item">🚀 Schnellstart</a>
          <a href="#wichtig" class="toc-item">⚠️ Wichtig zu wissen</a>
          <a href="#commands" class="toc-item">📋 Commands</a>
          ${user && isAdmin(user.username) ? '<a href="#admin" class="toc-item toc-admin">🔧 Admin Commands</a>' : ''}
          <a href="#gewinne" class="toc-item">💎 Gewinne & Chancen</a>
          <a href="#multiplier" class="toc-item">📈 Multiplier-System</a>
          <a href="#bonus" class="toc-item">🎁 Bonus-Systeme</a>
          <a href="#duell" class="toc-item">⚔️ Duell-System</a>
          <a href="#faq" class="toc-item">❓ FAQ</a>
          <a href="#hilfe" class="toc-item">📞 Hilfe</a>
          <a href="#shortcuts" class="toc-item desktop-only">⌨️ Tastaturkürzel</a>
        </div>
      </nav>

      <!-- Schnellstart -->
      <details class="info-accordion">
        <summary class="accordion-header"><h2>🚀 Schnellstart</h2></summary>
        <section id="schnellstart" class="content-section accordion-content">
          <p class="section-intro">Neu hier? In 4 Schritten loslegen:</p>
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
      </details>

      <!-- Wichtig zu wissen -->
      <details class="info-accordion" open>
        <summary class="accordion-header"><h2>⚠️ Wichtig zu wissen</h2></summary>
        <section id="wichtig" class="content-section accordion-content">
          <p class="section-intro">Diese Infos solltest du kennen, bevor du loslegst!</p>

          <h3>💰 Einsatz & Kosten</h3>
        <div class="info-grid compact">
          <div class="info-card">
            <span class="info-label">Mindesteinsatz</span>
            <span class="info-value">10 DachsTaler pro Spin</span>
          </div>
          <div class="info-card">
            <span class="info-label">Startguthaben</span>
            <span class="info-value">100 DachsTaler (neue Spieler)</span>
          </div>
          <div class="info-card">
            <span class="info-label">Bei 0 DachsTaler</span>
            <span class="info-value">Warte auf Daily oder bitte um Transfer</span>
          </div>
        </div>

        <h3>⏱️ Cooldowns</h3>
        <div class="command-list compact">
          <div class="command-item">
            <code>!slots / !slots [Einsatz]</code>
            <span>30 Sekunden</span>
          </div>
          <div class="command-item">
            <code>!slots daily</code>
            <span>24 Stunden (UTC Mitternacht)</span>
          </div>
          <div class="command-item">
            <span>Alle anderen Commands</span>
            <span>Kein Cooldown</span>
          </div>
        </div>

        <h3>🤖 Fossabot-Besonderheiten</h3>
        <div class="tip-list">
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <div>
              <strong>Keine doppelten Nachrichten</strong>
              <p>Schreibe zwischen zwei <code>!slots</code> immer eine andere Nachricht! Fossabot ignoriert identische aufeinanderfolgende Befehle.</p>
            </div>
          </div>
        </div>

          <h3>🎰 Höhere Einsätze freischalten</h3>
        <p>Höhere Einsätze müssen <strong>zuerst im Shop gekauft</strong> werden:</p>
        <div class="unlock-list">
          <div class="unlock-item">
            <code>!shop buy 13</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 20</code>
            <span class="unlock-price">500 DT</span>
          </div>
          <div class="unlock-item">
            <code>!shop buy 19</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 30</code>
            <span class="unlock-price">2.000 DT</span>
          </div>
          <div class="unlock-item">
            <code>!shop buy 21</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 50</code>
            <span class="unlock-price">2.500 DT</span>
          </div>
          <div class="unlock-item">
            <code>!shop buy 23</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 100</code>
            <span class="unlock-price">3.250 DT</span>
          </div>
          <div class="unlock-item">
            <code>!shop buy 25</code>
            <span class="unlock-arrow">→</span>
            <code>!slots 1-∞</code>
            <span class="unlock-price">4.444 DT</span>
          </div>
        </div>
        </section>
      </details>

      <!-- Commands -->
      <details class="info-accordion" open>
        <summary class="accordion-header"><h2>📋 Commands</h2></summary>
        <section id="commands" class="content-section accordion-content">
          <h3>Haupt-Commands</h3>
        <div class="command-list">
          <div class="command-item">
            <code>!slots</code>
            <span>Spin für 10 DachsTaler (30 Sek Cooldown)</span>
          </div>
          <div class="command-item">
            <code>!slots [20/30/50/100]</code>
            <span>Höhere Einsätze (benötigt Unlock)</span>
          </div>
          <div class="command-item">
            <code>!slots [1-∞] / !slots all</code>
            <span>Freie Beträge (benötigt !slots all Unlock)</span>
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
            <code>!slots lb / rank / ranking</code>
            <span>Top 5 Leaderboard</span>
          </div>
        </div>

        <h3>Shop & Transfer</h3>
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
        </div>

        <h3>Website & Erfolge</h3>
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

        <h3>Weitere Commands</h3>
        <div class="command-list">
          <div class="command-item">
            <code>!slots stats</code>
            <span>Persönliche Statistiken anzeigen</span>
          </div>
          <div class="command-item">
            <code>!slots info / help / commands</code>
            <span>Link zu dieser Seite</span>
          </div>
          <div class="command-item">
            <code>!slots disclaimer</code>
            <span>Glücksspiel-Warnung anzeigen</span>
          </div>
          <div class="command-item">
            <code>!slots selfban</code>
            <span>Selbstausschluss vom Spielen</span>
          </div>
        </div>

        <h3>Duell-Commands</h3>
        <div class="command-list">
          <div class="command-item">
            <code>!slots duel @user [Betrag]</code>
            <span>Fordere jemanden zum Duell heraus</span>
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
            <code>!slots duelopt out</code>
            <span>Duelle deaktivieren</span>
          </div>
          <div class="command-item">
            <code>!slots duelopt in</code>
            <span>Duelle wieder aktivieren</span>
          </div>
          </div>
        </section>
      </details>

      ${user && isAdmin(user.username) ? `
      <!-- Admin Commands -->
      <details class="info-accordion admin-section">
        <summary class="accordion-header"><h2>🔧 Admin Commands</h2></summary>
        <section id="admin" class="content-section accordion-content">
          <p class="section-intro admin-warning">Diese Commands sind nur für Admins verfügbar.</p>

          <h3>Moderation</h3>
          <div class="command-list admin-commands">
            <div class="command-item">
              <code>!slots ban @user</code>
              <span>Spieler vom Slots-Spiel ausschließen</span>
            </div>
            <div class="command-item">
              <code>!slots unban @user</code>
              <span>Spieler wieder freischalten</span>
            </div>
            <div class="command-item">
              <code>!slots freeze @user</code>
              <span>Account einfrieren (kann nicht spielen)</span>
            </div>
            <div class="command-item">
              <code>!slots unfreeze @user</code>
              <span>Account wieder freigeben</span>
            </div>
            <div class="command-item">
              <code>!slots maintenance [on/off]</code>
              <span>Wartungsmodus aktivieren/deaktivieren</span>
            </div>
          </div>

          <h3>Economy</h3>
          <div class="command-list admin-commands">
            <div class="command-item">
              <code>!slots give @user [Betrag]</code>
              <span>DachsTaler an Spieler geben</span>
            </div>
            <div class="command-item">
              <code>!slots setbalance @user [Betrag]</code>
              <span>Kontostand direkt setzen</span>
            </div>
            <div class="command-item">
              <code>!slots reset @user</code>
              <span>Spieler-Account komplett zurücksetzen</span>
            </div>
            <div class="command-item">
              <code>!slots wipe @user</code>
              <span>Alle Daten eines Spielers löschen</span>
            </div>
          </div>

          <h3>Buffs & Items</h3>
          <div class="command-list admin-commands">
            <div class="command-item">
              <code>!slots givebuff @user [buff] [dauer]</code>
              <span>Buff an Spieler geben (z.B. happy_hour 3600)</span>
            </div>
            <div class="command-item">
              <code>!slots removebuff @user [buff]</code>
              <span>Buff von Spieler entfernen</span>
            </div>
            <div class="command-item">
              <code>!slots clearallbuffs @user</code>
              <span>Alle Buffs eines Spielers entfernen</span>
            </div>
            <div class="command-item">
              <code>!slots givefreespins @user [anzahl] [multi]</code>
              <span>Free Spins geben (optional mit Multiplier)</span>
            </div>
            <div class="command-item">
              <code>!slots giveinsurance @user [anzahl]</code>
              <span>Insurance-Ladungen geben</span>
            </div>
            <div class="command-item">
              <code>!slots givewinmulti @user</code>
              <span>Win-Multiplier geben</span>
            </div>
          </div>

          <h3>Info & Debug</h3>
          <div class="command-list admin-commands">
            <div class="command-item">
              <code>!slots getstats @user</code>
              <span>Detaillierte Stats eines Spielers anzeigen</span>
            </div>
            <div class="command-item">
              <code>!slots getdaily @user</code>
              <span>Daily-Status eines Spielers prüfen</span>
            </div>
            <div class="command-item">
              <code>!slots resetdaily @user</code>
              <span>Daily-Cooldown zurücksetzen</span>
            </div>
            <div class="command-item">
              <code>!slots getmonthlylogin @user</code>
              <span>Monthly Login Status anzeigen</span>
            </div>
            <div class="command-item">
              <code>!slots resetweeklylimits @user</code>
              <span>Wöchentliche Kauflimits zurücksetzen</span>
            </div>
            <div class="command-item">
              <code>!slots removefromlb @user</code>
              <span>Spieler vom Leaderboard ausblenden</span>
            </div>
          </div>
        </section>
      </details>
      ` : ''}

      <!-- Gewinne & Chancen -->
      <details class="info-accordion">
        <summary class="accordion-header"><h2>💎 Gewinne & Symbole</h2></summary>
        <section id="gewinne" class="content-section accordion-content">
          <p class="section-intro">Je höher das Symbol in der Liste, desto wertvoller! Der Dachs ist das seltenste und wertvollste Symbol.</p>
          <div class="bet-toggle">
            <button class="bet-toggle-btn active" data-multiplier="1" data-bet="10">!slots</button>
            <button class="bet-toggle-btn" data-multiplier="2" data-bet="20">!slots 20</button>
            <button class="bet-toggle-btn" data-multiplier="3" data-bet="30">!slots 30</button>
            <button class="bet-toggle-btn" data-multiplier="5" data-bet="50">!slots 50</button>
            <button class="bet-toggle-btn" data-multiplier="10" data-bet="100">!slots 100</button>
          </div>
        <div class="symbol-grid">
          <div class="symbol-card jackpot">
            <div class="symbol-icon">🦡</div>
            <div class="symbol-name">Dachs</div>
            <div class="symbol-rarity">JACKPOT</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🦡🦡🦡</span><span class="win-amount gold payout-value" data-base="15000">15.000 DT</span></div>
              <div class="win-row"><span class="win-combo">🦡🦡</span><span class="win-amount payout-value" data-base="2500">2.500 DT</span></div>
              <div class="win-row"><span class="win-combo">🦡</span><span class="win-amount payout-value" data-base="100">100 DT</span></div>
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
            <p class="symbol-note">Free Spins behalten den Multiplier!</p>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">⭐</div>
            <div class="symbol-name">Stern</div>
            <div class="symbol-rarity">Sehr selten</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">⭐⭐⭐</span><span class="win-amount payout-value" data-base="500">500 DT</span></div>
              <div class="win-row"><span class="win-combo">⭐⭐</span><span class="win-amount payout-value" data-base="50">50 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍉</div>
            <div class="symbol-name">Melone</div>
            <div class="symbol-rarity">Selten</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍉🍉🍉</span><span class="win-amount payout-value" data-base="250">250 DT</span></div>
              <div class="win-row"><span class="win-combo">🍉🍉</span><span class="win-amount payout-value" data-base="25">25 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍇</div>
            <div class="symbol-name">Trauben</div>
            <div class="symbol-rarity">Ungewöhnlich</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍇🍇🍇</span><span class="win-amount payout-value" data-base="150">150 DT</span></div>
              <div class="win-row"><span class="win-combo">🍇🍇</span><span class="win-amount payout-value" data-base="15">15 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍊</div>
            <div class="symbol-name">Orange</div>
            <div class="symbol-rarity">Gewöhnlich</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍊🍊🍊</span><span class="win-amount payout-value" data-base="100">100 DT</span></div>
              <div class="win-row"><span class="win-combo">🍊🍊</span><span class="win-amount payout-value" data-base="10">10 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍋</div>
            <div class="symbol-name">Zitrone</div>
            <div class="symbol-rarity">Gewöhnlich</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍋🍋🍋</span><span class="win-amount payout-value" data-base="75">75 DT</span></div>
              <div class="win-row"><span class="win-combo">🍋🍋</span><span class="win-amount payout-value" data-base="8">8 DT</span></div>
            </div>
          </div>
          <div class="symbol-card">
            <div class="symbol-icon">🍒</div>
            <div class="symbol-name">Kirsche</div>
            <div class="symbol-rarity">Häufig</div>
            <div class="symbol-wins">
              <div class="win-row"><span class="win-combo">🍒🍒🍒</span><span class="win-amount payout-value" data-base="50">50 DT</span></div>
              <div class="win-row"><span class="win-combo">🍒🍒</span><span class="win-amount payout-value" data-base="5">5 DT</span></div>
            </div>
          </div>
        </div>
        <p class="section-note bet-toggle-hint"><strong>Tipp:</strong> Nutze die Buttons oben um die Gewinne für verschiedene Einsätze zu sehen!</p>

        <h3>🎲 Gewinnchancen</h3>
        <details class="faq-item">
          <summary>Alle Gewinnchancen anzeigen</summary>
          <div class="faq-content">
            <div class="chances-table">
              <div class="chances-row header">
                <span>Kombination</span>
                <span>Gewinn</span>
                <span>Chance</span>
              </div>
              <div class="chances-row jackpot-row">
                <span>🦡🦡🦡 Triple-Dachs</span>
                <span class="gold payout-value" data-base="15000">15.000 DT</span>
                <span>~1 in 140.000</span>
              </div>
              <div class="chances-row">
                <span>🦡🦡 Doppel-Dachs</span>
                <span class="payout-value" data-base="2500">2.500 DT</span>
                <span>~1 in 5.000</span>
              </div>
              <div class="chances-row">
                <span>🦡 Einzel-Dachs</span>
                <span class="payout-value" data-base="100">100 DT</span>
                <span>~1 in 50</span>
              </div>
              <div class="chances-row special-row">
                <span>💎💎💎 Triple-Diamant</span>
                <span>5 Free Spins</span>
                <span>~1 in 740</span>
              </div>
              <div class="chances-row">
                <span>💎💎 Doppel-Diamant</span>
                <span>1 Free Spin</span>
                <span>~1 in 34</span>
              </div>
              <div class="chances-row fruit-row">
                <span>⭐⭐⭐ Triple-Stern</span>
                <span class="payout-value" data-base="500">500 DT</span>
                <span>~1 in 1.728</span>
              </div>
              <div class="chances-row">
                <span>⭐⭐ Doppel-Stern</span>
                <span class="payout-value" data-base="50">50 DT</span>
                <span>~1 in 144</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍉🍉🍉 Triple-Melone</span>
                <span class="payout-value" data-base="250">250 DT</span>
                <span>~1 in 1.331</span>
              </div>
              <div class="chances-row">
                <span>🍉🍉 Doppel-Melone</span>
                <span class="payout-value" data-base="25">25 DT</span>
                <span>~1 in 100</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍇🍇🍇 Triple-Trauben</span>
                <span class="payout-value" data-base="150">150 DT</span>
                <span>~1 in 512</span>
              </div>
              <div class="chances-row">
                <span>🍇🍇 Doppel-Trauben</span>
                <span class="payout-value" data-base="15">15 DT</span>
                <span>~1 in 53</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍊🍊🍊 Triple-Orange</span>
                <span class="payout-value" data-base="100">100 DT</span>
                <span>~1 in 248</span>
              </div>
              <div class="chances-row">
                <span>🍊🍊 Doppel-Orange</span>
                <span class="payout-value" data-base="10">10 DT</span>
                <span>~1 in 40</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍋🍋🍋 Triple-Zitrone</span>
                <span class="payout-value" data-base="75">75 DT</span>
                <span>~1 in 216</span>
              </div>
              <div class="chances-row">
                <span>🍋🍋 Doppel-Zitrone</span>
                <span class="payout-value" data-base="8">8 DT</span>
                <span>~1 in 36</span>
              </div>
              <div class="chances-row fruit-row">
                <span>🍒🍒🍒 Triple-Kirsche</span>
                <span class="payout-value" data-base="50">50 DT</span>
                <span>~1 in 125</span>
              </div>
              <div class="chances-row">
                <span>🍒🍒 Doppel-Kirsche</span>
                <span class="payout-value" data-base="5">5 DT</span>
                <span>~1 in 25</span>
              </div>
            </div>
          </div>
          </details>
        </section>
      </details>

      <!-- Multiplier-System -->
      <details class="info-accordion">
        <summary class="accordion-header"><h2>📈 Multiplier-System</h2></summary>
        <section id="multiplier" class="content-section accordion-content">
          <h3>🔥 Streak-Multiplier (Kostenlos!)</h3>
        <p>Jeder Gewinn in Folge erhöht deinen Multiplier automatisch:</p>
        <div class="streak-table">
          <div class="streak-row header">
            <span>Wins</span>
            <span>Multiplier</span>
            <span>Boost</span>
          </div>
          <div class="streak-row">
            <span>1</span>
            <span>1.0×</span>
            <span>—</span>
          </div>
          <div class="streak-row">
            <span>2</span>
            <span>1.1×</span>
            <span>+10%</span>
          </div>
          <div class="streak-row">
            <span>5</span>
            <span>1.4×</span>
            <span>+40%</span>
          </div>
          <div class="streak-row hot">
            <span>10</span>
            <span>2.0×</span>
            <span>+100% 🔥</span>
          </div>
          <div class="streak-row hot">
            <span>20+</span>
            <span>3.0×</span>
            <span>+200% ✨</span>
          </div>
        </div>
          <p class="section-warning">⚠️ Bei Verlust: Reset auf 1.0×</p>
        </section>
      </details>

      <!-- Bonus-Systeme -->
      <details class="info-accordion">
        <summary class="accordion-header"><h2>🎁 Bonus-Systeme</h2></summary>
        <section id="bonus" class="content-section accordion-content">
          <h3>📅 Monthly Login</h3>
        <p>Sammle Login-Tage im Monat (keine Streak nötig!):</p>
        <div class="bonus-table">
          <div class="bonus-row header">
            <span>Tage</span>
            <span>Bonus</span>
            <span>Gesamt</span>
          </div>
          <div class="bonus-row">
            <span>1</span>
            <span>+50 DT</span>
            <span>100 DT</span>
          </div>
          <div class="bonus-row">
            <span>5</span>
            <span>+150 DT</span>
            <span>400 DT</span>
          </div>
          <div class="bonus-row">
            <span>10</span>
            <span>+400 DT</span>
            <span>950 DT</span>
          </div>
          <div class="bonus-row">
            <span>15</span>
            <span>+750 DT</span>
            <span>1.700 DT</span>
          </div>
          <div class="bonus-row highlight">
            <span>20</span>
            <span>+1.500 DT</span>
            <span><strong>3.250 DT</strong> 🎉</span>
          </div>
        </div>

        <h3>🔥 Combo-Boni</h3>
        <p>Gewinne in Folge geben extra Boni:</p>
        <div class="combo-list">
          <div class="combo-item">
            <span class="combo-wins">2 Wins</span>
            <span class="combo-bonus">+10 DT</span>
          </div>
          <div class="combo-item">
            <span class="combo-wins">3 Wins</span>
            <span class="combo-bonus">+30 DT</span>
          </div>
          <div class="combo-item">
            <span class="combo-wins">4 Wins</span>
            <span class="combo-bonus">+100 DT</span>
          </div>
          <div class="combo-item hot">
            <span class="combo-wins">5 Wins</span>
            <span class="combo-bonus">+500 DT (Hot Streak!) 🔥</span>
          </div>
        </div>

        <h3>Weitere Boni</h3>
        <div class="bonus-cards">
          <div class="bonus-card">
            <span class="bonus-icon">👑</span>
            <div class="bonus-info">
              <strong>Comeback King</strong>
              <p>Nach 5+ Verlusten gewinnen = +150 DT</p>
            </div>
          </div>
          <div class="bonus-card">
            <span class="bonus-icon">⏰</span>
            <div class="bonus-info">
              <strong>Hourly Jackpot</strong>
              <p>Zufällige "Lucky Second" pro Stunde = +100 DT</p>
            </div>
          </div>
          </div>
        </section>
      </details>

      <!-- Duell-System -->
      <details class="info-accordion">
        <summary class="accordion-header"><h2>⚔️ Duell-System</h2></summary>
        <section id="duell" class="content-section accordion-content">
          <p class="section-intro">Fordere andere Spieler zum direkten Slot-Duell heraus!</p>

          <h3>So funktioniert's</h3>
        <div class="duel-steps">
          <div class="duel-step">
            <span class="step-number">1</span>
            <div class="step-content">
              <strong>Herausfordern</strong>
              <code>!slots duel @spieler 500</code>
              <p>Du forderst @spieler zu einem Duell um 500 DT heraus.</p>
            </div>
          </div>
          <div class="duel-step">
            <span class="step-number">2</span>
            <div class="step-content">
              <strong>Annehmen oder Ablehnen</strong>
              <p>Der herausgeforderte Spieler hat <strong>60 Sekunden</strong> Zeit:</p>
              <code>!slots duelaccept</code> oder <code>!slots dueldecline</code>
            </div>
          </div>
          <div class="duel-step">
            <span class="step-number">3</span>
            <div class="step-content">
              <strong>Duell-Ablauf</strong>
              <p>Beide Spieler spinnen gleichzeitig – ohne Buffs, ohne Items. Ein faires 1v1!</p>
            </div>
          </div>
        </div>

        <h3>Regeln</h3>
        <div class="command-list compact">
          <div class="command-item">
            <span>Mindesteinsatz</span>
            <span>100 DachsTaler</span>
          </div>
          <div class="command-item">
            <span>Maximaleinsatz</span>
            <span>Unbegrenzt (beide müssen genug haben)</span>
          </div>
          <div class="command-item">
            <span>Buffs/Items</span>
            <span>Deaktiviert – faire Kämpfe!</span>
          </div>
          <div class="command-item">
            <span>Timeout</span>
            <span>60 Sekunden zum Antworten</span>
          </div>
          <div class="command-item">
            <span>Limit</span>
            <span>Eine aktive Herausforderung pro Spieler</span>
          </div>
          <div class="command-item">
            <span>Cooldown</span>
            <span>60 Sekunden nach dem Erstellen eines Duells</span>
          </div>
        </div>

        <h3>Wer gewinnt?</h3>
        <div class="duel-win-order">
          <div class="win-tier">
            <span class="tier-medal">🥇</span>
            <div>
              <strong>Triple</strong>
              <p>3 gleiche Symbole schlägt alles</p>
            </div>
          </div>
          <div class="win-tier">
            <span class="tier-medal">🥈</span>
            <div>
              <strong>Paar</strong>
              <p>2 gleiche Symbole schlägt Einzelne</p>
            </div>
          </div>
          <div class="win-tier">
            <span class="tier-medal">🥉</span>
            <div>
              <strong>Punkte</strong>
              <p>Bei Gleichstand zählt die Symbolsumme</p>
            </div>
          </div>
        </div>

        <h3>Symbol-Werte für Tiebreaker</h3>
        <div class="symbol-values">
          <span class="symbol-value"><span>🦡</span> 500</span>
          <span class="symbol-value"><span>💎</span> 100</span>
          <span class="symbol-value"><span>⭐</span> 25</span>
          <span class="symbol-value"><span>🍉</span> 13</span>
          <span class="symbol-value"><span>🍇</span> 8</span>
          <span class="symbol-value"><span>🍊</span> 5</span>
          <span class="symbol-value"><span>🍋</span> 4</span>
          <span class="symbol-value"><span>🍒</span> 3</span>
        </div>
        <p class="section-note"><strong>Beispiel:</strong> [ 🍒 🍉 ⭐ ] = 3 + 13 + 25 = <strong>41 Punkte</strong></p>

        <h3>Tipps</h3>
        <div class="tip-list">
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <p><strong>Kein Risiko:</strong> Dein Einsatz wird erst abgezogen wenn das Duell stattfindet</p>
          </div>
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <p><strong>Fair:</strong> Beide müssen den Betrag haben, sonst kein Duell</p>
          </div>
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <p><strong>Opt-Out:</strong> Mit <code>!slots duelopt out</code> keine Herausforderungen mehr</p>
          </div>
          <div class="tip-item">
            <span class="tip-icon">⏳</span>
            <p><strong>Cooldown:</strong> Nach einem Duell musst du 60 Sekunden warten bevor du ein neues starten kannst</p>
          </div>
          </div>
        </section>
      </details>

      <!-- FAQ -->
      <details class="info-accordion">
        <summary class="accordion-header"><h2>❓ FAQ</h2></summary>
        <section id="faq" class="content-section accordion-content">
          <details class="faq-item">
          <summary>💰 Wie bekomme ich mehr DachsTaler?</summary>
          <div class="faq-content">
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

        <details class="faq-item">
          <summary>🎰 Was sind Free Spins?</summary>
          <div class="faq-content">
            <p>Kostenlose Spins die du durch 💎💎 oder 💎💎💎 gewinnst.</p>
            <p><strong>Besonderheit:</strong> Free Spins behalten den Multiplier!</p>
            <p><strong>Beispiel:</strong> <code>!slots 100</code> → 💎💎💎 → 5 Free Spins mit je <strong>10× Multiplier</strong></p>
            <p>Werden automatisch beim nächsten <code>!slots</code> genutzt.</p>
          </div>
        </details>

        <details class="faq-item">
          <summary>🔓 Wie schalte ich höhere Einsätze frei?</summary>
          <div class="faq-content">
            <p>Im Shop kaufen! Reihenfolge:</p>
            <p><code>!shop buy 13</code> (20) → <code>!shop buy 19</code> (30) → <code>!shop buy 21</code> (50) → <code>!shop buy 23</code> (100) → <code>!shop buy 25</code> (all)</p>
            <p><strong>Gesamt:</strong> 12.694 DachsTaler</p>
          </div>
        </details>

        <details class="faq-item">
          <summary>📊 Wie sehe ich meine Stats?</summary>
          <div class="faq-content">
            <p>Nutze <code>!slots stats</code> im Chat!</p>
            <p>Zeigt: Spins, Win-Rate, Biggest Win, Total Won/Lost</p>
          </div>
        </details>

        <details class="faq-item">
          <summary>🔥 Was ist der Unterschied: Buffs vs Boosts?</summary>
          <div class="faq-content">
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

        <details class="faq-item">
          <summary>🃏 Wie funktioniert die Wild Card?</summary>
          <div class="faq-content">
            <p><code>!shop buy 38</code> (250 DT) → Optimiert deinen nächsten Spin!</p>
            <p>Die Wild Card erstellt das <strong>bestmögliche Paar/Triple</strong>:</p>
            <ul>
              <li><code>⭐ ⭐ 🍒</code> → <code>⭐ ⭐ ⭐</code> Star-Triple (500 DT)</li>
              <li><code>🦡 ⭐ 🍒</code> → <code>🦡 ⭐ ⭐</code> Star-Paar + Dachs (150 DT)</li>
              <li><code>⭐ 🍋 🍒</code> → <code>⭐ ⭐ 🍒</code> Star-Paar (50 DT)</li>
            </ul>
            <p>⚠️ Wild Card kann <strong>niemals</strong> zu einem 🦡 werden!</p>
          </div>
          </details>
        </section>
      </details>

      <!-- Hilfe -->
      <details class="info-accordion">
        <summary class="accordion-header"><h2>📞 Hilfe bei Glücksspielproblemen</h2></summary>
        <section id="hilfe" class="content-section accordion-content">
          <div class="help-table">
          <div class="help-row">
            <span>🇩🇪 Deutschland</span>
            <span>0800 - 1 37 27 00</span>
            <a href="https://check-dein-spiel.de" target="_blank" rel="noopener">check-dein-spiel.de</a>
          </div>
          <div class="help-row">
            <span>🇦🇹 Österreich</span>
            <span>0800 - 20 20 11</span>
            <a href="https://spielsuchthilfe.at" target="_blank" rel="noopener">spielsuchthilfe.at</a>
          </div>
          <div class="help-row">
            <span>🇨🇭 Schweiz</span>
            <span>0800 - 040 080</span>
            <a href="https://sos-spielsucht.ch" target="_blank" rel="noopener">sos-spielsucht.ch</a>
          </div>
        </div>

        <h3>🚫 Selbstausschluss (Selfban)</h3>
        <div class="selfban-info">
          <code>!slots selfban</code>
            <p>Du wirst sofort vom Spielen ausgeschlossen. <strong>Nur Admins</strong> (exaint_, frechhdachs) können dich wieder freischalten. Der Zeitpunkt wird gespeichert.</p>
          </div>
        </section>
      </details>

      <!-- Keyboard Shortcuts (Desktop only) -->
      <details class="info-accordion desktop-only">
        <summary class="accordion-header"><h2>⌨️ Tastaturkürzel</h2></summary>
        <section id="shortcuts" class="content-section accordion-content">
          <p class="section-intro">Navigiere schneller mit der Tastatur!</p>

          <div class="command-list compact">
            <div class="command-item">
              <kbd>/</kbd>
              <span>Suche fokussieren</span>
            </div>
            <div class="command-item">
              <kbd>H</kbd>
              <span>Zur Startseite</span>
            </div>
            <div class="command-item">
              <kbd>L</kbd>
              <span>Zum Leaderboard</span>
            </div>
            <div class="command-item">
              <kbd>S</kbd>
              <span>Zum Shop</span>
            </div>
            <div class="command-item">
              <kbd>T</kbd>
              <span>Theme wechseln</span>
            </div>
            <div class="command-item">
              <kbd>Shift + ?</kbd>
              <span>Diese Info-Seite öffnen</span>
            </div>
            <div class="command-item">
              <kbd>Esc</kbd>
              <span>Modal/Menü schließen</span>
            </div>
          </div>
        </section>
      </details>
    </div>
  `;

  return baseTemplate('Info & Commands', content, 'info', user);
}
