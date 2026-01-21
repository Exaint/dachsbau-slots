/**
 * Web Shop API - Purchase items directly from the website
 *
 * Only items that don't trigger immediate actions are purchasable.
 * Items like Chaos Spin, Mystery Box, etc. require chat interaction.
 */

import { logError } from '../utils.js';
import { SHOP_ITEMS, PREREQUISITE_NAMES, PRESTIGE_RANKS } from '../constants.js';
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
  updateBankBalance,
  activateGuaranteedPair,
  activateWildCard
} from '../database.js';
import {
  WEEKLY_DACHS_BOOST_LIMIT,
  WEEKLY_SPIN_BUNDLE_LIMIT,
  SPIN_BUNDLE_COUNT,
  SPIN_BUNDLE_MULTIPLIER,
  KV_ACTIVE,
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR
} from '../constants.js';

// Items that CAN be purchased via web (no chat interaction needed)
const WEB_PURCHASABLE_ITEM_IDS = new Set([
  // Boosts (2-8)
  2, 3, 4, 5, 6, 7, 8,
  // Insurance (9)
  9,
  // Win Multiplier (10)
  10,
  // Unlocks (13, 19, 21, 23, 25)
  13, 19, 21, 23, 25,
  // Timed Buffs (14, 20, 24, 32, 33, 34, 35, 39)
  14, 20, 24, 32, 33, 34, 35, 39,
  // Spin Bundle (15)
  15,
  // Prestige Ranks (17, 22, 26, 29, 30)
  17, 22, 26, 29, 30,
  // Daily Boost, Custom Message (27, 28)
  27, 28,
  // Spin Tokens - stored for next chat spin (37, 38)
  37, 38
]);

// Items that CANNOT be purchased via web (require chat/immediate action)
// 1 = Peek Token (requires chat output)
// 11 = Chaos Spin (instant action)
// 12 = Glücksrad (instant action)
// 16 = Mystery Box (instant action)
// 31 = Reverse Chaos (instant action)
// 36 = Diamond Mine (instant action)

/**
 * Check if item can be purchased via web
 */
export function isWebPurchasable(itemId) {
  return WEB_PURCHASABLE_ITEM_IDS.has(itemId);
}

/**
 * Get list of web-purchasable item IDs
 */
export function getWebPurchasableItems() {
  return Array.from(WEB_PURCHASABLE_ITEM_IDS);
}

/**
 * Handle shop purchase API request
 */
export async function handleShopBuyAPI(request, env, user) {
  // User must be logged in
  if (!user) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Nicht eingeloggt'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error: 'Ungültige Anfrage'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const itemId = parseInt(body.itemId, 10);

  // Validate item ID
  if (isNaN(itemId) || !SHOP_ITEMS[itemId]) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Ungültiges Item'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check if item is web-purchasable
  if (!isWebPurchasable(itemId)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Dieses Item kann nur im Chat gekauft werden'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Process purchase
  try {
    const result = await processWebPurchase(user.username, itemId, env);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('handleShopBuyAPI', error, { username: user.username, itemId });
    return new Response(JSON.stringify({
      success: false,
      error: 'Fehler beim Kauf'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Process a web purchase
 * Returns { success, message, newBalance } or { success: false, error }
 */
async function processWebPurchase(username, itemId, env) {
  const item = SHOP_ITEMS[itemId];

  // Load balance and type-specific data in parallel
  let balance, currentRank, hasPrerequisite, hasExistingUnlock;

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

  // Balance check
  if (balance < item.price) {
    return {
      success: false,
      error: `Nicht genug DachsTaler! ${item.name} kostet ${item.price}, du hast ${balance}.`
    };
  }

  // Type-specific purchase logic
  switch (item.type) {
    case 'prestige':
      return await purchasePrestige(username, item, itemId, balance, currentRank, env);
    case 'unlock':
      return await purchaseUnlock(username, item, itemId, balance, hasPrerequisite, hasExistingUnlock, env);
    case 'timed':
      return await purchaseTimed(username, item, balance, env);
    case 'boost':
      return await purchaseBoost(username, item, balance, env);
    case 'insurance':
      return await purchaseInsurance(username, item, balance, env);
    case 'winmulti':
      return await purchaseWinMulti(username, item, balance, env);
    case 'bundle':
      return await purchaseBundle(username, item, balance, env);
    case 'instant':
      return await purchaseSpinToken(username, item, itemId, balance, env);
    default:
      return { success: false, error: 'Unbekannter Item-Typ' };
  }
}

async function purchasePrestige(username, item, itemId, balance, currentRank, env) {
  const currentIndex = currentRank ? PRESTIGE_RANKS.indexOf(currentRank) : -1;
  const newIndex = PRESTIGE_RANKS.indexOf(item.rank);

  if (currentIndex >= newIndex) {
    return { success: false, error: `Du hast bereits ${currentRank} oder höher!` };
  }

  if (item.requiresRank) {
    const requiredIndex = PRESTIGE_RANKS.indexOf(item.requiresRank);
    if (currentIndex < requiredIndex) {
      return { success: false, error: `Du musst zuerst den ${item.requiresRank} Rang kaufen!` };
    }
  }

  const newBalance = balance - item.price;
  await Promise.all([
    setPrestigeRank(username, item.rank, env),
    setBalance(username, newBalance, env),
    updateBankBalance(item.price, env)
  ]);

  return {
    success: true,
    message: `${item.name} gekauft! Dein neuer Rang: ${item.rank}`,
    newBalance
  };
}

async function purchaseUnlock(username, item, itemId, balance, hasPrerequisite, hasExistingUnlock, env) {
  if (item.requires && !hasPrerequisite) {
    return { success: false, error: `Du musst zuerst ${PREREQUISITE_NAMES[item.requires]} freischalten!` };
  }

  if (hasExistingUnlock) {
    return { success: false, error: `Du hast ${item.name} bereits freigeschaltet!` };
  }

  const newBalance = balance - item.price;
  await Promise.all([
    setUnlock(username, item.unlockKey, env),
    setBalance(username, newBalance, env),
    updateBankBalance(item.price, env)
  ]);

  return {
    success: true,
    message: `${item.name} freigeschaltet!`,
    newBalance
  };
}

async function purchaseTimed(username, item, balance, env) {
  const newBalance = balance - item.price;

  await Promise.all([
    setBalance(username, newBalance, env),
    updateBankBalance(item.price, env)
  ]);

  if (item.uses) {
    await activateBuffWithUses(username, item.buffKey, item.duration, item.uses, env);
    return {
      success: true,
      message: `${item.name} aktiviert für ${item.uses} Spins!`,
      newBalance
    };
  }

  if (item.buffKey === 'rage_mode') {
    await activateBuffWithStack(username, item.buffKey, item.duration, env);
    const minutes = Math.floor(item.duration / SECONDS_PER_MINUTE);
    return {
      success: true,
      message: `${item.name} aktiviert für ${minutes} Minuten!`,
      newBalance
    };
  }

  await activateBuff(username, item.buffKey, item.duration, env);
  const duration = item.duration >= SECONDS_PER_HOUR
    ? Math.floor(item.duration / SECONDS_PER_HOUR) + 'h'
    : Math.floor(item.duration / SECONDS_PER_MINUTE) + ' Minuten';

  return {
    success: true,
    message: `${item.name} aktiviert für ${duration}!`,
    newBalance
  };
}

async function purchaseBoost(username, item, balance, env) {
  const lowerUsername = username.toLowerCase();

  // Weekly limit check for Dachs-Boost
  if (item.weeklyLimit) {
    const boostKey = `boost:${lowerUsername}:${item.symbol}`;
    const [existingBoost, purchases] = await Promise.all([
      env.SLOTS_KV.get(boostKey),
      getDachsBoostPurchases(username, env)
    ]);

    if (existingBoost === KV_ACTIVE) {
      return { success: false, error: `Du hast bereits einen aktiven ${item.name}!` };
    }

    if (purchases.count >= WEEKLY_DACHS_BOOST_LIMIT) {
      return { success: false, error: `Wöchentliches Limit erreicht! Max. ${WEEKLY_DACHS_BOOST_LIMIT} Dachs-Boost pro Woche.` };
    }

    const newBalance = balance - item.price;
    await Promise.all([
      setBalance(username, newBalance, env),
      addBoost(username, item.symbol, env),
      incrementDachsBoostPurchases(username, env),
      updateBankBalance(item.price, env)
    ]);

    return {
      success: true,
      message: `${item.name} aktiviert! Nächster ${item.symbol}-Gewinn wird verdoppelt!`,
      newBalance
    };
  }

  const newBalance = balance - item.price;
  await Promise.all([
    setBalance(username, newBalance, env),
    addBoost(username, item.symbol, env),
    updateBankBalance(item.price, env)
  ]);

  return {
    success: true,
    message: `${item.name} aktiviert! Nächster ${item.symbol}-Gewinn wird verdoppelt!`,
    newBalance
  };
}

async function purchaseInsurance(username, item, balance, env) {
  const newBalance = balance - item.price;
  await Promise.all([
    setBalance(username, newBalance, env),
    addInsurance(username, 5, env),
    updateBankBalance(item.price, env)
  ]);

  return {
    success: true,
    message: 'Insurance Pack erhalten! 5 Verluste geben 50% zurück!',
    newBalance
  };
}

async function purchaseWinMulti(username, item, balance, env) {
  const newBalance = balance - item.price;
  await Promise.all([
    setBalance(username, newBalance, env),
    addWinMultiplier(username, env),
    updateBankBalance(item.price, env)
  ]);

  return {
    success: true,
    message: 'Win Multiplier aktiviert! Nächster Gewinn wird x2!',
    newBalance
  };
}

async function purchaseBundle(username, item, balance, env) {
  const purchases = await getSpinBundlePurchases(username, env);
  if (purchases.count >= WEEKLY_SPIN_BUNDLE_LIMIT) {
    return { success: false, error: `Wöchentliches Limit erreicht! Max. ${WEEKLY_SPIN_BUNDLE_LIMIT} Spin Bundles pro Woche.` };
  }

  const newBalance = balance - item.price;
  await Promise.all([
    setBalance(username, newBalance, env),
    addFreeSpinsWithMultiplier(username, SPIN_BUNDLE_COUNT, SPIN_BUNDLE_MULTIPLIER, env),
    incrementSpinBundlePurchases(username, env),
    updateBankBalance(item.price, env)
  ]);

  const remainingPurchases = WEEKLY_SPIN_BUNDLE_LIMIT - (purchases.count + 1);
  return {
    success: true,
    message: `Spin Bundle erhalten! ${SPIN_BUNDLE_COUNT} Free Spins! (Noch ${remainingPurchases} diese Woche)`,
    newBalance
  };
}

async function purchaseSpinToken(username, item, itemId, balance, env) {
  const newBalance = balance - item.price;

  // Guaranteed Pair (ID 37)
  if (itemId === 37) {
    await Promise.all([
      setBalance(username, newBalance, env),
      activateGuaranteedPair(username, env),
      updateBankBalance(item.price, env)
    ]);

    return {
      success: true,
      message: 'Guaranteed Pair aktiviert! Dein nächster Spin hat garantiert ein Pair!',
      newBalance
    };
  }

  // Wild Card (ID 38)
  if (itemId === 38) {
    await Promise.all([
      setBalance(username, newBalance, env),
      activateWildCard(username, env),
      updateBankBalance(item.price, env)
    ]);

    return {
      success: true,
      message: 'Wild Card aktiviert! Dein nächster Spin enthält ein 🃏 Wild!',
      newBalance
    };
  }

  return { success: false, error: 'Dieses Item kann nur im Chat gekauft werden' };
}
