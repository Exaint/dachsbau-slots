/**
 * Admin Moderation Commands - Ban, freeze, wipe, maintenance
 */

import { RESPONSE_HEADERS, ALL_BUFF_KEYS, ALL_SYMBOLS, ALL_UNLOCK_KEYS } from '../../constants.js';
import { isAdmin, sanitizeUsername } from '../../utils.js';
import { setBalance, removeSelfBan } from '../../database.js';

// Helper: Check admin permission
function requireAdmin(username) {
  if (!isAdmin(username)) {
    return new Response(`@${username} ❌ Du hast keine Berechtigung für diesen Command!`, { headers: RESPONSE_HEADERS });
  }
  return null;
}

async function handleBan(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots ban @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.put(`blacklist:${cleanTarget}`, 'true');

    return new Response(`@${username} ✅ @${cleanTarget} wurde vom Slots-Spiel ausgeschlossen. 🔨`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleBan Error:', error);
    return new Response(`@${username} ❌ Fehler beim Bannen.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleUnban(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots unban @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await Promise.all([
      env.SLOTS_KV.delete(`blacklist:${cleanTarget}`),
      removeSelfBan(cleanTarget, env)
    ]);

    return new Response(`@${username} ✅ @${cleanTarget} wurde entbannt und kann wieder Slots spielen. ✅`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleUnban Error:', error);
    return new Response(`@${username} ❌ Fehler beim Entbannen.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleFreeze(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots freeze @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.put(`frozen:${cleanTarget}`, 'true');

    return new Response(`@${username} ✅ @${cleanTarget} wurde eingefroren. ❄️`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleFreeze Error:', error);
    return new Response(`@${username} ❌ Fehler beim Einfrieren.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleUnfreeze(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots unfreeze @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await env.SLOTS_KV.delete(`frozen:${cleanTarget}`);

    return new Response(`@${username} ✅ @${cleanTarget} wurde aufgetaut. ✅`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleUnfreeze Error:', error);
    return new Response(`@${username} ❌ Fehler beim Auftauen.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleReset(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots reset @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await Promise.all([
      setBalance(cleanTarget, 0, env),
      env.SLOTS_KV.delete(`stats:${cleanTarget}`),
      env.SLOTS_KV.delete(`streak:${cleanTarget}`)
    ]);

    return new Response(`@${username} ✅ @${cleanTarget} wurde zurückgesetzt (Balance & Stats auf 0). 🔄`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleReset Error:', error);
    return new Response(`@${username} ❌ Fehler beim Zurücksetzen.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleWipe(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots wipe @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    const deletePromises = [
      setBalance(cleanTarget, 0, env),
      env.SLOTS_KV.delete(`stats:${cleanTarget}`),
      env.SLOTS_KV.delete(`streak:${cleanTarget}`),
      env.SLOTS_KV.delete(`daily:${cleanTarget}`),
      env.SLOTS_KV.delete(`rank:${cleanTarget}`),
      env.SLOTS_KV.delete(`insurance:${cleanTarget}`),
      env.SLOTS_KV.delete(`winmulti:${cleanTarget}`),
      env.SLOTS_KV.delete(`blacklist:${cleanTarget}`),
      env.SLOTS_KV.delete(`frozen:${cleanTarget}`),
      ...ALL_BUFF_KEYS.map(key => env.SLOTS_KV.delete(`buff:${cleanTarget}:${key}`)),
      ...ALL_SYMBOLS.map(symbol => env.SLOTS_KV.delete(`boost:${cleanTarget}:${symbol}`)),
      ...ALL_UNLOCK_KEYS.map(unlock => env.SLOTS_KV.delete(`unlock:${cleanTarget}:${unlock}`))
    ];

    await Promise.all(deletePromises);

    return new Response(`@${username} ✅ @${cleanTarget} wurde komplett gelöscht! (Alle Daten, Buffs, Unlocks) 💥`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleWipe Error:', error);
    return new Response(`@${username} ❌ Fehler beim Löschen des Users.`, { headers: RESPONSE_HEADERS });
  }
}

async function handleMaintenance(username, mode, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    const lowerMode = mode?.toLowerCase();
    if (!lowerMode || (lowerMode !== 'on' && lowerMode !== 'off')) {
      return new Response(`@${username} ❌ Nutze: !slots maintenance [on/off]`, { headers: RESPONSE_HEADERS });
    }

    if (lowerMode === 'on') {
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

async function handleRemoveFromLB(username, target, env) {
  try {
    const adminCheck = requireAdmin(username);
    if (adminCheck) return adminCheck;

    if (!target) {
      return new Response(`@${username} ❌ Nutze: !slots removefromlb @user`, { headers: RESPONSE_HEADERS });
    }

    const cleanTarget = sanitizeUsername(target.replace('@', ''));
    if (!cleanTarget) {
      return new Response(`@${username} ❌ Ungültiger Username!`, { headers: RESPONSE_HEADERS });
    }

    await setBalance(cleanTarget, 0, env);

    return new Response(`@${username} ✅ @${cleanTarget} vom Leaderboard entfernt (Balance auf 0 gesetzt). 🗑️`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('handleRemoveFromLB Error:', error);
    return new Response(`@${username} ❌ Fehler beim Entfernen vom Leaderboard.`, { headers: RESPONSE_HEADERS });
  }
}

export {
  handleBan,
  handleUnban,
  handleFreeze,
  handleUnfreeze,
  handleReset,
  handleWipe,
  handleMaintenance,
  handleRemoveFromLB
};
