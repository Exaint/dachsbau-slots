/**
 * Web Pages Module Index
 *
 * This module provides page renderers and handlers for the website.
 *
 * ARCHITECTURE:
 * - utils.js - escapeHtml, formatNumber
 * - constants.js - CATEGORY_ICONS, ROLE_BADGES, PRESTIGE_RANK_NAMES
 * - template.js - baseTemplate, htmlResponse (with all client-side JS)
 * - home.js - Home page renderer
 * - profile.js - Profile page handler and renderer
 * - leaderboard.js - Leaderboard page handler and renderer
 * - info.js - Info page renderer
 * - shop.js - Shop page renderer
 * - stats.js - Global stats page handler and renderer
 * - changelog.js - Changelog page renderer
 * - legal.js - Impressum and Datenschutz page renderers
 * - errors.js - Error page renderers (404, error)
 */

// Re-export utilities
export { escapeHtml, formatNumber } from './utils.js';

// Re-export constants
export {
  CATEGORY_ICONS,
  CATEGORY_NAMES,
  PRESTIGE_RANK_NAMES,
  ROLE_BADGES
} from './constants.js';

// Re-export template functions
export { baseTemplate, htmlResponse } from './template.js';

// Re-export page renderers and handlers
export { renderHomePage } from './home.js';
export { handleProfilePage, renderProfilePage } from './profile.js';
export { handleLeaderboardPage, renderLeaderboardPage } from './leaderboard.js';
export { renderInfoPage } from './info.js';
export { renderShopPage } from './shop.js';
export { handleGlobalStatsPage, renderGlobalStatsPage } from './stats.js';
export { renderChangelogPage } from './changelog.js';
export { renderImpressumPage, renderDatenschutzPage } from './legal.js';
export { renderNotFoundPage, renderErrorPage } from './errors.js';
