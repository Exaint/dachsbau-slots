import { MAX_BALANCE, BANK_USERNAME, BANK_START_BALANCE, DAILY_TTL_SECONDS, JACKPOT_CLAIM_TTL, STARTING_BALANCE, STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_MAX, BUFF_TTL_BUFFER_SECONDS } from './constants.js';
import { getCurrentMonth, getCurrentDate, getWeekStart, exponentialBackoff } from './utils.js';

// Balance Functions
async function getBalance(username, env) {
  try {
    const key = `user:${username.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === null) {
      await setBalance(username, STARTING_BALANCE, env);
      return STARTING_BALANCE;
    }
    const balance = parseInt(value, 10);
    return isNaN(balance) ? STARTING_BALANCE : Math.min(balance, MAX_BALANCE);
  } catch (error) {
    console.error('getBalance Error:', error);
    return STARTING_BALANCE;
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

// Atomic balance update with retry mechanism (for race condition prevention)
async function atomicBalanceUpdate(username, updateFn, maxRetries = 3, env) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read current balance
      const currentBalance = await getBalance(username, env);

      // Calculate new balance using update function
      const newBalance = updateFn(currentBalance);
      const safeBalance = Math.max(0, Math.min(newBalance, MAX_BALANCE));

      // Try to update with metadata check (simple optimistic lock)
      const key = `user:${username.toLowerCase()}`;
      const metadata = { lastUpdate: Date.now(), attempt };

      await env.SLOTS_KV.put(key, safeBalance.toString(), { metadata });

      // Verify the write succeeded by reading back
      const verifyBalance = await getBalance(username, env);
      if (verifyBalance === safeBalance) {
        return { success: true, balance: safeBalance, attempts: attempt + 1 };
      }

      // If verification failed, retry
      if (attempt < maxRetries - 1) {
        // Exponential backoff: wait 10ms, 20ms, 40ms
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`atomicBalanceUpdate Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) {
        return { success: false, error, attempts: attempt + 1 };
      }
    }
  }

  return { success: false, error: 'Max retries reached', attempts: maxRetries };
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
    await env.SLOTS_KV.put(`daily:${username.toLowerCase()}`, timestamp.toString(), { expirationTtl: DAILY_TTL_SECONDS });
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

// OPTIMIZED: Accept monthlyLogin as parameter to avoid redundant KV read
async function markMilestoneClaimed(username, milestone, env, monthlyLogin = null) {
  try {
    const data = monthlyLogin || await getMonthlyLogin(username, env);

    if (!data.claimedMilestones.includes(milestone)) {
      data.claimedMilestones.push(milestone);
      await env.SLOTS_KV.put(`monthlylogin:${username.toLowerCase()}`, JSON.stringify(data));
    }
  } catch (error) {
    console.error('markMilestoneClaimed Error:', error);
  }
}

// Guaranteed Pair
async function activateGuaranteedPair(username, env) {
  try {
    await env.SLOTS_KV.put(`guaranteedpair:${username.toLowerCase()}`, 'active');
  } catch (error) {
    console.error('activateGuaranteedPair Error:', error);
  }
}

async function hasGuaranteedPair(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`guaranteedpair:${username.toLowerCase()}`);
    return value === 'active';
  } catch (error) {
    console.error('hasGuaranteedPair Error:', error);
    return false;
  }
}

async function consumeGuaranteedPair(username, env) {
  try {
    await env.SLOTS_KV.delete(`guaranteedpair:${username.toLowerCase()}`);
  } catch (error) {
    console.error('consumeGuaranteedPair Error:', error);
  }
}

// Wild Card
async function activateWildCard(username, env) {
  try {
    await env.SLOTS_KV.put(`wildcard:${username.toLowerCase()}`, 'active');
  } catch (error) {
    console.error('activateWildCard Error:', error);
  }
}

async function hasWildCard(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`wildcard:${username.toLowerCase()}`);
    return value === 'active';
  } catch (error) {
    console.error('hasWildCard Error:', error);
    return false;
  }
}

async function consumeWildCard(username, env) {
  try {
    await env.SLOTS_KV.delete(`wildcard:${username.toLowerCase()}`);
  } catch (error) {
    console.error('consumeWildCard Error:', error);
  }
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
    const newMultiplier = Math.min(current + STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_MAX);
    await env.SLOTS_KV.put(`streakmultiplier:${username.toLowerCase()}`, newMultiplier.toFixed(1));
    return newMultiplier;
  } catch (error) {
    return 1.0;
  }
}

async function resetStreakMultiplier(username, env) {
  try {
    await env.SLOTS_KV.delete(`streakmultiplier:${username.toLowerCase()}`);
  } catch (error) {
    console.error('resetStreakMultiplier Error:', error);
  }
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
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, expireAt.toString(), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
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
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, JSON.stringify(data), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
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

// Atomic buff uses decrement with retry mechanism (prevents race conditions)
async function decrementBuffUses(username, buffKey, env, maxRetries = 3) {
  const key = `buff:${username.toLowerCase()}:${buffKey}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read current state
      const value = await env.SLOTS_KV.get(key);
      if (!value) return;

      const data = JSON.parse(value);
      if (Date.now() >= data.expireAt || data.uses <= 0) {
        await env.SLOTS_KV.delete(key);
        return;
      }

      // Prepare update
      const updatedData = { ...data, uses: data.uses - 1 };

      if (updatedData.uses <= 0) {
        await env.SLOTS_KV.delete(key);
      } else {
        const ttl = Math.max(BUFF_TTL_BUFFER_SECONDS, Math.floor((data.expireAt - Date.now()) / 1000) + BUFF_TTL_BUFFER_SECONDS);
        const metadata = { lastUpdate: Date.now(), attempt };
        await env.SLOTS_KV.put(key, JSON.stringify(updatedData), { expirationTtl: ttl, metadata });
      }

      // Verify the write succeeded
      const verifyValue = await env.SLOTS_KV.get(key);
      if (updatedData.uses <= 0) {
        // Should be deleted
        if (!verifyValue) return; // Success
      } else {
        // Should have updated uses
        if (verifyValue) {
          const verifyData = JSON.parse(verifyValue);
          if (verifyData.uses === updatedData.uses) return; // Success
        }
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`decrementBuffUses Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) return;
    }
  }
}

// Buff with stack (Rage Mode)
async function activateBuffWithStack(username, buffKey, duration, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    const data = { expireAt, stack: 0 };
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, JSON.stringify(data), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
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

// OPTIMIZED: Set mulligan directly when count is already known (avoids redundant KV read)
async function setMulliganCount(username, count, env) {
  try {
    if (count <= 0) {
      await env.SLOTS_KV.delete(`mulligan:${username.toLowerCase()}`);
    } else {
      await env.SLOTS_KV.put(`mulligan:${username.toLowerCase()}`, count.toString());
    }
  } catch (error) {
    console.error('setMulliganCount Error:', error);
  }
}

// Insurance - Atomic add with retry mechanism
async function addInsurance(username, count, env, maxRetries = 3) {
  const key = `insurance:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const current = await getInsuranceCount(username, env);
      const newCount = current + count;
      await env.SLOTS_KV.put(key, newCount.toString());

      // Verify the write succeeded
      const verifyCount = await getInsuranceCount(username, env);
      if (verifyCount === newCount) {
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`addInsurance Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) return;
    }
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

// OPTIMIZED: Set insurance directly when count is already known (avoids redundant KV read)
async function setInsuranceCount(username, count, env) {
  try {
    if (count <= 0) {
      await env.SLOTS_KV.delete(`insurance:${username.toLowerCase()}`);
    } else {
      await env.SLOTS_KV.put(`insurance:${username.toLowerCase()}`, count.toString());
    }
  } catch (error) {
    console.error('setInsuranceCount Error:', error);
  }
}

// Spin Bundle Purchases
async function getSpinBundlePurchases(username, env) {
  try {
    // OPTIMIZED: Cache getWeekStart() result to avoid multiple Date calculations
    const currentWeekStart = getWeekStart();
    const value = await env.SLOTS_KV.get(`bundle_purchases:${username.toLowerCase()}`);
    if (!value) return { count: 0, weekStart: currentWeekStart };
    const data = JSON.parse(value);

    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }

    return data;
  } catch (error) {
    console.error('getSpinBundlePurchases Error:', error);
    return { count: 0, weekStart: getWeekStart() };
  }
}

// Atomic increment with retry mechanism
async function incrementSpinBundlePurchases(username, env, maxRetries = 3) {
  const key = `bundle_purchases:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await getSpinBundlePurchases(username, env);
      const expectedCount = data.count + 1;
      data.count = expectedCount;
      await env.SLOTS_KV.put(key, JSON.stringify(data));

      // Verify the write succeeded
      const verifyData = await getSpinBundlePurchases(username, env);
      if (verifyData.count === expectedCount) {
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`incrementSpinBundlePurchases Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) return;
    }
  }
}

// Dachs Boost Purchases
async function getDachsBoostPurchases(username, env) {
  try {
    // OPTIMIZED: Cache getWeekStart() result to avoid multiple Date calculations
    const currentWeekStart = getWeekStart();
    const value = await env.SLOTS_KV.get(`dachsboost_purchases:${username.toLowerCase()}`);
    if (!value) return { count: 0, weekStart: currentWeekStart };
    const data = JSON.parse(value);

    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }

    return data;
  } catch (error) {
    console.error('getDachsBoostPurchases Error:', error);
    return { count: 0, weekStart: getWeekStart() };
  }
}

// Atomic increment with retry mechanism
async function incrementDachsBoostPurchases(username, env, maxRetries = 3) {
  const key = `dachsboost_purchases:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await getDachsBoostPurchases(username, env);
      const expectedCount = data.count + 1;
      data.count = expectedCount;
      await env.SLOTS_KV.put(key, JSON.stringify(data));

      // Verify the write succeeded
      const verifyData = await getDachsBoostPurchases(username, env);
      if (verifyData.count === expectedCount) {
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`incrementDachsBoostPurchases Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) return;
    }
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

// Atomic free spin consumption with retry mechanism (prevents race conditions)
async function consumeFreeSpinWithMultiplier(username, env, maxRetries = 3) {
  const key = `freespins:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read current state
      const value = await env.SLOTS_KV.get(key);
      if (!value || value === 'null' || value === 'undefined') {
        return { used: false, multiplier: 0 };
      }

      const freeSpins = JSON.parse(value);
      if (!Array.isArray(freeSpins) || freeSpins.length === 0) {
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

      // Prepare update - OPTIMIZED: Use deep copy instead of redundant JSON.parse
      const multiplierToReturn = lowestEntry.multiplier;
      const updatedFreeSpins = freeSpins.map(entry => ({ ...entry }));
      updatedFreeSpins[0].count--;

      if (updatedFreeSpins[0].count <= 0) {
        updatedFreeSpins.shift();
      }

      // Write with metadata for optimistic lock verification
      const metadata = { lastUpdate: Date.now(), attempt };
      await env.SLOTS_KV.put(key, JSON.stringify(updatedFreeSpins), { metadata });

      // Verify the write succeeded
      const verifyValue = await env.SLOTS_KV.get(key);
      const verifySpins = verifyValue ? JSON.parse(verifyValue) : [];

      // Check if our update was applied (count should match)
      const expectedCount = updatedFreeSpins.length > 0 ? updatedFreeSpins[0]?.count : -1;
      const actualCount = verifySpins.length > 0 ? verifySpins[0]?.count : -1;

      if (verifySpins.length === updatedFreeSpins.length &&
          (updatedFreeSpins.length === 0 || expectedCount === actualCount)) {
        return { used: true, multiplier: multiplierToReturn };
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`consumeFreeSpinWithMultiplier Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) {
        return { used: false, multiplier: 0 };
      }
    }
  }

  return { used: false, multiplier: 0 };
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
  await env.SLOTS_KV.put(key, 'claimed', { expirationTtl: JACKPOT_CLAIM_TTL });
  return true;
}

export {
  getBalance,
  setBalance,
  atomicBalanceUpdate,
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
  addBoost,
  consumeBoost,
  getMulliganCount,
  setMulliganCount,
  addInsurance,
  getInsuranceCount,
  setInsuranceCount,
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
  getStats,
  updateStats,
  isBlacklisted,
  updateBankBalance,
  getBankBalance,
  checkAndClaimHourlyJackpot
};
