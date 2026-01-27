/**
 * Auth Routes - Login, logout, OAuth callbacks
 */

import { getUserLoginUrl, handleUserOAuthCallback, createLogoutResponse, handleOAuthCallback, getAuthorizationUrl, getBotAuthorizationUrl, handleBotOAuthCallback } from '../web/twitch.js';
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

  // Broadcaster authorization - redirect to Twitch OAuth (for mod/VIP roles + chat)
  if (pathname === '/auth/broadcaster') {
    const authUrl = await getAuthorizationUrl(env, url.origin);
    return Response.redirect(authUrl, 302);
  }

  // Bot authorization - redirect to Twitch OAuth (for chat messages as bot)
  if (pathname === '/auth/bot') {
    const botUrl = await getBotAuthorizationUrl(env, url.origin);
    return Response.redirect(botUrl, 302);
  }

  // User logout - clear session cookie
  if (pathname === '/auth/logout') {
    return createLogoutResponse(url.origin);
  }

  // Bot OAuth callback (stores bot token + user ID)
  if (pathname === '/auth/bot/callback') {
    return await handleBotOAuthCallback(url, env);
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
