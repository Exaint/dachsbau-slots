/**
 * Home Page Renderer
 */

import { escapeHtml } from './utils.js';
import { baseTemplate } from './template.js';

/**
 * Home page
 */
export function renderHomePage(errorMessage = null, user = null) {
  const errorHtml = errorMessage
    ? `<p style="color: var(--error); margin-bottom: 16px;">${escapeHtml(errorMessage)}</p>`
    : '';

  const content = `
    <div class="hero">
      <h1 class="hero-title">🦡 Dachsbau Slots</h1>
      <p class="hero-subtitle">Schau dir die Achievements und Stats von Spielern an!</p>
      ${errorHtml}
      <div class="hero-search">
        <form class="search-form" action="" method="get" role="search" aria-label="Spielersuche">
          <input type="hidden" name="page" value="profile">
          <input type="text" name="user" placeholder="Spielername eingeben..." class="search-input" required autofocus aria-label="Spielername eingeben">
          <button type="submit" class="btn">Profil anzeigen</button>
        </form>
      </div>
      <div style="margin-top: 32px;">
        <a href="?page=leaderboard" class="btn btn-secondary">Leaderboard anzeigen</a>
      </div>
    </div>
  `;

  return baseTemplate('Home', content, 'home', user);
}
