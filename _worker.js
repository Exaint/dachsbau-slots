import { RESPONSE_HEADERS, URLS, KV_TRUE } from './constants.js';
import { sanitizeUsername, isAdmin, getAdminList, logError } from './utils.js';
import { isBlacklisted, setSelfBan, hasAcceptedDisclaimer, setDisclaimerAccepted, getBalance } from './database.js';

// Web pages and API
import { handleWebPage } from './web/pages.js';
import { handleApi } from './web/api.js';
import { serveLogoPng } from './web/assets.js';
import { handleOAuthCallback, getUserFromRequest, getUserLoginUrl, handleUserOAuthCallback, createLogoutResponse } from './web/twitch.js';

// User commands
import {
  handleBalance,
  handleStats,
  handleDaily,
  handleBuffs,
  handleBank,
  handleTransfer,
  handleLeaderboard
} from './commands/user.js';

// Admin commands
import {
  handleGive,
  handleBan,
  handleUnban,
  handleReset,
  handleFreeze,
  handleUnfreeze,
  handleSetBalance,
  handleBankSet,
  handleBankReset,
  handleGiveBuff,
  handleRemoveBuff,
  handleClearAllBuffs,
  handleGetStats,
  handleGetDaily,
  handleResetDaily,
  handleMaintenance,
  handleWipe,
  handleRemoveFromLB,
  handleGiveFreespins,
  handleGiveInsurance,
  handleGetMonthlyLogin,
  handleResetWeeklyLimits,
  handleGiveWinMulti
} from './commands/admin.js';

// Slots commands
import { handleSlot } from './commands/slots.js';

// Shop commands
import { handleShop } from './commands/shop.js';

// Duel commands
import { handleDuel, handleDuelAccept, handleDuelDecline, handleDuelOpt } from './commands/duel.js';

// OPTIMIZED: Static command maps at module level (avoid recreation per request)
const LEADERBOARD_ALIASES = new Set(['lb', 'leaderboard', 'rank', 'ranking']);
const BALANCE_ALIASES = new Set(['balance', 'konto']);
const INFO_ALIASES = new Set(['info', 'help', 'commands']);
const WEBSITE_ALIASES = new Set(['website', 'site', 'seite']);
const ACHIEVEMENTS_ALIASES = new Set(['erfolge', 'achievements']);

// OPTIMIZED: Commands that don't need security checks (read-only info commands)
const SAFE_COMMANDS = new Set(['stats', 'buffs', 'bank', ...LEADERBOARD_ALIASES, ...BALANCE_ALIASES, ...INFO_ALIASES, ...WEBSITE_ALIASES, ...ACHIEVEMENTS_ALIASES]);

// Admin commands that take (username, target, env)
const ADMIN_COMMANDS_TARGET = {
  ban: handleBan,
  unban: handleUnban,
  reset: handleReset,
  freeze: handleFreeze,
  unfreeze: handleUnfreeze,
  clearallbuffs: handleClearAllBuffs,
  getstats: handleGetStats,
  getdaily: handleGetDaily,
  resetdaily: handleResetDaily,
  wipe: handleWipe,
  removefromlb: handleRemoveFromLB
};

// Admin commands that take (username, target, amount, env)
const ADMIN_COMMANDS_AMOUNT = {
  give: handleGive,
  setbalance: handleSetBalance,
  givebuff: handleGiveBuff,
  removebuff: handleRemoveBuff,
  giveinsurance: handleGiveInsurance
};

// Admin commands that take (username, target, env) - target only, no amount
const ADMIN_COMMANDS_TARGET_ONLY = {
  getmonthlylogin: handleGetMonthlyLogin,
  resetweeklylimits: handleResetWeeklyLimits,
  givewinmulti: handleGiveWinMulti
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (!env.SLOTS_KV) {
        return new Response('KV not configured', { headers: RESPONSE_HEADERS });
      }

      // Short URL paths (e.g., /u/username -> profile page)
      const pathname = url.pathname;
      if (pathname.startsWith('/u/')) {
        const username = sanitizeUsername(pathname.slice(3));
        if (username) {
          // Redirect to profile page
          const profileUrl = `${url.origin}/?page=profile&user=${username}`;
          return Response.redirect(profileUrl, 302);
        }
      }
      if (pathname === '/stats' || pathname === '/stats/') {
        return Response.redirect(`${url.origin}/?page=stats`, 302);
      }
      if (pathname === '/lb' || pathname === '/lb/' || pathname === '/leaderboard' || pathname === '/leaderboard/') {
        return Response.redirect(`${url.origin}/?page=leaderboard`, 302);
      }

      // Static assets
      if (pathname === '/assets/logo.png') {
        return serveLogoPng();
      }

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

      // Get logged-in user from cookie (for web pages)
      const loggedInUser = await getUserFromRequest(request, env);

      // Web pages (HTML)
      const page = url.searchParams.get('page');
      if (page) {
        return await handleWebPage(page, url, env, loggedInUser);
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

      // Twitch bot commands (existing logic)
      const action = url.searchParams.get('action') || 'slot';
      const username = url.searchParams.get('user') || 'Spieler';

      const cleanUsername = sanitizeUsername(username);
      if (!cleanUsername) {
        return new Response('Invalid username', { headers: RESPONSE_HEADERS });
      }

      // Handle special slot commands
      if (action === 'slot') {
        const amountParam = url.searchParams.get('amount');

        // Check special commands
        if (amountParam) {
          const lower = amountParam.toLowerCase();

          // OPTIMIZED: Skip security checks for safe read-only commands (saves 3 KV reads)
          if (!SAFE_COMMANDS.has(lower)) {
            // Note: cleanUsername is already lowercase from sanitizeUsername()
            const [blacklisted, isFrozen, maintenanceMode] = await Promise.all([
              isBlacklisted(cleanUsername, env),
              env.SLOTS_KV.get(`frozen:${cleanUsername}`),
              env.SLOTS_KV.get('maintenance_mode')
            ]);

            if (blacklisted) {
              return new Response(`@${cleanUsername} ❌ Du bist vom Slots-Spiel ausgeschlossen.`, { headers: RESPONSE_HEADERS });
            }
            if (isFrozen === KV_TRUE) {
              return new Response(`@${cleanUsername} ❄️ Dein Account ist eingefroren. Kontaktiere einen Admin.`, { headers: RESPONSE_HEADERS });
            }
            if (maintenanceMode === KV_TRUE && !isAdmin(cleanUsername)) {
              return new Response(`@${cleanUsername} 🔧 Wartungsmodus aktiv! Nur Admins können spielen.`, { headers: RESPONSE_HEADERS });
            }
          }

          // Detect !slots buy mistake
          if (lower === 'buy') {
            const itemNumber = url.searchParams.get('target'); // Fossabot passes $(2) as target
            if (itemNumber && !isNaN(parseInt(itemNumber, 10))) {
              return new Response(`@${cleanUsername} ❓ Meintest du !shop buy ${itemNumber}?`, { headers: RESPONSE_HEADERS });
            }
            return new Response(`@${cleanUsername} ❓ Meintest du !shop buy [Nummer]? (z.B. !shop buy 1)`, { headers: RESPONSE_HEADERS });
          }

          // OPTIMIZED: Use static command maps for O(1) lookup
          if (LEADERBOARD_ALIASES.has(lower)) return await handleLeaderboard(env);
          if (BALANCE_ALIASES.has(lower)) return await handleBalance(cleanUsername, env);
          if (INFO_ALIASES.has(lower)) {
            // Check for target parameter (like disclaimer command)
            const targetParam = url.searchParams.get('target');
            let finalTarget = cleanUsername;

            if (targetParam) {
              const cleanTarget = sanitizeUsername(targetParam.replace('@', ''));
              if (cleanTarget) {
                finalTarget = cleanTarget;
              }
            }

            return new Response(`@${finalTarget} ℹ️ Hier findest du alle Commands & Infos zum Dachsbau Slots: ${URLS.INFO}`, { headers: RESPONSE_HEADERS });
          }
          if (WEBSITE_ALIASES.has(lower)) {
            return new Response(`@${cleanUsername} 🦡 Dachsbau Slots Website: ${URLS.WEBSITE}`, { headers: RESPONSE_HEADERS });
          }
          if (ACHIEVEMENTS_ALIASES.has(lower)) {
            const targetParam = url.searchParams.get('target');
            let profileUser = cleanUsername;

            if (targetParam) {
              const cleanTarget = sanitizeUsername(targetParam.replace('@', ''));
              if (cleanTarget) {
                profileUser = cleanTarget;
              }
            }

            return new Response(`@${cleanUsername} 🏆 Erfolge von ${profileUser}: ${URLS.WEBSITE}/u/${profileUser}`, { headers: RESPONSE_HEADERS });
          }
          if (lower === 'daily') return await handleDaily(cleanUsername, env);
          if (lower === 'stats') return await handleStats(cleanUsername, env);
          if (lower === 'buffs') return await handleBuffs(cleanUsername, env);
          if (lower === 'bank') return await handleBank(cleanUsername, env);
          if (lower === 'transfer') return await handleTransfer(cleanUsername, url.searchParams.get('target'), url.searchParams.get('giveamount'), env);

          // Admin commands with target only
          if (ADMIN_COMMANDS_TARGET[lower]) {
            return await ADMIN_COMMANDS_TARGET[lower](cleanUsername, url.searchParams.get('target'), env);
          }

          // Admin commands with target and amount
          if (ADMIN_COMMANDS_AMOUNT[lower]) {
            return await ADMIN_COMMANDS_AMOUNT[lower](cleanUsername, url.searchParams.get('target'), url.searchParams.get('giveamount'), env);
          }

          // Admin commands with target only (no amount)
          if (ADMIN_COMMANDS_TARGET_ONLY[lower]) {
            return await ADMIN_COMMANDS_TARGET_ONLY[lower](cleanUsername, url.searchParams.get('target'), env);
          }

          // Special admin commands with unique signatures
          if (lower === 'bankset') return await handleBankSet(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'bankreset') return await handleBankReset(cleanUsername, env);
          if (lower === 'maintenance') return await handleMaintenance(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'givefreespins') return await handleGiveFreespins(cleanUsername, url.searchParams.get('target'), url.searchParams.get('giveamount'), url.searchParams.get('multiplier'), env);
          if (lower === 'disclaimer') {
            // For disclaimer, check the target parameter (which is $(2) in Fossabot)
            const targetParam = url.searchParams.get('target');
            let finalTarget = cleanUsername;

            if (targetParam) {
              const cleanTarget = sanitizeUsername(targetParam.replace('@', ''));
              if (cleanTarget) {
                finalTarget = cleanTarget;
              }
            }

            return new Response(`@${finalTarget} ⚠️ Dachsbau Slots dient nur zur Unterhaltung! Es werden keine Echtgeld-Beträge eingesetzt oder gewonnen. Hilfsangebote bei Glücksspielproblemen: ${URLS.INFO} 🦡`, { headers: RESPONSE_HEADERS });
          }
          if (lower === 'selfban') {
            await setSelfBan(cleanUsername, env);
            const adminList = getAdminList().join(', ');
            return new Response(`@${cleanUsername} ✅ Du wurdest vom Slots spielen ausgeschlossen. Nur Admins (${adminList}) können dich wieder freischalten. Wenn du Hilfe brauchst: ${URLS.INFO} 🦡`, { headers: RESPONSE_HEADERS });
          }
          if (lower === 'accept') {
            // Accept disclaimer and start playing
            const alreadyAccepted = await hasAcceptedDisclaimer(cleanUsername, env);
            if (alreadyAccepted) {
              return new Response(`@${cleanUsername} ✅ Du hast den Disclaimer bereits akzeptiert! Nutze einfach !slots zum Spielen 🎰`, { headers: RESPONSE_HEADERS });
            }
            // Check if legacy player (has balance before disclaimer system)
            const currentBalance = await getBalance(cleanUsername, env);
            await setDisclaimerAccepted(cleanUsername, env);
            if (currentBalance > 0) {
              return new Response(`@${cleanUsername} ✅ Disclaimer akzeptiert! Dein Kontostand: ${currentBalance} DachsTaler. Viel Spaß beim Spielen! 🦡🎰 Nutze !slots zum Spinnen!`, { headers: RESPONSE_HEADERS });
            }
            return new Response(`@${cleanUsername} ✅ Disclaimer akzeptiert! Du startest mit 100 DachsTaler. Viel Spaß beim Spielen! 🦡🎰 Nutze !slots zum Spinnen!`, { headers: RESPONSE_HEADERS });
          }

          // Duel commands
          if (lower === 'duel') {
            const target = url.searchParams.get('target');
            const amount = url.searchParams.get('giveamount');
            const args = [target, amount].filter(Boolean);
            return new Response(await handleDuel(cleanUsername, args, env), { headers: RESPONSE_HEADERS });
          }
          if (lower === 'duelaccept') {
            return new Response(await handleDuelAccept(cleanUsername, env), { headers: RESPONSE_HEADERS });
          }
          if (lower === 'dueldecline') {
            return new Response(await handleDuelDecline(cleanUsername, env), { headers: RESPONSE_HEADERS });
          }
          if (lower === 'duelopt') {
            const target = url.searchParams.get('target');
            const args = target ? [target] : [];
            return new Response(await handleDuelOpt(cleanUsername, args, env), { headers: RESPONSE_HEADERS });
          }
        }

        return await handleSlot(cleanUsername, amountParam, url, env);
      }

      // Safe read-only actions (no security check needed)
      if (action === 'leaderboard') return await handleLeaderboard(env);
      if (action === 'stats') return await handleStats(cleanUsername, env);
      if (action === 'balance') return await handleBalance(cleanUsername, env);

      // Actions that modify state need security checks
      // Note: cleanUsername is already lowercase from sanitizeUsername()
      const [blacklisted, isFrozen, maintenanceMode] = await Promise.all([
        isBlacklisted(cleanUsername, env),
        env.SLOTS_KV.get(`frozen:${cleanUsername}`),
        env.SLOTS_KV.get('maintenance_mode')
      ]);

      if (blacklisted) {
        return new Response(`@${cleanUsername} ❌ Du bist vom Slots-Spiel ausgeschlossen.`, { headers: RESPONSE_HEADERS });
      }
      if (isFrozen === KV_TRUE) {
        return new Response(`@${cleanUsername} ❄️ Dein Account ist eingefroren. Kontaktiere einen Admin.`, { headers: RESPONSE_HEADERS });
      }
      if (maintenanceMode === KV_TRUE && !isAdmin(cleanUsername)) {
        return new Response(`@${cleanUsername} 🔧 Wartungsmodus aktiv! Nur Admins können spielen.`, { headers: RESPONSE_HEADERS });
      }

      if (action === 'daily') return await handleDaily(cleanUsername, env);
      if (action === 'transfer') return await handleTransfer(cleanUsername, url.searchParams.get('target'), url.searchParams.get('amount'), env);
      if (action === 'shop') return await handleShop(cleanUsername, url.searchParams.get('item'), env);

      return new Response('Invalid action', { headers: RESPONSE_HEADERS });
    } catch (error) {
      logError('Worker', error);
      return new Response('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.', { headers: RESPONSE_HEADERS });
    }
  }
};
