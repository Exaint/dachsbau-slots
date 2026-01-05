import { MAX_BALANCE, BANK_USERNAME, BANK_START_BALANCE } from './constants.js';
import { getCurrentMonth, getCurrentDate, getWeekStart } from './utils.js';

// Balance Functions
async function getBalance(username, env) {
  try {
    const key = `user:${username.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === null) {
      await setBalance(username, 100, env);
      return 100;
    }
    const balance = parseInt(value, 10);
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

// Daily Functions
async function getLastDaily(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`daily:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    console.error('getLastDaily Error:', error);
    return null;
  }
}

async function setLastDaily(username, timestamp, env) {
  try {
    await env.SLOTS_KV.put(`daily:${username.toLowerCase()}`, timestamp.toString(), { expirationTtl: 86400 + 3600 }); // 1 day + 1 hour buffer in seconds
  } catch (error) {
    console.error('setLastDaily Error:', error);
  }
}

// Cooldown System
async function getLastSpin(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`cooldown:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : null;
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

// Prestige Rank
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

// Unlocks
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

// Buffs
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
    return Date.now() < parseInt(value, 10);
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

// OPTIMIZED: Return full data object to avoid redundant reads
async function getBuffWithUses(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return { active: false, uses: 0, data: null };

    const data = JSON.parse(value);
    if (Date.now() >= data.expireAt || data.uses <= 0) {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, uses: 0, data: null };
    }

    return { active: true, uses: data.uses, data };
  } catch (error) {
    console.error('getBuffWithUses Error:', error);
    return { active: false, uses: 0, data: null };
  }
}

// OPTIMIZED: Use data from getBuffWithUses to avoid redundant KV read
async function decrementBuffUses(username, buffKey, env) {
  try {
    const buff = await getBuffWithUses(username, buffKey, env);
    if (buff.active && buff.uses > 0 && buff.data) {
      const data = buff.data;
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

// OPTIMIZED: Return full data object to avoid redundant reads
async function getBuffWithStack(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return { active: false, stack: 0, data: null };

    const data = JSON.parse(value);
    if (Date.now() >= data.expireAt) {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, stack: 0, data: null };
    }

    return { active: true, stack: data.stack || 0, data };
  } catch (error) {
    console.error('getBuffWithStack Error:', error);
    return { active: false, stack: 0, data: null };
  }
}

// OPTIMIZED: Use data from getBuffWithStack to avoid redundant KV read
async function incrementRageModeStack(username, env) {
  try {
    const buff = await getBuffWithStack(username, 'rage_mode', env);
    if (buff.active && buff.data) {
      const data = buff.data;
      data.stack = Math.min((data.stack || 0) + 5, 50); // +5% per loss, max 50%

      const ttl = Math.floor((data.expireAt - Date.now()) / 1000);
      await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:rage_mode`, JSON.stringify(data), { expirationTtl: ttl + 60 });
    }
  } catch (error) {
    console.error('incrementRageModeStack Error:', error);
  }
}

// OPTIMIZED: Use data from getBuffWithStack to avoid redundant KV read
async function resetRageModeStack(username, env) {
  try {
    const buff = await getBuffWithStack(username, 'rage_mode', env);
    if (buff.active && buff.data) {
      const data = buff.data;
      data.stack = 0;

      const ttl = Math.floor((data.expireAt - Date.now()) / 1000);
      await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:rage_mode`, JSON.stringify(data), { expirationTtl: ttl + 60 });
    }
  } catch (error) {
    console.error('resetRageModeStack Error:', error);
  }
}

// Boosts
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

// Mulligan
async function getMulliganCount(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`mulligan:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : 0;
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

// Insurance
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
    return value ? parseInt(value, 10) : 0;
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

// Spin Bundle Purchases
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

// Dachs Boost Purchases
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

// Win Multiplier
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

// Free Spins
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

// Streaks
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

    await env.SLOTS_KV.put(`streak:${username.toLowerCase()}`, JSON.stringify(streak), { expirationTtl: 604800 }); // 7 days in seconds
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

// Stats
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

// Blacklist
async function isBlacklisted(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`blacklist:${username.toLowerCase()}`);
    return value === 'true';
  } catch (error) {
    console.error('isBlacklisted Error:', error);
    return false;
  }
}

// DachsBank Helper Functions
async function updateBankBalance(amount, env) {
  try {
    let bankBalance = await env.SLOTS_KV.get(`user:${BANK_USERNAME}`);

    // Initialize bank if doesn't exist
    if (bankBalance === null) {
      bankBalance = BANK_START_BALANCE;
    } else {
      bankBalance = parseInt(bankBalance, 10);
    }

    // Update balance (can go negative)
    const newBalance = bankBalance + amount;
    await env.SLOTS_KV.put(`user:${BANK_USERNAME}`, newBalance.toString());

    return newBalance;
  } catch (error) {
    console.error('updateBankBalance Error:', error);
  }
}

async function getBankBalance(env) {
  try {
    let bankBalance = await env.SLOTS_KV.get(`user:${BANK_USERNAME}`);

    if (bankBalance === null) {
      // Initialize bank
      await env.SLOTS_KV.put(`user:${BANK_USERNAME}`, BANK_START_BALANCE.toString());
      return BANK_START_BALANCE;
    }

    return parseInt(bankBalance, 10);
  } catch (error) {
    console.error('getBankBalance Error:', error);
    return BANK_START_BALANCE;
  }
}

// Hourly Jackpot
async function checkAndClaimHourlyJackpot(env) {
  const now = new Date();
  const currentSecond = now.getUTCSeconds();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDate();
  const currentMonth = now.getUTCMonth();
  const seed = currentDay * 100 + currentMonth * 10 + currentHour;
  const luckySecond = seed % 60;

  if (currentSecond !== luckySecond) return false;

  // Check if already claimed this hour
  const key = `jackpot:${currentDay}-${currentMonth}-${currentHour}`;
  const claimed = await env.SLOTS_KV.get(key);
  if (claimed) return false;

  // Claim jackpot (expires after 1 hour)
  await env.SLOTS_KV.put(key, 'claimed', { expirationTtl: 3600 });
  return true;
}

export {
  getBalance,
  setBalance,
  getLastDaily,
  setLastDaily,
  getLastSpin,
  setLastSpin,
  hasAcceptedDisclaimer,
  setDisclaimerAccepted,
  isSelfBanned,
  setSelfBan,
  removeSelfBan,
  getMonthlyLogin,
  updateMonthlyLogin,
  markMilestoneClaimed,
  activateGuaranteedPair,
  hasGuaranteedPair,
  consumeGuaranteedPair,
  activateWildCard,
  hasWildCard,
  consumeWildCard,
  getStreakMultiplier,
  incrementStreakMultiplier,
  resetStreakMultiplier,
  getPrestigeRank,
  setPrestigeRank,
  hasUnlock,
  setUnlock,
  activateBuff,
  isBuffActive,
  activateBuffWithUses,
  getBuffWithUses,
  decrementBuffUses,
  activateBuffWithStack,
  getBuffWithStack,
  incrementRageModeStack,
  resetRageModeStack,
  addBoost,
  consumeBoost,
  getMulliganCount,
  decrementMulligan,
  addInsurance,
  getInsuranceCount,
  decrementInsurance,
  getSpinBundlePurchases,
  incrementSpinBundlePurchases,
  getDachsBoostPurchases,
  incrementDachsBoostPurchases,
  addWinMultiplier,
  consumeWinMultiplier,
  getFreeSpins,
  addFreeSpinsWithMultiplier,
  consumeFreeSpinWithMultiplier,
  getStreak,
  updateStreak,
  resetStreak,
  getStats,
  updateStats,
  isBlacklisted,
  updateBankBalance,
  getBankBalance,
  checkAndClaimHourlyJackpot,
  getCurrentDate
};
