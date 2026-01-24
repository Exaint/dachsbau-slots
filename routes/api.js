/**
 * API Routes - Shop buy, disclaimer accept, etc.
 */

import { getUserFromRequest } from '../web/twitch.js';
import { handleShopBuyAPI } from '../web/shop-api.js';
import { setDisclaimerAccepted } from '../database.js';

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

  return null;
}
