/**
 * Web Shop API - Purchase items directly from the website
 *
 * Only items that don't trigger immediate actions are purchasable.
 * Items like Chaos Spin, Mystery Box, etc. require chat interaction.
 */

import { logError, exponentialBackoff } from '../utils.js';
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
import type { Env, ShopItem } from '../types/index.js';

// Extended ShopItem with optional properties for specific item types
interface ExtendedShopItem extends ShopItem {
  rank?: string;
  requiresRank?: string;
  unlockKey?: string;
  requires?: string;
  buffKey?: string;
  duration?: number;
  uses?: number;
  symbol?: string;
  weeklyLimit?: boolean;
}

interface LoggedInUser {
  username: string;
  displayName?: string;
}

interface PurchaseResult {
  success: boolean;
  message?: string;
  error?: string;
  newBalance?: number;
  redirectToProfile?: boolean;
}

interface BalanceDeductionResult {
  success: boolean;
  newBalance?: number;
  error?: string;
}

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
export function isWebPurchasable(itemId: number): boolean {
  return WEB_PURCHASABLE_ITEM_IDS.has(itemId);
}

/**
 * Get list of web-purchasable item IDs
 */
export function getWebPurchasableItems(): number[] {
  return Array.from(WEB_PURCHASABLE_ITEM_IDS);
}

/**
 * Handle shop purchase API request
 */
export async function handleShopBuyAPI(request: Request, env: Env, user: LoggedInUser | null): Promise<Response> {
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
  let body: { itemId?: string | number };
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

  const itemId = parseInt(String(body.itemId), 10);

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
 * Atomic balance deduction with retry mechanism
 * Prevents TOCTOU race conditions by verifying balance after deduction
 */
async function atomicBalanceDeduction(username: string, price: number, env: Env, maxRetries = 3): Promise<BalanceDeductionResult> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const balance = await getBalance(username, env);

    if (balance < price) {
      return {
        success: false,
        error: `Nicht genug DachsTaler! Kostet ${price}, du hast ${balance}.`
      };
    }

    const newBalance = balance - price;
    await setBalance(username, newBalance, env);

    // Verify the balance was set correctly (detect race condition)
    const verifyBalance = await getBalance(username, env);
    if (verifyBalance === newBalance) {
      return { success: true, newBalance };
    }

    // Race condition detected - retry with backoff
    if (attempt < maxRetries - 1) {
      await exponentialBackoff(attempt);
    }
  }

  return { success: false, error: 'Kauf fehlgeschlagen, bitte erneut versuchen.' };
}

/**
 * Process a web purchase
 * Returns { success, message, newBalance } or { success: false, error }
 */
async function processWebPurchase(username: string, itemId: number, env: Env): Promise<PurchaseResult> {
  const item = SHOP_ITEMS[itemId] as ExtendedShopItem;

  // Load type-specific data first (without balance - that's checked atomically)
  let currentRank: string | null = null;
  let hasPrerequisite: boolean = false;
  let hasExistingUnlock: boolean = false;

  if (item.type === 'prestige') {
    currentRank = await getPrestigeRank(username, env);
  } else if (item.type === 'unlock') {
    const promises: Promise<boolean>[] = [];
    if (item.requires) promises.push(hasUnlock(username, item.requires, env));
    promises.push(hasUnlock(username, item.unlockKey!, env));

    const results = await Promise.all(promises);
    if (item.requires) {
      hasPrerequisite = results[0];
      hasExistingUnlock = results[1];
    } else {
      hasPrerequisite = true; // No prerequisite needed
      hasExistingUnlock = results[0];
    }
  }

  // Type-specific purchase logic (all now use atomic balance deduction)
  switch (item.type) {
    case 'prestige':
      return await purchasePrestige(username, item, itemId, currentRank, env);
    case 'unlock':
      return await purchaseUnlock(username, item, itemId, hasPrerequisite, hasExistingUnlock, env);
    case 'timed':
      return await purchaseTimed(username, item, env);
    case 'boost':
      return await purchaseBoost(username, item, env);
    case 'insurance':
      return await purchaseInsurance(username, item, env);
    case 'winmulti':
      return await purchaseWinMulti(username, item, env);
    case 'bundle':
      return await purchaseBundle(username, item, env);
    case 'instant':
      return await purchaseSpinToken(username, item, itemId, env);
    default:
      return { success: false, error: 'Unbekannter Item-Typ' };
  }
}

async function purchasePrestige(username: string, item: ExtendedShopItem, itemId: number, currentRank: string | null, env: Env): Promise<PurchaseResult> {
  const currentIndex = currentRank ? PRESTIGE_RANKS.indexOf(currentRank) : -1;
  const newIndex = PRESTIGE_RANKS.indexOf(item.rank!);

  if (currentIndex >= newIndex) {
    return { success: false, error: `Du hast bereits ${currentRank} oder höher!` };
  }

  if (item.requiresRank) {
    const requiredIndex = PRESTIGE_RANKS.indexOf(item.requiresRank);
    if (currentIndex < requiredIndex) {
      return { success: false, error: `Du musst zuerst den ${item.requiresRank} Rang kaufen!` };
    }
  }

  // Atomic balance deduction with race condition protection
  const deduction = await atomicBalanceDeduction(username, item.price, env);
  if (!deduction.success) {
    return { success: false, error: deduction.error };
  }

  await setPrestigeRank(username, item.rank!, env);

  return {
    success: true,
    message: `${item.name} gekauft! Dein neuer Rang: ${item.rank}`,
    newBalance: deduction.newBalance
  };
}

async function purchaseUnlock(username: string, item: ExtendedShopItem, itemId: number, hasPrerequisite: boolean, hasExistingUnlock: boolean, env: Env): Promise<PurchaseResult> {
  if (item.requires && !hasPrerequisite) {
    return { success: false, error: `Du musst zuerst ${PREREQUISITE_NAMES[item.requires]} freischalten!` };
  }

  if (hasExistingUnlock) {
    return { success: false, error: `Du hast ${item.name} bereits freigeschaltet!` };
  }

  // Atomic balance deduction with race condition protection
  const deduction = await atomicBalanceDeduction(username, item.price, env);
  if (!deduction.success) {
    return { success: false, error: deduction.error };
  }

  await setUnlock(username, item.unlockKey!, env);

  const result: PurchaseResult = {
    success: true,
    message: `${item.name} freigeschaltet!`,
    newBalance: deduction.newBalance
  };

  if (item.unlockKey === 'custom_message') {
    result.redirectToProfile = true;
  }

  return result;
}

async function purchaseTimed(username: string, item: ExtendedShopItem, env: Env): Promise<PurchaseResult> {
  // Atomic balance deduction with race condition protection
  const deduction = await atomicBalanceDeduction(username, item.price, env);
  if (!deduction.success) {
    return { success: false, error: deduction.error };
  }

  if (item.uses) {
    await activateBuffWithUses(username, item.buffKey!, item.duration!, item.uses, env);
    return {
      success: true,
      message: `${item.name} aktiviert für ${item.uses} Spins!`,
      newBalance: deduction.newBalance
    };
  }

  if (item.buffKey === 'rage_mode') {
    await activateBuffWithStack(username, item.buffKey, item.duration!, env);
    const minutes = Math.floor(item.duration! / SECONDS_PER_MINUTE);
    return {
      success: true,
      message: `${item.name} aktiviert für ${minutes} Minuten!`,
      newBalance: deduction.newBalance
    };
  }

  await activateBuff(username, item.buffKey!, item.duration!, env);
  const duration = item.duration! >= SECONDS_PER_HOUR
    ? Math.floor(item.duration! / SECONDS_PER_HOUR) + 'h'
    : Math.floor(item.duration! / SECONDS_PER_MINUTE) + ' Minuten';

  return {
    success: true,
    message: `${item.name} aktiviert für ${duration}!`,
    newBalance: deduction.newBalance
  };
}

async function purchaseBoost(username: string, item: ExtendedShopItem, env: Env): Promise<PurchaseResult> {
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

    // Atomic balance deduction with race condition protection
    const deduction = await atomicBalanceDeduction(username, item.price, env);
    if (!deduction.success) {
      return { success: false, error: deduction.error };
    }

    await Promise.all([
      addBoost(username, item.symbol!, env),
      incrementDachsBoostPurchases(username, env)
    ]);

    return {
      success: true,
      message: `${item.name} aktiviert! Nächster ${item.symbol}-Gewinn wird verdoppelt!`,
      newBalance: deduction.newBalance
    };
  }

  // Atomic balance deduction with race condition protection
  const deduction = await atomicBalanceDeduction(username, item.price, env);
  if (!deduction.success) {
    return { success: false, error: deduction.error };
  }

  await addBoost(username, item.symbol!, env);

  return {
    success: true,
    message: `${item.name} aktiviert! Nächster ${item.symbol}-Gewinn wird verdoppelt!`,
    newBalance: deduction.newBalance
  };
}

async function purchaseInsurance(username: string, item: ExtendedShopItem, env: Env): Promise<PurchaseResult> {
  // Atomic balance deduction with race condition protection
  const deduction = await atomicBalanceDeduction(username, item.price, env);
  if (!deduction.success) {
    return { success: false, error: deduction.error };
  }

  await addInsurance(username, 5, env);

  return {
    success: true,
    message: 'Insurance Pack erhalten! 5 Verluste geben 50% zurück!',
    newBalance: deduction.newBalance
  };
}

async function purchaseWinMulti(username: string, item: ExtendedShopItem, env: Env): Promise<PurchaseResult> {
  // Atomic balance deduction with race condition protection
  const deduction = await atomicBalanceDeduction(username, item.price, env);
  if (!deduction.success) {
    return { success: false, error: deduction.error };
  }

  await addWinMultiplier(username, env);

  return {
    success: true,
    message: 'Win Multiplier aktiviert! Nächster Gewinn wird x2!',
    newBalance: deduction.newBalance
  };
}

async function purchaseBundle(username: string, item: ExtendedShopItem, env: Env): Promise<PurchaseResult> {
  const purchases = await getSpinBundlePurchases(username, env);
  if (purchases.count >= WEEKLY_SPIN_BUNDLE_LIMIT) {
    return { success: false, error: `Wöchentliches Limit erreicht! Max. ${WEEKLY_SPIN_BUNDLE_LIMIT} Spin Bundles pro Woche.` };
  }

  // Atomic balance deduction with race condition protection
  const deduction = await atomicBalanceDeduction(username, item.price, env);
  if (!deduction.success) {
    return { success: false, error: deduction.error };
  }

  await Promise.all([
    addFreeSpinsWithMultiplier(username, SPIN_BUNDLE_COUNT, SPIN_BUNDLE_MULTIPLIER, env),
    incrementSpinBundlePurchases(username, env)
  ]);

  const remainingPurchases = WEEKLY_SPIN_BUNDLE_LIMIT - (purchases.count + 1);
  return {
    success: true,
    message: `Spin Bundle erhalten! ${SPIN_BUNDLE_COUNT} Free Spins! (Noch ${remainingPurchases} diese Woche)`,
    newBalance: deduction.newBalance
  };
}

async function purchaseSpinToken(username: string, item: ExtendedShopItem, itemId: number, env: Env): Promise<PurchaseResult> {
  // Atomic balance deduction with race condition protection
  const deduction = await atomicBalanceDeduction(username, item.price, env);
  if (!deduction.success) {
    return { success: false, error: deduction.error };
  }

  // Guaranteed Pair (ID 37)
  if (itemId === 37) {
    await activateGuaranteedPair(username, env);

    return {
      success: true,
      message: 'Guaranteed Pair aktiviert! Dein nächster Spin hat garantiert ein Pair!',
      newBalance: deduction.newBalance
    };
  }

  // Wild Card (ID 38)
  if (itemId === 38) {
    await activateWildCard(username, env);

    return {
      success: true,
      message: 'Wild Card aktiviert! Dein nächster Spin enthält ein 🃏 Wild!',
      newBalance: deduction.newBalance
    };
  }

  return { success: false, error: 'Dieses Item kann nur im Chat gekauft werden' };
}
