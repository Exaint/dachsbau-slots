/**
 * V2 Home Page Renderer
 */

import { escapeHtml } from '../utils.js';
import { baseTemplateV2 } from './template.js';

/**
 * Home page with hero section
 */
export function renderHomePageV2(errorMessage = null, user = null) {
  const errorHtml = errorMessage
    ? `<p style="color: var(--v2-error); margin-bottom: 16px;">${escapeHtml(errorMessage)}</p>`
    : '';

  const content = `
    <div class="v2-hero">
      <img src="https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev/Slots.png" alt="Dachsbau Slots" class="v2-hero-logo">
      <h1 class="v2-hero-title">Dachsbau <span class="v2-hero-title-gold">Slots</span></h1>
      <p class="v2-hero-subtitle">Entdecke Achievements, Stats und Leaderboards der Dachsbau-Community.</p>
      ${errorHtml}
      <div class="v2-hero-search">
        <form class="v2-search-form" action="" method="get" role="search" aria-label="Spielersuche" style="display:flex;gap:8px">
          <input type="hidden" name="page" value="profile">
          <input type="text" name="user" placeholder="Spielername eingeben..." class="v2-search-input" required autofocus aria-label="Spielername eingeben" style="flex:1;padding:14px 18px;font-size:1rem;border-radius:var(--v2-radius-md)">
          <button type="submit" class="v2-btn v2-btn-primary">Profil anzeigen</button>
        </form>
      </div>
      <div class="v2-hero-actions">
        <a href="?page=leaderboard" class="v2-btn v2-btn-secondary">Leaderboard</a>
        <a href="?page=info" class="v2-btn v2-btn-ghost">Mehr erfahren</a>
      </div>
    </div>
  `;

  return baseTemplateV2('Home', content, 'home', user);
}
