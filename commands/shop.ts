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
  SHOP_ITEMS,
  SHOP_ITEM_MAX,
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
  KV_ACTIVE,
  ACHIEVEMENTS
} from '../constants.js';
import { getWeightedSymbol, secureRandom, secureRandomInt, logError, safeJsonParse } from '../utils.js';
import {
  getBalance,
  deductBalance,
  creditBalance,
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
  isBuffActive,
  checkAndUnlockAchievement,
  getPlayerAchievements,
  updatePlayerStat
} from '../database.js';
import { calculateWin } from './slots.js';
import type { Env, ShopItem, WinResult } from '../types/index.js';

// ============================================
// Types
// ============================================

interface WheelResult {
  result: string;
  message: string;
  prize: number;
}


// Static: Mystery Box item pool (avoid recreation per request)
const MYSTERY_BOX_ITEMS = [
  2, 3, 4, 5, 6, 7, 8,    // Symbol-Boosts (7)
  9, 10,                   // Utility Items (2)
  14, 20, 24,              // Timed Buffs Classic (3)
  32, 33, 34, 35, 39       // Timed Buffs Premium (5)
]; // Total: 17 Items (Unlocks, Prestige, Instants excluded)

// ============================================
// Achievement Tracking
// ============================================

// Achievement tracking for shop purchases
async function trackShopAchievements(
  username: string,
  itemId: number,
  item: ShopItem,
  extraData: { chaosResult?: number; wheelJackpot?: boolean } | null,
  env: Env
): Promise<void> {
  try {
    const promises: Promise<unknown>[] = [];

    // Track shop purchase stat (unified: achievement-blob + stats-KV + D1)
    promises.push(updatePlayerStat(username, 'shopPurchases', 1, env));

    // FIRST_PURCHASE
    promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.FIRST_PURCHASE.id, env));

    // Track item-specific stats for extended tracking & achievements
    switch (itemId) {
      case 1: // Peek Token
        promises.push(updatePlayerStat(username, 'peekTokens', 1, env));
        break;
      case 11: // Chaos Spin
        promises.push(updatePlayerStat(username, 'chaosSpins', 1, env));
        break;
      case 12: // Glücksrad
        promises.push(updatePlayerStat(username, 'wheelSpins', 1, env));
        break;
      case 16: // Mystery Box
        promises.push(updatePlayerStat(username, 'mysteryBoxes', 1, env));
        break;
      case 31: // Reverse Chaos
        promises.push(updatePlayerStat(username, 'reverseChaosSpins', 1, env));
        break;
      case 36: // Diamond Mine
        promises.push(updatePlayerStat(username, 'diamondMines', 1, env));
        break;
      case 37: // Guaranteed Pair
        promises.push(updatePlayerStat(username, 'guaranteedPairsUsed', 1, env));
        break;
      case 38: // Wild Card
        promises.push(updatePlayerStat(username, 'wildCardsUsed', 1, env));
        break;
    }

    // Check for UNLOCK_ALL_SLOTS when buying an unlock
    if (item.type === 'unlock') {
      // Check if all slot unlocks are now owned
      const data = await getPlayerAchievements(username, env);
      if (!data.unlockedAt[ACHIEVEMENTS.UNLOCK_ALL_SLOTS.id]) {
        const [has20, has30, has50, has100, hasAll] = await Promise.all([
          hasUnlock(username, 'slots_20', env),
          hasUnlock(username, 'slots_30', env),
          hasUnlock(username, 'slots_50', env),
          hasUnlock(username, 'slots_100', env),
          hasUnlock(username, 'slots_all', env)
        ]);
        if (has20 && has30 && has50 && has100 && hasAll) {
          promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.UNLOCK_ALL_SLOTS.id, env));
        }
      }
    }

    // CHAOS_SPIN_BIG (Chaos Spin with 1000+ win)
    if (itemId === 11 && extraData && extraData.chaosResult && extraData.chaosResult >= 1000) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.CHAOS_SPIN_BIG.id, env));
    }

    // WHEEL_JACKPOT (5x Dachs Jackpot)
    if (itemId === 12 && extraData && extraData.wheelJackpot) {
      promises.push(checkAndUnlockAchievement(username, ACHIEVEMENTS.WHEEL_JACKPOT.id, env));
    }

    await Promise.all(promises);
  } catch (error) {
    logError('trackShopAchievements', error, { username, itemId });
  }
}

// ============================================================================
// ITEM TYPE HANDLERS - Strategy Pattern
// Each handler processes a specific item type. Add new types by adding handlers.
// Handler signature: async (username, item, itemId, balance, env) => Response
// ============================================================================

async function handlePrestigeItem(
  username: string,
  item: ShopItem,
  itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  await setPrestigeRank(username, item.rank!, env);

  // Achievement tracking
  await trackShopAchievements(username, itemId, item, null, env);

  return new Response(`@${username} ✅ ${item.name} gekauft! Dein Rang: ${item.rank} | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleUnlockItem(
  username: string,
  item: ShopItem,
  itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  await setUnlock(username, item.unlockKey!, env);

  // Achievement tracking
  await trackShopAchievements(username, itemId, item, null, env);

  // Custom Messages unlock: include profile link
  if (item.unlockKey === 'custom_message') {
    return new Response(`@${username} ✅ Custom Messages freigeschaltet! Richte sie ein: https://dachsbau-slots.exaint.workers.dev/?page=profile&user=${encodeURIComponent(username)} | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
  }

  return new Response(`@${username} ✅ ${item.name} freigeschaltet! | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleTimedItem(
  username: string,
  item: ShopItem,
  _itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  if (item.uses) {
    await activateBuffWithUses(username, item.buffKey!, item.duration!, item.uses, env);
    return new Response(`@${username} ✅ ${item.name} aktiviert für ${item.uses} Spins! | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
  }

  if (item.buffKey === 'rage_mode') {
    await activateBuffWithStack(username, item.buffKey, item.duration!, env);
    const minutes = Math.floor(item.duration! / SECONDS_PER_MINUTE);
    return new Response(`@${username} ✅ ${item.name} aktiviert für ${minutes} Minuten! Verluste geben +5% Gewinn-Chance (bis 50%)! 🔥 | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
  }

  await activateBuff(username, item.buffKey!, item.duration!, env);
  const minutes = Math.floor(item.duration! / SECONDS_PER_MINUTE);
  const hours = item.duration! >= SECONDS_PER_HOUR ? Math.floor(item.duration! / SECONDS_PER_HOUR) + 'h' : minutes + ' Minuten';
  return new Response(`@${username} ✅ ${item.name} aktiviert für ${hours}! | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleBoostItem(
  username: string,
  item: ShopItem,
  _itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  if (item.weeklyLimit) {
    await Promise.all([
      addBoost(username, item.symbol!, env),
      incrementDachsBoostPurchases(username, env)
    ]);

    return new Response(`@${username} ✅ ${item.name} aktiviert! Dein nächster Gewinn mit ${item.symbol} wird verdoppelt! | Kontostand: ${balance} 🦡 | Du kannst diese Woche keinen weiteren Dachs-Boost kaufen`, { headers: RESPONSE_HEADERS });
  }

  await addBoost(username, item.symbol!, env);
  return new Response(`@${username} ✅ ${item.name} aktiviert! Dein nächster Gewinn mit ${item.symbol} wird verdoppelt! | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleInsuranceItem(
  username: string,
  _item: ShopItem,
  _itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  await addInsurance(username, 5, env);
  return new Response(`@${username} ✅ Insurance Pack erhalten! Die nächsten 5 Verluste geben 50% des Einsatzes zurück! 🛡️ | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleWinMultiItem(
  username: string,
  _item: ShopItem,
  _itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  await addWinMultiplier(username, env);
  return new Response(`@${username} ✅ Win Multiplier aktiviert! Dein nächster Gewinn wird x2! ⚡ | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
}

async function handleBundleItem(
  username: string,
  _item: ShopItem,
  _itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  await Promise.all([
    addFreeSpinsWithMultiplier(username, SPIN_BUNDLE_COUNT, SPIN_BUNDLE_MULTIPLIER, env),
    incrementSpinBundlePurchases(username, env)
  ]);

  return new Response(`@${username} ✅ Spin Bundle erhalten! ${SPIN_BUNDLE_COUNT} Free Spins (${SPIN_BUNDLE_MULTIPLIER * 10} DachsTaler) gutgeschrieben! | Kontostand: ${balance} 🦡 | Du kannst diese Woche kein weiteres Spin Bundle kaufen`, { headers: RESPONSE_HEADERS });
}

async function handlePeekItem(
  username: string,
  _item: ShopItem,
  _itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  const lowerUsername = username.toLowerCase();

  // Load all relevant buffs for accurate peek grid
  const [hasLuckyCharm, hasStarMagnet, hasDiamondRush, dachsLocator, rageMode] = await Promise.all([
    isBuffActive(username, 'lucky_charm', env),
    isBuffActive(username, 'star_magnet', env),
    isBuffActive(username, 'diamond_rush', env),
    env.SLOTS_KV.get(`buff:${lowerUsername}:dachs_locator`),
    env.SLOTS_KV.get(`buff:${lowerUsername}:rage_mode`)
  ]);

  // Calculate Dachs chance with all buffs
  let peekDachsChance = DACHS_BASE_CHANCE;
  if (hasLuckyCharm) peekDachsChance *= 2;
  if (dachsLocator) {
    const data = safeJsonParse(dachsLocator) as { expireAt: number; uses: number } | null;
    if (data && Date.now() < data.expireAt && data.uses > 0) peekDachsChance *= 3;
  }
  if (rageMode) {
    const data = safeJsonParse(rageMode) as { expireAt: number; stack: number } | null;
    if (data && Date.now() < data.expireAt && data.stack > 0) {
      peekDachsChance *= (1 + data.stack / 100);
    }
  }

  const peekGrid: string[] = [];
  const activeBuffs: string[] = [];
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
  const peekResult: WinResult = calculateWin(peekGrid);
  const willWin = peekResult.points > 0 || (peekResult.freeSpins && peekResult.freeSpins > 0);
  const buffText = activeBuffs.length > 0 ? ` (${activeBuffs.join('')} aktiv!)` : '';

  return new Response(`@${username} 🔮 Peek Token! Dein nächster Spin wird ${willWin ? '✅ GEWINNEN' : '❌ VERLIEREN'}! 🔮${buffText} | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
}

// Instant items have sub-handlers for different item IDs
async function handleInstantItem(
  username: string,
  item: ShopItem,
  itemId: number,
  balance: number,
  env: Env
): Promise<Response> {
  // Chaos Spin (ID 11) - result can be negative
  if (itemId === 11) {
    const result = secureRandomInt(CHAOS_SPIN_MIN, CHAOS_SPIN_MAX);
    let newBalance: number;
    if (result > 0) {
      newBalance = await creditBalance(username, result, env);
    } else if (result < 0) {
      const deductResult = await deductBalance(username, Math.abs(result), env);
      newBalance = deductResult.newBalance;
    } else {
      newBalance = balance;
    }
    // Achievement tracking
    await trackShopAchievements(username, itemId, item, { chaosResult: result }, env);
    return new Response(`@${username} 🎲 Chaos Spin! ${result >= 0 ? '+' : ''}${result} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
  }

  // Glücksrad (ID 12) - prize >= 0
  if (itemId === 12) {
    const wheel = spinWheel();
    let newBalance = balance;
    if (wheel.prize > 0) {
      newBalance = await creditBalance(username, wheel.prize, env);
    }
    // Achievement tracking (wheelJackpot = 5x Dachs)
    const isWheelJackpot = wheel.prize === WHEEL_JACKPOT_PRIZE;
    await trackShopAchievements(username, itemId, item, { wheelJackpot: isWheelJackpot }, env);
    const netResult = wheel.prize - item.price;
    return new Response(`@${username} 🎡 [ ${wheel.result} ] ${wheel.message} ${netResult >= 0 ? '+' : ''}${netResult} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
  }

  // Mystery Box (ID 16) - price already deducted
  if (itemId === 16) {
    const response = await handleMysteryBox(username, item, balance, env);
    // Track achievement only if mystery box succeeded (doesn't contain error message)
    await trackShopAchievements(username, itemId, item, null, env);
    return response;
  }

  // Reverse Chaos (ID 31) - result always positive
  if (itemId === 31) {
    const result = secureRandomInt(REVERSE_CHAOS_MIN, REVERSE_CHAOS_MAX);
    const newBalance = await creditBalance(username, result, env);
    // Achievement tracking
    await trackShopAchievements(username, itemId, item, null, env);
    return new Response(`@${username} 🎲 Reverse Chaos! +${result} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
  }

  // Diamond Mine (ID 36)
  if (itemId === 36) {
    const freeSpinsAmount = secureRandomInt(DIAMOND_MINE_MIN_SPINS, DIAMOND_MINE_MAX_SPINS);
    await addFreeSpinsWithMultiplier(username, freeSpinsAmount, 1, env);
    // Achievement tracking
    await trackShopAchievements(username, itemId, item, null, env);
    return new Response(`@${username} 💎 Diamond Mine! Du hast ${freeSpinsAmount} Free Spins gefunden! 💎 | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
  }

  // Guaranteed Pair (ID 37)
  if (itemId === 37) {
    await activateGuaranteedPair(username, env);
    // Achievement tracking
    await trackShopAchievements(username, itemId, item, null, env);
    return new Response(`@${username} ✅ Guaranteed Pair aktiviert! Dein nächster Spin hat garantiert mindestens ein Pair! 🎯 | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
  }

  // Wild Card (ID 38)
  if (itemId === 38) {
    await activateWildCard(username, env);
    // Achievement tracking
    await trackShopAchievements(username, itemId, item, null, env);
    return new Response(`@${username} ✅ Wild Card aktiviert! Dein nächster Spin enthält ein 🃏 Wild Symbol! | Kontostand: ${balance} 🦡`, { headers: RESPONSE_HEADERS });
  }

  // Fallback for unknown instant items
  return new Response(`@${username} ✅ ${item.name} gekauft! | Kontostand: ${balance}`, { headers: RESPONSE_HEADERS });
}

// Mystery Box has complex logic with rollback and timeout protection
const MYSTERY_BOX_TIMEOUT_MS = 10000; // 10s to handle cold starts

async function handleMysteryBox(username: string, item: ShopItem, balance: number, env: Env): Promise<Response> {
  const mysteryItemId = MYSTERY_BOX_ITEMS[secureRandomInt(0, MYSTERY_BOX_ITEMS.length - 1)];
  const mysteryResult = SHOP_ITEMS[mysteryItemId] as ShopItem;

  try {
    // Activation with timeout to prevent hanging operations
    const activationPromise = (async () => {
      if (mysteryResult.type === 'boost') {
        await addBoost(username, mysteryResult.symbol!, env);
      } else if (mysteryResult.type === 'insurance') {
        await addInsurance(username, 5, env);
      } else if (mysteryResult.type === 'winmulti') {
        await addWinMultiplier(username, env);
      } else if (mysteryResult.type === 'timed') {
        if (mysteryResult.uses) {
          await activateBuffWithUses(username, mysteryResult.buffKey!, mysteryResult.duration!, mysteryResult.uses, env);
        } else if (mysteryResult.buffKey === 'rage_mode') {
          await activateBuffWithStack(username, mysteryResult.buffKey, mysteryResult.duration!, env);
        } else {
          await activateBuff(username, mysteryResult.buffKey!, mysteryResult.duration!, env);
        }
      }
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Mystery Box activation timeout')), MYSTERY_BOX_TIMEOUT_MS)
    );

    await Promise.race([activationPromise, timeoutPromise]);
  } catch (activationError) {
    // Rollback: Atomic refund via creditBalance
    logError('MysteryBox.activation', activationError, { username, mysteryItemId, mysteryItemName: mysteryResult.name });

    try {
      await creditBalance(username, item.price, env);
    } catch (rollbackError) {
      logError('MysteryBox.rollback.CRITICAL', rollbackError, {
        username, itemPrice: item.price
      });
      return new Response(`@${username} ❌ Mystery Box Fehler! Bitte kontaktiere einen Admin für Erstattung.`, { headers: RESPONSE_HEADERS });
    }

    return new Response(`@${username} ❌ Mystery Box Fehler! Dein Einsatz wurde zurückerstattet.`, { headers: RESPONSE_HEADERS });
  }

  return new Response(`@${username} 📦 Mystery Box! Du hast gewonnen: ${mysteryResult.name} (Wert: ${mysteryResult.price})! Item wurde aktiviert! | Kontostand: ${balance}`, { headers: RESPONSE_HEADERS });
}

// ============================================================================
// ITEM TYPE HANDLER MAP
// Maps item.type to handler function. Extend by adding new entries.
// ============================================================================
type ItemHandler = (username: string, item: ShopItem, itemId: number, balance: number, env: Env) => Promise<Response>;

const ITEM_TYPE_HANDLERS: Record<string, ItemHandler> = {
  timed: handleTimedItem,
  boost: handleBoostItem,
  insurance: handleInsuranceItem,
  winmulti: handleWinMultiItem,
  bundle: handleBundleItem,
  peek: handlePeekItem,
  instant: handleInstantItem
  // Note: prestige and unlock require special pre-loading, handled in buyShopItem
};

// ============================================
// Main Shop Functions
// ============================================

async function handleShop(username: string, item: string | undefined, env: Env): Promise<Response> {
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
async function buyShopItem(username: string, itemId: number, env: Env): Promise<Response> {
  try {
    const item = SHOP_ITEMS[itemId] as ShopItem | undefined;

    if (!item) {
      return new Response(`@${username} ❌ Item nicht gefunden!`, { headers: RESPONSE_HEADERS });
    }

    // OPTIMIZED: Load balance and prerequisites in parallel based on item type
    let balance: number;
    let currentRank: string | null = null;

    if (item.type === 'prestige') {
      [balance, currentRank] = await Promise.all([
        getBalance(username, env),
        getPrestigeRank(username, env)
      ]);
    } else if (item.type === 'unlock') {
      const promises: Promise<number | boolean | string | null>[] = [getBalance(username, env)];
      if (item.requires) promises.push(hasUnlock(username, item.requires, env));
      promises.push(hasUnlock(username, item.unlockKey!, env));

      const results = await Promise.all(promises);
      balance = results[0] as number;
      const hasPrerequisite = item.requires ? results[1] as boolean : undefined;
      const hasExistingUnlock = item.requires ? results[2] as boolean : results[1] as boolean;

      // Pre-purchase validation for unlock items
      if (item.requires && !hasPrerequisite) {
        return new Response(`@${username} ❌ Du musst zuerst ${PREREQUISITE_NAMES[item.requires]} freischalten!`, { headers: RESPONSE_HEADERS });
      }
      if (hasExistingUnlock) {
        return new Response(`@${username} ❌ Du hast ${item.name} bereits freigeschaltet!`, { headers: RESPONSE_HEADERS });
      }
    } else {
      balance = await getBalance(username, env);
    }

    // Balance check (common to all types)
    if (balance < item.price) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! ${item.name} kostet ${item.price}, du hast ${balance}.`, { headers: RESPONSE_HEADERS });
    }

    // Pre-purchase validation for prestige items
    if (item.type === 'prestige') {
      const currentIndex = currentRank ? PRESTIGE_RANKS.indexOf(currentRank) : -1;
      const newIndex = PRESTIGE_RANKS.indexOf(item.rank!);
      if (currentIndex >= newIndex) {
        return new Response(`@${username} ❌ Du hast bereits ${currentRank} oder höher!`, { headers: RESPONSE_HEADERS });
      }
      if (item.requiresRank) {
        const requiredIndex = PRESTIGE_RANKS.indexOf(item.requiresRank);
        if (currentIndex < requiredIndex) {
          return new Response(`@${username} ❌ Du musst zuerst den ${item.requiresRank} Rang kaufen!`, { headers: RESPONSE_HEADERS });
        }
      }
    }

    // Pre-purchase validation for boost with weekly limit
    if (item.type === 'boost' && item.weeklyLimit) {
      const lowerUsername = username.toLowerCase();
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
    }

    // Pre-purchase validation for bundle with weekly limit
    if (item.type === 'bundle') {
      const purchases = await getSpinBundlePurchases(username, env);
      if (purchases.count >= WEEKLY_SPIN_BUNDLE_LIMIT) {
        return new Response(`@${username} ❌ Wöchentliches Limit erreicht! Du kannst maximal ${WEEKLY_SPIN_BUNDLE_LIMIT} Spin Bundles pro Woche kaufen. Nächster Reset: Montag 00:00 UTC`, { headers: RESPONSE_HEADERS });
      }
    }

    // ATOMIC DEDUCTION: D1-first with KV fallback (eliminates TOCTOU window)
    const deductResult = await deductBalance(username, item.price, env);
    if (!deductResult.success) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! ${item.name} kostet ${item.price}, du hast ${deductResult.newBalance}.`, { headers: RESPONSE_HEADERS });
    }
    balance = deductResult.newBalance;

    // Delegate to type-specific handlers (balance is POST-deduction)
    if (item.type === 'prestige') {
      return await handlePrestigeItem(username, item, itemId, balance, env);
    }

    if (item.type === 'unlock') {
      return await handleUnlockItem(username, item, itemId, balance, env);
    }

    // Use handler map for remaining types
    const handler = ITEM_TYPE_HANDLERS[item.type];
    if (handler) {
      const response = await handler(username, item, itemId, balance, env);
      // Achievement tracking for non-instant types
      // (instant types handle their own tracking with extraData)
      if (item.type !== 'instant') {
        await trackShopAchievements(username, itemId, item, null, env);
      }
      return response;
    }

    // Fallback for unknown types
    return new Response(`@${username} ✅ ${item.name} gekauft! | Kontostand: ${balance}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('buyShopItem', error, { username, itemId });
    return new Response(`@${username} ❌ Fehler beim Item-Kauf.`, { headers: RESPONSE_HEADERS });
  }
}

function spinWheel(): WheelResult {
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
