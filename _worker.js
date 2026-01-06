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

      if (action !== 'leaderboard') {
        if (await isBlacklisted(cleanUsername, env)) {
          return new Response(`@${cleanUsername} ❌ Du bist vom Slots-Spiel ausgeschlossen.`, { headers: RESPONSE_HEADERS });
        }

        // Check if user is frozen
        const isFrozen = await env.SLOTS_KV.get(`frozen:${cleanUsername.toLowerCase()}`);
        if (isFrozen === 'true') {
          return new Response(`@${cleanUsername} ❄️ Dein Account ist eingefroren. Kontaktiere einen Admin.`, { headers: RESPONSE_HEADERS });
        }

        // Check maintenance mode (only for non-admins)
        const maintenanceMode = await env.SLOTS_KV.get('maintenance_mode');
        if (maintenanceMode === 'true' && !isAdmin(cleanUsername)) {
          return new Response(`@${cleanUsername} 🔧 Wartungsmodus aktiv! Nur Admins können spielen.`, { headers: RESPONSE_HEADERS });
        }
      }

      // Handle special slot commands
      if (action === 'slot') {
        const amountParam = url.searchParams.get('amount');

        // Check special commands
        if (amountParam) {
          const lower = amountParam.toLowerCase();

          // Detect !slots buy mistake
          if (lower === 'buy') {
            const itemNumber = url.searchParams.get('target'); // Fossabot passes $(2) as target
            if (itemNumber && !isNaN(parseInt(itemNumber, 10))) {
              return new Response(`@${cleanUsername} ❓ Meintest du !shop buy ${itemNumber}?`, { headers: RESPONSE_HEADERS });
            }
            return new Response(`@${cleanUsername} ❓ Meintest du !shop buy [Nummer]? (z.B. !shop buy 1)`, { headers: RESPONSE_HEADERS });
          }

          // Special commands map for O(1) lookup
          const specialCommands = {
            lb: () => handleLeaderboard(env),
            leaderboard: () => handleLeaderboard(env),
            rank: () => handleLeaderboard(env),
            ranking: () => handleLeaderboard(env),
            balance: () => handleBalance(cleanUsername, env),
            konto: () => handleBalance(cleanUsername, env),
            daily: () => handleDaily(cleanUsername, env),
            info: () => new Response(`@${cleanUsername} ℹ️ Hier findest du alle Commands & Infos zum Dachsbau Slots: ${URLS.INFO}`, { headers: RESPONSE_HEADERS }),
            help: () => new Response(`@${cleanUsername} ℹ️ Hier findest du alle Commands & Infos zum Dachsbau Slots: ${URLS.INFO}`, { headers: RESPONSE_HEADERS }),
            commands: () => new Response(`@${cleanUsername} ℹ️ Hier findest du alle Commands & Infos zum Dachsbau Slots: ${URLS.INFO}`, { headers: RESPONSE_HEADERS }),
            stats: () => handleStats(cleanUsername, env),
            buffs: () => handleBuffs(cleanUsername, env),
            bank: () => handleBank(cleanUsername, env)
          };

          if (specialCommands[lower]) return await specialCommands[lower]();
          if (lower === 'give') return await handleGive(cleanUsername, url.searchParams.get('target'), url.searchParams.get('giveamount'), env);
          if (lower === 'ban') return await handleBan(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'unban') return await handleUnban(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'reset') return await handleReset(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'freeze') return await handleFreeze(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'unfreeze') return await handleUnfreeze(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'setbalance') return await handleSetBalance(cleanUsername, url.searchParams.get('target'), url.searchParams.get('giveamount'), env);
          if (lower === 'bankset') return await handleBankSet(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'bankreset') return await handleBankReset(cleanUsername, env);
          if (lower === 'givebuff') return await handleGiveBuff(cleanUsername, url.searchParams.get('target'), url.searchParams.get('giveamount'), env);
          if (lower === 'removebuff') return await handleRemoveBuff(cleanUsername, url.searchParams.get('target'), url.searchParams.get('giveamount'), env);
          if (lower === 'clearallbuffs') return await handleClearAllBuffs(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'getstats') return await handleGetStats(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'getdaily') return await handleGetDaily(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'resetdaily') return await handleResetDaily(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'maintenance') return await handleMaintenance(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'wipe') return await handleWipe(cleanUsername, url.searchParams.get('target'), env);
          if (lower === 'removefromlb') return await handleRemoveFromLB(cleanUsername, url.searchParams.get('target'), env);
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

      if (action === 'daily') return await handleDaily(cleanUsername, env);
      if (action === 'transfer') return await handleTransfer(cleanUsername, url.searchParams.get('target'), url.searchParams.get('amount'), env);
      if (action === 'leaderboard') return await handleLeaderboard(env);
      if (action === 'shop') return await handleShop(cleanUsername, url.searchParams.get('item'), env);
      if (action === 'stats') return await handleStats(cleanUsername, env);
      if (action === 'balance') return await handleBalance(cleanUsername, env);

      return new Response('Invalid action', { headers: RESPONSE_HEADERS });
    } catch (error) {
      console.error('Worker Error:', error);
      return new Response('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.', { headers: RESPONSE_HEADERS });
    }
  }
};
