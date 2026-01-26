/**
 * Cloudflare Worker Entry Point
 * Routes are handled by modules in ./routes/
 */

import type { Env, LoggedInUser } from './types/index.js';
import { RESPONSE_HEADERS } from './constants.js';
import { sanitizeUsername, logError } from './utils.js';

// Web pages and API
import { handleWebPage } from './web/pages.js';
import { handleApi } from './routes/data.js';
import { getUserFromRequest } from './web/twitch.js';

// Route handlers
import { handleShortUrls, handleStaticAssets } from './routes/static.js';
import { handleAuthRoutes } from './routes/auth.js';
import { validateCsrf, handleApiRoutes } from './routes/api.js';
import { handleSlotAction, handleLegacyActions } from './routes/commands.js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (!env.SLOTS_KV) {
        return new Response('KV not configured', { headers: RESPONSE_HEADERS });
      }

      const pathname = url.pathname;

      // Short URL redirects (/u/username, /stats, /lb)
      const shortUrlResponse = handleShortUrls(url);
      if (shortUrlResponse) return shortUrlResponse;

      // Static assets
      const assetResponse = handleStaticAssets(pathname);
      if (assetResponse) return assetResponse;

      // Auth routes (login, logout, callbacks)
      const authResponse = await handleAuthRoutes(pathname, url, env);
      if (authResponse) return authResponse;

      // CSRF protection for POST API endpoints
      const csrfError = validateCsrf(request, url);
      if (csrfError) return csrfError;

      // API routes (shop buy, disclaimer accept)
      const apiResponse = await handleApiRoutes(pathname, request, url, env);
      if (apiResponse) return apiResponse;

      // Get logged-in user from cookie (for web pages)
      const loggedInUser: LoggedInUser | null = await getUserFromRequest(request, env);

      // Web pages (HTML)
      const page = url.searchParams.get('page');
      if (page) {
        return await handleWebPage(page, url, env, loggedInUser, ctx);
      }

      // API endpoints (JSON)
      const api = url.searchParams.get('api');
      if (api) {
        return await handleApi(api, url, env, loggedInUser, request);
      }

      // Browser detection: If no bot parameters and browser request, redirect to home page
      const hasNoParams = !url.searchParams.has('action') && !url.searchParams.has('user') && !url.searchParams.has('amount');
      const acceptHeader = request.headers.get('Accept') || '';
      const isBrowserRequest = acceptHeader.includes('text/html');

      if (hasNoParams && isBrowserRequest) {
        return Response.redirect(`${url.origin}/?page=home`, 302);
      }

      // Twitch bot commands - verify shared secret if configured
      // Fossabot URL format: ?action=slot&user=$(user)&key=SECRET
      if (env.BOT_SECRET) {
        const providedKey = url.searchParams.get('key');
        if (providedKey !== env.BOT_SECRET) {
          return new Response('Unauthorized', { status: 403, headers: RESPONSE_HEADERS });
        }
      }

      const action = url.searchParams.get('action') || 'slot';
      const username = url.searchParams.get('user') || 'Spieler';
      const amountRaw = url.searchParams.get('amount');

      const cleanUsername = sanitizeUsername(username);
      if (!cleanUsername) {
        return new Response('Invalid username', { headers: RESPONSE_HEADERS });
      }

      // Handle slot action (includes subcommands)
      if (action === 'slot') {
        const reqStart = Date.now();
        console.log(`[DEBUG] REQUEST user=${cleanUsername} amount=${amountRaw} ts=${new Date().toISOString()}`);

        const response = await handleSlotAction(cleanUsername, amountRaw, url, env, ctx);

        // Append random invisible char to prevent Twitch duplicate message filter
        const body = await response.text();
        const isEmpty = body.trim().length === 0;
        const elapsed = Date.now() - reqStart;
        console.log(`[DEBUG] RESPONSE user=${cleanUsername} empty=${isEmpty} len=${body.length} ms=${elapsed} preview=${body.substring(0, 80).replace(/\n/g, ' ')}`);

        const dedupChar = String.fromCodePoint(0xE0001 + Math.floor(Math.random() * 95));
        return new Response(body + dedupChar, { status: response.status, headers: RESPONSE_HEADERS });
      }

      // Handle legacy action-based commands
      const legacyResponse = await handleLegacyActions(action, cleanUsername, url, env);
      if (legacyResponse) return legacyResponse;

      return new Response('Invalid action', { headers: RESPONSE_HEADERS });
    } catch (error) {
      logError('Worker', error);
      return new Response('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.', { headers: RESPONSE_HEADERS });
    }
  }
};
