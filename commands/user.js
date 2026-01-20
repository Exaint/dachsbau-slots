import {
  RESPONSE_HEADERS,
  MAX_BALANCE,
  MIN_TRANSFER,
  MAX_TRANSFER,
  BANK_USERNAME,
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
import { sanitizeUsername, validateAmount, isLeaderboardBlocked, exponentialBackoff, formatTimeRemaining, logError, getCurrentDate, getGermanDateFromTimestamp, getMsUntilGermanMidnight } from '../utils.js';
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
  getBankBalance,
  updateBankBalance,
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
  checkBalanceAchievements
} from '../database.js';

/**
 * Track daily claim achievements (fire-and-forget)
 * Daily achievements are based on monthly login days, not cumulative claims
 */
async function trackDailyAchievements(username, monthlyDays, env) {
  try {
    const promises = [];

    // FIRST_DAILY
    promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.FIRST_DAILY.id, env));

    // DAILY_7/14/21/28 - Check and unlock based on monthly login days
    if (monthlyDays >= 7) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.DAILY_7.id, env));
    }
    if (monthlyDays >= 14) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.DAILY_14.id, env));
    }
    if (monthlyDays >= 21) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.DAILY_21.id, env));
    }
    if (monthlyDays >= 28) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.DAILY_28.id, env));
    }

    await Promise.all(promises);
  } catch (error) {
    logError('trackDailyAchievements', error, { username, monthlyDays });
  }
}

/**
 * Track transfer achievements (fire-and-forget)
 */
async function trackTransferAchievements(username, amount, env) {
  try {
    const promises = [];

    // FIRST_TRANSFER
    promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.FIRST_TRANSFER.id, env));

    // Track totalTransferred for TRANSFER_1000/10000 achievements
    promises.push(updateAchievementStat(username, 'totalTransferred', amount, env));

    await Promise.all(promises);
  } catch (error) {
    logError('trackTransferAchievements', error, { username, amount });
  }
}

// Helper: Get days in current month (German timezone)
function getDaysInCurrentMonth() {
  const now = new Date();
  const germanDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const year = germanDate.getFullYear();
  const month = germanDate.getMonth();
  // Day 0 of next month = last day of current month
  return new Date(year, month + 1, 0).getDate();
}

// Static: Timed buff definitions (avoid recreation per request)
const TIMED_BUFF_KEYS = [
  { key: 'happy_hour', name: 'Happy Hour', emoji: '⚡' },
  { key: 'lucky_charm', name: 'Lucky Charm', emoji: '🍀' },
  { key: 'golden_hour', name: 'Golden Hour', emoji: '✨' },
  { key: 'profit_doubler', name: 'Profit Doubler', emoji: '📈' },
  { key: 'star_magnet', name: 'Star Magnet', emoji: '⭐' },
  { key: 'diamond_rush', name: 'Diamond Rush', emoji: '💎' }
];

async function handleBalance(username, env) {
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

async function handleStats(username, env) {
  try {
    // OPTIMIZED: Load unlock check and stats in parallel
    const [hasStatsUnlock, stats] = await Promise.all([
      hasUnlock(username, 'stats_tracker', env),
      getStats(username, env)
    ]);

    if (!hasStatsUnlock) {
      return new Response(`@${username} ❌ Du benötigst den Stats Tracker! Kaufe ihn im Shop: !shop buy 18`, { headers: RESPONSE_HEADERS });
    }

    const winRate = stats.totalSpins > 0 ? ((stats.wins / stats.totalSpins) * 100).toFixed(1) : 0;
    const netProfit = stats.totalWon - stats.totalLost;

    return new Response(`@${username} 📊 Stats: ${stats.totalSpins} Spins | ${stats.wins} Wins (${winRate}%) | Größter Gewinn: ${stats.biggestWin} | Gewonnen: ${stats.totalWon.toLocaleString('de-DE')} | Ausgegeben: ${stats.totalLost.toLocaleString('de-DE')} | Bilanz: ${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString('de-DE')}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleStats', error, { username });
    return new Response(`@${username} ❌ Fehler beim Abrufen der Stats.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleDaily(username, env) {
  try {
    const [hasBoost, lastDaily, currentBalance, monthlyLogin] = await Promise.all([
      hasUnlock(username, 'daily_boost', env),
      getLastDaily(username, env),
      getBalance(username, env),
      getMonthlyLogin(username, env)
    ]);

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

async function handleBuffs(username, env) {
  try {
    const buffs = [];
    const lowerUsername = username.toLowerCase(); // OPTIMIZED: Cache once, use everywhere

    // Check all timed buffs
    const timedBuffPromises = TIMED_BUFF_KEYS.map(async buff => {
      const value = await env.SLOTS_KV.get(`buff:${lowerUsername}:${buff.key}`);
      if (!value) return null;

      try {
        const expireAt = parseInt(value, 10);
        const remaining = expireAt - Date.now();

        if (remaining > 0) {
          return `${buff.emoji} ${buff.name} (${formatTimeRemaining(remaining)})`;
        }
      } catch (e) {
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
    buffs.push(...timedResults.filter(b => b !== null));

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
    const symbolBoosts = [
      { boost: cherryBoost, symbol: '🍒', name: 'Kirschen' },
      { boost: lemonBoost, symbol: '🍋', name: 'Zitronen' },
      { boost: orangeBoost, symbol: '🍊', name: 'Orangen' },
      { boost: grapeBoost, symbol: '🍇', name: 'Trauben' },
      { boost: melonBoost, symbol: '🍉', name: 'Wassermelonen' },
      { boost: starBoost, symbol: '⭐', name: 'Stern' },
      { boost: dachsBoost, symbol: '🦡', name: 'Dachs' }
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

async function handleBank(username, env) {
  try {
    const balance = await getBankBalance(env);

    if (balance >= 0) {
      return new Response(`@${username} 🏦 DachsBank Kontostand: ${balance.toLocaleString('de-DE')} DachsTaler | Die Bank ist im Plus! 💰`, { headers: RESPONSE_HEADERS });
    } else {
      const deficit = Math.abs(balance);
      return new Response(`@${username} 🏦 DachsBank Kontostand: ${balance.toLocaleString('de-DE')} DachsTaler | Die Community hat die Bank um ${deficit.toLocaleString('de-DE')} DachsTaler geplündert! 🦡💸`, { headers: RESPONSE_HEADERS });
    }
  } catch (error) {
    logError('handleBank', error);
    return new Response(`@${username} ❌ Fehler beim Abrufen der DachsBank.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleTransfer(username, target, amount, env) {
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

    // Allow transfer to DachsBank (no disclaimer check needed)
    if (cleanTarget === BANK_USERNAME) {
      const senderBalance = await getBalance(username, env);

      if (senderBalance < parsedAmount) {
        return new Response(`@${username} ❌ Nicht genug DachsTaler! Du hast ${senderBalance}.`, { headers: RESPONSE_HEADERS });
      }

      const newSenderBalance = senderBalance - parsedAmount;

      // OPTIMIZED: Update balance and bank atomically, use returned value instead of re-fetching
      const [, newBankBalance] = await Promise.all([
        setBalance(username, newSenderBalance, env),
        updateBankBalance(parsedAmount, env)
      ]);

      // Track achievements (await to ensure they complete before response)
      await trackTransferAchievements(username, parsedAmount, env);

      return new Response(`@${username} ✅ ${parsedAmount} DachsTaler an die DachsBank gespendet! 💰 | Dein Kontostand: ${newSenderBalance} | Bank: ${newBankBalance.toLocaleString('de-DE')} DachsTaler 🏦`, { headers: RESPONSE_HEADERS });
    }

    // Check if receiver has accepted disclaimer (has played before)
    const receiverHasDisclaimer = await hasAcceptedDisclaimer(cleanTarget, env);
    if (!receiverHasDisclaimer) {
      return new Response(`@${username} ❌ @${cleanTarget} hat noch nie gespielt! Der Empfänger muss zuerst !slots spielen, um einen Account zu erstellen.`, { headers: RESPONSE_HEADERS });
    }

    // Atomic transfer with retry mechanism to prevent race conditions
    const maxRetries = MAX_RETRIES;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const [senderBalance, receiverBalance] = await Promise.all([
        getBalance(username, env),
        getBalance(cleanTarget, env)
      ]);

      if (senderBalance < parsedAmount) {
        return new Response(`@${username} ❌ Nicht genug DachsTaler! Du hast ${senderBalance}.`, { headers: RESPONSE_HEADERS });
      }

      const newSenderBalance = senderBalance - parsedAmount;
      const newReceiverBalance = Math.min(receiverBalance + parsedAmount, MAX_BALANCE);

      // Write both balances
      await Promise.all([
        setBalance(username, newSenderBalance, env),
        setBalance(cleanTarget, newReceiverBalance, env)
      ]);

      // Verify the write succeeded
      const verifySender = await getBalance(username, env);
      if (verifySender === newSenderBalance) {
        // Track achievements (await to ensure they complete before response)
        await Promise.all([
          trackTransferAchievements(username, parsedAmount, env),
          checkBalanceAchievements(cleanTarget, newReceiverBalance, env)
        ]);
        return new Response(`@${username} ✅ ${parsedAmount} DachsTaler an @${cleanTarget} gesendet! Dein Kontostand: ${newSenderBalance} | @${cleanTarget}'s Kontostand: ${newReceiverBalance} 💸`, { headers: RESPONSE_HEADERS });
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    }

    return new Response(`@${username} ❌ Transfer fehlgeschlagen, bitte versuche es erneut.`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleTransfer', error, { username, target, amount });
    return new Response(`@${username} ❌ Fehler beim Transfer.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleLeaderboard(env) {
  try {
    // Try to get cached leaderboard
    const cached = await env.SLOTS_KV.get('leaderboard:cache');
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
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
    const users = [];

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
          const balance = parseInt(balances[j], 10);
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
  handleBank,
  handleTransfer,
  handleLeaderboard
};
