/**
 * Auth Routes - Login, logout, OAuth callbacks
 */

import { getUserLoginUrl, handleUserOAuthCallback, createLogoutResponse, handleOAuthCallback } from '../web/twitch.js';

/**
 * Handle authentication routes
 * @param {string} pathname - Request pathname
 * @param {URL} url - Request URL
 * @param {object} env - Environment bindings
 * @returns {Promise<Response|null>} Auth response or null if not an auth route
 */
export async function handleAuthRoutes(pathname, url, env) {
  // User login - redirect to Twitch OAuth
  if (pathname === '/auth/login') {
    const loginUrl = getUserLoginUrl(env, url.origin);
    return Response.redirect(loginUrl, 302);
  }

  // User logout - clear session cookie
  if (pathname === '/auth/logout') {
    return createLogoutResponse(url.origin);
  }

  // User OAuth callback (separate from broadcaster)
  if (pathname === '/auth/user/callback') {
    return await handleUserOAuthCallback(url, env);
  }

  // Broadcaster OAuth callback (for mod/VIP roles)
  if (pathname === '/auth/callback') {
    return await handleOAuthCallback(url, env);
  }

  return null;
}
