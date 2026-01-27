/**
 * Admin Economy Commands - Give, balance, buffs, stats
 */

import { RESPONSE_HEADERS, MAX_BALANCE, SHOP_ITEMS, SHOP_ITEM_MAX, ALL_BUFF_KEYS, ALL_SYMBOLS } from '../../constants.js';
import { requireAdmin, requireAdminWithTarget, validateAmount, sanitizeUsername, logError, logAudit, createErrorResponse } from '../../utils.js';
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
  getMonthlyLogin
} from '../../database.js';
import type { Env, ShopItem } from '../../types/index.js';

async function handleGive(username: string, target: string, amount: string, env: Env): Promise<Response> {
  try {
    const check = requireAdminWithTarget(username, target, 'Nutze: !slots give @user [Betrag]');
    if (!check.valid) return check.response!;

    const parsedAmount = validateAmount(amount, 1, MAX_BALANCE);
    if (!parsedAmount) {
      return createErrorResponse(username, `Ungültiger Betrag! (1-${MAX_BALANCE})`);
    }

    const currentBalance = await getBalance(check.cleanTarget!, env);
    const newBalance = Math.min(currentBalance + parsedAmount, MAX_BALANCE);
    await setBalance(check.cleanTarget!, newBalance, env);
    logAudit('give', username, check.cleanTarget!, { amount: parsedAmount, newBalance });

    return new Response(`@${username} ✅ ${parsedAmount} DachsTaler an @${check.cleanTarget} gutgeschrieben! Neuer Kontostand: ${newBalance} 🦡💰`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGive', error, { username, target, amount });
    return createErrorResponse(username, 'Fehler beim Gutschreiben.');
  }
}

async function handleRemove(username: string, target: string, amount: string, env: Env): Promise<Response> {
  try {
    const check = requireAdminWithTarget(username, target, 'Nutze: !slots remove @user [Betrag]');
    if (!check.valid) return check.response!;

    const parsedAmount = validateAmount(amount, 1, MAX_BALANCE);
    if (!parsedAmount) {
      return createErrorResponse(username, `Ungültiger Betrag! (1-${MAX_BALANCE})`);
    }

    const currentBalance = await getBalance(check.cleanTarget!, env);
    const newBalance = Math.max(currentBalance - parsedAmount, 0);
    await setBalance(check.cleanTarget!, newBalance, env);
    logAudit('remove', username, check.cleanTarget!, { amount: parsedAmount, newBalance });

    return new Response(`@${username} ✅ ${parsedAmount} DachsTaler von @${check.cleanTarget} abgezogen! Neuer Kontostand: ${newBalance} 🦡💰`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleRemove', error, { username, target, amount });
    return createErrorResponse(username, 'Fehler beim Abziehen.');
  }
}

async function handleSetBalance(username: string, target: string, amount: string, env: Env): Promise<Response> {
  try {
    const check = requireAdminWithTarget(username, target, 'Nutze: !slots setbalance @user [Betrag]');
    if (!check.valid) return check.response!;

    const parsedAmount = validateAmount(amount, 0, MAX_BALANCE);
    if (parsedAmount === null) {
      return createErrorResponse(username, 'Ungültiger Betrag!');
    }

    const newBalance = Math.min(parsedAmount, MAX_BALANCE);
    await setBalance(check.cleanTarget!, newBalance, env);
    logAudit('setbalance', username, check.cleanTarget!, { newBalance });

    return new Response(`@${username} ✅ Balance von @${check.cleanTarget} auf ${newBalance} DachsTaler gesetzt! 💰`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleSetBalance', error, { username, target, amount });
    return createErrorResponse(username, 'Fehler beim Setzen der Balance.');
  }
}

async function handleGiveBuff(username: string, target: string, shopNumber: string, env: Env): Promise<Response> {
  try {
    const check = requireAdminWithTarget(username, target, 'Nutze: !slots givebuff @user [Shopnummer]');
    if (!check.valid) return check.response!;

    const itemId = validateAmount(shopNumber, 1, SHOP_ITEM_MAX);
    if (!itemId) {
      return createErrorResponse(username, `Ungültige Shopnummer! Nutze 1-${SHOP_ITEM_MAX}.`);
    }

    const cleanTarget = check.cleanTarget!;
    const item = SHOP_ITEMS[itemId] as ShopItem | undefined;
    if (!item) {
      return createErrorResponse(username, `Shopnummer ${itemId} existiert nicht!`);
    }

    if (item.type === 'boost') {
      await addBoost(cleanTarget, (item as ShopItem & { symbol: string }).symbol, env);
      return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'insurance') {
      await addInsurance(cleanTarget, 5, env);
      return new Response(`@${username} ✅ ${item.name} (5x) an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'winmulti') {
      await addWinMultiplier(cleanTarget, env);
      return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} gegeben! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'timed') {
      const timedItem = item as ShopItem & { buffKey: string; duration: number; uses?: number };
      if (timedItem.uses) {
        await activateBuffWithUses(cleanTarget, timedItem.buffKey, timedItem.duration, timedItem.uses, env);
      } else if (timedItem.buffKey === 'rage_mode') {
        await activateBuffWithStack(cleanTarget, timedItem.buffKey, timedItem.duration, env);
      } else {
        await activateBuff(cleanTarget, timedItem.buffKey, timedItem.duration, env);
      }
      return new Response(`@${username} ✅ ${item.name} an @${cleanTarget} aktiviert! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'unlock') {
      await setUnlock(cleanTarget, item.unlockKey!, env);
      return new Response(`@${username} ✅ ${item.name} für @${cleanTarget} freigeschaltet! 🎁`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'prestige') {
      await setPrestigeRank(cleanTarget, item.rank!, env);
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
    logError('handleGiveBuff', error, { username, target, shopNumber });
    return new Response(`@${username} ❌ Fehler beim Geben des Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleRemoveBuff(username: string, target: string, shopNumber: string, env: Env): Promise<Response> {
  try {
    const check = requireAdminWithTarget(username, target, 'Nutze: !slots removebuff @user [Shopnummer]');
    if (!check.valid) return check.response!;

    const cleanTarget = check.cleanTarget!;

    const itemId = parseInt(shopNumber, 10);
    if (isNaN(itemId) || itemId < 1 || itemId > SHOP_ITEM_MAX) {
      return new Response(`@${username} ❌ Ungültige Shopnummer! Nutze 1-${SHOP_ITEM_MAX}.`, { headers: RESPONSE_HEADERS });
    }
    const item = SHOP_ITEMS[itemId] as ShopItem & { symbol?: string; buffKey?: string } | undefined;

    if (!item) {
      return new Response(`@${username} ❌ Shopnummer ${itemId} existiert nicht!`, { headers: RESPONSE_HEADERS });
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
    logError('handleRemoveBuff', error, { username, target, shopNumber });
    return new Response(`@${username} ❌ Fehler beim Entfernen des Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleClearAllBuffs(username: string, target: string, env: Env): Promise<Response> {
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

async function handleGetStats(username: string, target: string, env: Env): Promise<Response> {
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
    const netProfit = stats.totalWon - stats.totalLost;
    return new Response(`@${username} 📊 Stats @${cleanTarget}: Balance: ${balance} | Wins: ${stats.wins} | Losses: ${losses} | Total: ${stats.totalSpins} | Gewonnen: ${stats.totalWon.toLocaleString('de-DE')} | Ausgegeben: ${stats.totalLost.toLocaleString('de-DE')} | Bilanz: ${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString('de-DE')} | Streak: ${streak.wins}W ${streak.losses}L`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGetStats', error, { username, target });
    return new Response(`@${username} ❌ Fehler beim Abrufen der Stats.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGetDaily(username: string, target: string, env: Env): Promise<Response> {
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

async function handleResetDaily(username: string, target: string, env: Env): Promise<Response> {
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

async function handleGiveFreespins(username: string, target: string, amount: string, multiplier: string | undefined, env: Env): Promise<Response> {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots givefreespins @user [Anzahl] [Multiplier] - Multiplier: 1=10DT, 2=20DT, 3=30DT, 5=50DT, 10=100DT`, { headers: RESPONSE_HEADERS });
    }

    if (!amount) {
      return new Response(`@${username} ❌ Nutze: !slots givefreespins @user [Anzahl] [Multiplier] - Multiplier: 1=10DT, 2=20DT, 3=30DT, 5=50DT, 10=100DT`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 100) {
      return new Response(`@${username} ❌ Ungültige Anzahl! (1-100)`, { headers: RESPONSE_HEADERS });
    }

    // Parse multiplier (default: 1 = 10 DT freespins)
    const validMultipliers = [1, 2, 3, 5, 10];
    let parsedMultiplier = 1;
    if (multiplier) {
      parsedMultiplier = parseInt(multiplier, 10);
      if (!validMultipliers.includes(parsedMultiplier)) {
        return new Response(`@${username} ❌ Ungültiger Multiplier! Erlaubt: 1 (10DT), 2 (20DT), 3 (30DT), 5 (50DT), 10 (100DT)`, { headers: RESPONSE_HEADERS });
      }
    }

    // Add freespins with specified multiplier
    await addFreeSpinsWithMultiplier(cleanTarget, parsedAmount, parsedMultiplier, env);

    // Get total freespins for confirmation
    const totalSpins = await getFreeSpins(cleanTarget, env);
    const totalCount = totalSpins.reduce((sum, fs) => sum + fs.count, 0);

    const dtValue = parsedMultiplier * 10;
    return new Response(`@${username} ✅ ${parsedAmount}x ${dtValue}DT Freespins an @${cleanTarget} gegeben! (Gesamt: ${totalCount}) 🎰🎁`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleGiveFreespins', error, { username, target, amount, multiplier });
    return new Response(`@${username} ❌ Fehler beim Geben der Freespins.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGiveInsurance(username: string, target: string, amount: string, env: Env): Promise<Response> {
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

async function handleGetMonthlyLogin(username: string, target: string, env: Env): Promise<Response> {
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

async function handleResetWeeklyLimits(username: string, target: string, env: Env): Promise<Response> {
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

async function handleGiveWinMulti(username: string, target: string, env: Env): Promise<Response> {
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
  handleRemove,
  handleSetBalance,
  handleGiveBuff,
  handleRemoveBuff,
  handleClearAllBuffs,
  handleGetStats,
  handleGetDaily,
  handleResetDaily,
  handleGiveFreespins,
  handleGiveInsurance,
  handleGetMonthlyLogin,
  handleResetWeeklyLimits,
  handleGiveWinMulti
};
