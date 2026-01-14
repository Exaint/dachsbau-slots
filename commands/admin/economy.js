/**
 * Admin Economy Commands - Give, balance, buffs, stats
 */

import { RESPONSE_HEADERS, MAX_BALANCE, SHOP_ITEMS, BANK_KEY } from '../../constants.js';
import { isAdmin, sanitizeUsername, logError } from '../../utils.js';
import {
  getBalance,
  setBalance,
  getStats,
  getStreak,
  setPrestigeRank,
  setUnlock,
  addBoost,
  addInsurance,
  addWinMultiplier,
  activateBuff,
  activateBuffWithUses,
  activateBuffWithStack,
  addFreeSpinsWithMultiplier,
  getFreeSpins,
  activateGuaranteedPair,
  activateWildCard,
  getMulliganCount,
  setMulliganCount,
  getMonthlyLogin
} from '../../database.js';

// Dynamic shop item max (avoids hardcoded values)
const SHOP_ITEM_MAX = Math.max(...Object.keys(SHOP_ITEMS).map(Number));

// Helper: Check admin permission
function requireAdmin(username) {
  if (!isAdmin(username)) {
    return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
  }
  return null;
}

async function handleGive(username, target, amount, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots give @user [Betrag]`, { headers: RESPONSE_HEADERS });
    }

    if (!amount) {
      return new Response(`@${username} ❌ Nutze: !slots give @user [Betrag]`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = parseInt(amount, 10);
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
    logError('handleGive', error, { username, target, amount });
    return new Response(`@${username} ❌ Fehler beim Gutschreiben.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleSetBalance(username, target, amount, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target || !amount) {
      return new Response(`@${username} ❌ Nutze: !slots setbalance @user [Betrag]`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return new Response(`@${username} ❌ Ungültiger Betrag!`, { headers: RESPONSE_HEADERS });
    }

    const newBalance = Math.min(parsedAmount, MAX_BALANCE);
    await setBalance(cleanTarget, newBalance, env);

    return new Response(`@${username} ✅ Balance von @${cleanTarget} auf ${newBalance} DachsTaler gesetzt! 💰`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleSetBalance', error, { username, target, amount });
    return new Response(`@${username} ❌ Fehler beim Setzen der Balance.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBankSet(username, amount, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!amount) {
      return new Response(`@${username} ❌ Nutze: !slots bankset [Betrag]`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount)) {
      return new Response(`@${username} ❌ Ungültiger Betrag!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.put(BANK_KEY, parsedAmount.toString());

    return new Response(`@${username} ✅ DachsBank auf ${parsedAmount.toLocaleString('de-DE')} DachsTaler gesetzt! 🏦`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleBankSet', error, { username, amount });
    return new Response(`@${username} ❌ Fehler beim Setzen der Bank.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBankReset(username, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    await env.SLOTS_KV.put(BANK_KEY, '0');

    return new Response(`@${username} ✅ DachsBank wurde auf 0 DachsTaler zurückgesetzt! 🏦`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleBankReset', error, { username });
    return new Response(`@${username} ❌ Fehler beim Zurücksetzen der Bank.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGiveBuff(username, target, shopNumber, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target || !shopNumber) {
      return new Response(`@${username} ❌ Nutze: !slots givebuff @user [Shopnummer]`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const itemId = parseInt(shopNumber, 10);
    const item = SHOP_ITEMS[itemId];

    if (!item) {
      return new Response(`@${username} ❌ Ungültige Shopnummer! Nutze 1-${SHOP_ITEM_MAX}.`, { headers: RESPONSE_HEADERS });
    }

    if (item.type === 'boost') {
      await addBoost(cleanTarget, item.symbol, env);
      return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'insurance') {
      await addInsurance(cleanTarget, 5, env);
      return new Response(`@${username} ✅ ${item.name} (5x) an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'winmulti') {
      await addWinMultiplier(cleanTarget, env);
      return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'timed') {
      if (item.uses) {
        await activateBuffWithUses(cleanTarget, item.buffKey, item.duration, item.uses, env);
      } else if (item.buffKey === 'rage_mode') {
        await activateBuffWithStack(cleanTarget, item.buffKey, item.duration, env);
      } else {
        await activateBuff(cleanTarget, item.buffKey, item.duration, env);
      }
      return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} aktiviert! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'unlock') {
      await setUnlock(cleanTarget, item.unlockKey, env);
      return new Response(`@${username} ✅ ${item.name} für @${cleanTarget} freigeschaltet! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'prestige') {
      await setPrestigeRank(cleanTarget, item.rank, env);
      return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} vergeben! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'instant') {
      // Handle specific instant items that can be gifted
      if (itemId === 37) {
        // Guaranteed Pair
        await activateGuaranteedPair(cleanTarget, env);
        return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
      } else if (itemId === 38) {
        // Wild Card
        await activateWildCard(cleanTarget, env);
        return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
      } else {
        return new Response(`@${username} ❌ Dieses Instant-Item kann nicht verschenkt werden (wird sofort ausgeführt).`, { headers: RESPONSE_HEADERS });
      }
    } else {
      return new Response(`@${username} ❌ Dieser Item-Typ kann nicht direkt gegeben werden.`, { headers: RESPONSE_HEADERS });
    }
  } catch (error) {
    logError('handleGiveBuff', error, { username, target, buffArg });
    return new Response(`@${username} ❌ Fehler beim Geben des Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleRemoveBuff(username, target, shopNumber, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target || !shopNumber) {
      return new Response(`@${username} ❌ Nutze: !slots removebuff @user [Shopnummer]`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const itemId = parseInt(shopNumber, 10);
    const item = SHOP_ITEMS[itemId];

    if (!item) {
      return new Response(`@${username} ❌ Ungültige Shopnummer! Nutze 1-${SHOP_ITEM_MAX}.`, { headers: RESPONSE_HEADERS });
    }

    if (item.type === 'boost') {
      await env.SLOTS_KV.delete(`boost:${cleanTarget}:${item.symbol}`);
      return new Response(`@${username} ✅ ${item.name} von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'timed' && item.buffKey) {
      await env.SLOTS_KV.delete(`buff:${cleanTarget}:${item.buffKey}`);
      return new Response(`@${username} ✅ ${item.name} von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'unlock') {
      await env.SLOTS_KV.delete(`unlock:${cleanTarget}:${item.unlockKey}`);
      return new Response(`@${username} ✅ ${item.name} von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'prestige') {
      await env.SLOTS_KV.delete(`rank:${cleanTarget}`);
      return new Response(`@${username} ✅ Prestige-Rang von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
    } else {
      return new Response(`@${username} ❌ Dieser Item-Typ kann nicht entfernt werden.`, { headers: RESPONSE_HEADERS });
    }
  } catch (error) {
    logError('handleRemoveBuff', error, { username, target, buffArg });
    return new Response(`@${username} ❌ Fehler beim Entfernen des Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleClearAllBuffs(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots clearallbuffs @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const deletePromises = [
      ...ALL_BUFF_KEYS.map(key => env.SLOTS_KV.delete(`buff:${cleanTarget}:${key}`)),
      ...ALL_SYMBOLS.map(symbol => env.SLOTS_KV.delete(`boost:${cleanTarget}:${symbol}`)),
      env.SLOTS_KV.delete(`insurance:${cleanTarget}`),
      env.SLOTS_KV.delete(`winmulti:${cleanTarget}`)
    ];

    await Promise.all(deletePromises);

    return new Response(`@${username} ✅ Alle Buffs von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleClearAllBuffs', error, { username, target });
    return new Response(`@${username} ❌ Fehler beim Entfernen aller Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGetStats(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots getstats @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const [balance, stats, streak] = await Promise.all([
      getBalance(cleanTarget, env),
      getStats(cleanTarget, env),
      getStreak(cleanTarget, env)
    ]);

    const losses = stats.totalSpins - stats.wins;
    return new Response(`@${username} 📊 Stats @${cleanTarget}: Balance: ${balance} DachsTaler | Wins: ${stats.wins} | Losses: ${losses} | Total: ${stats.totalSpins} | Streak: ${streak.wins}W ${streak.losses}L`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGetStats', error, { username, target });
    return new Response(`@${username} ❌ Fehler beim Abrufen der Stats.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGetDaily(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots getdaily @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const lastDaily = await env.SLOTS_KV.get(`daily:${cleanTarget}`);

    if (!lastDaily) {
      return new Response(`@${username} ℹ️ @${cleanTarget} hat noch nie Daily abgeholt.`, { headers: RESPONSE_HEADERS });
    }

    const lastTime = parseInt(lastDaily, 10);
    const now = Date.now();
    const timeSince = now - lastTime;
    const hoursSince = Math.floor(timeSince / (1000 * 60 * 60));
    const canClaim = timeSince >= 86400000;

    return new Response(`@${username} ℹ️ @${cleanTarget} Daily: Letzter Claim vor ${hoursSince}h | ${canClaim ? '✅ Kann abholen' : '❌ Muss warten'}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGetDaily', error, { username, target });
    return new Response(`@${username} ❌ Fehler beim Abrufen des Daily-Status.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleResetDaily(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots resetdaily @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.delete(`daily:${cleanTarget}`);

    return new Response(`@${username} ✅ Daily-Cooldown von @${cleanTarget} zurückgesetzt! Kann sofort abholen. 🎁`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleResetDaily', error, { username, target });
    return new Response(`@${username} ❌ Fehler beim Zurücksetzen des Daily-Cooldowns.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGiveFreespins(username, target, amount, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots givefreespins @user [Anzahl]`, { headers: RESPONSE_HEADERS });
    }

    if (!amount) {
      return new Response(`@${username} ❌ Nutze: !slots givefreespins @user [Anzahl]`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 100) {
      return new Response(`@${username} ❌ Ungültige Anzahl! (1-100)`, { headers: RESPONSE_HEADERS });
    }

    // Add freespins with 1x multiplier (standard freespins)
    await addFreeSpinsWithMultiplier(cleanTarget, parsedAmount, 1, env);

    // Get total freespins for confirmation
    const totalSpins = await getFreeSpins(cleanTarget, env);
    const totalCount = totalSpins.reduce((sum, fs) => sum + fs.count, 0);

    return new Response(`@${username} ✅ ${parsedAmount} Freespins an @${cleanTarget} gegeben! (Gesamt: ${totalCount}) 🎰🎁`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGiveFreespins', error, { username, target, amount });
    return new Response(`@${username} ❌ Fehler beim Geben der Freespins.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGiveMulligan(username, target, amount, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots givemulligan @user [Anzahl]`, { headers: RESPONSE_HEADERS });
    }

    if (!amount) {
      return new Response(`@${username} ❌ Nutze: !slots givemulligan @user [Anzahl]`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 50) {
      return new Response(`@${username} ❌ Ungültige Anzahl! (1-50)`, { headers: RESPONSE_HEADERS });
    }

    // Get current mulligan count and add
    const currentCount = await getMulliganCount(cleanTarget, env);
    const newCount = currentCount + parsedAmount;
    await setMulliganCount(cleanTarget, newCount, env);

    return new Response(`@${username} ✅ ${parsedAmount} Mulligans an @${cleanTarget} gegeben! (Gesamt: ${newCount}) 🔄🎁`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGiveMulligan', error, { username, target, amount });
    return new Response(`@${username} ❌ Fehler beim Geben der Mulligans.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGiveInsurance(username, target, amount, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots giveinsurance @user [Anzahl]`, { headers: RESPONSE_HEADERS });
    }

    if (!amount) {
      return new Response(`@${username} ❌ Nutze: !slots giveinsurance @user [Anzahl]`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 100) {
      return new Response(`@${username} ❌ Ungültige Anzahl! (1-100)`, { headers: RESPONSE_HEADERS });
    }

    await addInsurance(cleanTarget, parsedAmount, env);

    return new Response(`@${username} ✅ ${parsedAmount} Insurance an @${cleanTarget} gegeben! 🛡️🎁`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGiveInsurance', error, { username, target, amount });
    return new Response(`@${username} ❌ Fehler beim Geben der Insurance.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGetMonthlyLogin(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots getmonthlylogin @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const monthlyLogin = await getMonthlyLogin(cleanTarget, env);
    const daysCount = monthlyLogin.days.length;
    const milestonesCount = monthlyLogin.claimedMilestones.length;

    return new Response(`@${username} 📅 @${cleanTarget} Monthly Login: ${daysCount} Tage | Monat: ${monthlyLogin.month} | Milestones: ${milestonesCount}/5`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGetMonthlyLogin', error, { username, target });
    return new Response(`@${username} ❌ Fehler beim Abrufen des Monthly Login Status.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleResetWeeklyLimits(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots resetweeklylimits @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    // Reset both weekly purchase limits
    await Promise.all([
      env.SLOTS_KV.delete(`bundle_purchases:${cleanTarget}`),
      env.SLOTS_KV.delete(`dachsboost_purchases:${cleanTarget}`)
    ]);

    return new Response(`@${username} ✅ Wöchentliche Kauflimits von @${cleanTarget} zurückgesetzt! (Spin Bundle & Dachs-Boost) 🔄`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleResetWeeklyLimits', error, { username, target });
    return new Response(`@${username} ❌ Fehler beim Zurücksetzen der Limits.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGiveWinMulti(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots givewinmulti @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await addWinMultiplier(cleanTarget, env);

    return new Response(`@${username} ✅ Win Multiplier (2x) an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGiveWinMulti', error, { username, target });
    return new Response(`@${username} ❌ Fehler beim Geben des Win Multipliers.`, { headers: RESPONSE_HEADERS });
  }
}

export {
  handleGive,
  handleSetBalance,
  handleBankSet,
  handleBankReset,
  handleGiveBuff,
  handleRemoveBuff,
  handleClearAllBuffs,
  handleGetStats,
  handleGetDaily,
  handleResetDaily,
  handleGiveFreespins,
  handleGiveMulligan,
  handleGiveInsurance,
  handleGetMonthlyLogin,
  handleResetWeeklyLimits,
  handleGiveWinMulti
};
