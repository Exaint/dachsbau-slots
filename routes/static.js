/**
 * Static Routes - Short URLs and asset serving
 */

import { sanitizeUsername } from '../utils.js';
import { serveLogoPng } from '../web/assets.js';

/**
 * Handle short URL redirects (/u/username, /stats, /lb)
 * @param {URL} url - Request URL
 * @returns {Response|null} Redirect response or null if not a short URL
 */
export function handleShortUrls(url) {
  const pathname = url.pathname;

  // Profile short URL: /u/username
  if (pathname.startsWith('/u/')) {
    const username = sanitizeUsername(pathname.slice(3));
    if (username) {
      return Response.redirect(`${url.origin}/?page=profile&user=${username}`, 302);
    }
  }

  // Stats short URL
  if (pathname === '/stats' || pathname === '/stats/') {
    return Response.redirect(`${url.origin}/?page=stats`, 302);
  }

  // Leaderboard short URLs
  if (pathname === '/lb' || pathname === '/lb/' || pathname === '/leaderboard' || pathname === '/leaderboard/') {
    return Response.redirect(`${url.origin}/?page=leaderboard`, 302);
  }

  return null;
}

/**
 * Handle static asset requests
 * @param {string} pathname - Request pathname
 * @returns {Response|null} Asset response or null if not an asset
 */
export function handleStaticAssets(pathname) {
  if (pathname === '/assets/logo.png') {
    return serveLogoPng();
  }
  return null;
}
