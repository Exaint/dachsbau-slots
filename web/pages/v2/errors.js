/**
 * V2 Error Page Renderers
 */

import { escapeHtml } from '../utils.js';
import { baseTemplateV2 } from './template.js';

/**
 * Not found page
 */
export function renderNotFoundPageV2(username = null, user = null) {
  const message = username
    ? `Spieler "${escapeHtml(username)}" wurde nicht gefunden.`
    : 'Die angeforderte Seite wurde nicht gefunden.';

  const content = `
    <div class="v2-not-found">
      <div class="v2-not-found-icon">\u{1F9A1}\u{2753}</div>
      <h1 class="v2-not-found-title">Nicht gefunden</h1>
      <p class="v2-not-found-text">${message}</p>
      <a href="?page=home" class="v2-btn v2-btn-primary">Zur Startseite</a>
    </div>
  `;

  return baseTemplateV2('Nicht gefunden', content, '', user);
}

/**
 * Error page
 */
export function renderErrorPageV2(user = null) {
  const content = `
    <div class="v2-not-found">
      <div class="v2-not-found-icon">\u{1F9A1}\u{1F4A5}</div>
      <h1 class="v2-not-found-title">Fehler</h1>
      <p class="v2-not-found-text">Ein unerwarteter Fehler ist aufgetreten.</p>
      <a href="?page=home" class="v2-btn v2-btn-primary">Zur Startseite</a>
    </div>
  `;

  return baseTemplateV2('Fehler', content, '', user);
}
