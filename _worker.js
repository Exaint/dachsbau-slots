// Cloudflare Worker (ES Module Format) - Dachsbau Slots Bot - Extended Features
// 
// Commands via Fossabot:
// !slots: $(customapi https://dachsbau-slots.exaint.workers.dev?action=slot&user=$(sender)&amount=$(1)&target=$(2)&giveamount=$(3))
// !transfer: $(customapi https://dachsbau-slots.exaint.workers.dev?action=transfer&user=$(sender)&target=$(touser)&amount=$(2))
// !shop: $(customapi https://dachsbau-slots.exaint.workers.dev?action=shop&user=$(sender)&item=$(query))

// Constants
const RESPONSE_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8' };
const MS_PER_HOUR = 3600000;
const MS_PER_MINUTE = 60000;
const MS_PER_DAY = 86400000;

const MAX_BALANCE = 999999999;
const MIN_TRANSFER = 1;
const MAX_TRANSFER = 100000;
const HOURLY_JACKPOT_AMOUNT = 100;
const COOLDOWN_SECONDS = 30; // Spin cooldown in seconds

// Leaderboard cache duration (5 minutes)
const LEADERBOARD_CACHE_TTL = 300;

// DEBUG MODE - Set to true for testing (exaint_ only)
const DEBUG_MODE = false; // Change to true to enable

const WEIGHTED_SYMBOLS = [
  ...Array(24).fill('🍒'),
  ...Array(20).fill('🍋'),
  ...Array(19).fill('🍊'),
  ...Array(21).fill('💎'),
  ...Array(15).fill('🍇'),
  ...Array(11).fill('🍉'),
  ...Array(10).fill('⭐'),
];

const SHOP_ITEMS = {
  1: { name: 'Peek Token', price: 75, type: 'peek' },
  2: { name: '🍒 Kirschen-Boost', price: 50, type: 'boost', symbol: '🍒' },
  3: { name: '🍋 Zitronen-Boost', price: 50, type: 'boost', symbol: '🍋' },
  4: { name: '🍊 Orangen-Boost', price: 50, type: 'boost', symbol: '🍊' },
  5: { name: '🍇 Trauben-Boost', price: 50, type: 'boost', symbol: '🍇' },
  6: { name: '🍉 Wassermelonen-Boost', price: 50, type: 'boost', symbol: '🍉' },
  7: { name: '⭐ Stern-Boost', price: 50, type: 'boost', symbol: '⭐' },
  8: { name: '🦡 Dachs-Boost', price: 150, type: 'boost', symbol: '🦡', weeklyLimit: true },
  9: { name: 'Insurance Pack', price: 250, type: 'insurance' },
  10: { name: 'Win Multiplier', price: 250, type: 'winmulti' },
  11: { name: 'Chaos Spin', price: 250, type: 'instant' },
  12: { name: 'Glücksrad Spin', price: 300, type: 'instant' },
  13: { name: '!slots 20 Unlock', price: 500, type: 'unlock', unlockKey: 'slots_20' },
  14: { name: 'Happy Hour', price: 800, type: 'timed', buffKey: 'happy_hour', duration: 3600 },
  15: { name: 'Spin Bundle', price: 90, type: 'bundle' },
  16: { name: 'Mystery Box', price: 1000, type: 'instant' },
  17: { name: 'Bronze Dachs Rang 🥉', price: 1200, type: 'prestige', rank: '🥉' },
  18: { name: 'Stats Tracker', price: 1250, type: 'unlock', unlockKey: 'stats_tracker' },
  19: { name: '!slots 30 Unlock', price: 2000, type: 'unlock', unlockKey: 'slots_30', requires: 'slots_20' },
  20: { name: 'Lucky Charm', price: 2000, type: 'timed', buffKey: 'lucky_charm', duration: 3600 },
  21: { name: '!slots 50 Unlock', price: 2500, type: 'unlock', unlockKey: 'slots_50', requires: 'slots_30' },
  22: { name: 'Silber Dachs Rang 🥈', price: 3000, type: 'prestige', rank: '🥈', requiresRank: '🥉' },
  23: { name: '!slots 100 Unlock', price: 3250, type: 'unlock', unlockKey: 'slots_100', requires: 'slots_50' },
  24: { name: 'Golden Hour', price: 3500, type: 'timed', buffKey: 'golden_hour', duration: 3600 },
  25: { name: '!slots all Unlock', price: 4444, type: 'unlock', unlockKey: 'slots_all', requires: 'slots_100' },
  26: { name: 'Gold Dachs Rang 🥇', price: 8000, type: 'prestige', rank: '🥇', requiresRank: '🥈' },
  27: { name: 'Daily Interest Boost', price: 10000, type: 'unlock', unlockKey: 'daily_boost' },
  28: { name: 'Custom Win Message', price: 10000, type: 'unlock', unlockKey: 'custom_message' },
  29: { name: 'Platin Dachs Rang 💎', price: 25000, type: 'prestige', rank: '💎', requiresRank: '🥇' },
  30: { name: 'Legendary Dachs Rang 👑', price: 44444, type: 'prestige', rank: '👑', requiresRank: '💎' },
  31: { name: 'Reverse Chaos', price: 150, type: 'instant' },
  32: { name: '🌟 Star Magnet', price: 1200, type: 'timed', buffKey: 'star_magnet', duration: 3600 },
  33: { name: '🦡 Dachs Locator', price: 1500, type: 'timed', buffKey: 'dachs_locator', duration: 600, uses: 10 },
  34: { name: '🔥 Rage Mode', price: 4000, type: 'timed', buffKey: 'rage_mode', duration: 1800 },
  35: { name: '📈 Profit Doubler', price: 5000, type: 'timed', buffKey: 'profit_doubler', duration: 86400 },
  36: { name: '💎 Diamond Mine', price: 2500, type: 'instant' },
  37: { name: '🎯 Guaranteed Pair', price: 180, type: 'guaranteedpair' },
  38: { name: '🃏 Wild Card', price: 250, type: 'wildcard' },
  39: { name: '💎 Diamond Rush', price: 2000, type: 'timed', buffKey: 'diamond_rush', duration: 3600 },
};

const PREREQUISITE_NAMES = {
  'slots_20': '!slots 20',
  'slots_30': '!slots 30',
  'slots_50': '!slots 50',
  'slots_100': '!slots 100'
};

const PRESTIGE_RANKS = ['🥉', '🥈', '🥇', '💎', '👑'];

const TRIPLE_PAYOUTS = {'⭐': 500, '🍉': 250, '🍇': 150, '🍊': 100, '🍋': 75, '🍒': 50};
const PAIR_PAYOUTS = {'⭐': 50, '🍉': 25, '🍇': 15, '🍊': 10, '🍋': 8, '🍒': 5};

// Monthly Login rewards
const MONTHLY_LOGIN_REWARDS = {
  1: 50,
  5: 150,
  10: 400,
  15: 750,
  20: 1500
};

// Combo bonus system
const COMBO_BONUSES = {
  2: 10, 3: 30, 4: 100, 5: 500
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
      
      if (action !== 'leaderboard') {
        if (await isBlacklisted(cleanUsername, env)) {
          return new Response(`@${cleanUsername} ❌ Du bist vom Slots-Spiel ausgeschlossen.`, { headers: RESPONSE_HEADERS });
        }
      }
      
      if (action === 'slot') return await handleSlot(cleanUsername, url.searchParams.get('amount'), url, env);
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

function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '');
  if (clean.length < 1 || clean.length > 25) return null;
  return clean;
}

function validateAmount(amount, min = MIN_TRANSFER, max = MAX_TRANSFER) {
  const parsed = parseInt(amount);
  if (isNaN(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function checkHourlyJackpot() {
  const now = new Date();
  const currentSecond = now.getUTCSeconds();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDate();
  const currentMonth = now.getUTCMonth();
  const seed = currentDay * 100 + currentMonth * 10 + currentHour;
  const luckySecond = seed % 60;
  return currentSecond === luckySecond;
}

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
    
    const dailyAmount = hasBoost ? 250 : 50;
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

async function handleGive(username, target, amount, env) {
  try {
    const allowedUsers = ['exaint_', 'frechhdachs'];
    const usernameClean = username.toLowerCase().replace('_', '');
    const isAllowed = allowedUsers.some(a => a.replace('_', '') === usernameClean || a === username.toLowerCase());
    
    if (!isAllowed) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }
    
    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots give @user [Betrag]`, { headers: RESPONSE_HEADERS });
    }
    
    if (!amount) {
      return new Response(`@${username} ❌ Nutze: !slots give @user [Betrag]`, { headers: RESPONSE_HEADERS });
    }
    
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > MAX_BALANCE) {
      return new Response(`@${username} ❌ Ungültiger Betrag! (1-${MAX_BALANCE})`, { headers: RESPONSE_HEADERS });
    }
    
    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }
    
    const currentBalance = await getBalance(cleanTarget, env);
    const newBalance = Math.min(currentBalance + parsedAmount, MAX_BALANCE);
    await setBalance(cleanTarget, newBalance, env);
    
    return new Response(`@${username} ✅ ${parsedAmount} DachsTaler an @${cleanTarget} gutgeschrieben! Neuer Kontostand: ${newBalance} 🦡💰`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleGive Error:', error);
    return new Response(`@${username} ❌ Fehler beim Gutschreiben.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBan(username, target, env) {
  try {
    const allowedUsers = ['exaint_', 'frechhdachs'];
    const usernameClean = username.toLowerCase().replace('_', '');
    const isAllowed = allowedUsers.some(a => a.replace('_', '') === usernameClean || a === username.toLowerCase());
    
    if (!isAllowed) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }
    
    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots ban @user`, { headers: RESPONSE_HEADERS });
    }
    
    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }
    
    // Add to blacklist in KV
    await env.SLOTS_KV.put(`blacklist:${cleanTarget.toLowerCase()}`, 'true');
    
    return new Response(`@${username} ✅ @${cleanTarget} wurde vom Slots-Spiel ausgeschlossen. 🔨`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleBan Error:', error);
    return new Response(`@${username} ❌ Fehler beim Bannen.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleUnban(username, target, env) {
  try {
    const allowedUsers = ['exaint_', 'frechhdachs'];
    const usernameClean = username.toLowerCase().replace('_', '');
    const isAllowed = allowedUsers.some(a => a.replace('_', '') === usernameClean || a === username.toLowerCase());
    
    if (!isAllowed) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }
    
    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots unban @user`, { headers: RESPONSE_HEADERS });
    }
    
    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }
    
    // Remove both blacklist and selfban
    await Promise.all([
      env.SLOTS_KV.delete(`blacklist:${cleanTarget.toLowerCase()}`),
      removeSelfBan(cleanTarget, env)
    ]);
    
    return new Response(`@${username} ✅ @${cleanTarget} wurde entbannt und kann wieder Slots spielen. ✅`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleUnban Error:', error);
    return new Response(`@${username} ❌ Fehler beim Entbannen.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleTransfer(username, target, amount, env) {
  try {
    if (!target) {
      return new Response(`@${username} ❌ Kein Ziel-User angegeben!`, { headers: RESPONSE_HEADERS });
    }
    
    const parsedAmount = validateAmount(amount);
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
        users.push({ username: usernames[i], balance: parseInt(balances[i]) });
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


async function handleSlot(username, amountParam, url, env) {
  try {
    // Sanitize amountParam: Remove invisible characters, zero-width spaces, etc.
    if (amountParam) {
      // Remove all invisible/control characters but keep normal spaces and alphanumeric
      amountParam = amountParam
        .replace(/[\u200B-\u200D\uFEFF\u00AD\u034F\u061C\u180E]/g, '') // Zero-width spaces
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .trim();
    }
    
    // Check special commands
    if (amountParam) {
      const lower = amountParam.toLowerCase();
      
      // Detect !slots buy mistake
      if (lower === 'buy') {
        const itemNumber = url.searchParams.get('target'); // Fossabot passes $(2) as target
        if (itemNumber && !isNaN(parseInt(itemNumber))) {
          return new Response(`@${username} ❓ Meintest du !shop buy ${itemNumber}?`, { headers: RESPONSE_HEADERS });
        }
        return new Response(`@${username} ❓ Meintest du !shop buy [Nummer]? (z.B. !shop buy 1)`, { headers: RESPONSE_HEADERS });
      }
      
      if (lower === 'lb' || lower === 'leaderboard') return await handleLeaderboard(env);
      if (lower === 'balance' || lower === 'konto') return await handleBalance(username, env);
      if (lower === 'daily') return await handleDaily(username, env);
      if (lower === 'info') return new Response(`@${username} ℹ️ Hier findest du alle Commands & Infos zum Dachsbau Slots: https://git.new/DachsbauSlotInfos`, { headers: RESPONSE_HEADERS });
      if (lower === 'stats') return await handleStats(username, env);
      if (lower === 'give') {
        const targetParam = url.searchParams.get('target');
        const giveAmount = url.searchParams.get('giveamount');
        return await handleGive(username, targetParam, giveAmount, env);
      }
      if (lower === 'ban') {
        const targetParam = url.searchParams.get('target');
        return await handleBan(username, targetParam, env);
      }
      if (lower === 'unban') {
        const targetParam = url.searchParams.get('target');
        return await handleUnban(username, targetParam, env);
      }
      if (lower === 'disclaimer') {
        // For disclaimer, check the target parameter (which is $(2) in Fossabot)
        const targetParam = url.searchParams.get('target');
        let finalTarget = username;
        
        if (targetParam) {
          const cleanTarget = sanitizeUsername(targetParam.replace('@', ''));
          if (cleanTarget) {
            finalTarget = cleanTarget;
          }
        }
        
        return new Response(`@${finalTarget} ⚠️ Dachsbau Slots dient nur zur Unterhaltung! Es werden keine Echtgeld-Beträge eingesetzt oder gewonnen. Hilfsangebote bei Glücksspielproblemen: https://git.new/DachsbauSlotInfos 🦡`, { headers: RESPONSE_HEADERS });
      }
      if (lower === 'selfban') {
        await setSelfBan(username, env);
         
        return new Response(`@${username} ✅ Du wurdest vom Slots spielen ausgeschlossen. Nur Admins (exaint_, frechhdachs) können dich wieder freischalten. Wenn du Hilfe brauchst: https://git.new/DachsbauSlotInfos 🦡     `, { headers: RESPONSE_HEADERS });
      }
    }
    
    // Selfban Check
    const selfBanData = await isSelfBanned(username, env);
    if (selfBanData) {
       
      return new Response(`@${username} 🚫 Du hast dich selbst vom Spielen ausgeschlossen (seit ${selfBanData.date}). Kontaktiere einen Admin für eine Freischaltung. Hilfe: https://git.new/DachsbauSlotInfos     `, { headers: RESPONSE_HEADERS });
    }
    
    // First-Time Disclaimer Check
    const hasAccepted = await hasAcceptedDisclaimer(username, env);
    if (!hasAccepted) {
      await setDisclaimerAccepted(username, env);
       
      return new Response(`@${username} 🦡 Willkommen! Dachsbau Slots ist nur zur Unterhaltung - kein Echtgeld! Verstanden? Schreib nochmal !slots zum Spielen! Weitere Infos: https://git.new/DachsbauSlotInfos | Shop: https://git.new/DachsbauSlotsShop 🎰     `, { headers: RESPONSE_HEADERS });
    }
    
    // Cooldown Check (before processing actual spin)
    const lastSpin = await getLastSpin(username, env);
    const now = Date.now();
    const cooldownMs = COOLDOWN_SECONDS * 1000;
    
    if (lastSpin && (now - lastSpin) < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastSpin);
      const remainingSec = Math.ceil(remainingMs / 1000);
       
      return new Response(`@${username} ⏱️ Cooldown: Noch ${remainingSec} Sekunden!     `, { headers: RESPONSE_HEADERS });
    }
    
// OPTIMIZED: Load only essential data first
let [currentBalance, hasGuaranteedPairToken, hasWildCardToken] = await Promise.all([
  getBalance(username, env),
  hasGuaranteedPair(username, env),
  hasWildCard(username, env)
]);
    
    // Check for Free Spins
    let isFreeSpinUsed = false;
    let freeSpinMultiplier = 1;
    
    try {
      const freeSpinResult = await consumeFreeSpinWithMultiplier(username, env);
      if (freeSpinResult && typeof freeSpinResult === 'object') {
        isFreeSpinUsed = freeSpinResult.used === true;
        freeSpinMultiplier = (typeof freeSpinResult.multiplier === 'number' && freeSpinResult.multiplier > 0) ? freeSpinResult.multiplier : 1;
      }
    } catch (freeSpinError) {
      console.error('Free Spin Consumption Error:', freeSpinError);
      isFreeSpinUsed = false;
      freeSpinMultiplier = 1;
    }
    
    let spinCost = isFreeSpinUsed ? 0 : 10;
    let multiplier = isFreeSpinUsed ? freeSpinMultiplier : 1;
    
    // Check custom stake
    if (!isFreeSpinUsed && amountParam) {
      const lower = amountParam.toLowerCase();
      
      if (lower === 'all') {
        if (!await hasUnlock(username, 'slots_all', env)) {
          return new Response(`@${username} ❌ !slots all nicht freigeschaltet! Weitere Infos: https://dub.sh/SlotUnlock`, { headers: RESPONSE_HEADERS });
        }
        if (currentBalance < 10) {
          return new Response(`@${username} ❌ Du brauchst mindestens 10 DachsTaler für !slots all!`, { headers: RESPONSE_HEADERS });
        }
        spinCost = currentBalance;
        multiplier = Math.floor(currentBalance / 10);
      } else {
        const customAmount = parseInt(amountParam);
        if (!isNaN(customAmount)) {
          const unlockMap = { 20: 'slots_20', 30: 'slots_30', 50: 'slots_50', 100: 'slots_100' };
          const multiplierMap = { 10: 1, 20: 2, 30: 3, 50: 5, 100: 10 };
          
          // Check if amount is too low
          if (customAmount < 10) {
             
            return new Response(`@${username} ❌ Minimum ist !slots 10! Verfügbar: 10, 20, 30, 50, 100, all 💡     `, { headers: RESPONSE_HEADERS });
          }
          
          // Check if amount is too high
          if (customAmount > 100) {
             
            return new Response(`@${username} ❌ Maximum ist !slots 100! Verfügbar: 10, 20, 30, 50, 100, all 💡     `, { headers: RESPONSE_HEADERS });
          }
          
          if (customAmount === 10) {
            spinCost = 10;
            multiplier = 1;
          } else if (unlockMap[customAmount]) {
            if (await hasUnlock(username, unlockMap[customAmount], env)) {
              spinCost = customAmount;
              multiplier = multiplierMap[customAmount];
            } else {
              return new Response(`@${username} ❌ !slots ${customAmount} nicht freigeschaltet! Weitere Infos: https://dub.sh/SlotUnlock`, { headers: RESPONSE_HEADERS });
            }
          } else {
            // Numbers like 15, 25, 35, 45, 69, etc.
             
            return new Response(`@${username} ❌ !slots ${customAmount} existiert nicht! Verfügbar: 10, 20, 30, 50, 100, all | Info: https://dub.sh/SlotUnlock     `, { headers: RESPONSE_HEADERS });
          }
        }
      }
    }
    
// OPTIMIZED: Only check Happy Hour if not using free spin
if (!isFreeSpinUsed && spinCost < 1000) {
  const hasHappyHour = await isBuffActive(username, 'happy_hour', env);
  if (hasHappyHour) {
    spinCost = Math.floor(spinCost / 2);
  }
}
    
    // Balance check
    if (!isFreeSpinUsed && currentBalance < spinCost) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! Du brauchst ${spinCost} (Aktuell: ${currentBalance}) 🦡`, { headers: RESPONSE_HEADERS });
    }
    
// OPTIMIZED: Load buffs in two stages
// Stage 1: Always needed (for grid generation)
const [hasStarMagnet, hasDiamondRush] = await Promise.all([
  isBuffActive(username, 'star_magnet', env),
  isBuffActive(username, 'diamond_rush', env)
]);

// Stage 2: Only for normal spins (for dachs chance calculation)
let hasLuckyCharm = false;
let hasDachsLocator = { active: false, uses: 0 };
let hasRageMode = { active: false, stack: 0 };

if (!isFreeSpinUsed) {
  [hasLuckyCharm, hasDachsLocator, hasRageMode] = await Promise.all([
    isBuffActive(username, 'lucky_charm', env),
    getBuffWithUses(username, 'dachs_locator', env),
    getBuffWithStack(username, 'rage_mode', env)
  ]);
}

// Generate spin with modified probabilities
let dachsChance = 1 / 150;
if (hasLuckyCharm) dachsChance = 1 / 75;
if (hasDachsLocator.active) dachsChance = dachsChance * 3; // 3x Dachs chance
    
    // Rage Mode: Apply stack bonus to win chance (simulated by adjusting dachs chance)
    // Each stack gives +5% win chance, max 50%
    // We simulate this by also boosting dachs chance
    if (hasRageMode.active && hasRageMode.stack > 0) {
      const rageBoost = 1 + (hasRageMode.stack / 100); // 5% = 1.05, 50% = 1.5
      dachsChance = dachsChance * rageBoost;
    }
    
    const grid = [];
    
    // DEBUG MODE: exaint_ gets 75% chance for exactly 2 dachs (next to each other)
    if (DEBUG_MODE && username.toLowerCase() === 'exaint_') {
      const roll = Math.random();
      if (roll < 0.75) {
        // 75% chance: Exactly 2 dachs next to each other on middle row
        // Possible positions: [0,1] or [1,2]
        const dachsPair = Math.random() < 0.5 ? [3, 4] : [4, 5]; // Position 0-1 or 1-2 on middle row
        
        // Build middle row
        for (let i = 3; i < 6; i++) {
          if (dachsPair.includes(i)) {
            grid[i] = '🦡';
          } else {
            grid[i] = WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)];
          }
        }
        
        // Fill top and bottom rows normally (no dachs)
        for (let i = 0; i < 3; i++) {
          grid[i] = WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)];
          grid[i + 6] = WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)];
        }
      } else {
        // 25% chance: Normal generation with normal dachs chance
        for (let i = 0; i < 9; i++) {
          if (Math.random() < dachsChance) {
            grid.push('🦡');
          } else {
            let symbol = WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)];
            if (hasStarMagnet && Math.random() < 0.66) {
              const starRoll = Math.random();
              if (starRoll < 0.33) symbol = '⭐';
            }
            grid.push(symbol);
          }
        }
      }
    } else {
      // Normal generation for all other users
      for (let i = 0; i < 9; i++) {
        if (Math.random() < dachsChance) {
          grid.push('🦡');
        } else {
          // Star Magnet: 3x more stars
          let symbol = WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)];
          if (hasStarMagnet && Math.random() < 0.66) {
            // 66% chance to re-roll for star if not already star
            const starRoll = Math.random();
            if (starRoll < 0.33) symbol = '⭐'; // Extra star chance
          }
          // Diamond Rush: 3x more diamonds
          if (hasDiamondRush && symbol !== '💎' && Math.random() < 0.66) {
            const diamondRoll = Math.random();
            if (diamondRoll < 0.33) symbol = '💎'; // Extra diamond chance
          }
          grid.push(symbol);
        }
      }
    }
    
    // Decrement Dachs Locator uses
    if (hasDachsLocator.active) {
      await decrementBuffUses(username, 'dachs_locator', env);
    }
    
    // Guaranteed Pair: Ensure at least a pair in middle row
    if (hasGuaranteedPairToken) {
      const middle = [grid[3], grid[4], grid[5]];
      const hasPair = (middle[0] === middle[1]) || (middle[1] === middle[2]) || (middle[0] === middle[2]);
      
      if (!hasPair) {
        // Force a pair by making positions 0 and 1 the same
        const symbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐'];
        const pairSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        grid[3] = pairSymbol;
        grid[4] = pairSymbol;
      }
      await consumeGuaranteedPair(username, env);
    }
    
    // Wild Card: Add 🃏 to middle row at random position
    if (hasWildCardToken) {
      const wildPos = Math.floor(Math.random() * 3) + 3; // Position 3, 4, or 5
      grid[wildPos] = '🃏';
      await consumeWildCard(username, env);
    }
    
    let result = calculateWin(grid);
    
    // Check Hourly Jackpot
    let hourlyJackpotWon = false;
    if (checkHourlyJackpot()) {
      result.points += HOURLY_JACKPOT_AMOUNT;
      hourlyJackpotWon = true;
    }
    
    // Award Free Spins
    if (result.freeSpins && result.freeSpins > 0) {
      try {
        await addFreeSpinsWithMultiplier(username, result.freeSpins, multiplier, env);
      } catch (addFreeSpinError) {
        console.error('Add Free Spins Error:', addFreeSpinError);
      }
    }
    
    result.points = result.points * multiplier;
    
    // Win Multiplier
    if (result.points > 0 && await consumeWinMultiplier(username, env)) {
      result.points *= 2;
      result.message += ' (⚡ 2x Win Boost!)';
    }
    
    // Symbol Boost
    const middle = [grid[3], grid[4], grid[5]];
    if (result.points > 0) {
      const symbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '🦡'];
      for (const symbol of symbols) {
        if (middle.includes(symbol) && await consumeBoost(username, symbol, env)) {
          const hasMatch = (middle[0] === symbol && middle[1] === symbol) ||
                          (middle[1] === symbol && middle[2] === symbol) ||
                          (middle[0] === symbol && middle[2] === symbol) ||
                          (middle[0] === symbol && middle[1] === symbol && middle[2] === symbol);
          
          if (hasMatch) {
            result.points *= 2;
            result.message += ' (🔥 2x Boost!)';
            break;
          }
        }
      }
    }
    
// OPTIMIZED: Only check Golden Hour and Profit Doubler if we have points
if (result.points > 0) {
  const [hasGoldenHour, hasProfitDoubler] = await Promise.all([
    isBuffActive(username, 'golden_hour', env),
    isBuffActive(username, 'profit_doubler', env)
  ]);
  
  if (hasGoldenHour) {
    result.points = Math.floor(result.points * 1.3);
    result.message += ' (+30%)';
  }
  
  if (hasProfitDoubler && result.points > 100) {
    result.points *= 2;
    result.message += ' (📈 Profit x2!)';
  }
}
    
    // Streak Multiplier: Increases with consecutive wins
    const currentStreakMulti = await getStreakMultiplier(username, env);
    if (result.points > 0 && currentStreakMulti > 1.0) {
      result.points = Math.floor(result.points * currentStreakMulti);
      result.message += ` (🔥 ${currentStreakMulti.toFixed(1)}x Streak!)`;
    }
    
    // Update streak and check for bonuses
    const isWin = result.points > 0 || (result.freeSpins && result.freeSpins > 0);
    const previousStreak = await getStreak(username, env);
    const newStreak = await updateStreak(username, isWin, env);
    
    let streakBonus = 0;
    let streakMessage = '';
    
    // Hot Streak: 5 wins in a row
    if (isWin && newStreak.wins === 5) {
      streakBonus = 500;
      streakMessage = ' 🔥 HOT STREAK! 5 Wins in Folge! +500 DT Bonus!';
      await resetStreak(username, env);
    }
    
    // Comeback King: 5 losses then a win
    if (isWin && previousStreak.losses >= 5) {
      streakBonus = 150;
      streakMessage = ' 👑 COMEBACK KING! Nach 5 Verlusten gewonnen! +150 DT Bonus!';
      await resetStreak(username, env);
    }
    
    // Combo Bonus System
    let comboBonus = 0;
    let comboMessage = '';
    if (isWin && newStreak.wins >= 2 && newStreak.wins < 5) {
      comboBonus = COMBO_BONUSES[newStreak.wins] || 0;
      if (comboBonus > 0) {
        comboMessage = ` 🎯 ${newStreak.wins}x Combo! +${comboBonus} DT!`;
      }
    }
    
    // Rage Mode: Increase chance after losses
    if (!isWin && hasRageMode.active) {
      await incrementRageModeStack(username, env);
      await resetStreakMultiplier(username, env); // Reset streak multiplier on loss
    } else if (isWin && hasRageMode.active) {
      await resetRageModeStack(username, env);
      await incrementStreakMultiplier(username, env); // Increment streak multiplier on win
    } else if (isWin) {
      await incrementStreakMultiplier(username, env); // Increment even without Rage Mode
    } else {
      await resetStreakMultiplier(username, env); // Reset on loss
    }
    
    // Loss Limit Warning: After 10+ losses in a row
    let lossWarningMessage = '';
    if (!isWin && newStreak.losses >= 10) {
      const lossMessages = {
        10: ' 😔 10 Losses in Folge - Möchtest du vielleicht eine Pause einlegen?',
        11: ' 🦡 11 Losses - Der Dachs versteckt sich noch... vielleicht eine kurze Pause?',
        12: ' 🦡💤 12 Losses - Der Dachs macht ein Nickerchen... Pause könnte helfen!',
        13: ' 🦡🌙 13 Losses - Der Dachs träumt vom Gewinn... Morgen vielleicht?',
        14: ' 🦡🍂 14 Losses - Der Dachs sammelt Wintervorräte... Zeit für eine Pause!',
        15: ' 🦡❄️ 15 Losses - Der Dachs überwintert... Komm später wieder!',
        16: ' 🦡🏔️ 16 Losses - Der Dachs ist tief im Bau... Vielleicht morgen mehr Glück?',
        17: ' 🦡🌌 17 Losses - Der Dachs philosophiert über das Leben... Pause empfohlen!',
        18: ' 🦡📚 18 Losses - Der Dachs liest ein Buch... Du auch? Pause! 📖',
        19: ' 🦡🎮 19 Losses - Der Dachs zockt was anderes... Du auch? 🎮',
        20: ' 🦡☕ 20 Losses - Der Dachs trinkt Kaffee und entspannt... Pause seriously! ☕'
      };
      
      // For 21+ losses, rotate through these messages
      const rotatingMessages = [
        ' 🦡🛌 Der Dachs schläft fest... Lass ihn ruhen! 😴',
        ' 🦡🧘 Der Dachs meditiert... Innere Ruhe finden! 🧘‍♂️',
        ' 🦡🎨 Der Dachs malt ein Bild... Kreative Pause! 🎨',
        ' 🦡🏃 Der Dachs macht Sport... Beweg dich auch! 🏃',
        ' 🦡🌳 Der Dachs genießt die Natur... Geh raus! 🌳'
      ];
      
      if (lossMessages[newStreak.losses]) {
        lossWarningMessage = lossMessages[newStreak.losses];
      } else if (newStreak.losses > 20) {
        // Rotate through messages for 21+
        const index = (newStreak.losses - 21) % rotatingMessages.length;
        lossWarningMessage = rotatingMessages[index];
      }
    }
    
    // Mulligan/Insurance
    if (!isFreeSpinUsed && result.points === 0 && !result.freeSpins) {
      const [mulliganCount, insuranceCount] = await Promise.all([
        getMulliganCount(username, env),
        getInsuranceCount(username, env)
      ]);
      
      if (mulliganCount > 0) {
        await decrementMulligan(username, env);
        return new Response(`@${username} 🔄 Mulligan! Du hast noch ${mulliganCount - 1} Re-Spins. Spin nochmal!`, { headers: RESPONSE_HEADERS });
      }
      
      if (insuranceCount > 0) {
        await decrementInsurance(username, env);
        const refund = Math.floor(spinCost * 0.5);
        const newBalanceWithRefund = Math.min(currentBalance - spinCost + refund, MAX_BALANCE);
        
        await Promise.all([
          setBalance(username, newBalanceWithRefund, env),
          updateStats(username, false, result.points, spinCost, env)
        ]);
        
        const rank = await getPrestigeRank(username, env);
        const rankSymbol = rank ? `${rank} ` : '';
        
        return new Response(`@${username} ${rankSymbol}[ ${grid[3]} ${grid[4]} ${grid[5]} ] ║ ${result.message} -${spinCost} (+${refund} Insurance) = -${spinCost - refund} 🛡️ ║ Kontostand: ${newBalanceWithRefund} DachsTaler (${insuranceCount - 1} Insurance übrig)`, { headers: RESPONSE_HEADERS });
      }
    }
    
    const totalBonuses = streakBonus + comboBonus;
    const newBalance = Math.min(currentBalance - spinCost + result.points + totalBonuses, MAX_BALANCE);
    
    await Promise.all([
      setBalance(username, newBalance, env),
      updateStats(username, result.points > 0, result.points, spinCost, env),
      setLastSpin(username, now, env) // Update cooldown timestamp
    ]);
    
    const rank = await getPrestigeRank(username, env);
    const rankSymbol = rank ? `${rank} ` : '';
    
    let remainingCount = 0;
    try {
      const remainingFreeSpins = await getFreeSpins(username, env);
      if (Array.isArray(remainingFreeSpins)) {
        remainingCount = remainingFreeSpins.reduce((sum, fs) => sum + (fs.count || 0), 0);
      }
    } catch (error) {
      console.error('Get Remaining Free Spins Error:', error);
    }
    
    const freeSpinPrefix = isFreeSpinUsed ? `FREE SPIN (${multiplier * 10} DT)${remainingCount > 0 ? ` (${remainingCount} übrig)` : ''} ` : '';
    
    const middleRow = `${grid[3]} ${grid[4]} ${grid[5]}`;
    let message = `@${username} ${rankSymbol}${freeSpinPrefix}[ ${middleRow} ]`;
    
    if (result.freeSpins && result.freeSpins > 0) {
      message += ` ║ ${result.message}`;
    } else if (result.points > 0 || totalBonuses > 0) {
      const totalWin = result.points + totalBonuses;
      const netWin = totalWin - spinCost;
      message += ` ║ ${result.message}`;
      if (result.points > 0) {
        message += ` +${result.points}`;
      }
      if (hourlyJackpotWon) {
        message += ` ⏰ HOURLY JACKPOT! +${HOURLY_JACKPOT_AMOUNT} DT!`;
      }
      if (streakBonus > 0) {
        message += streakMessage;
      }
      if (comboBonus > 0) {
        message += comboMessage;
      }
      if (spinCost > 0) {
        message += ` (-${spinCost}) = ${netWin >= 0 ? '+' : ''}${netWin} 💰`;
      } else {
        message += ` 💰`;
      }
    } else {
      if (spinCost > 0) {
        message += ` ║ ${result.message} -${spinCost} 💸`;
      } else {
        message += ` ║ ${result.message}`;
      }
    }
    
    message += ` ║ Kontostand: ${newBalance} DachsTaler 🦡`;
    
    // Low Balance Warning: Check if under 100 DT and daily is available
    if (newBalance < 100) {
      try {
        const lastDaily = await getLastDaily(username, env);
        const now = Date.now();
        const nowDate = new Date(now);
        const todayUTC = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
        
        let dailyAvailable = false;
        if (!lastDaily) {
          dailyAvailable = true;
        } else {
          const lastDailyDate = new Date(lastDaily);
          const lastDailyUTC = Date.UTC(lastDailyDate.getUTCFullYear(), lastDailyDate.getUTCMonth(), lastDailyDate.getUTCDate());
          dailyAvailable = todayUTC !== lastDailyUTC;
        }
        
        if (dailyAvailable) {
          const hasBoost = await hasUnlock(username, 'daily_boost', env);
          const dailyAmount = hasBoost ? 250 : 50;
          message += ` ⚠️ Niedriger Kontostand! Nutze !slots daily für +${dailyAmount} DT`;
        }
      } catch (error) {
        console.error('Low Balance Warning Check Error:', error);
      }
    }
    
    // Add loss warning if applicable
    if (lossWarningMessage) {
      message += lossWarningMessage;
    }
        
    return new Response(message, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleSlot Error:', error);
    return new Response(`@${username} ❌ Fehler beim Spin.`, { headers: RESPONSE_HEADERS });
  }
}

function calculateWin(grid) {
  const middle = [grid[3], grid[4], grid[5]];
  
  // Count Wild Cards
  const wildCount = middle.filter(s => s === '🃏').length;
  
  // Process wilds: Replace with best matching symbol
  let processedMiddle = [...middle];
  if (wildCount > 0) {
    // Find non-wild symbols
    const nonWildSymbols = middle.filter(s => s !== '🃏');
    
    if (nonWildSymbols.length === 0) {
      // All wilds → treat as best symbol (⭐)
      processedMiddle = ['⭐', '⭐', '⭐'];
    } else if (wildCount === 2) {
      // 2 wilds + 1 symbol → make triple of that symbol
      const symbol = nonWildSymbols[0];
      processedMiddle = [symbol, symbol, symbol];
    } else if (wildCount === 1) {
      // 1 wild → make best pair
      // Find if we already have a pair
      if (nonWildSymbols[0] === nonWildSymbols[1]) {
        // Already a pair, wild makes triple
        processedMiddle = [nonWildSymbols[0], nonWildSymbols[0], nonWildSymbols[0]];
      } else {
        // No pair, wild creates pair with higher value symbol
        const symbol1 = nonWildSymbols[0];
        const symbol2 = nonWildSymbols[1];
        // Use the symbol that appears first (simple heuristic)
        processedMiddle = [symbol1, symbol1, symbol2];
      }
    }
  }
  
  // Check Dachs (using processed middle)
  const dachsCount = processedMiddle.filter(s => s === '🦡').length;
  if (dachsCount === 3) {
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points: 15000, message: '🔥🦡🔥 MEGAAA DACHS JACKPOT!!! 🔥🦡🔥 HOLY MOLY!!!' + wildSuffix };
  }
  if (dachsCount === 2) {
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points: 2500, message: '💥🦡💥 KRASSER DOPPEL-DACHS!!! 💥🦡💥' + wildSuffix };
  }
  if (dachsCount === 1) {
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points: 100, message: '🦡 Dachs gesichtet! Nice!' + wildSuffix };
  }
  
  // Check Diamonds (using ORIGINAL middle, not processed - wilds don't count for free spins)
  if (middle[0] === '💎' && middle[1] === '💎' && middle[2] === '💎') {
    return { points: 0, message: '💎💎💎 DIAMANTEN JACKPOT! +5 FREE SPINS!', freeSpins: 5 };
  }
  
  if ((middle[0] === '💎' && middle[1] === '💎' && middle[2] !== '💎' && middle[2] !== '🃏') || 
      (middle[1] === '💎' && middle[2] === '💎' && middle[0] !== '💎' && middle[0] !== '🃏')) {
    return { points: 0, message: '💎💎 Diamanten! +1 FREE SPIN!', freeSpins: 1 };
  }
  
  // Check Triples (using processed middle)
  if (processedMiddle[0] === processedMiddle[1] && processedMiddle[1] === processedMiddle[2]) {
    const symbol = processedMiddle[0];
    const points = TRIPLE_PAYOUTS[symbol] || 50;
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points, message: `Dreifach ${symbol}!${wildSuffix}` };
  }
  
  // Check Pairs (using processed middle)
  if ((processedMiddle[0] === processedMiddle[1] && processedMiddle[0] !== processedMiddle[2]) || 
      (processedMiddle[1] === processedMiddle[2] && processedMiddle[0] !== processedMiddle[1])) {
    const symbol = processedMiddle[0] === processedMiddle[1] ? processedMiddle[0] : processedMiddle[1];
    const points = PAIR_PAYOUTS[symbol] || 5;
    const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';
    return { points, message: `Doppel ${symbol}!${wildSuffix}` };
  }
  
  const messages = ['Leider verloren! 😢', 'Nächstes Mal!', 'Fast! Versuch es nochmal!', 'Kein Glück diesmal...'];
  return { points: 0, message: messages[Math.floor(Math.random() * messages.length)] };
}

async function handleShop(username, item, env) {
  try {
    if (!item) {
      return new Response(`@${username} Hier findest du den Slots Shop: https://git.new/DachsbauSlotsShop | Nutze: !shop buy [Nummer]`, { headers: RESPONSE_HEADERS });
    }
    
    const parts = item.toLowerCase().split(' ');
    if (parts[0] !== 'buy' || !parts[1]) {
      return new Response(`@${username} ❌ Nutze: !shop buy [Nummer]`, { headers: RESPONSE_HEADERS });
    }
    
    const itemNumber = parseInt(parts[1]);
    if (isNaN(itemNumber) || itemNumber < 1 || itemNumber > 39) {
      return new Response(`@${username} ❌ Ungültige Item-Nummer! Nutze 1-39.`, { headers: RESPONSE_HEADERS });
    }
    
    return await buyShopItem(username, itemNumber, env);
  } catch (error) {
    console.error('handleShop Error:', error);
    return new Response(`@${username} ❌ Fehler beim Shop-Kauf.`, { headers: RESPONSE_HEADERS });
  }
}

async function buyShopItem(username, itemId, env) {
  try {
    const balance = await getBalance(username, env);
    const item = SHOP_ITEMS[itemId];
    
    if (!item) {
      return new Response(`@${username} ❌ Item nicht gefunden!`, { headers: RESPONSE_HEADERS });
    }
    
    if (balance < item.price) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! ${item.name} kostet ${item.price}, du hast ${balance}.`, { headers: RESPONSE_HEADERS });
    }
    
    if (item.type === 'unlock' && item.requires) {
      if (!await hasUnlock(username, item.requires, env)) {
        return new Response(`@${username} ❌ Du musst zuerst ${PREREQUISITE_NAMES[item.requires]} freischalten!`, { headers: RESPONSE_HEADERS });
      }
    }
    
    if (item.type === 'prestige') {
      const currentRank = await getPrestigeRank(username, env);
      const currentIndex = currentRank ? PRESTIGE_RANKS.indexOf(currentRank) : -1;
      const newIndex = PRESTIGE_RANKS.indexOf(item.rank);
      
      if (currentIndex >= newIndex) {
        return new Response(`@${username} ❌ Du hast bereits ${currentRank} oder höher!`, { headers: RESPONSE_HEADERS });
      }
      
      if (item.requiresRank) {
        const requiredIndex = PRESTIGE_RANKS.indexOf(item.requiresRank);
        if (currentIndex < requiredIndex) {
          return new Response(`@${username} ❌ Du musst zuerst den ${item.requiresRank} Rang kaufen!`, { headers: RESPONSE_HEADERS });
        }
      }
      
      await Promise.all([
        setPrestigeRank(username, item.rank, env),
        setBalance(username, balance - item.price, env)
      ]);
      
      return new Response(`@${username} ✅ ${item.name} gekauft! Dein Rang: ${item.rank} | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }
    
    if (item.type === 'unlock') {
      if (await hasUnlock(username, item.unlockKey, env)) {
        return new Response(`@${username} ❌ Du hast ${item.name} bereits freigeschaltet!`, { headers: RESPONSE_HEADERS });
      }
      await Promise.all([
        setUnlock(username, item.unlockKey, env),
        setBalance(username, balance - item.price, env)
      ]);
      return new Response(`@${username} ✅ ${item.name} freigeschaltet! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }
    
    if (item.type === 'timed') {
      await Promise.all([
        setBalance(username, balance - item.price, env)
      ]);
      
      // Special handling for buffs with uses
      if (item.uses) {
        await activateBuffWithUses(username, item.buffKey, item.duration, item.uses, env);
        return new Response(`@${username} ✅ ${item.name} aktiviert für ${item.uses} Spins! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
      } else if (item.buffKey === 'rage_mode') {
        await activateBuffWithStack(username, item.buffKey, item.duration, env);
        const minutes = Math.floor(item.duration / 60);
        return new Response(`@${username} ✅ ${item.name} aktiviert für ${minutes} Minuten! Verluste geben +5% Gewinn-Chance (bis 50%)! 🔥 | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
      } else {
        await activateBuff(username, item.buffKey, item.duration, env);
        const minutes = Math.floor(item.duration / 60);
        const hours = item.duration >= 3600 ? Math.floor(item.duration / 3600) + 'h' : minutes + ' Minuten';
        return new Response(`@${username} ✅ ${item.name} aktiviert für ${hours}! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
      }
    }
    
    if (item.type === 'boost') {
      // Check weekly limit for Dachs-Boost
      if (item.weeklyLimit) {
        // Check if boost is already active
        const boostKey = `boost:${username.toLowerCase()}:${item.symbol}`;
        const existingBoost = await env.SLOTS_KV.get(boostKey);
        
        if (existingBoost === 'active') {
          return new Response(`@${username} ❌ Du hast bereits einen aktiven ${item.name}! Nutze ihn erst, bevor du einen neuen kaufst.`, { headers: RESPONSE_HEADERS });
        }
        
        const purchases = await getDachsBoostPurchases(username, env);
        if (purchases.count >= 1) {
          return new Response(`@${username} ❌ Wöchentliches Limit erreicht! Du kannst maximal 1 Dachs-Boost pro Woche kaufen. Nächster Reset: Montag 00:00 UTC`, { headers: RESPONSE_HEADERS });
        }
        
        await Promise.all([
          setBalance(username, balance - item.price, env),
          addBoost(username, item.symbol, env),
          incrementDachsBoostPurchases(username, env)
        ]);
        
        return new Response(`@${username} ✅ ${item.name} aktiviert! Dein nächster Gewinn mit ${item.symbol} wird verdoppelt! | Kontostand: ${balance - item.price} 🦡 | Du kannst diese Woche keinen weiteren Dachs-Boost kaufen`, { headers: RESPONSE_HEADERS });
      }
      
      await Promise.all([
        setBalance(username, balance - item.price, env),
        addBoost(username, item.symbol, env)
      ]);
      return new Response(`@${username} ✅ ${item.name} aktiviert! Dein nächster Gewinn mit ${item.symbol} wird verdoppelt! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }
    
    if (item.type === 'insurance') {
      await Promise.all([
        setBalance(username, balance - item.price, env),
        addInsurance(username, 5, env)
      ]);
      return new Response(`@${username} ✅ Insurance Pack erhalten! Die nächsten 5 Verluste geben 50% des Einsatzes zurück! 🛡️ | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }
    
    if (item.type === 'winmulti') {
      await Promise.all([
        setBalance(username, balance - item.price, env),
        addWinMultiplier(username, env)
      ]);
      return new Response(`@${username} ✅ Win Multiplier aktiviert! Dein nächster Gewinn wird x2! ⚡ | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }
    
    if (item.type === 'bundle') {
      const purchases = await getSpinBundlePurchases(username, env);
      if (purchases.count >= 3) {
        return new Response(`@${username} ❌ Wöchentliches Limit erreicht! Du kannst maximal 3 Spin Bundles pro Woche kaufen. Nächster Reset: Montag 00:00 UTC`, { headers: RESPONSE_HEADERS });
      }
      
      await Promise.all([
        setBalance(username, balance - item.price, env),
        addFreeSpinsWithMultiplier(username, 10, 1, env),
        incrementSpinBundlePurchases(username, env)
      ]);
      
      const remainingPurchases = 3 - (purchases.count + 1);
      return new Response(`@${username} ✅ Spin Bundle erhalten! 10 Free Spins (10 DT) gutgeschrieben! | Kontostand: ${balance - item.price} 🦡 | Noch ${remainingPurchases} Käufe diese Woche möglich`, { headers: RESPONSE_HEADERS });
    }
    
    if (item.type === 'peek') {
      await setBalance(username, balance - item.price, env);
      const hasLuckyCharm = await isBuffActive(username, 'lucky_charm', env);
      const testDachsChance = hasLuckyCharm ? 1 / 75 : 1 / 150;
      const testGrid = [];
      for (let i = 0; i < 9; i++) {
        if (Math.random() < testDachsChance) {
          testGrid.push('🦡');
        } else {
          testGrid.push(WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)]);
        }
      }
      const testResult = calculateWin(testGrid);
      const willWin = testResult.points > 0 || (testResult.freeSpins && testResult.freeSpins > 0);
      const charmText = hasLuckyCharm ? ' (🍀 Lucky Charm aktiv!)' : '';
      return new Response(`@${username} 🔮 Peek Token! Dein nächster Spin wird ${willWin ? '✅ GEWINNEN' : '❌ VERLIEREN'}! 🔮${charmText} | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }
    
    if (item.type === 'instant') {
      await setBalance(username, balance - item.price, env);
      
      if (itemId === 11) { // Chaos Spin
        const result = Math.floor(Math.random() * 701) - 300;
        const newBalance = Math.min(balance - item.price + result, MAX_BALANCE);
        await setBalance(username, Math.max(0, newBalance), env);
        return new Response(`@${username} 🎲 Chaos Spin! ${result >= 0 ? '+' : ''}${result} DachsTaler! | Kontostand: ${Math.max(0, newBalance)}`, { headers: RESPONSE_HEADERS });
      }
      
      if (itemId === 12) { // Glücksrad
        const wheel = spinWheel();
        const newBalance = Math.min(balance - item.price + wheel.prize, MAX_BALANCE);
        await setBalance(username, newBalance, env);
        const netResult = wheel.prize - item.price;
        return new Response(`@${username} 🎡 [ ${wheel.result} ] ${wheel.message} ${netResult >= 0 ? '+' : ''}${netResult} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
      }
      
if (itemId === 16) { // Mystery Box
        const mysteryItems = [
          2, 3, 4, 5, 6, 7, 8,    // Symbol-Boosts (7)
          9, 10,                   // Utility Items (2)
          14, 20, 24,              // Timed Buffs Classic (3)
          32, 33, 34, 35, 39       // Timed Buffs Premium (5)
        ]; // Total: 17 Items (Stats Tracker, Unlocks, Prestige, Instants excluded)
        const mysteryItemId = mysteryItems[Math.floor(Math.random() * mysteryItems.length)];
        const mysteryResult = SHOP_ITEMS[mysteryItemId];
        
        if (mysteryResult.type === 'boost') {
          await addBoost(username, mysteryResult.symbol, env);
        } else if (mysteryResult.type === 'insurance') {
          await addInsurance(username, 5, env);
        } else if (mysteryResult.type === 'winmulti') {
          await addWinMultiplier(username, env);
        } else if (mysteryResult.type === 'timed') {
          await activateBuff(username, mysteryResult.buffKey, mysteryResult.duration, env);
        }
        
        return new Response(`@${username} 📦 Mystery Box! Du hast gewonnen: ${mysteryResult.name} (Wert: ${mysteryResult.price})! Item wurde aktiviert! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
      }
      
      if (itemId === 31) { // Reverse Chaos (NEW)
        const result = Math.floor(Math.random() * 151) + 50; // 50-200 DT guaranteed positive
        const newBalance = Math.min(balance - item.price + result, MAX_BALANCE);
        await setBalance(username, newBalance, env);
        return new Response(`@${username} 🎲 Reverse Chaos! +${result} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
      }
      
      if (itemId === 36) { // Diamond Mine (NEW)
        const freeSpinsAmount = Math.floor(Math.random() * 3) + 3; // 3-5 free spins
        await addFreeSpinsWithMultiplier(username, freeSpinsAmount, 1, env);
        return new Response(`@${username} 💎 Diamond Mine! Du hast ${freeSpinsAmount} Free Spins gefunden! 💎 | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
      }
      
      if (itemId === 37) { // Guaranteed Pair
        await activateGuaranteedPair(username, env);
        return new Response(`@${username} ✅ Guaranteed Pair aktiviert! Dein nächster Spin hat garantiert mindestens ein Pair! 🎯 | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
      }
      
      if (itemId === 38) { // Wild Card
        await activateWildCard(username, env);
        return new Response(`@${username} ✅ Wild Card aktiviert! Dein nächster Spin enthält ein 🃏 Wild Symbol! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
      }
    }
    
    return new Response(`@${username} ✅ ${item.name} gekauft! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('buyShopItem Error:', error);
    return new Response(`@${username} ❌ Fehler beim Item-Kauf.`, { headers: RESPONSE_HEADERS });
  }
}

function spinWheel() {
  const rand = Math.random() * 100;
  if (rand < 1) {
    if (Math.random() < 0.00032) return { result: '🦡 🦡 🦡 🦡 🦡', message: '🔥 5x DACHS JACKPOT! 🔥', prize: 100000 };
    return { result: '🦡 🦡 💎 ⭐ 💰', message: 'Dachse!', prize: 500 };
  }
  if (rand < 5) return { result: '💎 💎 💎 ⭐ 💰', message: 'Diamanten!', prize: 1000 };
  if (rand < 20) return { result: '💰 💰 💰 ⭐ 💸', message: 'Gold!', prize: 400 };
  if (rand < 50) return { result: '⭐ ⭐ ⭐ 💰 💸', message: 'Sterne!', prize: 200 };
  return { result: '💸 💸 ⭐ 💰 🦡', message: 'Leider verloren!', prize: 0 };
}

// KV Helper Functions
async function getBalance(username, env) {
  try {
    const key = `user:${username.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === null) {
      await setBalance(username, 100, env);
      return 100;
    }
    const balance = parseInt(value);
    return isNaN(balance) ? 100 : Math.min(balance, MAX_BALANCE);
  } catch (error) {
    console.error('getBalance Error:', error);
    return 100;
  }
}

async function setBalance(username, balance, env) {
  try {
    const safeBalance = Math.max(0, Math.min(balance, MAX_BALANCE));
    await env.SLOTS_KV.put(`user:${username.toLowerCase()}`, safeBalance.toString());
  } catch (error) {
    console.error('setBalance Error:', error);
  }
}

async function getLastDaily(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`daily:${username.toLowerCase()}`);
    return value ? parseInt(value) : null;
  } catch (error) {
    console.error('getLastDaily Error:', error);
    return null;
  }
}

async function setLastDaily(username, timestamp, env) {
  try {
    await env.SLOTS_KV.put(`daily:${username.toLowerCase()}`, timestamp.toString(), { expirationTtl: MS_PER_DAY + 1000 });
  } catch (error) {
    console.error('setLastDaily Error:', error);
  }
}

// Cooldown System
async function getLastSpin(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`cooldown:${username.toLowerCase()}`);
    return value ? parseInt(value) : null;
  } catch (error) {
    console.error('getLastSpin Error:', error);
    return null;
  }
}

async function setLastSpin(username, timestamp, env) {
  try {
    // Auto-expire after 60 seconds (2x cooldown time for safety)
    await env.SLOTS_KV.put(`cooldown:${username.toLowerCase()}`, timestamp.toString(), { expirationTtl: 60 });
  } catch (error) {
    console.error('setLastSpin Error:', error);
  }
}

// First-Time User System
async function hasAcceptedDisclaimer(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`disclaimer:${username.toLowerCase()}`);
    return value === 'accepted';
  } catch (error) {
    console.error('hasAcceptedDisclaimer Error:', error);
    return false;
  }
}

async function setDisclaimerAccepted(username, env) {
  try {
    await env.SLOTS_KV.put(`disclaimer:${username.toLowerCase()}`, 'accepted');
  } catch (error) {
    console.error('setDisclaimerAccepted Error:', error);
  }
}

// Selfban System
async function isSelfBanned(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`selfban:${username.toLowerCase()}`);
    if (!value) return null;
    return JSON.parse(value); // Returns { timestamp, date }
  } catch (error) {
    console.error('isSelfBanned Error:', error);
    return null;
  }
}

async function setSelfBan(username, env) {
  try {
    const now = Date.now();
    const date = new Date(now).toLocaleString('de-DE', { 
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const banData = {
      timestamp: now,
      date: date
    };
    
    await env.SLOTS_KV.put(`selfban:${username.toLowerCase()}`, JSON.stringify(banData));
  } catch (error) {
    console.error('setSelfBan Error:', error);
  }
}

async function removeSelfBan(username, env) {
  try {
    await env.SLOTS_KV.delete(`selfban:${username.toLowerCase()}`);
  } catch (error) {
    console.error('removeSelfBan Error:', error);
  }
}

// Monthly Login System
async function getMonthlyLogin(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`monthlylogin:${username.toLowerCase()}`);
    const currentMonth = getCurrentMonth();
    
    if (!value) {
      return { month: currentMonth, days: [], claimedMilestones: [] };
    }
    
    const data = JSON.parse(value);
    
    // Reset if new month
    if (data.month !== currentMonth) {
      return { month: currentMonth, days: [], claimedMilestones: [] };
    }
    
    return data;
  } catch (error) {
    console.error('getMonthlyLogin Error:', error);
    const currentMonth = getCurrentMonth();
    return { month: currentMonth, days: [], claimedMilestones: [] };
  }
}

async function updateMonthlyLogin(username, env) {
  try {
    const monthlyLogin = await getMonthlyLogin(username, env);
    const today = getCurrentDate();
    
    // Check if today is already logged
    if (!monthlyLogin.days.includes(today)) {
      monthlyLogin.days.push(today);
      monthlyLogin.days.sort(); // Keep sorted
    }
    
    await env.SLOTS_KV.put(`monthlylogin:${username.toLowerCase()}`, JSON.stringify(monthlyLogin));
    return monthlyLogin;
  } catch (error) {
    console.error('updateMonthlyLogin Error:', error);
    const currentMonth = getCurrentMonth();
    return { month: currentMonth, days: [], claimedMilestones: [] };
  }
}

async function markMilestoneClaimed(username, milestone, env) {
  try {
    const monthlyLogin = await getMonthlyLogin(username, env);
    
    if (!monthlyLogin.claimedMilestones.includes(milestone)) {
      monthlyLogin.claimedMilestones.push(milestone);
      await env.SLOTS_KV.put(`monthlylogin:${username.toLowerCase()}`, JSON.stringify(monthlyLogin));
    }
  } catch (error) {
    console.error('markMilestoneClaimed Error:', error);
  }
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getCurrentDate() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

// Guaranteed Pair
async function activateGuaranteedPair(username, env) {
  await env.SLOTS_KV.put(`guaranteedpair:${username.toLowerCase()}`, 'active');
}

async function hasGuaranteedPair(username, env) {
  const value = await env.SLOTS_KV.get(`guaranteedpair:${username.toLowerCase()}`);
  return value === 'active';
}

async function consumeGuaranteedPair(username, env) {
  await env.SLOTS_KV.delete(`guaranteedpair:${username.toLowerCase()}`);
}

// Wild Card
async function activateWildCard(username, env) {
  await env.SLOTS_KV.put(`wildcard:${username.toLowerCase()}`, 'active');
}

async function hasWildCard(username, env) {
  const value = await env.SLOTS_KV.get(`wildcard:${username.toLowerCase()}`);
  return value === 'active';
}

async function consumeWildCard(username, env) {
  await env.SLOTS_KV.delete(`wildcard:${username.toLowerCase()}`);
}

// Streak Multiplier
async function getStreakMultiplier(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`streakmultiplier:${username.toLowerCase()}`);
    return value ? parseFloat(value) : 1.0;
  } catch (error) {
    return 1.0;
  }
}

async function incrementStreakMultiplier(username, env) {
  try {
    const current = await getStreakMultiplier(username, env);
    const newMultiplier = Math.min(current + 0.1, 3.0); // Max 3.0x
    await env.SLOTS_KV.put(`streakmultiplier:${username.toLowerCase()}`, newMultiplier.toFixed(1));
    return newMultiplier;
  } catch (error) {
    return 1.0;
  }
}

async function resetStreakMultiplier(username, env) {
  await env.SLOTS_KV.delete(`streakmultiplier:${username.toLowerCase()}`);
}

async function getPrestigeRank(username, env) {
  try {
    return await env.SLOTS_KV.get(`rank:${username.toLowerCase()}`);
  } catch (error) {
    console.error('getPrestigeRank Error:', error);
    return null;
  }
}

async function setPrestigeRank(username, rank, env) {
  try {
    await env.SLOTS_KV.put(`rank:${username.toLowerCase()}`, rank);
  } catch (error) {
    console.error('setPrestigeRank Error:', error);
  }
}

async function hasUnlock(username, unlockKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`unlock:${username.toLowerCase()}:${unlockKey}`);
    return value === 'true';
  } catch (error) {
    console.error('hasUnlock Error:', error);
    return false;
  }
}

async function setUnlock(username, unlockKey, env) {
  try {
    await env.SLOTS_KV.put(`unlock:${username.toLowerCase()}:${unlockKey}`, 'true');
  } catch (error) {
    console.error('setUnlock Error:', error);
  }
}

async function activateBuff(username, buffKey, duration, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, expireAt.toString(), { expirationTtl: duration + 60 });
  } catch (error) {
    console.error('activateBuff Error:', error);
  }
}

async function isBuffActive(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return false;
    return Date.now() < parseInt(value);
  } catch (error) {
    console.error('isBuffActive Error:', error);
    return false;
  }
}

// Buff with uses (Dachs Locator)
async function activateBuffWithUses(username, buffKey, duration, uses, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    const data = { expireAt, uses };
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, JSON.stringify(data), { expirationTtl: duration + 60 });
  } catch (error) {
    console.error('activateBuffWithUses Error:', error);
  }
}

async function getBuffWithUses(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return { active: false, uses: 0 };
    
    const data = JSON.parse(value);
    if (Date.now() >= data.expireAt || data.uses <= 0) {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, uses: 0 };
    }
    
    return { active: true, uses: data.uses };
  } catch (error) {
    console.error('getBuffWithUses Error:', error);
    return { active: false, uses: 0 };
  }
}

async function decrementBuffUses(username, buffKey, env) {
  try {
    const buff = await getBuffWithUses(username, buffKey, env);
    if (buff.active && buff.uses > 0) {
      const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
      const data = JSON.parse(value);
      data.uses--;
      
      if (data.uses <= 0) {
        await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      } else {
        const ttl = Math.floor((data.expireAt - Date.now()) / 1000);
        await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, JSON.stringify(data), { expirationTtl: ttl + 60 });
      }
    }
  } catch (error) {
    console.error('decrementBuffUses Error:', error);
  }
}

// Buff with stack (Rage Mode)
async function activateBuffWithStack(username, buffKey, duration, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    const data = { expireAt, stack: 0 };
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, JSON.stringify(data), { expirationTtl: duration + 60 });
  } catch (error) {
    console.error('activateBuffWithStack Error:', error);
  }
}

async function getBuffWithStack(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return { active: false, stack: 0 };
    
    const data = JSON.parse(value);
    if (Date.now() >= data.expireAt) {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, stack: 0 };
    }
    
    return { active: true, stack: data.stack || 0 };
  } catch (error) {
    console.error('getBuffWithStack Error:', error);
    return { active: false, stack: 0 };
  }
}

async function incrementRageModeStack(username, env) {
  try {
    const buff = await getBuffWithStack(username, 'rage_mode', env);
    if (buff.active) {
      const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:rage_mode`);
      const data = JSON.parse(value);
      data.stack = Math.min((data.stack || 0) + 5, 50); // +5% per loss, max 50%
      
      const ttl = Math.floor((data.expireAt - Date.now()) / 1000);
      await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:rage_mode`, JSON.stringify(data), { expirationTtl: ttl + 60 });
    }
  } catch (error) {
    console.error('incrementRageModeStack Error:', error);
  }
}

async function resetRageModeStack(username, env) {
  try {
    const buff = await getBuffWithStack(username, 'rage_mode', env);
    if (buff.active) {
      const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:rage_mode`);
      const data = JSON.parse(value);
      data.stack = 0;
      
      const ttl = Math.floor((data.expireAt - Date.now()) / 1000);
      await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:rage_mode`, JSON.stringify(data), { expirationTtl: ttl + 60 });
    }
  } catch (error) {
    console.error('resetRageModeStack Error:', error);
  }
}

async function addBoost(username, symbol, env) {
  try {
    await env.SLOTS_KV.put(`boost:${username.toLowerCase()}:${symbol}`, 'active');
  } catch (error) {
    console.error('addBoost Error:', error);
  }
}

async function consumeBoost(username, symbol, env) {
  try {
    const key = `boost:${username.toLowerCase()}:${symbol}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === 'active') {
      await env.SLOTS_KV.delete(key);
      return true;
    }
    return false;
  } catch (error) {
    console.error('consumeBoost Error:', error);
    return false;
  }
}

async function getMulliganCount(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`mulligan:${username.toLowerCase()}`);
    return value ? parseInt(value) : 0;
  } catch (error) {
    console.error('getMulliganCount Error:', error);
    return 0;
  }
}

async function decrementMulligan(username, env) {
  try {
    const current = await getMulliganCount(username, env);
    if (current > 0) {
      await env.SLOTS_KV.put(`mulligan:${username.toLowerCase()}`, (current - 1).toString());
    }
  } catch (error) {
    console.error('decrementMulligan Error:', error);
  }
}

async function addInsurance(username, count, env) {
  try {
    const current = await getInsuranceCount(username, env);
    await env.SLOTS_KV.put(`insurance:${username.toLowerCase()}`, (current + count).toString());
  } catch (error) {
    console.error('addInsurance Error:', error);
  }
}

async function getInsuranceCount(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`insurance:${username.toLowerCase()}`);
    return value ? parseInt(value) : 0;
  } catch (error) {
    console.error('getInsuranceCount Error:', error);
    return 0;
  }
}

async function decrementInsurance(username, env) {
  try {
    const current = await getInsuranceCount(username, env);
    if (current > 0) {
      await env.SLOTS_KV.put(`insurance:${username.toLowerCase()}`, (current - 1).toString());
    }
  } catch (error) {
    console.error('decrementInsurance Error:', error);
  }
}

async function addSpinBundle(username, count, env) {
  try {
    const current = await getSpinBundleCount(username, env);
    await env.SLOTS_KV.put(`bundle:${username.toLowerCase()}`, (current + count).toString());
  } catch (error) {
    console.error('addSpinBundle Error:', error);
  }
}

async function getSpinBundleCount(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`bundle:${username.toLowerCase()}`);
    return value ? parseInt(value) : 0;
  } catch (error) {
    console.error('getSpinBundleCount Error:', error);
    return 0;
  }
}

async function decrementSpinBundle(username, env) {
  try {
    const current = await getSpinBundleCount(username, env);
    if (current > 0) {
      await env.SLOTS_KV.put(`bundle:${username.toLowerCase()}`, (current - 1).toString());
    }
  } catch (error) {
    console.error('decrementSpinBundle Error:', error);
  }
}

async function getSpinBundlePurchases(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`bundle_purchases:${username.toLowerCase()}`);
    if (!value) return { count: 0, weekStart: getWeekStart() };
    const data = JSON.parse(value);
    
    const currentWeekStart = getWeekStart();
    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }
    
    return data;
  } catch (error) {
    console.error('getSpinBundlePurchases Error:', error);
    return { count: 0, weekStart: getWeekStart() };
  }
}

async function incrementSpinBundlePurchases(username, env) {
  try {
    const data = await getSpinBundlePurchases(username, env);
    data.count++;
    await env.SLOTS_KV.put(`bundle_purchases:${username.toLowerCase()}`, JSON.stringify(data));
  } catch (error) {
    console.error('incrementSpinBundlePurchases Error:', error);
  }
}

function getWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

async function getDachsBoostPurchases(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`dachsboost_purchases:${username.toLowerCase()}`);
    if (!value) return { count: 0, weekStart: getWeekStart() };
    const data = JSON.parse(value);
    
    const currentWeekStart = getWeekStart();
    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }
    
    return data;
  } catch (error) {
    console.error('getDachsBoostPurchases Error:', error);
    return { count: 0, weekStart: getWeekStart() };
  }
}

async function incrementDachsBoostPurchases(username, env) {
  try {
    const data = await getDachsBoostPurchases(username, env);
    data.count++;
    await env.SLOTS_KV.put(`dachsboost_purchases:${username.toLowerCase()}`, JSON.stringify(data));
  } catch (error) {
    console.error('incrementDachsBoostPurchases Error:', error);
  }
}

async function addWinMultiplier(username, env) {
  try {
    await env.SLOTS_KV.put(`winmulti:${username.toLowerCase()}`, 'active');
  } catch (error) {
    console.error('addWinMultiplier Error:', error);
  }
}

async function consumeWinMultiplier(username, env) {
  try {
    const key = `winmulti:${username.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === 'active') {
      await env.SLOTS_KV.delete(key);
      return true;
    }
    return false;
  } catch (error) {
    console.error('consumeWinMultiplier Error:', error);
    return false;
  }
}

async function getFreeSpins(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`freespins:${username.toLowerCase()}`);
    if (!value || value === 'null' || value === 'undefined') return [];
    
    const parsed = JSON.parse(value);
    
    if (!Array.isArray(parsed)) {
      console.error('Invalid free spins structure (not array):', parsed);
      return [];
    }
    
    const valid = parsed.filter(fs => 
      fs && 
      typeof fs === 'object' && 
      typeof fs.multiplier === 'number' && 
      typeof fs.count === 'number' &&
      fs.multiplier > 0 &&
      fs.count > 0
    );
    
    return valid;
  } catch (error) {
    console.error('getFreeSpins Error:', error);
    return [];
  }
}

async function addFreeSpinsWithMultiplier(username, count, multiplier, env) {
  try {
    if (typeof count !== 'number' || count <= 0 || typeof multiplier !== 'number' || multiplier <= 0) {
      console.error('Invalid free spin parameters:', { count, multiplier });
      return;
    }
    
    const freeSpins = await getFreeSpins(username, env);
    
    const existing = freeSpins.find(fs => fs.multiplier === multiplier);
    if (existing) {
      existing.count += count;
    } else {
      freeSpins.push({ multiplier, count });
    }
    
    freeSpins.sort((a, b) => a.multiplier - b.multiplier);
    
    await env.SLOTS_KV.put(`freespins:${username.toLowerCase()}`, JSON.stringify(freeSpins));
  } catch (error) {
    console.error('addFreeSpinsWithMultiplier Error:', error);
  }
}

async function consumeFreeSpinWithMultiplier(username, env) {
  try {
    const freeSpins = await getFreeSpins(username, env);
    
    if (!freeSpins || !Array.isArray(freeSpins) || freeSpins.length === 0) {
      return { used: false, multiplier: 0 };
    }
    
    const lowestEntry = freeSpins[0];
    
    if (!lowestEntry || typeof lowestEntry !== 'object') {
      console.error('Invalid lowest entry:', lowestEntry);
      return { used: false, multiplier: 0 };
    }
    
    if (typeof lowestEntry.count !== 'number' || typeof lowestEntry.multiplier !== 'number') {
      console.error('Invalid entry types:', lowestEntry);
      return { used: false, multiplier: 0 };
    }
    
    if (lowestEntry.multiplier <= 0 || lowestEntry.count <= 0) {
      console.error('Invalid entry values:', lowestEntry);
      return { used: false, multiplier: 0 };
    }
    
    const multiplierToReturn = lowestEntry.multiplier;
    lowestEntry.count--;
    
    if (lowestEntry.count <= 0) {
      freeSpins.shift();
    }
    
    await env.SLOTS_KV.put(`freespins:${username.toLowerCase()}`, JSON.stringify(freeSpins));
    
    return { used: true, multiplier: multiplierToReturn };
  } catch (error) {
    console.error('consumeFreeSpinWithMultiplier Error:', error);
    return { used: false, multiplier: 0 };
  }
}

async function getStreak(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`streak:${username.toLowerCase()}`);
    if (!value) return { wins: 0, losses: 0 };
    return JSON.parse(value);
  } catch (error) {
    console.error('getStreak Error:', error);
    return { wins: 0, losses: 0 };
  }
}

async function updateStreak(username, isWin, env) {
  try {
    const streak = await getStreak(username, env);
    
    if (isWin) {
      streak.wins++;
      streak.losses = 0;
    } else {
      streak.losses++;
      streak.wins = 0;
    }
    
    await env.SLOTS_KV.put(`streak:${username.toLowerCase()}`, JSON.stringify(streak), { expirationTtl: MS_PER_DAY * 7 });
    return streak;
  } catch (error) {
    console.error('updateStreak Error:', error);
    return { wins: 0, losses: 0 };
  }
}

async function resetStreak(username, env) {
  try {
    await env.SLOTS_KV.put(`streak:${username.toLowerCase()}`, JSON.stringify({ wins: 0, losses: 0 }));
  } catch (error) {
    console.error('resetStreak Error:', error);
  }
}

async function getStats(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`stats:${username.toLowerCase()}`);
    if (!value) return { totalSpins: 0, wins: 0, biggestWin: 0, totalWon: 0, totalLost: 0 };
    return JSON.parse(value);
  } catch (error) {
    console.error('getStats Error:', error);
    return { totalSpins: 0, wins: 0, biggestWin: 0, totalWon: 0, totalLost: 0 };
  }
}

async function updateStats(username, isWin, winAmount, lostAmount, env) {
  try {
    const stats = await getStats(username, env);
    stats.totalSpins++;
    if (isWin) {
      stats.wins++;
      stats.totalWon += winAmount;
      if (winAmount > stats.biggestWin) stats.biggestWin = winAmount;
    } else {
      stats.totalLost += lostAmount;
    }
    await env.SLOTS_KV.put(`stats:${username.toLowerCase()}`, JSON.stringify(stats));
  } catch (error) {
    console.error('updateStats Error:', error);
  }
}

async function isBlacklisted(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`blacklist:${username.toLowerCase()}`);
    return value === 'true';
  } catch (error) {
    console.error('isBlacklisted Error:', error);
    return false;
  }
}

function isLeaderboardBlocked(username) {
  const leaderboardBlocklist = [];
  return leaderboardBlocklist.includes(username.toLowerCase());
}
