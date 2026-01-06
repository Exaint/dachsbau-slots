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
  DAILY_BOOST_AMOUNT
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
    if (!await hasUnlock(username, 'stats_tracker', env)) {
      return new Response(`@${username} ❌ Du benötigst den Stats Tracker! Kaufe ihn im Shop: !shop buy 18`, { headers: RESPONSE_HEADERS });
    }

    const stats = await getStats(username, env);
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

    const timedResults = await Promise.all(timedBuffPromises);
    buffs.push(...timedResults.filter(b => b !== null));

    // Buffs with Uses (Dachs Locator)
    const dachsLocator = await getBuffWithUses(username, 'dachs_locator', env);
    if (dachsLocator.active) {
      buffs.push(`🦡 Dachs Locator (${dachsLocator.uses} Spins)`);
    }

    // Buffs with Stack (Rage Mode)
    const rageMode = await getBuffWithStack(username, 'rage_mode', env);
    if (rageMode.active) {
      const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:rage_mode`);
      const data = JSON.parse(value);
      const remaining = data.expireAt - Date.now();
      const minutes = Math.floor(remaining / MS_PER_MINUTE);
      buffs.push(`🔥 Rage Mode (${minutes}m, Stack: ${rageMode.stack}%)`);
    }

    // Symbol Boosts (check all symbols)
    const symbols = [
      { symbol: '🍒', name: 'Kirschen' },
      { symbol: '🍋', name: 'Zitronen' },
      { symbol: '🍊', name: 'Orangen' },
      { symbol: '🍇', name: 'Trauben' },
      { symbol: '🍉', name: 'Wassermelonen' },
      { symbol: '⭐', name: 'Stern' },
      { symbol: '🦡', name: 'Dachs' }
    ];

    const boostPromises = symbols.map(async s => {
      const value = await env.SLOTS_KV.get(`boost:${username.toLowerCase()}:${s.symbol}`);
      if (value === 'active') {
        return `${s.symbol} ${s.name}-Boost (1x)`;
      }
      return null;
    });

    const boostResults = await Promise.all(boostPromises);
    buffs.push(...boostResults.filter(b => b !== null));

    // Win Multiplier
    const winMulti = await env.SLOTS_KV.get(`winmulti:${username.toLowerCase()}`);
    if (winMulti === 'active') {
      buffs.push('⚡ Win Multiplier (1x)');
    }

    // Insurance Pack
    const insurance = await getInsuranceCount(username, env);
    if (insurance > 0) {
      buffs.push(`🛡️ Insurance Pack (${insurance}x)`);
    }

    // Guaranteed Pair
    const guaranteedPair = await hasGuaranteedPair(username, env);
    if (guaranteedPair) {
      buffs.push('🎯 Guaranteed Pair (1x)');
    }

    // Wild Card
    const wildCard = await hasWildCard(username, env);
    if (wildCard) {
      buffs.push('🃏 Wild Card (1x)');
    }

    // Build response (ONE LINE with ||)
    if (buffs.length === 0) {
      return new Response(`@${username} ❌ Keine aktiven Buffs! Schau im Shop vorbei: https://git.new/DachsbauSlotsShop`, { headers: RESPONSE_HEADERS });
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

      // Update both atomically to prevent race condition
      await Promise.all([
        setBalance(username, newSenderBalance, env),
        updateBankBalance(parsedAmount, env)
      ]);

      const newBankBalance = await getBalance(BANK_USERNAME, env);

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
