/**
 * User Commands - Balance, stats, daily, buffs, transfer, leaderboard
 */

import {
  RESPONSE_HEADERS,
  MAX_BALANCE,
  MIN_TRANSFER,
  MAX_TRANSFER,
  LEADERBOARD_CACHE_TTL,
  LEADERBOARD_LIMIT,
  LEADERBOARD_BATCH_SIZE,
  LEADERBOARD_MIN_USERS,
  MONTHLY_LOGIN_REWARDS,
  DAILY_AMOUNT,
  DAILY_BOOST_AMOUNT,
  URLS,
  BUFF_SYMBOLS_WITH_NAMES,
  MAX_RETRIES,
  KV_ACTIVE,
  ACHIEVEMENTS
} from '../constants.js';
import { sanitizeUsername, validateAmount, isLeaderboardBlocked, exponentialBackoff, formatTimeRemaining, logError, getCurrentDate, getGermanDateFromTimestamp, getMsUntilGermanMidnight, checkRateLimit } from '../utils.js';
import {
  getBalance,
  setBalance,
  getFreeSpins,
  getStats,
  hasUnlock,
  getLastDaily,
  getMonthlyLogin,
  updateMonthlyLogin,
  markMilestoneClaimed,
  setLastDaily,
  getBuffWithUses,
  getBuffWithStack,
  getInsuranceCount,
  hasGuaranteedPair,
  hasWildCard,
  getPrestigeRank,
  isBuffActive,
  hasAcceptedDisclaimer,
  checkAndUnlockAchievement,
  updateAchievementStat,
  checkBalanceAchievements,
  incrementStat
} from '../database.js';
import type { Env, FreeSpinEntry, MonthlyLoginData } from '../types/index.js';

// ============================================
// Types
// ============================================

interface TimedBuffDef {
  key: string;
  name: string;
  emoji: string;
}

interface SymbolBoostDef {
  boost: string | null;
  symbol: string;
  name: string;
}

// ============================================
// Achievement Tracking
// ============================================

/**
 * Track daily claim achievements (fire-and-forget)
 * Daily achievements are based on monthly login days, not cumulative claims
 */
async function trackDailyAchievements(username: string, monthlyDays: number, env: Env): Promise<void> {
  try {
    const promises: Promise<void>[] = [];

    // FIRST_DAILY
    promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.FIRST_DAILY.id, env));

    // Track dailysClaimed stat
    promises.push(incrementStat(username, 'dailysClaimed', 1, env));

    // DAILY_7/14/21/28 - Check and unlock based on monthly login days
    if (monthlyDays >= 7) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.DAILY_7.id, env));
    }
    if (monthlyDays >= 14) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.DAILY_14.id, env));
    }
    if (monthlyDays >= 20) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.DAILY_20.id, env));
    }

    await Promise.all(promises);
  } catch (error) {
    logError('trackDailyAchievements', error, { username, monthlyDays });
  }
}

/**
 * Track transfer achievements (fire-and-forget)
 */
async function trackTransferAchievements(username: string, amount: number, env: Env): Promise<void> {
  try {
    const promises: Promise<void>[] = [];

    // FIRST_TRANSFER
    promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.FIRST_TRANSFER.id, env));

    // Track totalTransferred for TRANSFER_1000/10000 achievements
    promises.push(updateAchievementStat(username, 'totalTransferred', amount, env));

    // Track transfer count for TRANSFER_COUNT_10/50/100 achievements
    promises.push(updateAchievementStat(username, 'transfersSentCount', 1, env));
    promises.push(incrementStat(username, 'transfersSentCount', 1, env));

    await Promise.all(promises);
  } catch (error) {
    logError('trackTransferAchievements', error, { username, amount });
  }
}

/**
 * Track transfer received stats for receiver (fire-and-forget)
 */
async function trackTransferReceived(username: string, amount: number, env: Env): Promise<void> {
  try {
    await incrementStat(username, 'transfersReceived', amount, env);
  } catch (error) {
    logError('trackTransferReceived', error, { username, amount });
  }
}

// ============================================
// Helpers
// ============================================

// Helper: Get days in current month (German timezone) - cached per month
let _daysInMonthCache = { key: '', days: 0 };
function getDaysInCurrentMonth(): number {
  const now = new Date();
  const germanDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const year = germanDate.getFullYear();
  const month = germanDate.getMonth();
  const cacheKey = `${year}-${month}`;

  // Return cached value if same month
  if (_daysInMonthCache.key === cacheKey) {
    return _daysInMonthCache.days;
  }

  // Calculate and cache
  const days = new Date(year, month + 1, 0).getDate();
  _daysInMonthCache = { key: cacheKey, days };
  return days;
}

// Static: Timed buff definitions (avoid recreation per request)
const TIMED_BUFF_KEYS: TimedBuffDef[] = [
  { key: 'happy_hour', name: 'Happy Hour', emoji: '⚡' },
  { key: 'lucky_charm', name: 'Lucky Charm', emoji: '🍀' },
  { key: 'golden_hour', name: 'Golden Hour', emoji: '✨' },
  { key: 'profit_doubler', name: 'Profit Doubler', emoji: '📈' },
  { key: 'star_magnet', name: 'Star Magnet', emoji: '⭐' },
  { key: 'diamond_rush', name: 'Diamond Rush', emoji: '💎' }
];

// ============================================
// Command Handlers
// ============================================

async function handleBalance(username: string, env: Env): Promise<Response> {
  try {
    const [balance, freeSpins] = await Promise.all([
      getBalance(username, env),
      getFreeSpins(username, env)
    ]);

    const totalCount = freeSpins.reduce((sum, fs) => sum + fs.count, 0);


    if (totalCount === 0) {
      return new Response(`@${username}, dein Kontostand: ${balance} DachsTaler 🦡💰`, { headers: RESPONSE_HEADERS });
    }

    const details = freeSpins.map(fs => `${fs.count}x ${fs.multiplier * 10} DachsTaler`).join(', ');

    return new Response(`@${username}, dein Kontostand: ${balance} DachsTaler 🦡💰 | 🎰 ${totalCount} Free Spins | Details: ${details}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleBalance', error, { username });
    return new Response(`@${username} ❌ Fehler beim Abrufen des Kontostands.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleStats(username: string, env: Env): Promise<Response> {
  try {
    const stats = await getStats(username, env);
    const winRate = stats.totalSpins > 0 ? ((stats.wins / stats.totalSpins) * 100).toFixed(1) : '0';
    const netProfit = stats.totalWon - stats.totalLost;

    return new Response(`@${username} 📊 Stats: ${stats.totalSpins} Spins | ${stats.wins} Wins (${winRate}%) | Größter Gewinn: ${stats.biggestWin} | Gewonnen: ${stats.totalWon.toLocaleString('de-DE')} | Ausgegeben: ${stats.totalLost.toLocaleString('de-DE')} | Bilanz: ${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString('de-DE')}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleStats', error, { username });
    return new Response(`@${username} ❌ Fehler beim Abrufen der Stats.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleDaily(username: string, env: Env): Promise<Response> {
  try {
    // Rate limit: max 5 requests per 60 seconds
    const allowed = await checkRateLimit(`daily:${username}`, 5, 60, env);
    if (!allowed) {
      return new Response(`@${username} ⏰ Zu viele Anfragen, bitte warte kurz.`, { headers: RESPONSE_HEADERS });
    }

    const [hasAccepted, hasBoost, lastDaily, currentBalance, monthlyLogin] = await Promise.all([
      hasAcceptedDisclaimer(username, env),
      hasUnlock(username, 'daily_boost', env),
      getLastDaily(username, env),
      getBalance(username, env),
      getMonthlyLogin(username, env)
    ]);

    // Disclaimer check - same as slots
    if (!hasAccepted) {
      return new Response(`@${username} 🦡 Willkommen! Dachsbau Slots ist nur zur Unterhaltung - Hier geht es NICHT um Echtgeld! Verstanden? Schreib "!slots accept" zum Spielen! Weitere Infos: ${URLS.INFO} | Shop: ${URLS.SHOP} 🎰`, { headers: RESPONSE_HEADERS });
    }

    const dailyAmount = hasBoost ? DAILY_BOOST_AMOUNT : DAILY_AMOUNT;
    const now = Date.now();

    // Check if daily was already claimed today (German timezone reset at midnight)
    const todayGerman = getCurrentDate();
    const daysInMonth = getDaysInCurrentMonth(); // Cache once at start

    if (lastDaily) {
      const lastDailyGerman = getGermanDateFromTimestamp(lastDaily);

      if (todayGerman === lastDailyGerman) {
        // Already claimed today, calculate time until next German midnight
        const remainingMs = getMsUntilGermanMidnight();
        return new Response(`@${username} ⏰ Daily Bonus bereits abgeholt! Nächster Bonus in ${formatTimeRemaining(remainingMs)} | Login-Tage: ${monthlyLogin.days.length}/${daysInMonth} 📅`, { headers: RESPONSE_HEADERS });
      }
    }

    // Update monthly login
    const newMonthlyLogin = await updateMonthlyLogin(username, env);
    const milestoneBonus = MONTHLY_LOGIN_REWARDS[newMonthlyLogin.days.length] || 0;
    const isNewMilestone = milestoneBonus > 0 && !newMonthlyLogin.claimedMilestones.includes(newMonthlyLogin.days.length);

    const totalBonus = dailyAmount + (isNewMilestone ? milestoneBonus : 0);
    const newBalance = Math.min(currentBalance + totalBonus, MAX_BALANCE);

    await Promise.all([
      setBalance(username, newBalance, env),
      setLastDaily(username, now, env),
      isNewMilestone ? markMilestoneClaimed(username, newMonthlyLogin.days.length, env, newMonthlyLogin) : Promise.resolve()
    ]);

    // Track achievements (await to ensure they complete before response)
    await Promise.all([
      trackDailyAchievements(username, newMonthlyLogin.days.length, env),
      checkBalanceAchievements(username, newBalance, env)
    ]);

    const boostText = hasBoost ? ' (💎 Boosted!)' : '';
    let milestoneText = '';

    if (isNewMilestone) {
      milestoneText = ` | 🎉 ${newMonthlyLogin.days.length} Tage Milestone: +${milestoneBonus} DachsTaler!`;
    }

    return new Response(`@${username} 🎁 Daily Bonus erhalten! +${totalBonus} DachsTaler${boostText}${milestoneText} 🦡 | Login-Tage: ${newMonthlyLogin.days.length}/${daysInMonth} 📅 | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleDaily', error, { username });
    return new Response(`@${username} ❌ Fehler beim Daily Bonus.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBuffs(username: string, env: Env): Promise<Response> {
  try {
    const buffs: string[] = [];
    const lowerUsername = username.toLowerCase(); // OPTIMIZED: Cache once, use everywhere

    // Check all timed buffs
    const timedBuffPromises = TIMED_BUFF_KEYS.map(async (buff): Promise<string | null> => {
      const value = await env.SLOTS_KV.get(`buff:${lowerUsername}:${buff.key}`);
      if (!value) return null;

      try {
        const expireAt = parseInt(value, 10);
        const remaining = expireAt - Date.now();

        if (remaining > 0) {
          return `${buff.emoji} ${buff.name} (${formatTimeRemaining(remaining)})`;
        }
      } catch {
        // Might be JSON (buffs with uses/stack)
      }

      return null;
    });

    // OPTIMIZED: Load ALL buff data in parallel with named destructuring
    const [
      timedResults,
      dachsLocator,
      rageMode,
      // Symbol boosts (7 items)
      cherryBoost, lemonBoost, orangeBoost, grapeBoost, melonBoost, starBoost, dachsBoost,
      // Other buffs
      winMultiplier,
      insuranceCount,
      guaranteedPair,
      wildCard
    ] = await Promise.all([
      Promise.all(timedBuffPromises),
      getBuffWithUses(username, 'dachs_locator', env),
      getBuffWithStack(username, 'rage_mode', env),
      // Symbol boosts - use cached lowerUsername
      ...BUFF_SYMBOLS_WITH_NAMES.map(s => env.SLOTS_KV.get(`boost:${lowerUsername}:${s.symbol}`)),
      // Win Multiplier
      env.SLOTS_KV.get(`winmulti:${lowerUsername}`),
      // Insurance, Guaranteed Pair, Wild Card
      getInsuranceCount(username, env),
      hasGuaranteedPair(username, env),
      hasWildCard(username, env)
    ]);

    // Process timed buffs
    buffs.push(...timedResults.filter((b): b is string => b !== null));

    // Dachs Locator
    if (dachsLocator.active) {
      buffs.push(`🦡 Dachs Locator (${dachsLocator.uses} Spins)`);
    }

    // Rage Mode
    if (rageMode.active && rageMode.data) {
      const remaining = rageMode.data.expireAt - Date.now();
      buffs.push(`🔥 Rage Mode (${formatTimeRemaining(remaining)}, Stack: ${rageMode.stack}%)`);
    }

    // Symbol Boosts - named variables for clarity
    const symbolBoosts: SymbolBoostDef[] = [
      { boost: cherryBoost as string | null, symbol: '🍒', name: 'Kirschen' },
      { boost: lemonBoost as string | null, symbol: '🍋', name: 'Zitronen' },
      { boost: orangeBoost as string | null, symbol: '🍊', name: 'Orangen' },
      { boost: grapeBoost as string | null, symbol: '🍇', name: 'Trauben' },
      { boost: melonBoost as string | null, symbol: '🍉', name: 'Wassermelonen' },
      { boost: starBoost as string | null, symbol: '⭐', name: 'Stern' },
      { boost: dachsBoost as string | null, symbol: '🦡', name: 'Dachs' }
    ];
    symbolBoosts.forEach(({ boost, symbol, name }) => {
      if (boost === KV_ACTIVE) {
        buffs.push(`${symbol} ${name}-Boost (1x)`);
      }
    });

    // Win Multiplier
    if (winMultiplier === KV_ACTIVE) {
      buffs.push('⚡ Win Multiplier (1x)');
    }

    // Insurance Pack
    if (insuranceCount > 0) {
      buffs.push(`🛡️ Insurance Pack (${insuranceCount}x)`);
    }

    // Guaranteed Pair
    if (guaranteedPair) {
      buffs.push('🎯 Guaranteed Pair (1x)');
    }

    // Wild Card
    if (wildCard) {
      buffs.push('🃏 Wild Card (1x)');
    }

    // Build response (ONE LINE with ||)
    if (buffs.length === 0) {
      return new Response(`@${username} ❌ Keine aktiven Buffs! Schau im Shop vorbei: ${URLS.SHOP}`, { headers: RESPONSE_HEADERS });
    }

    const buffList = buffs.join(' || ');
    return new Response(`@${username} 🔥 Deine aktiven Buffs: ${buffList}`, { headers: RESPONSE_HEADERS });

  } catch (error) {
    logError('handleBuffs', error, { username });
    return new Response(`@${username} ❌ Fehler beim Abrufen der Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleTransfer(username: string, target: string, amount: string, env: Env): Promise<Response> {
  try {
    const lowerUsername = username.toLowerCase(); // OPTIMIZED: Cache once

    if (!target) {
      return new Response(`@${username} ❌ Kein Ziel-User angegeben!`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = validateAmount(amount, MIN_TRANSFER, MAX_TRANSFER);
    if (parsedAmount === null) {
      return new Response(`@${username} ❌ Ungültiger Betrag! (${MIN_TRANSFER}-${MAX_TRANSFER})`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    if (lowerUsername === cleanTarget) {
      return new Response(`@${username} ❌ Du kannst dir nicht selbst DachsTaler senden!`, { headers: RESPONSE_HEADERS });
    }

    // Check if receiver has accepted disclaimer (has played before)
    const receiverHasDisclaimer = await hasAcceptedDisclaimer(cleanTarget, env);
    if (!receiverHasDisclaimer) {
      return new Response(`@${username} ❌ @${cleanTarget} hat noch nie gespielt! Der Empfänger muss zuerst !slots spielen, um einen Account zu erstellen.`, { headers: RESPONSE_HEADERS });
    }

    // Atomic transfer with lock mechanism to prevent double-spend race conditions
    const lockKey = `transfer_lock:${lowerUsername}`;
    const maxRetries = MAX_RETRIES;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Try to acquire lock (short TTL to prevent deadlock)
      const lockValue = `${Date.now()}:${Math.random()}`;
      const existingLock = await env.SLOTS_KV.get(lockKey);

      if (existingLock) {
        // Lock exists - wait and retry
        if (attempt < maxRetries - 1) {
          await exponentialBackoff(attempt);
          continue;
        }
        return new Response(`@${username} ❌ Transfer wird gerade verarbeitet, bitte warte kurz.`, { headers: RESPONSE_HEADERS });
      }

      // Acquire lock (5 second TTL)
      await env.SLOTS_KV.put(lockKey, lockValue, { expirationTtl: 5 });

      try {
        // Verify we got the lock
        const verifyLock = await env.SLOTS_KV.get(lockKey);
        if (verifyLock !== lockValue) {
          // Another request got the lock first
          if (attempt < maxRetries - 1) {
            await exponentialBackoff(attempt);
            continue;
          }
          return new Response(`@${username} ❌ Transfer wird gerade verarbeitet, bitte warte kurz.`, { headers: RESPONSE_HEADERS });
        }

        // Now perform the transfer atomically
        const senderBalance = await getBalance(username, env);

        if (senderBalance < parsedAmount) {
          await env.SLOTS_KV.delete(lockKey);
          return new Response(`@${username} ❌ Nicht genug DachsTaler! Du hast ${senderBalance}.`, { headers: RESPONSE_HEADERS });
        }

        const newSenderBalance = senderBalance - parsedAmount;

        // Deduct from sender first
        await setBalance(username, newSenderBalance, env);

        // Verify sender balance was correctly deducted
        const verifySender = await getBalance(username, env);
        if (verifySender !== newSenderBalance) {
          // Race condition - restore and retry
          await env.SLOTS_KV.delete(lockKey);
          if (attempt < maxRetries - 1) {
            await exponentialBackoff(attempt);
            continue;
          }
          return new Response(`@${username} ❌ Transfer fehlgeschlagen, bitte versuche es erneut.`, { headers: RESPONSE_HEADERS });
        }

        // Now credit receiver (after sender is confirmed deducted)
        const receiverBalance = await getBalance(cleanTarget, env);
        const newReceiverBalance = Math.min(receiverBalance + parsedAmount, MAX_BALANCE);

        // Warn if amount was capped
        const actualReceived = newReceiverBalance - receiverBalance;
        const wasCapped = actualReceived < parsedAmount;

        await setBalance(cleanTarget, newReceiverBalance, env);

        // Release lock
        await env.SLOTS_KV.delete(lockKey);

        // Track achievements
        await Promise.all([
          trackTransferAchievements(username, parsedAmount, env),
          trackTransferReceived(cleanTarget, actualReceived, env),
          checkBalanceAchievements(cleanTarget, newReceiverBalance, env)
        ]);

        if (wasCapped) {
          return new Response(`@${username} ✅ ${parsedAmount} DachsTaler an @${cleanTarget} gesendet! ⚠️ ${parsedAmount - actualReceived} DachsTaler wurden nicht gutgeschrieben (Max-Balance erreicht) | Dein Kontostand: ${newSenderBalance} 💸`, { headers: RESPONSE_HEADERS });
        }

        return new Response(`@${username} ✅ ${parsedAmount} DachsTaler an @${cleanTarget} gesendet! Dein Kontostand: ${newSenderBalance} | @${cleanTarget}'s Kontostand: ${newReceiverBalance} 💸`, { headers: RESPONSE_HEADERS });
      } catch (error) {
        // Ensure lock is released on error
        await env.SLOTS_KV.delete(lockKey);
        throw error;
      }
    }

    return new Response(`@${username} ❌ Transfer fehlgeschlagen, bitte versuche es erneut.`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleTransfer', error, { username, target, amount });
    return new Response(`@${username} ❌ Fehler beim Transfer.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleLeaderboard(env: Env): Promise<Response> {
  try {
    // Try to get cached leaderboard
    const cached = await env.SLOTS_KV.get('leaderboard:cache');
    if (cached) {
      try {
        const cachedData = JSON.parse(cached) as { timestamp: number; message: string };
        // Validate cache structure and check if still valid
        if (cachedData.timestamp && cachedData.message &&
            Date.now() - cachedData.timestamp < LEADERBOARD_CACHE_TTL * 1000) {
          return new Response(cachedData.message, { headers: RESPONSE_HEADERS });
        }
      } catch {
        // Invalid cache, continue to rebuild
      }
    }

    // Cache miss or expired - rebuild leaderboard
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:', limit: LEADERBOARD_LIMIT });

    if (!listResult.keys || listResult.keys.length === 0) {
      return new Response(`🏆 Leaderboard: Noch keine Spieler vorhanden!`, { headers: RESPONSE_HEADERS });
    }

    // Filter blocked users first, then batch KV reads
    const validKeys = listResult.keys.filter(key => {
      const username = key.name.replace('user:', '');
      return !isLeaderboardBlocked(username);
    });

    // Batch reads in chunks for better performance
    const users: { username: string; balance: number }[] = [];

    for (let i = 0; i < validKeys.length; i += LEADERBOARD_BATCH_SIZE) {
      const batch = validKeys.slice(i, i + LEADERBOARD_BATCH_SIZE);
      const usernames = batch.map(key => key.name.replace('user:', ''));

      // Fetch balances and disclaimer status in parallel
      const [balances, disclaimerStatuses] = await Promise.all([
        Promise.all(batch.map(key => env.SLOTS_KV.get(key.name))),
        Promise.all(usernames.map(username => hasAcceptedDisclaimer(username, env)))
      ]);

      for (let j = 0; j < batch.length; j++) {
        // Only include users who have accepted the disclaimer
        if (balances[j] && disclaimerStatuses[j]) {
          const balance = parseInt(balances[j]!, 10);
          if (!isNaN(balance) && balance > 0) {
            users.push({
              username: usernames[j],
              balance
            });
          }
        }
      }

      // Early exit if we have enough high-balance users
      if (users.length >= LEADERBOARD_MIN_USERS) break;
    }

    users.sort((a, b) => b.balance - a.balance);
    const top5 = users.slice(0, 5);

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const leaderboardText = top5.map((user, index) =>
      `${medals[index]} ${user.username}: ${user.balance.toLocaleString('de-DE')} DachsTaler`
    ).join(' ║ ');

    const message = `🏆 Top 5 Leaderboard: ${leaderboardText}`;

    // Cache the leaderboard
    await env.SLOTS_KV.put('leaderboard:cache', JSON.stringify({
      message,
      timestamp: Date.now()
    }), { expirationTtl: LEADERBOARD_CACHE_TTL + 60 });

    return new Response(message, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleLeaderboard', error);
    return new Response(`🏆 Leaderboard: Fehler beim Laden.`, { headers: RESPONSE_HEADERS });
  }
}

export {
  handleBalance,
  handleStats,
  handleDaily,
  handleBuffs,
  handleTransfer,
  handleLeaderboard
};
