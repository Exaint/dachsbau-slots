import {
  RESPONSE_HEADERS,
  MAX_BALANCE,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MIN_TRANSFER,
  MAX_TRANSFER,
  BANK_USERNAME,
  LEADERBOARD_CACHE_TTL,
  MONTHLY_LOGIN_REWARDS,
  DAILY_AMOUNT,
  DAILY_BOOST_AMOUNT,
  URLS,
  BUFF_SYMBOLS_WITH_NAMES
} from '../constants.js';
import { sanitizeUsername, validateAmount, isLeaderboardBlocked } from '../utils.js';
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
  isBuffActive
} from '../database.js';

async function handleBalance(username, env) {
  try {
    const [balance, freeSpins] = await Promise.all([
      getBalance(username, env),
      getFreeSpins(username, env)
    ]);

    const totalCount = freeSpins.reduce((sum, fs) => sum + fs.count, 0);


    if (totalCount === 0) {
      return new Response(`@${username}, dein Kontostand: ${balance} DachsTaler 🦡💰     `, { headers: RESPONSE_HEADERS });
    }

    const details = freeSpins.map(fs => `${fs.count}x ${fs.multiplier * 10}DT`).join(', ');

    return new Response(`@${username}, dein Kontostand: ${balance} DachsTaler 🦡💰 | 🎰 ${totalCount} Free Spins | Details: ${details}     `, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleBalance Error:', error);
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

    return new Response(`@${username} 📊 Stats: ${stats.totalSpins} Spins | ${stats.wins} Wins (${winRate}%) | Größter Gewinn: ${stats.biggestWin} | Total: ${stats.totalWon - stats.totalLost >= 0 ? '+' : ''}${stats.totalWon - stats.totalLost}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleStats Error:', error);
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

    // Check if daily was already claimed today (UTC day reset)
    const nowDate = new Date(now);
    const todayUTC = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());

    if (lastDaily) {
      const lastDailyDate = new Date(lastDaily);
      const lastDailyUTC = Date.UTC(lastDailyDate.getUTCFullYear(), lastDailyDate.getUTCMonth(), lastDailyDate.getUTCDate());

      if (todayUTC === lastDailyUTC) {
        // Already claimed today, calculate time until next UTC midnight
        const tomorrow = new Date(todayUTC);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const remainingMs = tomorrow.getTime() - now;
        const remainingHours = Math.floor(remainingMs / MS_PER_HOUR);
        const remainingMinutes = Math.floor((remainingMs % MS_PER_HOUR) / MS_PER_MINUTE);

        return new Response(`@${username} ⏰ Daily Bonus bereits abgeholt! Nächster Bonus in ${remainingHours}h ${remainingMinutes}m | Login-Tage diesen Monat: ${monthlyLogin.days.length} 📅`, { headers: RESPONSE_HEADERS });
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
      isNewMilestone ? markMilestoneClaimed(username, newMonthlyLogin.days.length, env) : Promise.resolve()
    ]);

    const boostText = hasBoost ? ' (💎 Boosted!)' : '';
    let milestoneText = '';

    if (isNewMilestone) {
      milestoneText = ` | 🎉 ${newMonthlyLogin.days.length} Tage Milestone: +${milestoneBonus} DT!`;
    }


    return new Response(`@${username} 🎁 Daily Bonus erhalten! +${totalBonus} DachsTaler${boostText}${milestoneText} 🦡 | Login-Tage: ${newMonthlyLogin.days.length}/Monat 📅 | Kontostand: ${newBalance}     `, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleDaily Error:', error);
    return new Response(`@${username} ❌ Fehler beim Daily Bonus.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBuffs(username, env) {
  try {
    const buffs = [];

    // Timed Buffs (with expiry)
    const timedBuffKeys = [
      { key: 'happy_hour', name: 'Happy Hour', emoji: '⚡' },
      { key: 'lucky_charm', name: 'Lucky Charm', emoji: '🍀' },
      { key: 'golden_hour', name: 'Golden Hour', emoji: '✨' },
      { key: 'profit_doubler', name: 'Profit Doubler', emoji: '📈' },
      { key: 'star_magnet', name: 'Star Magnet', emoji: '⭐' },
      { key: 'diamond_rush', name: 'Diamond Rush', emoji: '💎' }
    ];

    // Check all timed buffs
    const timedBuffPromises = timedBuffKeys.map(async buff => {
      const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buff.key}`);
      if (!value) return null;

      try {
        const expireAt = parseInt(value, 10);
        const remaining = expireAt - Date.now();

        if (remaining > 0) {
          const hours = Math.floor(remaining / MS_PER_HOUR);
          const minutes = Math.floor((remaining % MS_PER_HOUR) / MS_PER_MINUTE);

          let timeStr;
          if (hours > 0) {
            timeStr = `${hours}h ${minutes}m`;
          } else {
            timeStr = `${minutes}m`;
          }

          return `${buff.emoji} ${buff.name} (${timeStr})`;
        }
      } catch (e) {
        // Might be JSON (buffs with uses/stack)
      }

      return null;
    });

    // OPTIMIZED: Load ALL buff data in parallel, use static constant for symbols
    const [
      timedResults,
      dachsLocator,
      rageMode,
      ...otherResults
    ] = await Promise.all([
      Promise.all(timedBuffPromises),
      getBuffWithUses(username, 'dachs_locator', env),
      getBuffWithStack(username, 'rage_mode', env),
      // Symbol boosts - use static constant
      ...BUFF_SYMBOLS_WITH_NAMES.map(s => env.SLOTS_KV.get(`boost:${username.toLowerCase()}:${s.symbol}`)),
      // Win Multiplier
      env.SLOTS_KV.get(`winmulti:${username.toLowerCase()}`),
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
      const minutes = Math.floor(remaining / MS_PER_MINUTE);
      buffs.push(`🔥 Rage Mode (${minutes}m, Stack: ${rageMode.stack}%)`);
    }

    // Symbol Boosts (indices 0-6 in otherResults) - use static constant
    BUFF_SYMBOLS_WITH_NAMES.forEach((s, i) => {
      if (otherResults[i] === 'active') {
        buffs.push(`${s.symbol} ${s.name}-Boost (1x)`);
      }
    });

    // Win Multiplier (index 7)
    if (otherResults[7] === 'active') {
      buffs.push('⚡ Win Multiplier (1x)');
    }

    // Insurance Pack (index 8)
    if (otherResults[8] > 0) {
      buffs.push(`🛡️ Insurance Pack (${otherResults[8]}x)`);
    }

    // Guaranteed Pair (index 9)
    if (otherResults[9]) {
      buffs.push('🎯 Guaranteed Pair (1x)');
    }

    // Wild Card (index 10)
    if (otherResults[10]) {
      buffs.push('🃏 Wild Card (1x)');
    }

    // Build response (ONE LINE with ||)
    if (buffs.length === 0) {
      return new Response(`@${username} ❌ Keine aktiven Buffs! Schau im Shop vorbei: ${URLS.SHOP}`, { headers: RESPONSE_HEADERS });
    }

    const buffList = buffs.join(' || ');
    return new Response(`@${username} 🔥 Deine aktiven Buffs: ${buffList}`, { headers: RESPONSE_HEADERS });

  } catch (error) {
    console.error('handleBuffs Error:', error);
    return new Response(`@${username} ❌ Fehler beim Abrufen der Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBank(username, env) {
  try {
    const balance = await getBankBalance(env);

    if (balance >= 0) {
      return new Response(`@${username} 🏦 DachsBank Kontostand: ${balance.toLocaleString('de-DE')} DT | Die Bank ist im Plus! 💰`, { headers: RESPONSE_HEADERS });
    } else {
      const deficit = Math.abs(balance);
      return new Response(`@${username} 🏦 DachsBank Kontostand: ${balance.toLocaleString('de-DE')} DT | Die Community hat die Bank um ${deficit.toLocaleString('de-DE')} DT geplündert! 🦡💸`, { headers: RESPONSE_HEADERS });
    }
  } catch (error) {
    console.error('handleBank Error:', error);
    return new Response(`@${username} ❌ Fehler beim Abrufen der DachsBank.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleTransfer(username, target, amount, env) {
  try {
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

    if (username.toLowerCase() === cleanTarget) {
      return new Response(`@${username} ❌ Du kannst dir nicht selbst DachsTaler senden!`, { headers: RESPONSE_HEADERS });
    }

    // Allow transfer to DachsBank
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

      return new Response(`@${username} ✅ ${parsedAmount} DachsTaler an die DachsBank gespendet! 💰 | Dein Kontostand: ${newSenderBalance} | Bank: ${newBankBalance.toLocaleString('de-DE')} DT 🏦`, { headers: RESPONSE_HEADERS });
    }

    const [senderBalance, receiverBalance] = await Promise.all([
      getBalance(username, env),
      getBalance(cleanTarget, env)
    ]);

    if (senderBalance < parsedAmount) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! Du hast ${senderBalance}.`, { headers: RESPONSE_HEADERS });
    }

    const newSenderBalance = senderBalance - parsedAmount;
    const newReceiverBalance = Math.min(receiverBalance + parsedAmount, MAX_BALANCE);

    await Promise.all([
      setBalance(username, newSenderBalance, env),
      setBalance(cleanTarget, newReceiverBalance, env)
    ]);


    return new Response(`@${username} ✅ ${parsedAmount} DachsTaler an @${cleanTarget} gesendet! Dein Kontostand: ${newSenderBalance} | @${cleanTarget}'s Kontostand: ${newReceiverBalance} 💸     `, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleTransfer Error:', error);
    return new Response(`@${username} ❌ Fehler beim Transfer.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleLeaderboard(env) {
  try {
    // Try to get cached leaderboard
    const cached = await env.SLOTS_KV.get('leaderboard:cache');
    if (cached) {
      const cachedData = JSON.parse(cached);
      // Check if cache is still valid (less than 5 minutes old)
      if (Date.now() - cachedData.timestamp < LEADERBOARD_CACHE_TTL * 1000) {
        return new Response(cachedData.message, { headers: RESPONSE_HEADERS });
      }
    }

    // Cache miss or expired - rebuild leaderboard
    const listResult = await env.SLOTS_KV.list({ prefix: 'user:' });

    if (!listResult.keys || listResult.keys.length === 0) {
      return new Response(`🏆 Leaderboard: Noch keine Spieler vorhanden!`, { headers: RESPONSE_HEADERS });
    }

    const users = [];
    const balancePromises = [];
    const usernames = [];

    for (const key of listResult.keys) {
      const username = key.name.replace('user:', '');
      if (isLeaderboardBlocked(username)) continue;

      usernames.push(username);
      balancePromises.push(env.SLOTS_KV.get(key.name));
    }

    const balances = await Promise.all(balancePromises);

    for (let i = 0; i < usernames.length; i++) {
      if (balances[i]) {
        users.push({ username: usernames[i], balance: parseInt(balances[i], 10) });
      }
    }

    users.sort((a, b) => b.balance - a.balance);
    const top5 = users.slice(0, 5);

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const leaderboardText = top5.map((user, index) => `${medals[index]} ${user.username}: ${user.balance} DachsTaler`).join(' ║ ');

    const message = `🏆 Top 5 Leaderboard: ${leaderboardText}`;

    // Cache the leaderboard
    await env.SLOTS_KV.put('leaderboard:cache', JSON.stringify({
      message,
      timestamp: Date.now()
    }), { expirationTtl: LEADERBOARD_CACHE_TTL + 60 });

    return new Response(message, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleLeaderboard Error:', error);
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
