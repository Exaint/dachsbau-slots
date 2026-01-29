/**
 * API Routes - Shop buy, disclaimer accept, etc.
 */

import { getUserFromRequest, verifySessionIP } from '../web/twitch.js';
import { handleShopBuyAPI } from './shop.js';
import { setDisclaimerAccepted, hasUnlock, getCustomMessages, setCustomMessages } from '../database.js';
import { checkRateLimit, containsProfanity, isAdmin, jsonErrorResponse, jsonSuccessResponse, stripInvisibleChars, checkIdempotencyKey, storeIdempotencyResponse, clearIdempotencyKey, logAuditTrail } from '../utils.js';
import { RATE_LIMIT_SHOP, RATE_LIMIT_WINDOW_SECONDS, CUSTOM_MESSAGE_MAX_LENGTH, CUSTOM_MESSAGES_MAX_COUNT } from '../constants/config.js';
import type { Env, LoggedInUser } from '../types/index.js';

/**
 * Validate CSRF protection for POST requests
 * Checks Origin header first, falls back to Referer if Origin is missing
 */
export function validateCsrf(request: Request, url: URL): Response | null {
  // Check for /api/ paths OR ?api= query parameter (admin API)
  const isApiPath = url.pathname.startsWith('/api/');
  const isApiQuery = url.searchParams.has('api');

  if (request.method === 'POST' && (isApiPath || isApiQuery)) {
    const origin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');

    // Check Origin header first (preferred)
    if (origin) {
      if (!origin.startsWith(url.origin)) {
        return jsonErrorResponse('Invalid origin', 403);
      }
      return null; // Valid Origin
    }

    // Fallback to Referer header if Origin is missing
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.origin !== url.origin) {
          return jsonErrorResponse('Invalid referer', 403);
        }
        return null; // Valid Referer
      } catch {
        // Invalid Referer URL
        return jsonErrorResponse('Invalid referer', 403);
      }
    }

    // Neither Origin nor Referer present - block the request
    return jsonErrorResponse('Missing origin header', 403);
  }
  return null;
}

/**
 * Handle API routes
 */
const MAX_BODY_SIZE = 4096; // 4KB max for API requests

export async function handleApiRoutes(pathname: string, request: Request, url: URL, env: Env): Promise<Response | null> {
  // Reject oversized request bodies
  if (request.method === 'POST') {
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_SIZE) {
      return jsonErrorResponse('Request body too large', 413);
    }
  }

  // Shop buy API endpoint (requires logged-in user)
  if (pathname === '/api/shop/buy' && request.method === 'POST') {
    const loggedInUser = await getUserFromRequest(request, env) as LoggedInUser | null;
    if (!loggedInUser) {
      return jsonErrorResponse('Nicht eingeloggt', 401);
    }
    // IP-Binding check for sensitive operations (prevents session hijacking)
    const ipValid = await verifySessionIP(request, loggedInUser, env);
    if (!ipValid) {
      return jsonErrorResponse('Session ungültig - bitte erneut einloggen', 401);
    }
    // Idempotency check (prevents double-purchases on network retry)
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    if (idempotencyKey) {
      const idempResult = await checkIdempotencyKey(idempotencyKey, env);
      if (idempResult.isDuplicate) {
        if (idempResult.cachedResponse) {
          // Return cached response from previous request
          return new Response(idempResult.cachedResponse, {
            headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' }
          });
        }
        // Request still processing
        return jsonErrorResponse('Anfrage wird noch verarbeitet', 409);
      }
    }
    // Rate-Limit per User
    const allowed = await checkRateLimit(`shop:${loggedInUser.username}`, RATE_LIMIT_SHOP, RATE_LIMIT_WINDOW_SECONDS, env);
    if (!allowed) {
      if (idempotencyKey) await clearIdempotencyKey(idempotencyKey, env);
      return jsonErrorResponse('Zu viele Käufe, bitte warte kurz', 429);
    }

    try {
      const response = await handleShopBuyAPI(request, env, loggedInUser);
      // Store response for idempotency (only on success)
      if (idempotencyKey && response.ok) {
        const responseBody = await response.clone().text();
        await storeIdempotencyResponse(idempotencyKey, JSON.parse(responseBody), env);

        // Audit log for purchase
        const bodyData = JSON.parse(responseBody) as { item?: string };
        await logAuditTrail(loggedInUser.username, 'shop_purchase', { item: bodyData.item }, env);
      }
      return response;
    } catch (error) {
      // Clear idempotency on error to allow retry
      if (idempotencyKey) await clearIdempotencyKey(idempotencyKey, env);
      throw error;
    }
  }

  // Accept disclaimer endpoint (requires logged-in user)
  if (pathname === '/api/disclaimer/accept' && request.method === 'POST') {
    const loggedInUser = await getUserFromRequest(request, env) as LoggedInUser | null;
    if (!loggedInUser) {
      return jsonErrorResponse('Nicht eingeloggt', 401);
    }
    // Rate limit: 2 per 60 seconds (disclaimer is a one-time action)
    const allowed = await checkRateLimit(`disclaimer:${loggedInUser.username}`, 2, RATE_LIMIT_WINDOW_SECONDS, env);
    if (!allowed) {
      return jsonErrorResponse('Zu viele Anfragen, bitte warte kurz', 429);
    }
    await setDisclaimerAccepted(loggedInUser.username, env);
    return jsonSuccessResponse();
  }

  // Custom Messages save endpoint
  if (pathname === '/api/custom-messages' && request.method === 'POST') {
    const loggedInUser = await getUserFromRequest(request, env) as LoggedInUser | null;
    if (!loggedInUser) {
      return jsonErrorResponse('Nicht eingeloggt', 401);
    }

    // Rate limit: 5 per 60 seconds
    const allowed = await checkRateLimit(`custom_msg:${loggedInUser.username}`, 5, RATE_LIMIT_WINDOW_SECONDS, env);
    if (!allowed) {
      return jsonErrorResponse('Zu viele Anfragen, bitte warte kurz', 429);
    }

    // Check unlock
    const hasCustomMessageUnlock = await hasUnlock(loggedInUser.username, 'custom_message', env);
    if (!hasCustomMessageUnlock) {
      return jsonErrorResponse('Custom Messages nicht freigeschaltet', 403);
    }

    let body: { win?: unknown; loss?: unknown };
    try {
      body = await request.json();
    } catch {
      return jsonErrorResponse('Ungültiges JSON');
    }

    const { win = [], loss = [] } = body;

    // Validate arrays
    if (!Array.isArray(win) || !Array.isArray(loss)) {
      return jsonErrorResponse('win und loss müssen Arrays sein');
    }

    if (win.length > CUSTOM_MESSAGES_MAX_COUNT || loss.length > CUSTOM_MESSAGES_MAX_COUNT) {
      return jsonErrorResponse(`Maximal ${CUSTOM_MESSAGES_MAX_COUNT} Nachrichten pro Typ`);
    }

    // Validate and sanitize each message
    const cleanWin: string[] = [];
    const cleanLoss: string[] = [];

    for (const msg of win) {
      if (typeof msg !== 'string') continue;
      // Strip invisible Unicode chars before trimming (prevents bypass attacks)
      const sanitized = stripInvisibleChars(msg).trim();
      if (!sanitized) continue;
      if (sanitized.length > CUSTOM_MESSAGE_MAX_LENGTH) {
        return jsonErrorResponse(`Nachricht zu lang (max. ${CUSTOM_MESSAGE_MAX_LENGTH} Zeichen): "${sanitized.slice(0, 20)}..."`);
      }
      if (containsProfanity(sanitized)) {
        return jsonErrorResponse('Nachricht enthält unerlaubte Wörter');
      }
      cleanWin.push(sanitized);
    }

    for (const msg of loss) {
      if (typeof msg !== 'string') continue;
      // Strip invisible Unicode chars before trimming (prevents bypass attacks)
      const sanitized = stripInvisibleChars(msg).trim();
      if (!sanitized) continue;
      if (sanitized.length > CUSTOM_MESSAGE_MAX_LENGTH) {
        return jsonErrorResponse(`Nachricht zu lang (max. ${CUSTOM_MESSAGE_MAX_LENGTH} Zeichen): "${sanitized.slice(0, 20)}..."`);
      }
      if (containsProfanity(sanitized)) {
        return jsonErrorResponse('Nachricht enthält unerlaubte Wörter');
      }
      cleanLoss.push(sanitized);
    }

    const messages = { win: cleanWin, loss: cleanLoss };
    const success = await setCustomMessages(loggedInUser.username, messages, env);

    if (!success) {
      return jsonErrorResponse('Speichern fehlgeschlagen', 500);
    }

    return jsonSuccessResponse();
  }

  // Get custom messages endpoint
  if (pathname === '/api/custom-messages' && request.method === 'GET') {
    const loggedInUser = await getUserFromRequest(request, env) as LoggedInUser | null;
    if (!loggedInUser) {
      return jsonErrorResponse('Nicht eingeloggt', 401);
    }

    const targetUser = url.searchParams.get('user') || loggedInUser.username;
    const isOwn = targetUser.toLowerCase() === loggedInUser.username.toLowerCase();

    // Only own messages or admin can view
    if (!isOwn && !isAdmin(loggedInUser.username)) {
      return jsonErrorResponse('Keine Berechtigung', 403);
    }

    const messages = await getCustomMessages(targetUser, env);
    return jsonSuccessResponse({ messages: messages || { win: [], loss: [] } });
  }

  return null;
}
