/**
 * Twitch API Integration
 * Fetches avatars and channel roles (Mod/VIP) with caching
 */

import { logError } from '../utils.js';

// Cache TTLs
const AVATAR_CACHE_TTL = 86400; // 24 hours
const ROLES_CACHE_TTL = 3600;   // 1 hour
const TOKEN_CACHE_TTL = 3600;   // 1 hour (tokens last longer but we refresh early)

// Twitch API endpoints
const TWITCH_API = 'https://api.twitch.tv/helix';
const TWITCH_OAUTH = 'https://id.twitch.tv/oauth2/token';

// Channel to fetch roles from
const BROADCASTER_LOGIN = 'frechhdachs';

/**
 * Get app access token (Client Credentials flow)
 * This token is used for public API calls (avatars, user info)
 */
async function getAppAccessToken(env) {
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
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();
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
async function getBroadcasterToken(env) {
  try {
    const tokenData = await env.SLOTS_KV.get('twitch:broadcaster_token', { type: 'json' });
    if (!tokenData) {
      return null;
    }

    // Check if token is expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt - 300000) {
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
async function refreshBroadcasterToken(refreshToken, env) {
  try {
    const response = await fetch(TWITCH_OAUTH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();

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
async function getTwitchUser(username, env) {
  try {
    // Check cache first
    const cacheKey = `twitch:user:${username.toLowerCase()}`;
    const cached = await env.SLOTS_KV.get(cacheKey, { type: 'json' });
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
        'Client-Id': env.TWITCH_CLIENT_ID
      }
    });

    if (!response.ok) {
      throw new Error(`User fetch failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      return null;
    }

    const user = {
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
async function getBroadcasterId(env) {
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
async function getChannelRoles(env) {
  try {
    // Check cache first
    const cached = await env.SLOTS_KV.get('twitch:channel_roles', { type: 'json' });
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
          'Client-Id': env.TWITCH_CLIENT_ID
        }
      }),
      fetch(`${TWITCH_API}/channels/vips?broadcaster_id=${broadcasterId}&first=100`, {
        headers: {
          'Authorization': `Bearer ${broadcasterToken}`,
          'Client-Id': env.TWITCH_CLIENT_ID
        }
      })
    ]);

    const moderators = [];
    const vips = [];

    if (modsResponse.ok) {
      const modsData = await modsResponse.json();
      moderators.push(...(modsData.data || []).map(m => m.user_login.toLowerCase()));
    }

    if (vipsResponse.ok) {
      const vipsData = await vipsResponse.json();
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
async function getUserRole(username, env) {
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
async function getTwitchProfileData(username, env) {
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
async function handleOAuthCallback(url, env) {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`Authorization failed: ${error}`, { status: 400 });
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  try {
    // Exchange code for tokens
    const response = await fetch(TWITCH_OAUTH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/auth/callback`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

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
    return new Response(`Authorization failed: ${error.message}`, { status: 500 });
  }
}

/**
 * Generate OAuth authorization URL
 */
function getAuthorizationUrl(env, origin) {
  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    redirect_uri: `${origin}/auth/callback`,
    response_type: 'code',
    scope: 'moderation:read channel:read:vips'
  });

  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

export {
  getTwitchUser,
  getUserRole,
  getChannelRoles,
  getTwitchProfileData,
  handleOAuthCallback,
  getAuthorizationUrl
};
