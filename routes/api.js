/**
 * API Routes - Shop buy, disclaimer accept, etc.
 */

import { getUserFromRequest } from '../web/twitch.js';
import { handleShopBuyAPI } from './shop.js';
import { setDisclaimerAccepted, hasUnlock, getCustomMessages, setCustomMessages } from '../database.js';
import { checkRateLimit, containsProfanity, isAdmin } from '../utils.js';
import { RATE_LIMIT_SHOP, RATE_LIMIT_WINDOW_SECONDS } from '../constants/config.js';

/**
 * Validate CSRF protection for POST requests
 * Checks Origin header first, falls back to Referer if Origin is missing
 * @param {Request} request - Incoming request
 * @param {URL} url - Request URL
 * @returns {Response|null} Error response or null if valid
 */
export function validateCsrf(request, url) {
  // Check for /api/ paths OR ?api= query parameter (admin API)
  const isApiPath = url.pathname.startsWith('/api/');
  const isApiQuery = url.searchParams.has('api');

  if (request.method === 'POST' && (isApiPath || isApiQuery)) {
    const origin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');

    // Check Origin header first (preferred)
    if (origin) {
      if (!origin.startsWith(url.origin)) {
        return new Response(JSON.stringify({ error: 'Invalid origin' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return null; // Valid Origin
    }

    // Fallback to Referer header if Origin is missing
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.origin !== url.origin) {
          return new Response(JSON.stringify({ error: 'Invalid referer' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return null; // Valid Referer
      } catch {
        // Invalid Referer URL
        return new Response(JSON.stringify({ error: 'Invalid referer' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Neither Origin nor Referer present - block the request
    return new Response(JSON.stringify({ error: 'Missing origin header' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}

/**
 * Handle API routes
 * @param {string} pathname - Request pathname
 * @param {Request} request - Incoming request
 * @param {URL} url - Request URL
 * @param {object} env - Environment bindings
 * @returns {Promise<Response|null>} API response or null if not an API route
 */
const MAX_BODY_SIZE = 4096; // 4KB max for API requests

export async function handleApiRoutes(pathname, request, url, env) {
  // Reject oversized request bodies
  if (request.method === 'POST') {
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: 'Request body too large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Shop buy API endpoint (requires logged-in user)
  if (pathname === '/api/shop/buy' && request.method === 'POST') {
    const loggedInUser = await getUserFromRequest(request, env);
    if (!loggedInUser) {
      return new Response(JSON.stringify({ error: 'Nicht eingeloggt' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Rate-Limit per User
    const allowed = await checkRateLimit(`shop:${loggedInUser.username}`, RATE_LIMIT_SHOP, RATE_LIMIT_WINDOW_SECONDS, env);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Zu viele Käufe, bitte warte kurz' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return await handleShopBuyAPI(request, env, loggedInUser);
  }

  // Accept disclaimer endpoint (requires logged-in user)
  if (pathname === '/api/disclaimer/accept' && request.method === 'POST') {
    const loggedInUser = await getUserFromRequest(request, env);
    if (!loggedInUser) {
      return new Response(JSON.stringify({ error: 'Nicht eingeloggt' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    await setDisclaimerAccepted(loggedInUser.username, env);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Custom Messages save endpoint
  if (pathname === '/api/custom-messages' && request.method === 'POST') {
    const loggedInUser = await getUserFromRequest(request, env);
    if (!loggedInUser) {
      return new Response(JSON.stringify({ error: 'Nicht eingeloggt' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check unlock or admin
    const hasCustomMessageUnlock = await hasUnlock(loggedInUser.username, 'custom_message', env);
    if (!hasCustomMessageUnlock && !isAdmin(loggedInUser.username)) {
      return new Response(JSON.stringify({ error: 'Custom Messages nicht freigeschaltet' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { win = [], loss = [] } = body;

    // Validate arrays
    if (!Array.isArray(win) || !Array.isArray(loss)) {
      return new Response(JSON.stringify({ error: 'win und loss müssen Arrays sein' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Max 5 per type
    if (win.length > 5 || loss.length > 5) {
      return new Response(JSON.stringify({ error: 'Maximal 5 Nachrichten pro Typ' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate each message
    const cleanWin = [];
    const cleanLoss = [];

    for (const msg of win) {
      if (typeof msg !== 'string') continue;
      const trimmed = msg.trim();
      if (!trimmed) continue;
      if (trimmed.length > 50) {
        return new Response(JSON.stringify({ error: `Nachricht zu lang (max. 50 Zeichen): "${trimmed.slice(0, 20)}..."` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (containsProfanity(trimmed)) {
        return new Response(JSON.stringify({ error: 'Nachricht enthält unerlaubte Wörter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      cleanWin.push(trimmed);
    }

    for (const msg of loss) {
      if (typeof msg !== 'string') continue;
      const trimmed = msg.trim();
      if (!trimmed) continue;
      if (trimmed.length > 50) {
        return new Response(JSON.stringify({ error: `Nachricht zu lang (max. 50 Zeichen): "${trimmed.slice(0, 20)}..."` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (containsProfanity(trimmed)) {
        return new Response(JSON.stringify({ error: 'Nachricht enthält unerlaubte Wörter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      cleanLoss.push(trimmed);
    }

    const messages = { win: cleanWin, loss: cleanLoss };
    const success = await setCustomMessages(loggedInUser.username, messages, env);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Speichern fehlgeschlagen' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get custom messages endpoint
  if (pathname === '/api/custom-messages' && request.method === 'GET') {
    const loggedInUser = await getUserFromRequest(request, env);
    if (!loggedInUser) {
      return new Response(JSON.stringify({ error: 'Nicht eingeloggt' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const targetUser = url.searchParams.get('user') || loggedInUser.username;
    const isOwn = targetUser.toLowerCase() === loggedInUser.username.toLowerCase();

    // Only own messages or admin can view
    if (!isOwn && !isAdmin(loggedInUser.username)) {
      return new Response(JSON.stringify({ error: 'Keine Berechtigung' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const messages = await getCustomMessages(targetUser, env);
    return new Response(JSON.stringify({ messages: messages || { win: [], loss: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return null;
}
