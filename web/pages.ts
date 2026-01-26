/**
 * HTML Page Router
 *
 * This file serves as the main entry point for web page requests.
 * All page renderers are in separate files under ./pages/
 *
 * ARCHITECTURE:
 * - ./pages/utils.ts - escapeHtml, formatNumber
 * - ./pages/ui-config.ts - CATEGORY_ICONS, ROLE_BADGES, PRESTIGE_RANK_NAMES
 * - ./pages/template.js - baseTemplate, htmlResponse (with all client-side JS)
 * - ./pages/home.ts - Home page
 * - ./pages/profile.js - Profile page
 * - ./pages/leaderboard.js - Leaderboard page
 * - ./pages/info.js - Info page
 * - ./pages/shop.js - Shop page
 * - ./pages/stats.js - Global stats page
 * - ./pages/changelog.ts - Changelog page
 * - ./pages/legal.ts - Impressum and Datenschutz
 * - ./pages/errors.ts - Not found and error pages
 */

import type { Env, LoggedInUser } from '../types/index.d.ts';
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
 */
export async function handleWebPage(
  page: string,
  url: URL,
  env: Env,
  loggedInUser: LoggedInUser | null = null,
  ctx: ExecutionContext | null = null
): Promise<Response> {
  try {
    // Check if logged-in user has accepted disclaimer
    if (loggedInUser) {
      const userHasDisclaimer = await hasAcceptedDisclaimer(loggedInUser.username, env);
      loggedInUser = { ...loggedInUser, hasDisclaimer: userHasDisclaimer };
    }

    switch (page) {
      case 'home':
        return htmlResponse(await renderHomePage(null, loggedInUser, env));
      case 'profile':
        return await handleProfilePage(url, env, loggedInUser);
      case 'leaderboard':
        const showAll = url.searchParams.get('showAll') === 'true';
        return await handleLeaderboardPage(env, loggedInUser, showAll, ctx);
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
