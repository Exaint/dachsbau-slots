/**
 * Error Page Renderers
 */

import type { LoggedInUser } from '../../types/index.js';
import { escapeHtml } from './utils.js';
import { baseTemplate } from './template.js';

/**
 * Not found page
 */
export function renderNotFoundPage(username: string | null = null, user: LoggedInUser | null = null): string {
  const message = username
    ? `Spieler "${escapeHtml(username)}" wurde nicht gefunden.`
    : 'Die angeforderte Seite wurde nicht gefunden.';

  const content = `
    <div class="not-found">
      <div class="not-found-emoji">🦡❓</div>
      <h1 class="not-found-title">Nicht gefunden</h1>
      <p class="not-found-text">${message}</p>
      <a href="?page=home" class="btn">Zur Startseite</a>
    </div>
  `;

  return baseTemplate('Nicht gefunden', content, '', user);
}

/**
 * Error page
 */
export function renderErrorPage(user: LoggedInUser | null = null): string {
  const content = `
    <div class="not-found">
      <div class="not-found-emoji">🦡💥</div>
      <h1 class="not-found-title">Fehler</h1>
      <p class="not-found-text">Ein unerwarteter Fehler ist aufgetreten.</p>
      <a href="?page=home" class="btn">Zur Startseite</a>
    </div>
  `;

  return baseTemplate('Fehler', content, '', user);
}
