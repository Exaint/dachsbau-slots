/**
 * Legal Page Renderers (Impressum, Datenschutz)
 */

import { baseTemplate } from './template.js';

/**
 * Impressum page (TMG §5)
 */
export function renderImpressumPage(user = null) {
  const content = `
    <div class="legal-page">
      <h1>Impressum</h1>
      <p class="legal-subtitle">Angaben gemäß § 5 TMG</p>

      <section class="legal-section">
        <h2>Verantwortlich für den Inhalt</h2>
        <address>
          <strong>Exaint i. A. frechhdachs</strong><br>
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
          <strong>Exaint i. A. frechhdachs</strong><br>
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

  return baseTemplate('Impressum', content, 'impressum', user);
}

/**
 * Datenschutz page (DSGVO)
 */
export function renderDatenschutzPage(user = null) {
  const content = `
    <div class="legal-page">
      <h1>Datenschutzerklärung</h1>
      <p class="legal-subtitle">Stand: Januar 2026</p>

      <section class="legal-section">
        <h2>1. Verantwortlicher</h2>
        <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO):</p>
        <address>
          <strong>Exaint i. A. frechhdachs c/o OOE-Esports</strong><br>
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

        <h3>4.2 Twitch-Login (OAuth)</h3>
        <p>
          Du kannst dich optional mit deinem Twitch-Konto anmelden. Dabei werden folgende Daten
          von Twitch abgerufen und in deinem Session-Cookie gespeichert:
        </p>
        <ul>
          <li>Twitch-Benutzer-ID</li>
          <li>Twitch-Benutzername</li>
          <li>Anzeigename</li>
          <li>Profilbild-URL</li>
        </ul>
        <p>
          Diese Daten werden <strong>nicht</strong> dauerhaft auf unseren Servern gespeichert,
          sondern nur im verschlüsselten Session-Cookie in deinem Browser.
        </p>

        <h3>4.3 Twitch-API-Daten</h3>
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

        <h3>4.4 Server-Log-Dateien</h3>
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

        <h3>4.5 Lokaler Speicher (LocalStorage)</h3>
        <p>
          Diese Website speichert deine Theme-Einstellung (Hell/Dunkel-Modus) im lokalen Speicher
          deines Browsers. Dies dient ausschließlich deinem Komfort und wird nicht an uns übertragen.
        </p>
      </section>

      <section class="legal-section">
        <h2>5. Cookies</h2>
        <p>
          Diese Website verwendet <strong>keine Cookies</strong> zu Tracking- oder Werbezwecken.
        </p>
        <h3>5.1 Session-Cookie (optionaler Login)</h3>
        <p>
          Wenn du dich mit deinem Twitch-Konto anmeldest, wird ein Session-Cookie gesetzt:
        </p>
        <ul>
          <li><strong>Name:</strong> dachsbau_session</li>
          <li><strong>Zweck:</strong> Speicherung der Login-Session</li>
          <li><strong>Inhalt:</strong> Verschlüsselter Token mit Twitch-ID, Benutzername und Profilbild-URL</li>
          <li><strong>Gültigkeit:</strong> 7 Tage</li>
          <li><strong>Flags:</strong> HttpOnly, Secure, SameSite=Lax</li>
        </ul>
        <p>
          Dieser Cookie wird nur gesetzt, wenn du dich aktiv einloggst. Du kannst dich jederzeit
          ausloggen, wodurch der Cookie gelöscht wird.
        </p>
        <h3>5.2 Technische Cookies</h3>
        <p>
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

  return baseTemplate('Datenschutzerklärung', content, 'datenschutz', user);
}
