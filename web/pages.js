/**
 * HTML Page Router
 *
 * This file serves as the main entry point for web page requests.
 * All page renderers are in separate files under ./pages/
 *
 * ARCHITECTURE:
 * - ./pages/utils.js - escapeHtml, formatNumber
 * - ./pages/ui-config.js - CATEGORY_ICONS, ROLE_BADGES, PRESTIGE_RANK_NAMES
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
 * - ./pages/v2/ - V2 redesign (admin-only toggle)
 */

import { hasAcceptedDisclaimer } from '../database.js';
import { logError, isAdmin } from '../utils.js';

// V1 page handlers and renderers
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

// V2 page handlers and renderers
import { htmlResponse as htmlResponseV2 } from './pages/v2/template.js';
import { renderHomePageV2 } from './pages/v2/home.js';
import { renderNotFoundPageV2, renderErrorPageV2 } from './pages/v2/errors.js';
import { handleProfilePageV2 } from './pages/v2/profile.js';
import { handleLeaderboardPageV2 } from './pages/v2/leaderboard.js';
import { renderInfoPageV2 } from './pages/v2/info.js';
import { renderShopPageV2 } from './pages/v2/shop.js';
import { handleGlobalStatsPageV2 } from './pages/v2/stats.js';
import { renderChangelogPageV2 } from './pages/v2/changelog.js';
import { renderImpressumPageV2, renderDatenschutzPageV2 } from './pages/v2/legal.js';

/**
 * Detect design version from cookie (admin-only)
 */
function getDesignVersion(request, loggedInUser) {
  if (!loggedInUser || !isAdmin(loggedInUser.username)) return 'v1';
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/dachsbau_design=(\w+)/);
  return (match && match[1] === 'v2') ? 'v2' : 'v1';
}

/**
 * Handle web page requests
 * @param {string} page - Page name
 * @param {URL} url - Request URL
 * @param {object} env - Environment bindings
 * @param {object|null} loggedInUser - Logged in user from JWT cookie
 * @param {Request|null} request - Original request (for cookie reading)
 */
export async function handleWebPage(page, url, env, loggedInUser = null, request = null) {
  try {
    // Check if logged-in user has accepted disclaimer
    if (loggedInUser) {
      const userHasDisclaimer = await hasAcceptedDisclaimer(loggedInUser.username, env);
      loggedInUser = { ...loggedInUser, hasDisclaimer: userHasDisclaimer };
    }

    // Check design version (admin-only V2 toggle)
    const version = request ? getDesignVersion(request, loggedInUser) : 'v1';
    if (version === 'v2') {
      return await handleWebPageV2(page, url, env, loggedInUser);
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
        return htmlResponse(renderInfoPage(loggedInUser), 200, { cacheSeconds: 300 });
      case 'shop':
        return htmlResponse(await renderShopPage(env, loggedInUser));
      case 'changelog':
        return htmlResponse(renderChangelogPage(loggedInUser), 200, { cacheSeconds: 3600 });
      case 'stats':
        return await handleGlobalStatsPage(env, loggedInUser);
      case 'impressum':
        return htmlResponse(renderImpressumPage(loggedInUser), 200, { cacheSeconds: 3600 });
      case 'datenschutz':
        return htmlResponse(renderDatenschutzPage(loggedInUser), 200, { cacheSeconds: 3600 });
      default:
        return htmlResponse(renderNotFoundPage(null, loggedInUser));
    }
  } catch (error) {
    logError('handleWebPage', error, { page });
    return htmlResponse(renderErrorPage(loggedInUser));
  }
}

/**
 * Handle V2 web page requests
 */
async function handleWebPageV2(page, url, env, loggedInUser) {
  try {
    switch (page) {
      case 'home':
        return htmlResponseV2(renderHomePageV2(null, loggedInUser));
      case 'profile':
        return await handleProfilePageV2(url, env, loggedInUser);
      case 'leaderboard':
        const showAll = url.searchParams.get('showAll') === 'true';
        return await handleLeaderboardPageV2(env, loggedInUser, showAll);
      case 'info':
        return htmlResponseV2(renderInfoPageV2(loggedInUser), 200, { cacheSeconds: 300 });
      case 'shop':
        return htmlResponseV2(await renderShopPageV2(env, loggedInUser));
      case 'changelog':
        return htmlResponseV2(renderChangelogPageV2(loggedInUser), 200, { cacheSeconds: 3600 });
      case 'stats':
        return await handleGlobalStatsPageV2(env, loggedInUser);
      case 'impressum':
        return htmlResponseV2(renderImpressumPageV2(loggedInUser), 200, { cacheSeconds: 3600 });
      case 'datenschutz':
        return htmlResponseV2(renderDatenschutzPageV2(loggedInUser), 200, { cacheSeconds: 3600 });
      default:
        return htmlResponseV2(renderNotFoundPageV2(null, loggedInUser));
    }
  } catch (error) {
    logError('handleWebPageV2', error, { page });
    return htmlResponseV2(renderErrorPageV2(loggedInUser));
  }
}
