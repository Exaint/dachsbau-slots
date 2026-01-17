/**
 * Shop System - Item purchases and activations
 *
 * ARCHITECTURE NOTES (for future coding sessions):
 * ================================================
 * - Uses STRATEGY PATTERN for item type handling
 * - Each item type has a dedicated handler function (handleTimedItem, handleBoostItem, etc.)
 * - ITEM_TYPE_HANDLERS map delegates to the correct handler
 *
 * TO ADD A NEW ITEM TYPE:
 * 1. Create handler function: async function handleNewType(username, item, itemId, balance, env)
 * 2. Add entry to ITEM_TYPE_HANDLERS map: { newType: handleNewType }
 * 3. If type needs special pre-loading (like prestige/unlock), handle in buyShopItem()
 *
 * SPECIAL CASES:
 * - 'prestige' and 'unlock' types need additional data pre-loaded before handler
 * - 'instant' type uses sub-handlers for different item IDs (11, 12, 16, 31, 36, 37, 38)
 * - Mystery Box (ID 16) has rollback mechanism for failed activations
 */
import {
  RESPONSE_HEADERS,
  MAX_BALANCE,
  SHOP_ITEMS,
  PREREQUISITE_NAMES,
  PRESTIGE_RANKS,
  DACHS_BASE_CHANCE,
  GRID_SIZE,
  CHAOS_SPIN_MIN,
  CHAOS_SPIN_MAX,
  REVERSE_CHAOS_MIN,
  REVERSE_CHAOS_MAX,
  DIAMOND_MINE_MIN_SPINS,
  DIAMOND_MINE_MAX_SPINS,
  URLS,
  PEEK_TTL_SECONDS,
  WEEKLY_DACHS_BOOST_LIMIT,
  WEEKLY_SPIN_BUNDLE_LIMIT,
  SPIN_BUNDLE_COUNT,
  SPIN_BUNDLE_MULTIPLIER,
  WHEEL_JACKPOT_THRESHOLD,
  WHEEL_JACKPOT_CHANCE,
  WHEEL_DACHS_PRIZE,
  WHEEL_JACKPOT_PRIZE,
  WHEEL_DIAMOND_THRESHOLD,
  WHEEL_DIAMOND_PRIZE,
  WHEEL_GOLD_THRESHOLD,
  WHEEL_GOLD_PRIZE,
  WHEEL_STAR_THRESHOLD,
  WHEEL_STAR_PRIZE,
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  KV_ACTIVE
} from '../constants.js';
import { getWeightedSymbol, secureRandom, secureRandomInt, logError } from '../utils.js';
import {
  getBalance,
  setBalance,
  hasUnlock,
  setUnlock,
  getPrestigeRank,
  setPrestigeRank,
  activateBuff,
  activateBuffWithUses,
  activateBuffWithStack,
  addBoost,
  addInsurance,
  addWinMultiplier,
  addFreeSpinsWithMultiplier,
  getSpinBundlePurchases,
  incrementSpinBundlePurchases,
  getDachsBoostPurchases,
  incrementDachsBoostPurchases,
  activateGuaranteedPair,
  activateWildCard,
  updateBankBalance,
  isBuffActive
} from '../database.js';
import { calculateWin } from './slots.js';

// Static: Mystery Box item pool (avoid recreation per request)
const MYSTERY_BOX_ITEMS = [
  2, 3, 4, 5, 6, 7, 8,    // Symbol-Boosts (7)
  9, 10,                   // Utility Items (2)
  14, 20, 24,              // Timed Buffs Classic (3)
  32, 33, 34, 35, 39       // Timed Buffs Premium (5)
]; // Total: 17 Items (Stats Tracker, Unlocks, Prestige, Instants excluded)

// Dynamic shop item max (avoids hardcoded values)
const SHOP_ITEM_MAX = Math.max(...Object.keys(SHOP_ITEMS).map(Number));

// ============================================================================
// ITEM TYPE HANDLERS - Strategy Pattern
// Each handler processes a specific item type. Add new types by adding handlers.
// Handler signature: async (username, item, itemId, balance, env) => Response
// ============================================================================

async function handlePrestigeItem(username, item, itemId, balance, currentRank, env) {
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
  await updateBankBalance(item.price, env);

  return new Response(`@${username} ✅ ${item.name} gekauft! Dein Rang: ${item.rank} | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleUnlockItem(username, item, itemId, balance, hasPrerequisite, hasExistingUnlock, env) {
  if (item.requires && !hasPrerequisite) {
    return new Response(`@${username} ❌ Du musst zuerst ${PREREQUISITE_NAMES[item.requires]} freischalten!`, { headers: RESPONSE_HEADERS });
  }

  if (hasExistingUnlock) {
    return new Response(`@${username} ❌ Du hast ${item.name} bereits freigeschaltet!`, { headers: RESPONSE_HEADERS });
  }

  await Promise.all([
    setUnlock(username, item.unlockKey, env),
    setBalance(username, balance - item.price, env),
    updateBankBalance(item.price, env)
  ]);

  return new Response(`@${username} ✅ ${item.name} freigeschaltet! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleTimedItem(username, item, itemId, balance, env) {
  await Promise.all([
    setBalance(username, balance - item.price, env),
    updateBankBalance(item.price, env)
  ]);

  if (item.uses) {
    await activateBuffWithUses(username, item.buffKey, item.duration, item.uses, env);
    return new Response(`@${username} ✅ ${item.name} aktiviert für ${item.uses} Spins! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
  }

  if (item.buffKey === 'rage_mode') {
    await activateBuffWithStack(username, item.buffKey, item.duration, env);
    const minutes = Math.floor(item.duration / SECONDS_PER_MINUTE);
    return new Response(`@${username} ✅ ${item.name} aktiviert für ${minutes} Minuten! Verluste geben +5% Gewinn-Chance (bis 50%)! 🔥 | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
  }

  await activateBuff(username, item.buffKey, item.duration, env);
  const minutes = Math.floor(item.duration / SECONDS_PER_MINUTE);
  const hours = item.duration >= SECONDS_PER_HOUR ? Math.floor(item.duration / SECONDS_PER_HOUR) + 'h' : minutes + ' Minuten';
  return new Response(`@${username} ✅ ${item.name} aktiviert für ${hours}! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleBoostItem(username, item, itemId, balance, env) {
  const lowerUsername = username.toLowerCase();

  // Weekly limit check for Dachs-Boost
  if (item.weeklyLimit) {
    const boostKey = `boost:${lowerUsername}:${item.symbol}`;
    const [existingBoost, purchases] = await Promise.all([
      env.SLOTS_KV.get(boostKey),
      getDachsBoostPurchases(username, env)
    ]);

    if (existingBoost === KV_ACTIVE) {
      return new Response(`@${username} ❌ Du hast bereits einen aktiven ${item.name}! Nutze ihn erst, bevor du einen neuen kaufst.`, { headers: RESPONSE_HEADERS });
    }

    if (purchases.count >= WEEKLY_DACHS_BOOST_LIMIT) {
      return new Response(`@${username} ❌ Wöchentliches Limit erreicht! Du kannst maximal ${WEEKLY_DACHS_BOOST_LIMIT} Dachs-Boost pro Woche kaufen. Nächster Reset: Montag 00:00 UTC`, { headers: RESPONSE_HEADERS });
    }

    await Promise.all([
      setBalance(username, balance - item.price, env),
      addBoost(username, item.symbol, env),
      incrementDachsBoostPurchases(username, env),
      updateBankBalance(item.price, env)
    ]);

    return new Response(`@${username} ✅ ${item.name} aktiviert! Dein nächster Gewinn mit ${item.symbol} wird verdoppelt! | Kontostand: ${balance - item.price} 🦡 | Du kannst diese Woche keinen weiteren Dachs-Boost kaufen`, { headers: RESPONSE_HEADERS });
  }

  await Promise.all([
    setBalance(username, balance - item.price, env),
    addBoost(username, item.symbol, env),
    updateBankBalance(item.price, env)
  ]);
  return new Response(`@${username} ✅ ${item.name} aktiviert! Dein nächster Gewinn mit ${item.symbol} wird verdoppelt! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleInsuranceItem(username, item, itemId, balance, env) {
  await Promise.all([
    setBalance(username, balance - item.price, env),
    addInsurance(username, 5, env),
    updateBankBalance(item.price, env)
  ]);
  return new Response(`@${username} ✅ Insurance Pack erhalten! Die nächsten 5 Verluste geben 50% des Einsatzes zurück! 🛡️ | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleWinMultiItem(username, item, itemId, balance, env) {
  await Promise.all([
    setBalance(username, balance - item.price, env),
    addWinMultiplier(username, env),
    updateBankBalance(item.price, env)
  ]);
  return new Response(`@${username} ✅ Win Multiplier aktiviert! Dein nächster Gewinn wird x2! ⚡ | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleBundleItem(username, item, itemId, balance, env) {
  const purchases = await getSpinBundlePurchases(username, env);
  if (purchases.count >= WEEKLY_SPIN_BUNDLE_LIMIT) {
    return new Response(`@${username} ❌ Wöchentliches Limit erreicht! Du kannst maximal ${WEEKLY_SPIN_BUNDLE_LIMIT} Spin Bundles pro Woche kaufen. Nächster Reset: Montag 00:00 UTC`, { headers: RESPONSE_HEADERS });
  }

  await Promise.all([
    setBalance(username, balance - item.price, env),
    addFreeSpinsWithMultiplier(username, SPIN_BUNDLE_COUNT, SPIN_BUNDLE_MULTIPLIER, env),
    incrementSpinBundlePurchases(username, env),
    updateBankBalance(item.price, env)
  ]);

  const remainingPurchases = WEEKLY_SPIN_BUNDLE_LIMIT - (purchases.count + 1);
  return new Response(`@${username} ✅ Spin Bundle erhalten! ${SPIN_BUNDLE_COUNT} Free Spins (${SPIN_BUNDLE_MULTIPLIER * 10} DachsTaler) gutgeschrieben! | Kontostand: ${balance - item.price} 🦡 | Noch ${remainingPurchases} Käufe diese Woche möglich`, { headers: RESPONSE_HEADERS });
}

async function handlePeekItem(username, item, itemId, balance, env) {
  const lowerUsername = username.toLowerCase();

  // Load all relevant buffs for accurate peek grid
  const [hasLuckyCharm, hasStarMagnet, hasDiamondRush, dachsLocator, rageMode] = await Promise.all([
    isBuffActive(username, 'lucky_charm', env),
    isBuffActive(username, 'star_magnet', env),
    isBuffActive(username, 'diamond_rush', env),
    env.SLOTS_KV.get(`buff:${lowerUsername}:dachs_locator`),
    env.SLOTS_KV.get(`buff:${lowerUsername}:rage_mode`)
  ]);

  await Promise.all([
    setBalance(username, balance - item.price, env),
    updateBankBalance(item.price, env)
  ]);

  // Calculate Dachs chance with all buffs
  let peekDachsChance = DACHS_BASE_CHANCE;
  if (hasLuckyCharm) peekDachsChance *= 2;
  if (dachsLocator) {
    try {
      const data = JSON.parse(dachsLocator);
      if (Date.now() < data.expireAt && data.uses > 0) peekDachsChance *= 3;
    } catch (e) { /* ignore parse errors */ }
  }
  if (rageMode) {
    try {
      const data = JSON.parse(rageMode);
      if (Date.now() < data.expireAt && data.stack > 0) {
        peekDachsChance *= (1 + data.stack / 100);
      }
    } catch (e) { /* ignore parse errors */ }
  }

  const peekGrid = [];
  const activeBuffs = [];
  if (hasLuckyCharm) activeBuffs.push('🍀');
  if (hasStarMagnet) activeBuffs.push('⭐');
  if (hasDiamondRush) activeBuffs.push('💎');

  // Generate the peek grid with all buff effects (matches actual spin generation)
  for (let i = 0; i < GRID_SIZE; i++) {
    if (secureRandom() < peekDachsChance) {
      peekGrid.push('🦡');
    } else {
      let symbol = getWeightedSymbol();

      // Apply Star Magnet and Diamond Rush (same logic as engine.js)
      if (hasStarMagnet || hasDiamondRush) {
        const buffRoll = secureRandom();
        const boostRoll = secureRandom();
        const BUFF_REROLL_CHANCE = 0.66;
        const SYMBOL_BOOST_CHANCE = 0.33;

        if (hasStarMagnet && symbol !== '⭐' && buffRoll < BUFF_REROLL_CHANCE && boostRoll < SYMBOL_BOOST_CHANCE) {
          symbol = '⭐';
        } else if (hasDiamondRush && symbol !== '💎' && buffRoll < BUFF_REROLL_CHANCE && boostRoll < SYMBOL_BOOST_CHANCE) {
          symbol = '💎';
        }
      }

      peekGrid.push(symbol);
    }
  }

  // Store the grid for the next spin
  await env.SLOTS_KV.put(`peek:${lowerUsername}`, JSON.stringify(peekGrid), { expirationTtl: PEEK_TTL_SECONDS });

  // Calculate result to show prediction
  const peekResult = calculateWin(peekGrid);
  const willWin = peekResult.points > 0 || (peekResult.freeSpins && peekResult.freeSpins > 0);
  const buffText = activeBuffs.length > 0 ? ` (${activeBuffs.join('')} aktiv!)` : '';

  return new Response(`@${username} 🔮 Peek Token! Dein nächster Spin wird ${willWin ? '✅ GEWINNEN' : '❌ VERLIEREN'}! 🔮${buffText} | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
}

// Instant items have sub-handlers for different item IDs
async function handleInstantItem(username, item, itemId, balance, env) {
  // Chaos Spin (ID 11)
  if (itemId === 11) {
    const result = secureRandomInt(CHAOS_SPIN_MIN, CHAOS_SPIN_MAX);
    const newBalance = Math.min(balance - item.price + result, MAX_BALANCE);
    const netBankChange = item.price - result;
    await Promise.all([
      setBalance(username, Math.max(0, newBalance), env),
      updateBankBalance(netBankChange, env)
    ]);
    return new Response(`@${username} 🎲 Chaos Spin! ${result >= 0 ? '+' : ''}${result} DachsTaler! | Kontostand: ${Math.max(0, newBalance)}`, { headers: RESPONSE_HEADERS });
  }

  // Glücksrad (ID 12)
  if (itemId === 12) {
    const wheel = spinWheel();
    const newBalance = Math.max(0, Math.min(balance - item.price + wheel.prize, MAX_BALANCE));
    const netBankChange = item.price - wheel.prize;
    await Promise.all([
      setBalance(username, newBalance, env),
      updateBankBalance(netBankChange, env)
    ]);
    const netResult = wheel.prize - item.price;
    return new Response(`@${username} 🎡 [ ${wheel.result} ] ${wheel.message} ${netResult >= 0 ? '+' : ''}${netResult} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
  }

  // All other instant items: deduct price first
  await Promise.all([
    setBalance(username, balance - item.price, env),
    updateBankBalance(item.price, env)
  ]);

  // Mystery Box (ID 16)
  if (itemId === 16) {
    return await handleMysteryBox(username, item, balance, env);
  }

  // Reverse Chaos (ID 31)
  if (itemId === 31) {
    const result = secureRandomInt(REVERSE_CHAOS_MIN, REVERSE_CHAOS_MAX);
    const newBalance = Math.max(0, Math.min(balance - item.price + result, MAX_BALANCE));
    await Promise.all([
      setBalance(username, newBalance, env),
      updateBankBalance(-result, env)
    ]);
    return new Response(`@${username} 🎲 Reverse Chaos! +${result} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
  }

  // Diamond Mine (ID 36)
  if (itemId === 36) {
    const freeSpinsAmount = secureRandomInt(DIAMOND_MINE_MIN_SPINS, DIAMOND_MINE_MAX_SPINS);
    await addFreeSpinsWithMultiplier(username, freeSpinsAmount, 1, env);
    return new Response(`@${username} 💎 Diamond Mine! Du hast ${freeSpinsAmount} Free Spins gefunden! 💎 | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
  }

  // Guaranteed Pair (ID 37)
  if (itemId === 37) {
    await activateGuaranteedPair(username, env);
    return new Response(`@${username} ✅ Guaranteed Pair aktiviert! Dein nächster Spin hat garantiert mindestens ein Pair! 🎯 | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
  }

  // Wild Card (ID 38)
  if (itemId === 38) {
    await activateWildCard(username, env);
    return new Response(`@${username} ✅ Wild Card aktiviert! Dein nächster Spin enthält ein 🃏 Wild Symbol! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
  }

  // Fallback for unknown instant items
  return new Response(`@${username} ✅ ${item.name} gekauft! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
}

// Mystery Box has complex logic with rollback, extracted for clarity
async function handleMysteryBox(username, item, balance, env) {
  const mysteryItemId = MYSTERY_BOX_ITEMS[secureRandomInt(0, MYSTERY_BOX_ITEMS.length - 1)];
  const mysteryResult = SHOP_ITEMS[mysteryItemId];

  try {
    if (mysteryResult.type === 'boost') {
      await addBoost(username, mysteryResult.symbol, env);
    } else if (mysteryResult.type === 'insurance') {
      await addInsurance(username, 5, env);
    } else if (mysteryResult.type === 'winmulti') {
      await addWinMultiplier(username, env);
    } else if (mysteryResult.type === 'timed') {
      if (mysteryResult.uses) {
        await activateBuffWithUses(username, mysteryResult.buffKey, mysteryResult.duration, mysteryResult.uses, env);
      } else if (mysteryResult.buffKey === 'rage_mode') {
        await activateBuffWithStack(username, mysteryResult.buffKey, mysteryResult.duration, env);
      } else {
        await activateBuff(username, mysteryResult.buffKey, mysteryResult.duration, env);
      }
    }
  } catch (activationError) {
    // Rollback: Refund balance and reverse bank update if activation failed
    logError('MysteryBox.activation', activationError, { username, mysteryItemId, mysteryItemName: mysteryResult.name });
    try {
      await Promise.all([
        setBalance(username, balance, env),
        updateBankBalance(-item.price, env)
      ]);
      // Verify rollback succeeded
      const verifyBalance = await getBalance(username, env);
      if (verifyBalance !== balance) {
        logError('MysteryBox.rollback.verify', new Error('Balance mismatch after rollback'), { username, expected: balance, actual: verifyBalance });
      }
    } catch (rollbackError) {
      logError('MysteryBox.rollback.CRITICAL', rollbackError, { username, originalBalance: balance, itemPrice: item.price });
    }
    return new Response(`@${username} ❌ Mystery Box Fehler! Dein Einsatz wurde zurückerstattet.`, { headers: RESPONSE_HEADERS });
  }

  return new Response(`@${username} 📦 Mystery Box! Du hast gewonnen: ${mysteryResult.name} (Wert: ${mysteryResult.price})! Item wurde aktiviert! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
}

// ============================================================================
// ITEM TYPE HANDLER MAP
// Maps item.type to handler function. Extend by adding new entries.
// ============================================================================
const ITEM_TYPE_HANDLERS = {
  timed: handleTimedItem,
  boost: handleBoostItem,
  insurance: handleInsuranceItem,
  winmulti: handleWinMultiItem,
  bundle: handleBundleItem,
  peek: handlePeekItem,
  instant: handleInstantItem
  // Note: prestige and unlock require special pre-loading, handled in buyShopItem
};

async function handleShop(username, item, env) {
  try {
    if (!item) {
      return new Response(`@${username} Hier findest du den Slots Shop: ${URLS.SHOP} | Nutze: !shop buy [Nummer]`, { headers: RESPONSE_HEADERS });
    }

    const parts = item.toLowerCase().split(/\s+/);
    if (parts[0] !== 'buy' || !parts[1]) {
      return new Response(`@${username} ❌ Nutze: !shop buy [Nummer]`, { headers: RESPONSE_HEADERS });
    }

    const itemNumber = parseInt(parts[1], 10);
    if (isNaN(itemNumber) || itemNumber < 1 || itemNumber > SHOP_ITEM_MAX) {
      return new Response(`@${username} ❌ Ungültige Item-Nummer! Nutze 1-${SHOP_ITEM_MAX}.`, { headers: RESPONSE_HEADERS });
    }

    return await buyShopItem(username, itemNumber, env);
  } catch (error) {
    logError('handleShop', error, { username, item });
    return new Response(`@${username} ❌ Fehler beim Shop-Kauf.`, { headers: RESPONSE_HEADERS });
  }
}

// ============================================================================
// MAIN PURCHASE FUNCTION
// Uses Strategy Pattern - delegates to type-specific handlers above.
// For new item types: 1) Add handler function 2) Add to ITEM_TYPE_HANDLERS map
// ============================================================================
async function buyShopItem(username, itemId, env) {
  try {
    const item = SHOP_ITEMS[itemId];

    if (!item) {
      return new Response(`@${username} ❌ Item nicht gefunden!`, { headers: RESPONSE_HEADERS });
    }

    // OPTIMIZED: Load balance and prerequisites in parallel based on item type
    let balance, hasPrerequisite, currentRank, hasExistingUnlock;

    if (item.type === 'prestige') {
      [balance, currentRank] = await Promise.all([
        getBalance(username, env),
        getPrestigeRank(username, env)
      ]);
    } else if (item.type === 'unlock') {
      const promises = [getBalance(username, env)];
      if (item.requires) promises.push(hasUnlock(username, item.requires, env));
      promises.push(hasUnlock(username, item.unlockKey, env));

      const results = await Promise.all(promises);
      balance = results[0];
      if (item.requires) {
        hasPrerequisite = results[1];
        hasExistingUnlock = results[2];
      } else {
        hasExistingUnlock = results[1];
      }
    } else {
      balance = await getBalance(username, env);
    }

    // Balance check (common to all types)
    if (balance < item.price) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! ${item.name} kostet ${item.price}, du hast ${balance}.`, { headers: RESPONSE_HEADERS });
    }

    // Delegate to type-specific handlers
    if (item.type === 'prestige') {
      return await handlePrestigeItem(username, item, itemId, balance, currentRank, env);
    }

    if (item.type === 'unlock') {
      return await handleUnlockItem(username, item, itemId, balance, hasPrerequisite, hasExistingUnlock, env);
    }

    // Use handler map for remaining types
    const handler = ITEM_TYPE_HANDLERS[item.type];
    if (handler) {
      return await handler(username, item, itemId, balance, env);
    }

    // Fallback for unknown types
    return new Response(`@${username} ✅ ${item.name} gekauft! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('buyShopItem', error, { username, itemId });
    return new Response(`@${username} ❌ Fehler beim Item-Kauf.`, { headers: RESPONSE_HEADERS });
  }
}

function spinWheel() {
  const rand = secureRandom() * 100;
  if (rand < WHEEL_JACKPOT_THRESHOLD) {
    if (secureRandom() < WHEEL_JACKPOT_CHANCE) return { result: '🦡 🦡 🦡 🦡 🦡', message: '🔥 5x DACHS JACKPOT! 🔥', prize: WHEEL_JACKPOT_PRIZE };
    return { result: '🦡 🦡 💎 ⭐ 💰', message: 'Dachse!', prize: WHEEL_DACHS_PRIZE };
  }
  if (rand < WHEEL_DIAMOND_THRESHOLD) return { result: '💎 💎 💎 ⭐ 💰', message: 'Diamanten!', prize: WHEEL_DIAMOND_PRIZE };
  if (rand < WHEEL_GOLD_THRESHOLD) return { result: '💰 💰 💰 ⭐ 💸', message: 'Gold!', prize: WHEEL_GOLD_PRIZE };
  if (rand < WHEEL_STAR_THRESHOLD) return { result: '⭐ ⭐ ⭐ 💰 💸', message: 'Sterne!', prize: WHEEL_STAR_PRIZE };
  return { result: '💸 💸 ⭐ 💰 🦡', message: 'Leider verloren!', prize: 0 };
}

export { handleShop, buyShopItem };
