/**
 * Static Routes - Short URLs and asset serving
 */

import { sanitizeUsername } from '../utils.js';
import { serveLogoPng } from '../web/assets.js';

/**
 * Handle short URL redirects (/u/username, /stats, /lb)
 */
export function handleShortUrls(url: URL): Response | null {
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
 */
export function handleStaticAssets(pathname: string): Response | null {
  if (pathname === '/assets/logo.png') {
    return serveLogoPng();
  }
  return null;
}
