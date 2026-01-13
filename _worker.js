import { RESPONSE_HEADERS, URLS } from './constants.js';
import { sanitizeUsername, isAdmin } from './utils.js';
import { isBlacklisted, setSelfBan } from './database.js';

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
  handleRemoveFromLB
} from './commands/admin.js';

// Slots commands
import { handleSlot } from './commands/slots.js';

// Shop commands
import { handleShop } from './commands/shop.js';

// OPTIMIZED: Static command maps at module level (avoid recreation per request)
const LEADERBOARD_ALIASES = new Set(['lb', 'leaderboard', 'rank', 'ranking']);
const BALANCE_ALIASES = new Set(['balance', 'konto']);
const INFO_ALIASES = new Set(['info', 'help', 'commands']);

// OPTIMIZED: Commands that don't need security checks (read-only info commands)
const SAFE_COMMANDS = new Set(['stats', 'buffs', 'bank', ...LEADERBOARD_ALIASES, ...BALANCE_ALIASES, ...INFO_ALIASES]);

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
  removebuff: handleRemoveBuff
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'slot';
      const username = url.searchParams.get('user') || 'Spieler';

      if (!env.SLOTS_KV) {
        return new Response('KV not configured', { headers: RESPONSE_HEADERS });
      }

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
            const [blacklisted, isFrozen, maintenanceMode] = await Promise.all([
              isBlacklisted(cleanUsername, env),
              env.SLOTS_KV.get(`frozen:${cleanUsername.toLowerCase()}`),
              env.SLOTS_KV.get('maintenance_mode')
            ]);

            if (blacklisted) {
              return new Response(`@${cleanUsername} ❌ Du bist vom Slots-Spiel ausgeschlossen.`, { headers: RESPONSE_HEADERS });
            }
            if (isFrozen === 'true') {
              return new Response(`@${cleanUsername} ❄️ Dein Account ist eingefroren. Kontaktiere einen Admin.`, { headers: RESPONSE_HEADERS });
            }
            if (maintenanceMode === 'true' && !isAdmin(cleanUsername)) {
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
          if (INFO_ALIASES.has(lower)) return new Response(`@${cleanUsername} ℹ️ Hier findest du alle Commands & Infos zum Dachsbau Slots: ${URLS.INFO}`, { headers: RESPONSE_HEADERS });
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

          // Special admin commands with unique signatures
          if (lower === 'bankset') return await handleBankSet(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'bankreset') return await handleBankReset(cleanUsername, env);
          if (lower === 'maintenance') return await handleMaintenance(cleanUsername, url.searchParams.get('target'), env);
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
            return new Response(`@${cleanUsername} ✅ Du wurdest vom Slots spielen ausgeschlossen. Nur Admins (exaint_, frechhdachs) können dich wieder freischalten. Wenn du Hilfe brauchst: ${URLS.INFO} 🦡`, { headers: RESPONSE_HEADERS });
          }
        }

        return await handleSlot(cleanUsername, amountParam, url, env);
      }

      // Safe read-only actions (no security check needed)
      if (action === 'leaderboard') return await handleLeaderboard(env);
      if (action === 'stats') return await handleStats(cleanUsername, env);
      if (action === 'balance') return await handleBalance(cleanUsername, env);

      // Actions that modify state need security checks
      const [blacklisted, isFrozen, maintenanceMode] = await Promise.all([
        isBlacklisted(cleanUsername, env),
        env.SLOTS_KV.get(`frozen:${cleanUsername.toLowerCase()}`),
        env.SLOTS_KV.get('maintenance_mode')
      ]);

      if (blacklisted) {
        return new Response(`@${cleanUsername} ❌ Du bist vom Slots-Spiel ausgeschlossen.`, { headers: RESPONSE_HEADERS });
      }
      if (isFrozen === 'true') {
        return new Response(`@${cleanUsername} ❄️ Dein Account ist eingefroren. Kontaktiere einen Admin.`, { headers: RESPONSE_HEADERS });
      }
      if (maintenanceMode === 'true' && !isAdmin(cleanUsername)) {
        return new Response(`@${cleanUsername} 🔧 Wartungsmodus aktiv! Nur Admins können spielen.`, { headers: RESPONSE_HEADERS });
      }

      if (action === 'daily') return await handleDaily(cleanUsername, env);
      if (action === 'transfer') return await handleTransfer(cleanUsername, url.searchParams.get('target'), url.searchParams.get('amount'), env);
      if (action === 'shop') return await handleShop(cleanUsername, url.searchParams.get('item'), env);

      return new Response('Invalid action', { headers: RESPONSE_HEADERS });
    } catch (error) {
      console.error('Worker Error:', error);
      return new Response('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.', { headers: RESPONSE_HEADERS });
    }
  }
};
