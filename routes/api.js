/**
 * API Routes - Shop buy, disclaimer accept, etc.
 */

import { getUserFromRequest } from '../web/twitch.js';
import { handleShopBuyAPI } from '../web/shop-api.js';
import { setDisclaimerAccepted } from '../database.js';

/**
 * Validate CSRF protection for POST requests
 * @param {Request} request - Incoming request
 * @param {URL} url - Request URL
 * @returns {Response|null} Error response or null if valid
 */
export function validateCsrf(request, url) {
  if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
    const origin = request.headers.get('Origin');
    if (!origin || !origin.startsWith(url.origin)) {
      return new Response(JSON.stringify({ error: 'Invalid origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
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
export async function handleApiRoutes(pathname, request, url, env) {
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
