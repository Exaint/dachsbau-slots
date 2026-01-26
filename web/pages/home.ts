/**
 * Home Page Renderer
 */

import type { Env, LoggedInUser } from '../../types/index.js';
import { getAchievementStats, getTripleStatsD1 } from '../../database.js';
import { getHomePageStats } from '../../database/d1.js';
import { escapeHtml, formatNumber } from './utils.js';
import { baseTemplate } from './template.js';
import { R2_BASE } from './ui-config.js';
import { logError } from '../../utils.js';

/**
 * Home page
 */
export async function renderHomePage(errorMessage: string | null = null, user: LoggedInUser | null = null, env?: Env): Promise<string> {
  const errorHtml = errorMessage
    ? `<p style="color: var(--error); margin-bottom: 16px;">${escapeHtml(errorMessage)}</p>`
    : '';

  // Fetch quick stats
  let totalPlayers = 0;
  let totalUnlocked = 0;
  let totalWon = 0;
  let totalLost = 0;
  let dachsSingles = 0;
  let dachsDoubles = 0;
  let dachsTriples = 0;
  if (env) {
    try {
      const [achievementStats, homeStats, tripleStats] = await Promise.all([
        getAchievementStats(env),
        getHomePageStats(env),
        getTripleStatsD1(env)
      ]);
      totalUnlocked = Object.values(achievementStats.counts as Record<string, number>).reduce((sum, count) => sum + count, 0);
      if (homeStats) {
        totalPlayers = homeStats.totalPlayers;
        totalWon = homeStats.totalWon;
        totalLost = homeStats.totalLost;
      } else {
        totalPlayers = achievementStats.totalPlayers;
      }
      if (tripleStats) {
        for (const stat of tripleStats) {
          if (stat.triple_key === 'dachs_single') dachsSingles = stat.total_hits;
          else if (stat.triple_key === 'dachs_double') dachsDoubles = stat.total_hits;
          else if (stat.triple_key === 'dachs_triple') dachsTriples = stat.total_hits;
        }
      }
    } catch (error) {
      logError('homePage.quickStats', error);
    }
  }

  const quickStatsHtml = totalPlayers > 0 ? `
    <div class="home-stats">
      <div class="home-stat">
        <span class="home-stat-value">${formatNumber(totalPlayers)}</span>
        <span class="home-stat-label">Spieler</span>
      </div>
      <div class="home-stat">
        <span class="home-stat-value home-stat-won">${formatNumber(totalWon)} DachsTaler</span>
        <span class="home-stat-label">gewonnen</span>
      </div>
      <div class="home-stat">
        <span class="home-stat-value home-stat-lost">${formatNumber(totalLost)} DachsTaler</span>
        <span class="home-stat-label">verloren</span>
      </div>
      <div class="home-stat">
        <span class="home-stat-value">${formatNumber(totalUnlocked)}</span>
        <span class="home-stat-label">Erfolge freigeschaltet</span>
      </div>
    </div>
  ` : '';

  const content = `
    <div class="hero">
      <h1 class="hero-title">Dachsbau Slots</h1>
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

    <div class="home-features">
      <a href="?page=info" class="home-feature-card">
        <img src="${R2_BASE}/Gamba_animated.gif" alt="Slots" class="home-feature-gif" loading="lazy">
        <h3>Slots</h3>
        <p>Versuch dein Glück und gewinne DachsTaler</p>
      </a>
      <a href="?page=info#duell" class="home-feature-card">
        <img src="${R2_BASE}/Duelle_animated.gif" alt="Duelle" class="home-feature-gif" loading="lazy">
        <h3>Duelle</h3>
        <p>Fordere andere Spieler heraus</p>
      </a>
      <a href="?page=stats" class="home-feature-card">
        <img src="${R2_BASE}/Erfolge_animated.gif" alt="Achievements" class="home-feature-gif" loading="lazy">
        <h3>Achievements</h3>
        <p>Schalte Achievements frei und sammle Belohnungen</p>
      </a>
      <a href="?page=shop" class="home-feature-card">
        <img src="${R2_BASE}/Shop_animated.gif" alt="Shop" class="home-feature-gif" loading="lazy">
        <h3>Shop</h3>
        <p>Kaufe Upgrades und Power-Ups</p>
      </a>
    </div>

    ${quickStatsHtml}

    ${(dachsSingles + dachsDoubles + dachsTriples) > 0 ? `
    <div class="home-dachs-stats">
      <h3>🦡 Dachs-Sichtungen</h3>
      <div class="home-stats">
        <div class="home-stat">
          <span class="home-stat-value">${formatNumber(dachsSingles)}</span>
          <span class="home-stat-label">Einzel-Dachs</span>
          <span class="home-stat-emoji">🦡</span>
        </div>
        <div class="home-stat">
          <span class="home-stat-value">${formatNumber(dachsDoubles)}</span>
          <span class="home-stat-label">Doppel-Dachs</span>
          <span class="home-stat-emoji">🦡🦡</span>
        </div>
        <div class="home-stat">
          <span class="home-stat-value">${formatNumber(dachsTriples)}</span>
          <span class="home-stat-label">Triple-Dachs</span>
          <span class="home-stat-emoji">🦡🦡🦡</span>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="home-discord">
      <div class="home-discord-heading">
        <img src="${R2_BASE}/Discord.png" alt="" class="home-discord-mascot" loading="lazy">
        <h2>Komm in den Dachsbau!</h2>
        <img src="${R2_BASE}/Discord_gedreht.png" alt="" class="home-discord-mascot" loading="lazy">
      </div>
      <p class="home-discord-sub">Ideen, Feedback oder einfach quatschen &ndash; wir freuen uns auf dich!</p>
      <a href="https://discord.gg/dachsbau" target="_blank" rel="noopener" class="btn-discord">
        <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 5a.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.2v.1a58.7 58.7 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.8.2.2 0 00.3.1A58.5 58.5 0 0070.3 45.3v-.1C71.7 30 67.8 16.8 60.2 5a.2.2 0 00-.1 0zM23.7 37.1c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.8 7.1-6.3 7.1zm23.3 0c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.7 7.1-6.3 7.1z"/></svg>
        Discord beitreten
      </a>
    </div>
  `;

  return baseTemplate('Home', content, 'home', user);
}
