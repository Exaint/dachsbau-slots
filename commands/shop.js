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
  URLS
} from '../constants.js';
import { getWeightedSymbol, secureRandom, secureRandomInt } from '../utils.js';
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

async function handleShop(username, item, env) {
  try {
    if (!item) {
      return new Response(`@${username} Hier findest du den Slots Shop: ${URLS.SHOP} | Nutze: !shop buy [Nummer]`, { headers: RESPONSE_HEADERS });
    }

    const parts = item.toLowerCase().split(' ');
    if (parts[0] !== 'buy' || !parts[1]) {
      return new Response(`@${username} ❌ Nutze: !shop buy [Nummer]`, { headers: RESPONSE_HEADERS });
    }

    const itemNumber = parseInt(parts[1], 10);
    if (isNaN(itemNumber) || itemNumber < 1 || itemNumber > 39) {
      return new Response(`@${username} ❌ Ungültige Item-Nummer! Nutze 1-39.`, { headers: RESPONSE_HEADERS });
    }

    return await buyShopItem(username, itemNumber, env);
  } catch (error) {
    console.error('handleShop Error:', error);
    return new Response(`@${username} ❌ Fehler beim Shop-Kauf.`, { headers: RESPONSE_HEADERS });
  }
}

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

    if (balance < item.price) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! ${item.name} kostet ${item.price}, du hast ${balance}.`, { headers: RESPONSE_HEADERS });
    }

    if (item.type === 'unlock' && item.requires && !hasPrerequisite) {
      return new Response(`@${username} ❌ Du musst zuerst ${PREREQUISITE_NAMES[item.requires]} freischalten!`, { headers: RESPONSE_HEADERS });
    }

    if (item.type === 'prestige') {
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

    if (item.type === 'unlock') {
      // OPTIMIZED: hasExistingUnlock already loaded in parallel above
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

    if (item.type === 'timed') {
      await Promise.all([
        setBalance(username, balance - item.price, env),
        updateBankBalance(item.price, env)
      ]);

      // Special handling for buffs with uses
      if (item.uses) {
        await activateBuffWithUses(username, item.buffKey, item.duration, item.uses, env);
        return new Response(`@${username} ✅ ${item.name} aktiviert für ${item.uses} Spins! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
      } else if (item.buffKey === 'rage_mode') {
        await activateBuffWithStack(username, item.buffKey, item.duration, env);
        const minutes = Math.floor(item.duration / 60);
        return new Response(`@${username} ✅ ${item.name} aktiviert für ${minutes} Minuten! Verluste geben +5% Gewinn-Chance (bis 50%)! 🔥 | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
      } else {
        await activateBuff(username, item.buffKey, item.duration, env);
        const minutes = Math.floor(item.duration / 60);
        const hours = item.duration >= 3600 ? Math.floor(item.duration / 3600) + 'h' : minutes + ' Minuten';
        return new Response(`@${username} ✅ ${item.name} aktiviert für ${hours}! | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
      }
    }

    if (item.type === 'boost') {
      // Check weekly limit for Dachs-Boost
      if (item.weeklyLimit) {
        // OPTIMIZED: Check existing boost AND weekly purchases in parallel
        const boostKey = `boost:${username.toLowerCase()}:${item.symbol}`;
        const [existingBoost, purchases] = await Promise.all([
          env.SLOTS_KV.get(boostKey),
          getDachsBoostPurchases(username, env)
        ]);

        if (existingBoost === 'active') {
          return new Response(`@${username} ❌ Du hast bereits einen aktiven ${item.name}! Nutze ihn erst, bevor du einen neuen kaufst.`, { headers: RESPONSE_HEADERS });
        }

        if (purchases.count >= 1) {
          return new Response(`@${username} ❌ Wöchentliches Limit erreicht! Du kannst maximal 1 Dachs-Boost pro Woche kaufen. Nächster Reset: Montag 00:00 UTC`, { headers: RESPONSE_HEADERS });
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

    if (item.type === 'insurance') {
      await Promise.all([
        setBalance(username, balance - item.price, env),
        addInsurance(username, 5, env),
        updateBankBalance(item.price, env)
      ]);
      return new Response(`@${username} ✅ Insurance Pack erhalten! Die nächsten 5 Verluste geben 50% des Einsatzes zurück! 🛡️ | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }

    if (item.type === 'winmulti') {
      await Promise.all([
        setBalance(username, balance - item.price, env),
        addWinMultiplier(username, env),
        updateBankBalance(item.price, env)
      ]);
      return new Response(`@${username} ✅ Win Multiplier aktiviert! Dein nächster Gewinn wird x2! ⚡ | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }

    if (item.type === 'bundle') {
      const purchases = await getSpinBundlePurchases(username, env);
      if (purchases.count >= 3) {
        return new Response(`@${username} ❌ Wöchentliches Limit erreicht! Du kannst maximal 3 Spin Bundles pro Woche kaufen. Nächster Reset: Montag 00:00 UTC`, { headers: RESPONSE_HEADERS });
      }

      await Promise.all([
        setBalance(username, balance - item.price, env),
        addFreeSpinsWithMultiplier(username, 10, 1, env),
        incrementSpinBundlePurchases(username, env),
        updateBankBalance(item.price, env)
      ]);

      const remainingPurchases = 3 - (purchases.count + 1);
      return new Response(`@${username} ✅ Spin Bundle erhalten! 10 Free Spins (10 DT) gutgeschrieben! | Kontostand: ${balance - item.price} 🦡 | Noch ${remainingPurchases} Käufe diese Woche möglich`, { headers: RESPONSE_HEADERS });
    }

    if (item.type === 'peek') {
      // Generate and store the next spin for this user
      await Promise.all([
        setBalance(username, balance - item.price, env),
        updateBankBalance(item.price, env)
      ]);

      const hasLuckyCharm = await isBuffActive(username, 'lucky_charm', env);
      const peekDachsChance = hasLuckyCharm ? DACHS_BASE_CHANCE * 2 : DACHS_BASE_CHANCE;
      const peekGrid = [];

      // Generate the peek grid (this will be the actual next spin)
      for (let i = 0; i < GRID_SIZE; i++) {
        if (secureRandom() < peekDachsChance) {
          peekGrid.push('🦡');
        } else {
          peekGrid.push(getWeightedSymbol());
        }
      }

      // Store the grid for the next spin
      await env.SLOTS_KV.put(`peek:${username.toLowerCase()}`, JSON.stringify(peekGrid), { expirationTtl: 3600 });

      // Calculate result to show prediction
      const peekResult = calculateWin(peekGrid);
      const willWin = peekResult.points > 0 || (peekResult.freeSpins && peekResult.freeSpins > 0);
      const charmText = hasLuckyCharm ? ' (🍀 Lucky Charm aktiv!)' : '';

      return new Response(`@${username} 🔮 Peek Token! Dein nächster Spin wird ${willWin ? '✅ GEWINNEN' : '❌ VERLIEREN'}! 🔮${charmText} | Kontostand: ${balance - item.price} 🦡`, { headers: RESPONSE_HEADERS });
    }

    if (item.type === 'instant') {
      if (itemId === 11) { // Chaos Spin
        const result = secureRandomInt(CHAOS_SPIN_MIN, CHAOS_SPIN_MAX);
        const newBalance = Math.min(balance - item.price + result, MAX_BALANCE);
        // Bank gets: item price minus the result (negative result = bank profit)
        const netBankChange = item.price - result;
        await Promise.all([
          setBalance(username, Math.max(0, newBalance), env),
          updateBankBalance(netBankChange, env)
        ]);
        return new Response(`@${username} 🎲 Chaos Spin! ${result >= 0 ? '+' : ''}${result} DachsTaler! | Kontostand: ${Math.max(0, newBalance)}`, { headers: RESPONSE_HEADERS });
      }

      if (itemId === 12) { // Glücksrad
        const wheel = spinWheel();
        const newBalance = Math.max(0, Math.min(balance - item.price + wheel.prize, MAX_BALANCE));
        // Bank gets: item price minus the prize won
        const netBankChange = item.price - wheel.prize;
        await Promise.all([
          setBalance(username, newBalance, env),
          updateBankBalance(netBankChange, env)
        ]);
        const netResult = wheel.prize - item.price;
        return new Response(`@${username} 🎡 [ ${wheel.result} ] ${wheel.message} ${netResult >= 0 ? '+' : ''}${netResult} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
      }

      // For other instant items, deduct price first
      await Promise.all([
        setBalance(username, balance - item.price, env),
        updateBankBalance(item.price, env)
      ]);

      if (itemId === 16) { // Mystery Box
        const mysteryItems = [
          2, 3, 4, 5, 6, 7, 8,    // Symbol-Boosts (7)
          9, 10,                   // Utility Items (2)
          14, 20, 24,              // Timed Buffs Classic (3)
          32, 33, 34, 35, 39       // Timed Buffs Premium (5)
        ]; // Total: 17 Items (Stats Tracker, Unlocks, Prestige, Instants excluded)
        const mysteryItemId = mysteryItems[secureRandomInt(0, mysteryItems.length - 1)];
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
          // Rollback: Refund the balance and reverse bank update if item activation failed
          console.error('Mystery Box activation failed, rolling back:', activationError);
          try {
            await Promise.all([
              setBalance(username, balance, env),
              updateBankBalance(-item.price, env) // Reverse the bank update
            ]);
          } catch (rollbackError) {
            console.error('CRITICAL: Mystery Box rollback failed!', rollbackError);
            // At this point, manual intervention may be needed
          }
          return new Response(`@${username} ❌ Mystery Box Fehler! Dein Einsatz wurde zurückerstattet.`, { headers: RESPONSE_HEADERS });
        }

        return new Response(`@${username} 📦 Mystery Box! Du hast gewonnen: ${mysteryResult.name} (Wert: ${mysteryResult.price})! Item wurde aktiviert! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
      }

      if (itemId === 31) { // Reverse Chaos
        const result = secureRandomInt(REVERSE_CHAOS_MIN, REVERSE_CHAOS_MAX);
        const newBalance = Math.max(0, Math.min(balance - item.price + result, MAX_BALANCE));
        // Bank gets: item price minus the result won
        const netBankChange = item.price - result;
        await Promise.all([
          setBalance(username, newBalance, env),
          updateBankBalance(netBankChange, env)
        ]);
        return new Response(`@${username} 🎲 Reverse Chaos! +${result} DachsTaler! | Kontostand: ${newBalance}`, { headers: RESPONSE_HEADERS });
      }

      if (itemId === 36) { // Diamond Mine
        const freeSpinsAmount = secureRandomInt(DIAMOND_MINE_MIN_SPINS, DIAMOND_MINE_MAX_SPINS);
        await addFreeSpinsWithMultiplier(username, freeSpinsAmount, 1, env);
        return new Response(`@${username} 💎 Diamond Mine! Du hast ${freeSpinsAmount} Free Spins gefunden! 💎 | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
      }

      if (itemId === 37) { // Guaranteed Pair
        await activateGuaranteedPair(username, env);
        return new Response(`@${username} ✅ Guaranteed Pair aktiviert! Dein nächster Spin hat garantiert mindestens ein Pair! 🎯 | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
      }

      if (itemId === 38) { // Wild Card
        await activateWildCard(username, env);
        return new Response(`@${username} ✅ Wild Card aktiviert! Dein nächster Spin enthält ein 🃏 Wild Symbol! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
      }
    }

    return new Response(`@${username} ✅ ${item.name} gekauft! | Kontostand: ${balance - item.price}`, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('buyShopItem Error:', error);
    return new Response(`@${username} ❌ Fehler beim Item-Kauf.`, { headers: RESPONSE_HEADERS });
  }
}

function spinWheel() {
  const rand = secureRandom() * 100;
  if (rand < 1) {
    if (secureRandom() < 0.00032) return { result: '🦡 🦡 🦡 🦡 🦡', message: '🔥 5x DACHS JACKPOT! 🔥', prize: 100000 };
    return { result: '🦡 🦡 💎 ⭐ 💰', message: 'Dachse!', prize: 500 };
  }
  if (rand < 5) return { result: '💎 💎 💎 ⭐ 💰', message: 'Diamanten!', prize: 1000 };
  if (rand < 20) return { result: '💰 💰 💰 ⭐ 💸', message: 'Gold!', prize: 400 };
  if (rand < 50) return { result: '⭐ ⭐ ⭐ 💰 💸', message: 'Sterne!', prize: 200 };
  return { result: '💸 💸 ⭐ 💰 🦡', message: 'Leider verloren!', prize: 0 };
}

export { handleShop, buyShopItem, spinWheel };
