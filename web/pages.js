/**
 * HTML Page Router
 *
 * This file serves as the main entry point for web page requests.
 * All page renderers are in separate files under ./pages/
 *
 * ARCHITECTURE:
 * - ./pages/utils.js - escapeHtml, formatNumber
 * - ./pages/constants.js - CATEGORY_ICONS, ROLE_BADGES, PRESTIGE_RANK_NAMES
 * - ./pages/template.js - baseTemplate, htmlResponse (with all client-side JS)
 * - ./pages/home.js - Home page
 * - ./pages/profile.js - Profile page
 * - ./pages/leaderboard.js - Leaderboard page
 * - ./pages/info.js - Info page
 * - ./pages/shop.js - Shop page
 * - ./pages/stats.js - Global stats page
 * - ./pages/changelog.js - Changelog page
 * - ./pages/legal.js - Impressum and Datenschutz
 * - ./pages/errors.js - Not found and error pages
 */

import { hasAcceptedDisclaimer } from '../database.js';
import { logError } from '../utils.js';

// Import page handlers and renderers
import { htmlResponse } from './pages/template.js';
import { renderHomePage } from './pages/home.js';
import { handleProfilePage } from './pages/profile.js';
import { handleLeaderboardPage } from './pages/leaderboard.js';
import { renderInfoPage } from './pages/info.js';
import { renderShopPage } from './pages/shop.js';
import { handleGlobalStatsPage } from './pages/stats.js';
import { renderChangelogPage } from './pages/changelog.js';
import { renderImpressumPage, renderDatenschutzPage } from './pages/legal.js';
import { renderNotFoundPage, renderErrorPage } from './pages/errors.js';

/**
 * Handle web page requests
 * @param {string} page - Page name
 * @param {URL} url - Request URL
 * @param {object} env - Environment bindings
 * @param {object|null} loggedInUser - Logged in user from JWT cookie
 */
export async function handleWebPage(page, url, env, loggedInUser = null) {
  try {
    // Check if logged-in user has accepted disclaimer
    if (loggedInUser) {
      const userHasDisclaimer = await hasAcceptedDisclaimer(loggedInUser.username, env);
      loggedInUser = { ...loggedInUser, hasDisclaimer: userHasDisclaimer };
    }

    switch (page) {
      case 'home':
        return htmlResponse(renderHomePage(null, loggedInUser));
      case 'profile':
        return await handleProfilePage(url, env, loggedInUser);
      case 'leaderboard':
        const showAll = url.searchParams.get('showAll') === 'true';
        return await handleLeaderboardPage(env, loggedInUser, showAll);
      case 'info':
        return htmlResponse(renderInfoPage(loggedInUser));
      case 'shop':
        return htmlResponse(await renderShopPage(env, loggedInUser));
      case 'changelog':
        return htmlResponse(renderChangelogPage(loggedInUser));
      case 'stats':
        return await handleGlobalStatsPage(env, loggedInUser);
      case 'impressum':
        return htmlResponse(renderImpressumPage(loggedInUser));
      case 'datenschutz':
        return htmlResponse(renderDatenschutzPage(loggedInUser));
      default:
        return htmlResponse(renderNotFoundPage(null, loggedInUser));
    }
  } catch (error) {
    logError('handleWebPage', error, { page });
    return htmlResponse(renderErrorPage(loggedInUser));
  }
}
