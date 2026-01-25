/**
 * Auth Routes - Login, logout, OAuth callbacks
 */

import { getUserLoginUrl, handleUserOAuthCallback, createLogoutResponse, handleOAuthCallback } from '../web/twitch.js';
import type { Env } from '../types/index.js';

/**
 * Handle authentication routes
 */
export async function handleAuthRoutes(pathname: string, url: URL, env: Env): Promise<Response | null> {
  // User login - redirect to Twitch OAuth
  if (pathname === '/auth/login') {
    const loginUrl = await getUserLoginUrl(env, url.origin);
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
