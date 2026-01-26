/**
 * Command Routes - Twitch bot command handling
 */

import { RESPONSE_HEADERS, URLS, KV_TRUE } from '../constants.js';
import { sanitizeUsername, isAdmin, getAdminList } from '../utils.js';
import { isBlacklisted, setSelfBan, hasAcceptedDisclaimer, setDisclaimerAccepted, getBalance } from '../database.js';

// User commands
import {
  handleBalance,
  handleStats,
  handleDaily,
  handleBuffs,
  handleTransfer,
  handleLeaderboard
} from '../commands/user.js';

// Admin commands
import {
  handleGive,
  handleBan,
  handleUnban,
  handleReset,
  handleFreeze,
  handleUnfreeze,
  handleSetBalance,
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
} from '../commands/admin.js';

// Slots commands
import { handleSlot } from '../commands/slots.js';

// Shop commands
import { handleShop } from '../commands/shop.js';

// Duel commands
import { handleDuel, handleDuelAccept, handleDuelDecline, handleDuelOpt } from '../commands/duel.js';

import type { Env } from '../types/index.js';

// Command alias sets (O(1) lookup)
export const LEADERBOARD_ALIASES = new Set(['lb', 'leaderboard', 'rank', 'ranking']);
export const BALANCE_ALIASES = new Set(['balance', 'konto']);
export const INFO_ALIASES = new Set(['info', 'help', 'commands']);
export const WEBSITE_ALIASES = new Set(['website', 'site', 'seite']);
export const ACHIEVEMENTS_ALIASES = new Set(['erfolge', 'achievements']);

// Commands that don't need security checks (read-only info commands)
export const SAFE_COMMANDS = new Set([
  'stats', 'buffs', 'ping',
  ...LEADERBOARD_ALIASES, ...BALANCE_ALIASES, ...INFO_ALIASES,
  ...WEBSITE_ALIASES, ...ACHIEVEMENTS_ALIASES
]);

// Admin commands that take (username, target, env)
const ADMIN_COMMANDS_TARGET: Record<string, (username: string, target: string, env: Env) => Promise<Response>> = {
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
const ADMIN_COMMANDS_AMOUNT: Record<string, (username: string, target: string, amount: string, env: Env) => Promise<Response>> = {
  give: handleGive,
  setbalance: handleSetBalance,
  givebuff: handleGiveBuff,
  removebuff: handleRemoveBuff,
  giveinsurance: handleGiveInsurance
};

// Admin commands that take (username, target, env) - target only, no amount
const ADMIN_COMMANDS_TARGET_ONLY: Record<string, (username: string, target: string, env: Env) => Promise<Response>> = {
  getmonthlylogin: handleGetMonthlyLogin,
  resetweeklylimits: handleResetWeeklyLimits,
  givewinmulti: handleGiveWinMulti
};

/**
 * Check security constraints (blacklist, frozen, maintenance)
 */
export async function checkSecurityConstraints(username: string, env: Env): Promise<Response | null> {
  const [blacklisted, isFrozen, maintenanceMode] = await Promise.all([
    isBlacklisted(username, env),
    env.SLOTS_KV.get(`frozen:${username}`),
    env.SLOTS_KV.get('maintenance_mode')
  ]);

  if (blacklisted) {
    return new Response(`@${username} ❌ Du bist vom Slots-Spiel ausgeschlossen.`, { headers: RESPONSE_HEADERS });
  }
  if (isFrozen === KV_TRUE) {
    return new Response(`@${username} ❄️ Dein Account ist eingefroren. Kontaktiere einen Admin.`, { headers: RESPONSE_HEADERS });
  }
  if (maintenanceMode === KV_TRUE && !isAdmin(username)) {
    return new Response(`@${username} 🔧 Wartungsmodus aktiv! Nur Admins können spielen.`, { headers: RESPONSE_HEADERS });
  }

  return null;
}

/**
 * Handle slot subcommands (amount parameter variations)
 */
export async function handleSlotSubcommands(cleanUsername: string, lower: string, url: URL, env: Env): Promise<Response | null> {
  // Detect !slots buy mistake
  if (lower === 'buy') {
    const itemNumber = url.searchParams.get('target');
    if (itemNumber && !isNaN(parseInt(itemNumber, 10))) {
      return new Response(`@${cleanUsername} ❓ Meintest du !shop buy ${itemNumber}?`, { headers: RESPONSE_HEADERS });
    }
    return new Response(`@${cleanUsername} ❓ Meintest du !shop buy [Nummer]? (z.B. !shop buy 1)`, { headers: RESPONSE_HEADERS });
  }

  // Admin: response time test (KV + D1)
  if (lower === 'ping' && isAdmin(cleanUsername)) {
    const start = Date.now();
    await env.SLOTS_KV.get(`balance:${cleanUsername}`);
    const kvTime = Date.now() - start;
    let d1Time: string = '-';
    if (env.DB) {
      const d1Start = Date.now();
      await env.DB.prepare('SELECT 1').first();
      d1Time = `${Date.now() - d1Start}ms`;
    }
    return new Response(`@${cleanUsername} pong! KV: ${kvTime}ms | D1: ${d1Time} | Total: ${Date.now() - start}ms`, { headers: RESPONSE_HEADERS });
  }

  // Read-only info commands
  if (LEADERBOARD_ALIASES.has(lower)) return await handleLeaderboard(env);
  if (BALANCE_ALIASES.has(lower)) return await handleBalance(cleanUsername, env);

  if (INFO_ALIASES.has(lower)) {
    const targetParam = url.searchParams.get('target');
    let finalTarget = cleanUsername;
    if (targetParam) {
      const cleanTarget = sanitizeUsername(targetParam.replace('@', ''));
      if (cleanTarget) finalTarget = cleanTarget;
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
      if (cleanTarget) profileUser = cleanTarget;
    }
    return new Response(`@${cleanUsername} 🏆 Erfolge von ${profileUser}: ${URLS.WEBSITE}/u/${profileUser}`, { headers: RESPONSE_HEADERS });
  }

  // User commands
  if (lower === 'daily') return await handleDaily(cleanUsername, env);
  if (lower === 'stats') return await handleStats(cleanUsername, env);
  if (lower === 'buffs') return await handleBuffs(cleanUsername, env);
  if (lower === 'transfer') return await handleTransfer(cleanUsername, url.searchParams.get('target') || '', url.searchParams.get('giveamount') || '', env);

  // Admin commands with target only
  if (ADMIN_COMMANDS_TARGET[lower]) {
    return await ADMIN_COMMANDS_TARGET[lower](cleanUsername, url.searchParams.get('target') || '', env);
  }

  // Admin commands with target and amount
  if (ADMIN_COMMANDS_AMOUNT[lower]) {
    return await ADMIN_COMMANDS_AMOUNT[lower](cleanUsername, url.searchParams.get('target') || '', url.searchParams.get('giveamount') || '', env);
  }

  // Admin commands with target only (no amount)
  if (ADMIN_COMMANDS_TARGET_ONLY[lower]) {
    return await ADMIN_COMMANDS_TARGET_ONLY[lower](cleanUsername, url.searchParams.get('target') || '', env);
  }

  // Special admin commands with unique signatures
  if (lower === 'maintenance') return await handleMaintenance(cleanUsername, url.searchParams.get('target') || '', env);
  // Fossabot: target=$(2), giveamount=$(3)=count, multiplier=$(4) - add &multiplier=$(4) to Fossabot URL!
  if (lower === 'givefreespins') return await handleGiveFreespins(cleanUsername, url.searchParams.get('target') || '', url.searchParams.get('giveamount') || '', url.searchParams.get('multiplier') || '', env);

  // Disclaimer command
  if (lower === 'disclaimer') {
    const targetParam = url.searchParams.get('target');
    let finalTarget = cleanUsername;
    if (targetParam) {
      const cleanTarget = sanitizeUsername(targetParam.replace('@', ''));
      if (cleanTarget) finalTarget = cleanTarget;
    }
    return new Response(`@${finalTarget} ⚠️ Dachsbau Slots dient nur zur Unterhaltung! Es werden keine Echtgeld-Beträge eingesetzt oder gewonnen. Hilfsangebote bei Glücksspielproblemen: ${URLS.INFO} 🦡`, { headers: RESPONSE_HEADERS });
  }

  // Self-ban
  if (lower === 'selfban') {
    await setSelfBan(cleanUsername, env);
    const adminList = getAdminList().join(', ');
    return new Response(`@${cleanUsername} ✅ Du wurdest vom Slots spielen ausgeschlossen. Nur Admins (${adminList}) können dich wieder freischalten. Wenn du Hilfe brauchst: ${URLS.INFO} 🦡`, { headers: RESPONSE_HEADERS });
  }

  // Accept disclaimer
  if (lower === 'accept') {
    const alreadyAccepted = await hasAcceptedDisclaimer(cleanUsername, env);
    if (alreadyAccepted) {
      return new Response(`@${cleanUsername} ✅ Du hast den Disclaimer bereits akzeptiert! Nutze einfach !slots zum Spielen 🎰`, { headers: RESPONSE_HEADERS });
    }
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
    const args = [target, amount].filter(Boolean) as string[];
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

  return null; // Not a subcommand, continue to regular slot
}

/**
 * Handle the main slot action
 */
export async function handleSlotAction(cleanUsername: string, amountParam: string | null, url: URL, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const lower = amountParam?.toLowerCase() ?? null;

  // Security checks for all state-modifying actions (including default spin without amount)
  if (!lower || !SAFE_COMMANDS.has(lower)) {
    const securityError = await checkSecurityConstraints(cleanUsername, env);
    if (securityError) return securityError;
  }

  if (lower) {
    // Try subcommands first
    const subcommandResponse = await handleSlotSubcommands(cleanUsername, lower, url, env);
    if (subcommandResponse) return subcommandResponse;
  }

  return await handleSlot(cleanUsername, amountParam ?? undefined, url, env, ctx);
}

/**
 * Handle legacy action-based commands
 */
export async function handleLegacyActions(action: string, cleanUsername: string, url: URL, env: Env): Promise<Response | null> {
  // Safe read-only actions (no security check needed)
  if (action === 'leaderboard') return await handleLeaderboard(env);
  if (action === 'stats') return await handleStats(cleanUsername, env);
  if (action === 'balance') return await handleBalance(cleanUsername, env);

  // Actions that modify state need security checks
  const securityError = await checkSecurityConstraints(cleanUsername, env);
  if (securityError) return securityError;

  if (action === 'daily') return await handleDaily(cleanUsername, env);
  if (action === 'transfer') return await handleTransfer(cleanUsername, url.searchParams.get('target') || '', url.searchParams.get('amount') || '', env);
  if (action === 'shop') return await handleShop(cleanUsername, url.searchParams.get('item') || '', env);

  return null;
}
