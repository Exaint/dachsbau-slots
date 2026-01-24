/**
 * V2 Global Statistics Page
 */

import { getAchievementStats } from '../../../database.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES } from '../../../constants.js';
import { escapeHtml, formatNumber } from '../utils.js';
import { CATEGORY_ICONS, CATEGORY_NAMES } from '../ui-config.js';
import { baseTemplateV2, htmlResponse } from './template.js';

export async function handleGlobalStatsPageV2(env, loggedInUser = null) {
  const achievementStats = await getAchievementStats(env);
  const { totalPlayers, counts } = achievementStats;
  const allAchievements = getAllAchievements();
  const totalUnlocked = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const achievementsWithCounts = allAchievements.map(ach => ({
    ...ach,
    count: counts[ach.id] || 0,
    percent: totalPlayers > 0 ? Math.round((counts[ach.id] || 0) / totalPlayers * 100) : 0
  }));

  const rarestAchievements = [...achievementsWithCounts]
    .filter(a => a.count > 0)
    .sort((a, b) => a.count - b.count)
    .slice(0, 5);

  const mostCommonAchievements = [...achievementsWithCounts]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const avgAchievementsPerPlayer = totalPlayers > 0 ? (totalUnlocked / totalPlayers).toFixed(1) : 0;

  // Build rarest HTML
  const rarestHtml = rarestAchievements.map((ach, index) => `
    <div class="v2-stat-achievement">
      <span class="v2-stat-rank">#${index + 1}</span>
      <div class="v2-stat-ach-info">
        <span class="v2-stat-ach-name">${escapeHtml(ach.name)}</span>
        <span class="v2-stat-ach-desc">${escapeHtml(ach.description)}</span>
      </div>
      <span class="v2-stat-ach-count">${ach.count} Spieler (${ach.percent}%)</span>
    </div>
  `).join('');

  // Build common HTML
  const commonHtml = mostCommonAchievements.map((ach, index) => `
    <div class="v2-stat-achievement">
      <span class="v2-stat-rank">#${index + 1}</span>
      <div class="v2-stat-ach-info">
        <span class="v2-stat-ach-name">${escapeHtml(ach.name)}</span>
        <span class="v2-stat-ach-desc">${escapeHtml(ach.description)}</span>
      </div>
      <span class="v2-stat-ach-count">${ach.count} Spieler (${ach.percent}%)</span>
    </div>
  `).join('');

  // Category breakdown
  const categoryStats = {};
  for (const cat of Object.values(ACHIEVEMENT_CATEGORIES)) {
    const catAchievements = achievementsWithCounts.filter(a => a.category === cat);
    const catUnlocked = catAchievements.reduce((sum, a) => sum + a.count, 0);
    categoryStats[cat] = {
      total: catAchievements.length,
      unlocked: catUnlocked,
      avgPercent: catAchievements.length > 0 && totalPlayers > 0
        ? Math.round(catUnlocked / (catAchievements.length * totalPlayers) * 100)
        : 0
    };
  }

  const categoryHtml = Object.entries(categoryStats).map(([cat, stats]) => `
    <div class="v2-stat-category">
      <span class="v2-stat-cat-icon">${CATEGORY_ICONS[cat] || '🎯'}</span>
      <span class="v2-stat-cat-name">${CATEGORY_NAMES[cat] || cat}</span>
      <span class="v2-stat-cat-value">${stats.avgPercent}% durchschnittlich</span>
    </div>
  `).join('');

  const profileLinkHtml = loggedInUser ? `
    <div class="v2-stats-profile-link">
      <a href="/?page=profile&user=${encodeURIComponent(loggedInUser.username)}" class="v2-btn v2-btn-primary">
        Meine Erfolge anzeigen
      </a>
    </div>
  ` : '';

  const content = `
    <div class="v2-content-page">
      <h1 class="v2-page-title">Globale Statistiken</h1>
      <p class="v2-page-subtitle">Übersicht aller Spielerdaten</p>
      ${profileLinkHtml}

      <div class="v2-global-stats-grid">
        <div class="v2-global-stat-card">
          <div class="v2-global-stat-value">${formatNumber(totalPlayers)}</div>
          <div class="v2-global-stat-label">Spieler gesamt</div>
        </div>
        <div class="v2-global-stat-card">
          <div class="v2-global-stat-value">${allAchievements.length}</div>
          <div class="v2-global-stat-label">Achievements verfügbar</div>
        </div>
        <div class="v2-global-stat-card">
          <div class="v2-global-stat-value">${formatNumber(totalUnlocked)}</div>
          <div class="v2-global-stat-label">Freischaltungen insgesamt</div>
          <div class="v2-global-stat-hint">von allen Spielern</div>
        </div>
        <div class="v2-global-stat-card">
          <div class="v2-global-stat-value">${avgAchievementsPerPlayer}</div>
          <div class="v2-global-stat-label">Ø pro Spieler</div>
        </div>
      </div>

      <div class="v2-stats-section">
        <h2>Seltenste Achievements</h2>
        <div class="v2-stat-achievement-list">
          ${rarestHtml || '<p class="v2-text-muted">Noch keine Daten verfügbar</p>'}
        </div>
      </div>

      <div class="v2-stats-section">
        <h2>Häufigste Achievements</h2>
        <div class="v2-stat-achievement-list">
          ${commonHtml || '<p class="v2-text-muted">Noch keine Daten verfügbar</p>'}
        </div>
      </div>

      <div class="v2-stats-section">
        <h2>Kategorien-Übersicht</h2>
        <div class="v2-stat-category-list">
          ${categoryHtml}
        </div>
      </div>
    </div>
  `;

  return htmlResponse(baseTemplateV2('Statistiken', content, 'stats', loggedInUser));
}
