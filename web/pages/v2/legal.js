/**
 * V2 Legal Page Renderers (Impressum, Datenschutz)
 */

import { baseTemplateV2 } from './template.js';

/**
 * Impressum page
 */
export function renderImpressumPageV2(user = null) {
  const content = `
    <div class="v2-info-section">
      <h1 class="v2-page-title">Impressum</h1>
      <p class="v2-page-subtitle">Angaben gem\u00e4\u00df \u00a7 5 TMG</p>

      <h2>Verantwortlich f\u00fcr den Inhalt</h2>
      <p>
        <strong>Exaint i. A. frechhdachs (Maria Kellner)</strong><br>
        c/o OOE-Esports<br>
        Lastenstr. 42<br>
        4020 Linz<br>
        \u00d6sterreich
      </p>

      <h2>Kontakt</h2>
      <p>E-Mail: <a href="mailto:tulpe_salbei6s@icloud.com">tulpe_salbei6s@icloud.com</a></p>

      <h2>Verantwortlich f\u00fcr den Inhalt nach \u00a7 55 Abs. 2 RStV</h2>
      <p>
        <strong>Exaint i. A. frechhdachs (Maria Kellner)</strong><br>
        c/o OOE-Esports<br>
        Lastenstr. 42<br>
        4020 Linz
      </p>

      <h2>Haftungsausschluss</h2>

      <h3>Haftung f\u00fcr Inhalte</h3>
      <p>
        Die Inhalte unserer Seiten wurden mit gr\u00f6\u00dfter Sorgfalt erstellt. F\u00fcr die Richtigkeit,
        Vollst\u00e4ndigkeit und Aktualit\u00e4t der Inhalte k\u00f6nnen wir jedoch keine Gew\u00e4hr \u00fcbernehmen.
      </p>

      <h3>Haftung f\u00fcr Links</h3>
      <p>
        Unser Angebot enth\u00e4lt Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
        Einfluss haben. F\u00fcr die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
        verantwortlich.
      </p>

      <h3>Urheberrecht</h3>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht.
      </p>

      <h2>Hinweis zu Gl\u00fccksspiel</h2>
      <p>
        <strong>Dachsbau Slots ist ein reines Unterhaltungsangebot.</strong> Es werden keine
        Echtgeld-Betr\u00e4ge eingesetzt oder gewonnen. DachsTaler haben keinen realen Geldwert.
      </p>
      <p>Hilfe bei Spielsucht:</p>
      <ul>
        <li><a href="https://www.spielen-mit-verantwortung.de" target="_blank" rel="noopener">Spielen mit Verantwortung</a></li>
        <li><a href="https://www.bzga.de" target="_blank" rel="noopener">Bundeszentrale f\u00fcr gesundheitliche Aufkl\u00e4rung</a></li>
        <li>Telefonberatung: 0800 1 37 27 00 (kostenlos)</li>
      </ul>

      <h2>Streitschlichtung</h2>
      <p>
        Online-Streitbeilegung: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a>
      </p>

      <div style="margin-top:var(--v2-space-xl);padding-top:var(--v2-space-md);border-top:1px solid var(--v2-border)">
        <a href="?page=datenschutz" class="v2-btn v2-btn-ghost">\u2192 Zur Datenschutzerkl\u00e4rung</a>
      </div>
    </div>
  `;

  return baseTemplateV2('Impressum', content, 'impressum', user);
}

/**
 * Datenschutz page
 */
export function renderDatenschutzPageV2(user = null) {
  const content = `
    <div class="v2-info-section">
      <h1 class="v2-page-title">Datenschutzerkl\u00e4rung</h1>
      <p class="v2-page-subtitle">Stand: Januar 2026</p>

      <h2>1. Verantwortlicher</h2>
      <p>
        <strong>Exaint i. A. frechhdachs (Maria Kellner) c/o OOE-Esports</strong><br>
        Lastenstr. 42, 4020 Linz<br>
        E-Mail: <a href="mailto:tulpe_salbei6s@icloud.com">tulpe_salbei6s@icloud.com</a>
      </p>

      <h2>2. \u00dcbersicht der Verarbeitungen</h2>
      <p>Wir verarbeiten personenbezogene Daten nur zur Bereitstellung der Website und des Spiels.</p>
      <h3>Verarbeitete Datenarten:</h3>
      <ul>
        <li>Nutzungsdaten (Twitch-Benutzername, Spielstatistiken)</li>
        <li>Meta-/Kommunikationsdaten (IP-Adressen, Zeitpunkt des Zugriffs)</li>
        <li>Profilbilder und Kanalrollen von Twitch (\u00f6ffentlich verf\u00fcgbar)</li>
      </ul>

      <h2>3. Rechtsgrundlagen</h2>
      <ul>
        <li><strong>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</strong> \u2013 Durch Nutzung des Spiels willigst du ein.</li>
        <li><strong>Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</strong> \u2013 Technisch fehlerfreie Darstellung.</li>
      </ul>

      <h2>4. Datenerhebung</h2>
      <h3>4.1 Spielerdaten (Twitch-Chat)</h3>
      <p>Bei Nutzung von Spielbefehlen wird dein Twitch-Benutzername gespeichert.</p>
      <p><strong>Gespeicherte Daten:</strong> Benutzername, Kontostand, Statistiken, Achievements, letzte Aktivit\u00e4t.</p>
      <p><strong>L\u00f6schung:</strong> Jederzeit per E-Mail beantragbar.</p>

      <h3>4.2 Twitch-Login (OAuth)</h3>
      <p>Optionaler Login speichert Twitch-ID, Benutzername, Anzeigename und Profilbild-URL nur im verschl\u00fcsselten Session-Cookie.</p>

      <h3>4.3 Twitch-API-Daten</h3>
      <p>Profilbilder (Cache: 24h) und Kanalrollen (Cache: 1h) werden \u00fcber die offizielle Twitch-API abgerufen.</p>

      <h3>4.4 Server-Log-Dateien</h3>
      <p>Cloudflare erhebt automatisch IP-Adresse, Zeitstempel, URL, Browser und Betriebssystem.</p>

      <h3>4.5 Lokaler Speicher</h3>
      <p>Theme-Einstellungen werden lokal im Browser gespeichert.</p>

      <h2>5. Cookies</h2>
      <p><strong>Keine</strong> Tracking- oder Werbe-Cookies. Nur ein optionaler Session-Cookie (7 Tage, HttpOnly, Secure).</p>

      <h2>6. Hosting</h2>
      <p>Cloudflare, Inc. \u2013 EU-US Data Privacy Framework zertifiziert.</p>

      <h2>7. Deine Rechte</h2>
      <p>Auskunft, Berichtigung, L\u00f6schung, Einschr\u00e4nkung, Daten\u00fcbertragbarkeit, Widerspruch, Widerruf.</p>
      <p>Kontakt: <a href="mailto:tulpe_salbei6s@icloud.com">tulpe_salbei6s@icloud.com</a></p>

      <h2>8. Datensicherheit</h2>
      <p>SSL/TLS-Verschl\u00fcsselung auf allen Seiten.</p>

      <h2>9. Aktualit\u00e4t</h2>
      <p>Stand: Januar 2026. \u00c4nderungen vorbehalten.</p>

      <div style="margin-top:var(--v2-space-xl);padding-top:var(--v2-space-md);border-top:1px solid var(--v2-border)">
        <a href="?page=impressum" class="v2-btn v2-btn-ghost">\u2192 Zum Impressum</a>
      </div>
    </div>
  `;

  return baseTemplateV2('Datenschutzerkl\u00e4rung', content, 'datenschutz', user);
}
