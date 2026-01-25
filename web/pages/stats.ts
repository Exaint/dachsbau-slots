/**
 * Global Statistics Page Handler and Renderer
 */

import type { Env, LoggedInUser } from '../../types/index.d.ts';
import { getAchievementStats } from '../../database.js';
import { getAllAchievements, ACHIEVEMENT_CATEGORIES } from '../../constants.js';
import { escapeHtml, formatNumber } from './utils.js';
import { CATEGORY_ICONS, CATEGORY_NAMES } from './ui-config.js';
import { baseTemplate, htmlResponse } from './template.js';

interface AchievementWithCount {
  id: string;
  name: string;
  description: string;
  category: string;
  count: number;
  percent: number;
}

interface GlobalStatsData {
  totalPlayers: number;
  totalAchievements: number;
  totalUnlocked: number;
  rarestAchievements: AchievementWithCount[];
  mostCommonAchievements: AchievementWithCount[];
  achievementsWithCounts: AchievementWithCount[];
}

/**
 * Global Statistics page handler
 */
export async function handleGlobalStatsPage(env: Env, loggedInUser: LoggedInUser | null = null): Promise<Response> {
  // Fetch achievement stats and player data
  const achievementStats = await getAchievementStats(env);
  const { totalPlayers, counts } = achievementStats;

  // Get all achievements
  const allAchievements = getAllAchievements();

  // Calculate total achievements unlocked
  const totalUnlocked = Object.values(counts as Record<string, number>).reduce((sum, count) => sum + count, 0);

  // Find rarest and most common achievements
  const achievementsWithCounts: AchievementWithCount[] = allAchievements.map(ach => ({
    ...ach,
    count: counts[ach.id] || 0,
    percent: totalPlayers > 0 ? Math.round((counts[ach.id] || 0) / totalPlayers * 100) : 0
  }));

  // Sort by rarity (ascending count = rarer)
  const rarestAchievements = [...achievementsWithCounts]
    .filter(a => a.count > 0)
    .sort((a, b) => a.count - b.count)
    .slice(0, 5);

  const mostCommonAchievements = [...achievementsWithCounts]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return htmlResponse(renderGlobalStatsPage({
    totalPlayers,
    totalAchievements: allAchievements.length,
    totalUnlocked,
    rarestAchievements,
    mostCommonAchievements,
    achievementsWithCounts
  }, loggedInUser));
}

/**
 * Global Statistics page renderer
 */
export function renderGlobalStatsPage(data: GlobalStatsData, user: LoggedInUser | null = null): string {
  const { totalPlayers, totalAchievements, totalUnlocked, rarestAchievements, mostCommonAchievements, achievementsWithCounts } = data;

  const avgAchievementsPerPlayer = totalPlayers > 0 ? (totalUnlocked / totalPlayers).toFixed(1) : '0';

  // Rarest achievements HTML (with description)
  const rarestHtml = rarestAchievements.map((ach, index) => `
    <div class="stat-achievement">
      <span class="stat-rank">#${index + 1}</span>
      <div class="stat-ach-info">
        <span class="stat-ach-name">${escapeHtml(ach.name)}</span>
        <span class="stat-ach-desc">${escapeHtml(ach.description)}</span>
      </div>
      <span class="stat-ach-count">${ach.count} Spieler (${ach.percent}%)</span>
    </div>
  `).join('');

  // Most common achievements HTML (with description)
  const commonHtml = mostCommonAchievements.map((ach, index) => `
    <div class="stat-achievement">
      <span class="stat-rank">#${index + 1}</span>
      <div class="stat-ach-info">
        <span class="stat-ach-name">${escapeHtml(ach.name)}</span>
        <span class="stat-ach-desc">${escapeHtml(ach.description)}</span>
      </div>
      <span class="stat-ach-count">${ach.count} Spieler (${ach.percent}%)</span>
    </div>
  `).join('');

  // Category breakdown
  const categoryStats: Record<string, { total: number; unlocked: number; avgPercent: number }> = {};
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
    <div class="stat-category">
      <span class="stat-cat-icon">${CATEGORY_ICONS[cat] || '🎯'}</span>
      <span class="stat-cat-name">${CATEGORY_NAMES[cat] || cat}</span>
      <span class="stat-cat-value">${stats.avgPercent}% durchschnittlich</span>
    </div>
  `).join('');

  // Profile link for logged-in users
  const profileLinkHtml = user ? `
    <div class="stats-profile-link">
      <a href="/?page=profile&user=${encodeURIComponent(user.username)}" class="btn btn-primary">
        🏆 Meine Erfolge anzeigen
      </a>
    </div>
  ` : '';

  const content = `
    <div class="content-page">
      <h1 class="page-title">📊 Globale Statistiken</h1>
      <p class="page-subtitle">Übersicht aller Spielerdaten</p>
      ${profileLinkHtml}

      <div class="global-stats-grid">
        <div class="global-stat-card">
          <div class="global-stat-value">${formatNumber(totalPlayers)}</div>
          <div class="global-stat-label">Spieler gesamt</div>
        </div>
        <div class="global-stat-card">
          <div class="global-stat-value">${totalAchievements}</div>
          <div class="global-stat-label">Achievements verfügbar</div>
        </div>
        <div class="global-stat-card">
          <div class="global-stat-value">${formatNumber(totalUnlocked)}</div>
          <div class="global-stat-label">Freischaltungen insgesamt</div>
          <div class="global-stat-hint">von allen Spielern</div>
        </div>
        <div class="global-stat-card">
          <div class="global-stat-value">${avgAchievementsPerPlayer}</div>
          <div class="global-stat-label">Ø pro Spieler</div>
        </div>
      </div>

      <div class="stats-section">
        <h2>💎 Seltenste Achievements</h2>
        <div class="stat-achievement-list">
          ${rarestHtml || '<p class="text-muted">Noch keine Daten verfügbar</p>'}
        </div>
      </div>

      <div class="stats-section">
        <h2>👥 Häufigste Achievements</h2>
        <div class="stat-achievement-list">
          ${commonHtml || '<p class="text-muted">Noch keine Daten verfügbar</p>'}
        </div>
      </div>

      <div class="stats-section">
        <h2>📈 Kategorien-Übersicht</h2>
        <div class="stat-category-list">
          ${categoryHtml}
        </div>
      </div>
    </div>
  `;

  return baseTemplate('Statistiken', content, 'stats', user);
}
