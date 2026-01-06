import { RESPONSE_HEADERS, MAX_BALANCE, SHOP_ITEMS, BANK_KEY, ALL_BUFF_KEYS, ALL_SYMBOLS, ALL_UNLOCK_KEYS } from '../constants.js';
import { isAdmin, sanitizeUsername } from '../utils.js';
import {
  getBalance,
  setBalance,
  getStats,
  getStreak,
  removeSelfBan,
  setPrestigeRank,
  setUnlock,
  addBoost,
  addInsurance,
  addWinMultiplier,
  activateBuff,
  activateBuffWithUses,
  activateBuffWithStack
} from '../database.js';

async function handleGive(username, target, amount, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

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
    console.error('handleGive Error:', error);
    return new Response(`@${username} ❌ Fehler beim Gutschreiben.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBan(username, target, env) {
  try {
    if (!isAdmin(username)) {
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
    if (!isAdmin(username)) {
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

async function handleReset(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots reset @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    // Reset balance and stats (not purchases/unlocks)
    await Promise.all([
      setBalance(cleanTarget, 0, env),
      env.SLOTS_KV.delete(`stats:${cleanTarget.toLowerCase()}`),
      env.SLOTS_KV.delete(`streak:${cleanTarget.toLowerCase()}`)
    ]);

    return new Response(`@${username} ✅ @${cleanTarget} wurde zurückgesetzt (Balance & Stats auf 0). 🔄`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleReset Error:', error);
    return new Response(`@${username} ❌ Fehler beim Zurücksetzen.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleFreeze(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots freeze @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.put(`frozen:${cleanTarget.toLowerCase()}`, 'true');

    return new Response(`@${username} ✅ @${cleanTarget} wurde eingefroren. ❄️`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleFreeze Error:', error);
    return new Response(`@${username} ❌ Fehler beim Einfrieren.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleUnfreeze(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots unfreeze @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.delete(`frozen:${cleanTarget.toLowerCase()}`);

    return new Response(`@${username} ✅ @${cleanTarget} wurde aufgetaut. ✅`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleUnfreeze Error:', error);
    return new Response(`@${username} ❌ Fehler beim Auftauen.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleSetBalance(username, target, amount, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

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

    return new Response(`@${username} ✅ Balance von @${cleanTarget} auf ${newBalance} DT gesetzt! 💰`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleSetBalance Error:', error);
    return new Response(`@${username} ❌ Fehler beim Setzen der Balance.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBankSet(username, amount, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!amount) {
      return new Response(`@${username} ❌ Nutze: !slots bankset [Betrag]`, { headers: RESPONSE_HEADERS });
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount)) {
      return new Response(`@${username} ❌ Ungültiger Betrag!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.put(BANK_KEY, parsedAmount.toString());

    return new Response(`@${username} ✅ DachsBank auf ${parsedAmount.toLocaleString('de-DE')} DT gesetzt! 🏦`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleBankSet Error:', error);
    return new Response(`@${username} ❌ Fehler beim Setzen der Bank.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleBankReset(username, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.put(BANK_KEY, '0');

    return new Response(`@${username} ✅ DachsBank wurde auf 0 DT zurückgesetzt! 🏦`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleBankReset Error:', error);
    return new Response(`@${username} ❌ Fehler beim Zurücksetzen der Bank.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGiveBuff(username, target, shopNumber, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

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
      return new Response(`@${username} ❌ Ungültige Shopnummer! Nutze 1-39.`, { headers: RESPONSE_HEADERS });
    }

    // Give the buff/item based on type
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
    } else {
      return new Response(`@${username} ❌ Dieser Item-Typ kann nicht direkt gegeben werden. (Nutze für Instant-Items den Shop)`, { headers: RESPONSE_HEADERS });
    }
  } catch (error) {
    console.error('handleGiveBuff Error:', error);
    return new Response(`@${username} ❌ Fehler beim Geben des Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleRemoveBuff(username, target, shopNumber, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

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
      return new Response(`@${username} ❌ Ungültige Shopnummer! Nutze 1-39.`, { headers: RESPONSE_HEADERS });
    }

    // Remove buff based on type
    if (item.type === 'boost') {
      await env.SLOTS_KV.delete(`boost:${cleanTarget.toLowerCase()}:${item.symbol}`);
      return new Response(`@${username} ✅ ${item.name} von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'timed' && item.buffKey) {
      await env.SLOTS_KV.delete(`buff:${cleanTarget.toLowerCase()}:${item.buffKey}`);
      return new Response(`@${username} ✅ ${item.name} von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'unlock') {
      await env.SLOTS_KV.delete(`unlock:${cleanTarget.toLowerCase()}:${item.unlockKey}`);
      return new Response(`@${username} ✅ ${item.name} von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
    } else if (item.type === 'prestige') {
      await env.SLOTS_KV.delete(`rank:${cleanTarget.toLowerCase()}`);
      return new Response(`@${username} ✅ Prestige-Rang von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
    } else {
      return new Response(`@${username} ❌ Dieser Item-Typ kann nicht entfernt werden.`, { headers: RESPONSE_HEADERS });
    }
  } catch (error) {
    console.error('handleRemoveBuff Error:', error);
    return new Response(`@${username} ❌ Fehler beim Entfernen des Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleClearAllBuffs(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots clearallbuffs @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    // Delete all possible buffs (timed buffs)
    const deletePromises = ALL_BUFF_KEYS.map(key => env.SLOTS_KV.delete(`buff:${cleanTarget.toLowerCase()}:${key}`));

    // Delete all symbol boosts
    ALL_SYMBOLS.forEach(symbol => {
      deletePromises.push(env.SLOTS_KV.delete(`boost:${cleanTarget.toLowerCase()}:${symbol}`));
    });

    // Delete insurance and win multipliers
    deletePromises.push(env.SLOTS_KV.delete(`insurance:${cleanTarget.toLowerCase()}`));
    deletePromises.push(env.SLOTS_KV.delete(`winmulti:${cleanTarget.toLowerCase()}`));

    await Promise.all(deletePromises);

    return new Response(`@${username} ✅ Alle Buffs von @${cleanTarget} entfernt! 🗑️`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleClearAllBuffs Error:', error);
    return new Response(`@${username} ❌ Fehler beim Entfernen aller Buffs.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGetStats(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

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
    return new Response(`@${username} 📊 Stats @${cleanTarget}: Balance: ${balance} DT | Wins: ${stats.wins} | Losses: ${losses} | Total: ${stats.totalSpins} | Streak: ${streak.wins}W ${streak.losses}L`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleGetStats Error:', error);
    return new Response(`@${username} ❌ Fehler beim Abrufen der Stats.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleGetDaily(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots getdaily @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const lastDaily = await env.SLOTS_KV.get(`daily:${cleanTarget.toLowerCase()}`);

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
    console.error('handleGetDaily Error:', error);
    return new Response(`@${username} ❌ Fehler beim Abrufen des Daily-Status.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleResetDaily(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots resetdaily @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.delete(`daily:${cleanTarget.toLowerCase()}`);

    return new Response(`@${username} ✅ Daily-Cooldown von @${cleanTarget} zurückgesetzt! Kann sofort abholen. 🎁`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleResetDaily Error:', error);
    return new Response(`@${username} ❌ Fehler beim Zurücksetzen des Daily-Cooldowns.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleMaintenance(username, mode, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!mode || (mode.toLowerCase() !== 'on' && mode.toLowerCase() !== 'off')) {
      return new Response(`@${username} ❌ Nutze: !slots maintenance [on/off]`, { headers: RESPONSE_HEADERS });
    }

    if (mode.toLowerCase() === 'on') {
      await env.SLOTS_KV.put('maintenance_mode', 'true');
      return new Response(`@${username} ✅ Wartungsmodus aktiviert! Nur Admins können spielen. 🔧`, { headers: RESPONSE_HEADERS });
    } else {
      await env.SLOTS_KV.delete('maintenance_mode');
      return new Response(`@${username} ✅ Wartungsmodus deaktiviert! Alle können wieder spielen. ✅`, { headers: RESPONSE_HEADERS });
    }
  } catch (error) {
    console.error('handleMaintenance Error:', error);
    return new Response(`@${username} ❌ Fehler beim Setzen des Wartungsmodus.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleWipe(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots wipe @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    // Delete EVERYTHING for this user
    const deletePromises = [
      // Balance & Stats
      setBalance(cleanTarget, 0, env),
      env.SLOTS_KV.delete(`stats:${cleanTarget.toLowerCase()}`),
      env.SLOTS_KV.delete(`streak:${cleanTarget.toLowerCase()}`),
      env.SLOTS_KV.delete(`daily:${cleanTarget.toLowerCase()}`),
      env.SLOTS_KV.delete(`rank:${cleanTarget.toLowerCase()}`),

      // Buffs
      env.SLOTS_KV.delete(`insurance:${cleanTarget.toLowerCase()}`),
      env.SLOTS_KV.delete(`winmulti:${cleanTarget.toLowerCase()}`),

      // Bans
      env.SLOTS_KV.delete(`blacklist:${cleanTarget.toLowerCase()}`),
      env.SLOTS_KV.delete(`frozen:${cleanTarget.toLowerCase()}`)
    ];

    // Delete all timed buffs
    ALL_BUFF_KEYS.forEach(key => deletePromises.push(env.SLOTS_KV.delete(`buff:${cleanTarget.toLowerCase()}:${key}`)));

    // Delete all symbol boosts
    ALL_SYMBOLS.forEach(symbol => deletePromises.push(env.SLOTS_KV.delete(`boost:${cleanTarget.toLowerCase()}:${symbol}`)));

    // Delete all unlocks
    ALL_UNLOCK_KEYS.forEach(unlock => deletePromises.push(env.SLOTS_KV.delete(`unlock:${cleanTarget.toLowerCase()}:${unlock}`)));

    await Promise.all(deletePromises);

    return new Response(`@${username} ✅ @${cleanTarget} wurde komplett gelöscht! (Alle Daten, Buffs, Unlocks) 💥`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleWipe Error:', error);
    return new Response(`@${username} ❌ Fehler beim Löschen des Users.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleRemoveFromLB(username, target, env) {
  try {
    if (!isAdmin(username)) {
      return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
    }

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots removefromlb @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    // Set balance to 0 to remove from leaderboard
    await setBalance(cleanTarget, 0, env);

    return new Response(`@${username} ✅ @${cleanTarget} vom Leaderboard entfernt (Balance auf 0 gesetzt). 🗑️`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleRemoveFromLB Error:', error);
    return new Response(`@${username} ❌ Fehler beim Entfernen vom Leaderboard.`, { headers: RESPONSE_HEADERS });
  }
}

export {
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
};
