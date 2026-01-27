/**
 * Twitch API Integration
 * Fetches avatars and channel roles (Mod/VIP) with caching
 * Also handles user authentication via OAuth
 */

import type { Env, LoggedInUser } from '../types/index.js';
import { logError } from '../utils.js';
import { BROADCASTER_LOGIN } from '../constants.js';

// Cache TTLs
const AVATAR_CACHE_TTL = 86400; // 24 hours
const ROLES_CACHE_TTL = 3600;   // 1 hour
const TOKEN_CACHE_TTL = 1800;   // 30 min (rotate frequently to limit compromise window)

// User session constants
const USER_SESSION_COOKIE = 'dachsbau_session';
const SESSION_TTL_SECONDS = 604800; // 7 days
const TOKEN_REFRESH_THRESHOLD_MS = 300000; // 5 minutes before expiry
const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes

// Twitch API endpoints
const TWITCH_API = 'https://api.twitch.tv/helix';
const TWITCH_OAUTH = 'https://id.twitch.tv/oauth2/token';

interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  avatar: string;
}

interface TwitchTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface TwitchUserResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
  }>;
}

interface ChannelRoles {
  moderators: Set<string>;
  vips: Set<string>;
}

interface TwitchProfileData {
  avatar: string | null;
  displayName: string;
  role: string | null;
}

interface SessionPayload {
  twitchId: string;
  username: string;
  displayName: string;
  avatar: string;
  iat?: number;
  exp?: number;
}

/**
 * Get app access token (Client Credentials flow)
 * This token is used for public API calls (avatars, user info)
 */
async function getAppAccessToken(env: Env): Promise<string | null> {
  try {
    // Check cache first
    const cached = await env.SLOTS_KV.get('twitch:app_token');
    if (cached) {
      return cached;
    }

    // Fetch new token
    const response = await fetch(TWITCH_OAUTH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID!,
        client_secret: env.TWITCH_CLIENT_SECRET!,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json() as TwitchTokenResponse;
    const token = data.access_token;

    // Cache token (slightly shorter than actual expiry)
    await env.SLOTS_KV.put('twitch:app_token', token, {
      expirationTtl: TOKEN_CACHE_TTL
    });

    return token;
  } catch (error) {
    logError('getAppAccessToken', error);
    return null;
  }
}

/**
 * Get broadcaster access token (for mod/VIP lists)
 * This requires the broadcaster to have authorized the app
 */
async function getBroadcasterToken(env: Env): Promise<string | null> {
  try {
    const tokenData = await env.SLOTS_KV.get('twitch:broadcaster_token', { type: 'json' }) as { accessToken: string; refreshToken: string; expiresAt: number } | null;
    if (!tokenData) {
      return null;
    }

    // Check if token is expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt - TOKEN_REFRESH_THRESHOLD_MS) {
      // Token expired or expiring soon, try to refresh
      return await refreshBroadcasterToken(tokenData.refreshToken, env);
    }

    return tokenData.accessToken;
  } catch (error) {
    logError('getBroadcasterToken', error);
    return null;
  }
}

/**
 * Refresh broadcaster token
 */
async function refreshBroadcasterToken(refreshToken: string, env: Env): Promise<string | null> {
  try {
    const response = await fetch(TWITCH_OAUTH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID!,
        client_secret: env.TWITCH_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json() as TwitchTokenResponse;

    // Store new tokens
    await env.SLOTS_KV.put('twitch:broadcaster_token', JSON.stringify({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    }));

    return data.access_token;
  } catch (error) {
    logError('refreshBroadcasterToken', error);
    return null;
  }
}

/**
 * Get user info (including avatar) from Twitch
 */
async function getTwitchUser(username: string, env: Env): Promise<TwitchUser | null> {
  try {
    // Check cache first
    const cacheKey = `twitch:user:${username.toLowerCase()}`;
    const cached = await env.SLOTS_KV.get(cacheKey, { type: 'json' }) as TwitchUser | null;
    if (cached) {
      return cached;
    }

    const token = await getAppAccessToken(env);
    if (!token) {
      return null;
    }

    const response = await fetch(`${TWITCH_API}/users?login=${encodeURIComponent(username)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': env.TWITCH_CLIENT_ID!
      }
    });

    if (!response.ok) {
      throw new Error(`User fetch failed: ${response.status}`);
    }

    const data = await response.json() as TwitchUserResponse;
    if (!data.data || data.data.length === 0) {
      return null;
    }

    const user: TwitchUser = {
      id: data.data[0].id,
      login: data.data[0].login,
      displayName: data.data[0].display_name,
      avatar: data.data[0].profile_image_url
    };

    // Cache user data
    await env.SLOTS_KV.put(cacheKey, JSON.stringify(user), {
      expirationTtl: AVATAR_CACHE_TTL
    });

    return user;
  } catch (error) {
    logError('getTwitchUser', error, { username });
    return null;
  }
}

/**
 * Get broadcaster ID (cached)
 */
async function getBroadcasterId(env: Env): Promise<string | null> {
  try {
    const cached = await env.SLOTS_KV.get('twitch:broadcaster_id');
    if (cached) {
      return cached;
    }

    const user = await getTwitchUser(BROADCASTER_LOGIN, env);
    if (user) {
      await env.SLOTS_KV.put('twitch:broadcaster_id', user.id, {
        expirationTtl: 86400 * 7 // 1 week
      });
      return user.id;
    }

    return null;
  } catch (error) {
    logError('getBroadcasterId', error);
    return null;
  }
}

/**
 * Get channel roles (moderators and VIPs)
 * Returns object with 'moderators' and 'vips' Sets
 */
async function getChannelRoles(env: Env): Promise<ChannelRoles> {
  try {
    // Check cache first
    const cached = await env.SLOTS_KV.get('twitch:channel_roles', { type: 'json' }) as { moderators: string[]; vips: string[] } | null;
    if (cached) {
      return {
        moderators: new Set(cached.moderators || []),
        vips: new Set(cached.vips || [])
      };
    }

    const broadcasterToken = await getBroadcasterToken(env);
    if (!broadcasterToken) {
      // No broadcaster token, return empty sets
      return { moderators: new Set(), vips: new Set() };
    }

    const broadcasterId = await getBroadcasterId(env);
    if (!broadcasterId) {
      return { moderators: new Set(), vips: new Set() };
    }

    // Fetch moderators and VIPs in parallel
    const [modsResponse, vipsResponse] = await Promise.all([
      fetch(`${TWITCH_API}/moderation/moderators?broadcaster_id=${broadcasterId}&first=100`, {
        headers: {
          'Authorization': `Bearer ${broadcasterToken}`,
          'Client-Id': env.TWITCH_CLIENT_ID!
        }
      }),
      fetch(`${TWITCH_API}/channels/vips?broadcaster_id=${broadcasterId}&first=100`, {
        headers: {
          'Authorization': `Bearer ${broadcasterToken}`,
          'Client-Id': env.TWITCH_CLIENT_ID!
        }
      })
    ]);

    const moderators: string[] = [];
    const vips: string[] = [];

    if (modsResponse.ok) {
      const modsData = await modsResponse.json() as { data: Array<{ user_login: string }> };
      moderators.push(...(modsData.data || []).map(m => m.user_login.toLowerCase()));
    }

    if (vipsResponse.ok) {
      const vipsData = await vipsResponse.json() as { data: Array<{ user_login: string }> };
      vips.push(...(vipsData.data || []).map(v => v.user_login.toLowerCase()));
    }

    // Cache roles
    await env.SLOTS_KV.put('twitch:channel_roles', JSON.stringify({
      moderators,
      vips
    }), {
      expirationTtl: ROLES_CACHE_TTL
    });

    return {
      moderators: new Set(moderators),
      vips: new Set(vips)
    };
  } catch (error) {
    logError('getChannelRoles', error);
    return { moderators: new Set(), vips: new Set() };
  }
}

/**
 * Get user's role in channel
 * Returns: 'broadcaster', 'moderator', 'vip', or null
 */
async function getUserRole(username: string, env: Env): Promise<string | null> {
  const lowerUsername = username.toLowerCase();

  // Check if broadcaster
  if (lowerUsername === BROADCASTER_LOGIN) {
    return 'broadcaster';
  }

  const roles = await getChannelRoles(env);

  if (roles.moderators.has(lowerUsername)) {
    return 'moderator';
  }

  if (roles.vips.has(lowerUsername)) {
    return 'vip';
  }

  return null;
}

/**
 * Get full Twitch profile data (avatar + role)
 * This is the main function to call from profile pages
 */
async function getTwitchProfileData(username: string, env: Env): Promise<TwitchProfileData> {
  try {
    // Fetch user data and role in parallel
    const [user, role] = await Promise.all([
      getTwitchUser(username, env),
      getUserRole(username, env)
    ]);

    return {
      avatar: user?.avatar || null,
      displayName: user?.displayName || username,
      role: role
    };
  } catch (error) {
    logError('getTwitchProfileData', error, { username });
    return {
      avatar: null,
      displayName: username,
      role: null
    };
  }
}

/**
 * Handle OAuth callback from Twitch
 * This is called when the broadcaster authorizes the app
 */
async function handleOAuthCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  if (error) {
    return new Response(`Authorization failed: ${error}`, { status: 400 });
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  // Validate state parameter (CSRF protection)
  if (!state) {
    return new Response('Missing state parameter', { status: 400 });
  }

  const stateKey = `oauth_state:broadcaster:${state}`;
  const storedState = await env.SLOTS_KV.get(stateKey);
  if (!storedState) {
    return new Response('Invalid or expired state parameter', { status: 400 });
  }

  // Delete used state (one-time use)
  await env.SLOTS_KV.delete(stateKey);

  try {
    // Exchange code for tokens
    const response = await fetch(TWITCH_OAUTH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID!,
        client_secret: env.TWITCH_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/auth/callback`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as TwitchTokenResponse;

    // Store broadcaster tokens
    await env.SLOTS_KV.put('twitch:broadcaster_token', JSON.stringify({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    }));

    // Clear cached roles so they're fetched fresh
    await env.SLOTS_KV.delete('twitch:channel_roles');

    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Autorisierung erfolgreich</title>
        <style>
          body { font-family: system-ui; background: #1a1a2e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .container { text-align: center; padding: 40px; }
          h1 { color: #FFD700; }
          a { color: #00D9FF; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🦡 Autorisierung erfolgreich!</h1>
          <p>Dachsbau Slots kann jetzt Moderator- und VIP-Rollen anzeigen.</p>
          <p><a href="/?page=home">Zurück zur Website</a></p>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    logError('handleOAuthCallback', error);
    return new Response(`Authorization failed: ${(error as Error).message}`, { status: 500 });
  }
}

/**
 * Generate a cryptographically secure state parameter for OAuth
 */
function generateOAuthState(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate OAuth authorization URL with CSRF protection
 */
async function getAuthorizationUrl(env: Env, origin: string): Promise<string> {
  const state = generateOAuthState();

  // Store state in KV with short TTL (10 minutes)
  await env.SLOTS_KV.put(`oauth_state:broadcaster:${state}`, 'valid', { expirationTtl: OAUTH_STATE_TTL_SECONDS });

  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID!,
    redirect_uri: `${origin}/auth/callback`,
    response_type: 'code',
    scope: 'moderation:read channel:read:vips user:write:chat channel:bot',
    state
  });

  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

// ==================== USER AUTHENTICATION ====================

/**
 * Base64URL encode (JWT-safe)
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

/**
 * Create JWT session token
 */
async function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>, env: Env): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const claims: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(claims));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Sign with HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.JWT_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(unsigned)
  );

  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${unsigned}.${signatureB64}`;
}

/**
 * Verify and decode session token
 */
async function verifySessionToken(token: string, env: Env): Promise<LoggedInUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const unsigned = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.JWT_SECRET!),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Uint8Array.from(base64UrlDecode(signatureB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(unsigned)
    );

    if (!valid) return null;

    // Decode and check expiration
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as SessionPayload;
    if (payload.exp! < Math.floor(Date.now() / 1000)) return null;

    return {
      twitchId: payload.twitchId,
      username: payload.username,
      displayName: payload.displayName,
      avatar: payload.avatar
    };
  } catch (error) {
    logError('verifySessionToken', error);
    return null;
  }
}

/**
 * Get user from request cookie
 */
async function getUserFromRequest(request: Request, env: Env): Promise<LoggedInUser | null> {
  try {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...val] = c.trim().split('=');
        return [key, val.join('=')];
      })
    );

    const token = cookies[USER_SESSION_COOKIE];
    if (!token) return null;

    return await verifySessionToken(token, env);
  } catch (error) {
    logError('getUserFromRequest', error);
    return null;
  }
}

/**
 * Generate user login URL with CSRF protection
 */
async function getUserLoginUrl(env: Env, origin: string): Promise<string> {
  const state = generateOAuthState();

  // Store state in KV with short TTL (10 minutes)
  await env.SLOTS_KV.put(`oauth_state:user:${state}`, 'valid', { expirationTtl: OAUTH_STATE_TTL_SECONDS });

  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID!,
    redirect_uri: `${origin}/auth/user/callback`,
    response_type: 'code',
    scope: '', // No special scopes needed for basic user info
    state
  });

  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

/**
 * Handle user OAuth callback
 */
async function handleUserOAuthCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  if (error) {
    // User cancelled or error occurred
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/?page=home`
      }
    });
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  // Validate state parameter (CSRF protection)
  if (!state) {
    return new Response('Missing state parameter', { status: 400 });
  }

  const stateKey = `oauth_state:user:${state}`;
  const storedState = await env.SLOTS_KV.get(stateKey);
  if (!storedState) {
    return new Response('Invalid or expired state parameter', { status: 400 });
  }

  // Delete used state (one-time use)
  await env.SLOTS_KV.delete(stateKey);

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(TWITCH_OAUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID!,
        client_secret: env.TWITCH_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/auth/user/callback`
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json() as TwitchTokenResponse;

    // Get user info from Twitch
    const userResponse = await fetch(`${TWITCH_API}/users`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Client-Id': env.TWITCH_CLIENT_ID!
      }
    });

    if (!userResponse.ok) {
      throw new Error(`User fetch failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json() as TwitchUserResponse;
    if (!userData.data || userData.data.length === 0) {
      throw new Error('No user data returned');
    }

    const user = userData.data[0];

    // Create JWT session
    const session = await createSessionToken({
      twitchId: user.id,
      username: user.login,
      displayName: user.display_name,
      avatar: user.profile_image_url
    }, env);

    // Redirect to home with session cookie
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/?page=home`,
        'Set-Cookie': `${USER_SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
      }
    });
  } catch (error) {
    logError('handleUserOAuthCallback', error);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/?page=home`
      }
    });
  }
}

/**
 * Create logout response (clears cookie)
 */
function createLogoutResponse(origin: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${origin}/?page=home`,
      'Set-Cookie': `${USER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    }
  });
}

// ==================== BOT ACCOUNT ====================

/**
 * Get bot access token (for sending chat messages as bot)
 * The bot account must have authorized the app via /auth/bot
 */
async function getBotToken(env: Env): Promise<string | null> {
  try {
    const tokenData = await env.SLOTS_KV.get('twitch:bot_token', { type: 'json' }) as { accessToken: string; refreshToken: string; expiresAt: number } | null;
    if (!tokenData) {
      return null;
    }

    // Check if token is expired or expiring soon
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt - TOKEN_REFRESH_THRESHOLD_MS) {
      return await refreshBotToken(tokenData.refreshToken, env);
    }

    return tokenData.accessToken;
  } catch (error) {
    logError('getBotToken', error);
    return null;
  }
}

/**
 * Refresh bot token
 */
async function refreshBotToken(refreshToken: string, env: Env): Promise<string | null> {
  try {
    const response = await fetch(TWITCH_OAUTH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID!,
        client_secret: env.TWITCH_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Bot token refresh failed: ${response.status}`);
    }

    const data = await response.json() as TwitchTokenResponse;

    await env.SLOTS_KV.put('twitch:bot_token', JSON.stringify({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    }));

    return data.access_token;
  } catch (error) {
    logError('refreshBotToken', error);
    return null;
  }
}

/**
 * Get bot user ID (cached)
 */
async function getBotId(env: Env): Promise<string | null> {
  try {
    const cached = await env.SLOTS_KV.get('twitch:bot_id');
    if (cached) return cached;
    return null; // Set during bot OAuth callback
  } catch (error) {
    logError('getBotId', error);
    return null;
  }
}

/**
 * Generate OAuth authorization URL for bot account
 */
async function getBotAuthorizationUrl(env: Env, origin: string): Promise<string> {
  const state = generateOAuthState();

  await env.SLOTS_KV.put(`oauth_state:bot:${state}`, 'valid', { expirationTtl: OAUTH_STATE_TTL_SECONDS });

  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID!,
    redirect_uri: `${origin}/auth/bot/callback`,
    response_type: 'code',
    scope: 'user:write:chat',
    state
  });

  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

/**
 * Handle bot OAuth callback
 * Stores bot token and user ID
 */
async function handleBotOAuthCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  if (error) {
    return new Response(`Bot-Autorisierung fehlgeschlagen: ${error}`, { status: 400 });
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  if (!state) {
    return new Response('Missing state parameter', { status: 400 });
  }

  const stateKey = `oauth_state:bot:${state}`;
  const storedState = await env.SLOTS_KV.get(stateKey);
  if (!storedState) {
    return new Response('Invalid or expired state parameter', { status: 400 });
  }

  await env.SLOTS_KV.delete(stateKey);

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(TWITCH_OAUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID!,
        client_secret: env.TWITCH_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/auth/bot/callback`
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokens = await tokenResponse.json() as TwitchTokenResponse;

    // Get bot user info to store the bot's user ID
    const userResponse = await fetch(`${TWITCH_API}/users`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Client-Id': env.TWITCH_CLIENT_ID!
      }
    });

    if (!userResponse.ok) {
      throw new Error(`Bot user fetch failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json() as TwitchUserResponse;
    if (!userData.data || userData.data.length === 0) {
      throw new Error('No bot user data returned');
    }

    const botUser = userData.data[0];

    // Store bot token and ID
    await Promise.all([
      env.SLOTS_KV.put('twitch:bot_token', JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000)
      })),
      env.SLOTS_KV.put('twitch:bot_id', botUser.id),
      env.SLOTS_KV.put('twitch:bot_login', botUser.login)
    ]);

    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bot-Autorisierung erfolgreich</title>
        <style>
          body { font-family: system-ui; background: #1a1a2e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .container { text-align: center; padding: 40px; }
          h1 { color: #FFD700; }
          a { color: #00D9FF; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 Bot-Autorisierung erfolgreich!</h1>
          <p>Bot-Account <strong>${botUser.display_name}</strong> (${botUser.login}) ist jetzt autorisiert.</p>
          <p>Duel-Timeout-Nachrichten werden als <strong>${botUser.display_name}</strong> gesendet.</p>
          <p><a href="/?page=home">Zurück zur Website</a></p>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    logError('handleBotOAuthCallback', error);
    return new Response(`Bot-Autorisierung fehlgeschlagen: ${(error as Error).message}`, { status: 500 });
  }
}

/**
 * Send a chat message to the broadcaster's channel via Twitch Helix API.
 * Uses bot token if available (message appears from bot), falls back to broadcaster token.
 * Requires user:write:chat scope on the sending account.
 */
async function sendChatMessage(message: string, env: Env): Promise<boolean> {
  try {
    const broadcasterId = await getBroadcasterId(env);
    if (!broadcasterId) {
      logError('sendChatMessage', new Error('Missing broadcaster ID'));
      return false;
    }

    // Try bot token first (message appears from bot account)
    const [botToken, botId] = await Promise.all([
      getBotToken(env),
      getBotId(env)
    ]);

    let senderToken: string | null = botToken;
    let senderId: string = botId || broadcasterId;

    // Fall back to broadcaster token if no bot token
    if (!senderToken || !botId) {
      senderToken = await getBroadcasterToken(env);
      senderId = broadcasterId;
    }

    if (!senderToken) {
      logError('sendChatMessage', new Error('No bot or broadcaster token available'));
      return false;
    }

    const response = await fetch(`${TWITCH_API}/chat/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${senderToken}`,
        'Client-Id': env.TWITCH_CLIENT_ID!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        broadcaster_id: broadcasterId,
        sender_id: senderId,
        message
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError('sendChatMessage', new Error(`Twitch API ${response.status}: ${errorText}`));
      return false;
    }

    return true;
  } catch (error) {
    logError('sendChatMessage', error);
    return false;
  }
}

// ==================== EVENTSUB ====================

interface EventSubSubscription {
  id: string;
  type: string;
  status: string;
  condition: Record<string, string>;
  transport: { method: string; callback: string };
}

/**
 * List existing EventSub subscriptions for this app
 */
async function listEventSubSubscriptions(env: Env): Promise<EventSubSubscription[]> {
  const appToken = await getAppAccessToken(env);
  if (!appToken) {
    throw new Error('Failed to get app access token');
  }

  const response = await fetch(`${TWITCH_API}/eventsub/subscriptions`, {
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Client-Id': env.TWITCH_CLIENT_ID!
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`List subscriptions failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { data: EventSubSubscription[] };
  return data.data;
}

/**
 * Create EventSub subscription for channel.chat.message
 * Required for bot badge: bot must listen for chat messages via webhook
 */
async function createEventSubSubscription(env: Env, origin: string): Promise<EventSubSubscription | null> {
  const [appToken, broadcasterId, botId] = await Promise.all([
    getAppAccessToken(env),
    getBroadcasterId(env),
    getBotId(env)
  ]);

  if (!appToken) throw new Error('Failed to get app access token');
  if (!broadcasterId) throw new Error('Broadcaster ID not found — authorize via /auth/broadcaster first');
  if (!botId) throw new Error('Bot ID not found — authorize via /auth/bot first');
  if (!env.EVENTSUB_SECRET) throw new Error('EVENTSUB_SECRET not configured');

  const response = await fetch(`${TWITCH_API}/eventsub/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Client-Id': env.TWITCH_CLIENT_ID!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'channel.chat.message',
      version: '1',
      condition: {
        broadcaster_user_id: broadcasterId,
        user_id: botId
      },
      transport: {
        method: 'webhook',
        callback: `${origin}/eventsub`,
        secret: env.EVENTSUB_SECRET
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create subscription failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { data: EventSubSubscription[] };
  return data.data[0] || null;
}

export {
  getTwitchUser,
  getUserRole,
  getChannelRoles,
  getTwitchProfileData,
  handleOAuthCallback,
  getAuthorizationUrl,
  sendChatMessage,
  // User authentication
  getUserFromRequest,
  getUserLoginUrl,
  handleUserOAuthCallback,
  createLogoutResponse,
  // Bot authentication
  getBotAuthorizationUrl,
  handleBotOAuthCallback,
  // EventSub
  listEventSubSubscriptions,
  createEventSubSubscription
};
