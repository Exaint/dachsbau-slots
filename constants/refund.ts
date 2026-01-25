/**
 * Refund System Constants
 * Defines refundable items and their dependency chains
 */

import { SHOP_ITEMS } from './shop.js';

export interface RefundableItem {
  type: 'prestige' | 'unlock';
  rank?: string;
  unlockKey?: string;
  symbol: string;
  shopId: number;
  name: string;
  price: number;
  blockedBy: string[];
}

// Prestige ranks in order (lowest to highest)
// Must be refunded in REVERSE order (highest first)
export const PRESTIGE_CHAIN: string[] = ['🥉', '🥈', '🥇', '💎', '👑'];

// Slot unlocks in order (lowest to highest)
// Must be refunded in REVERSE order (highest first)
export const SLOT_UNLOCK_CHAIN: string[] = ['slots_20', 'slots_30', 'slots_50', 'slots_100', 'slots_all'];

// Map unlock keys to shop item IDs for price lookup
export const UNLOCK_TO_SHOP_ID: Record<string, number> = {
  'slots_20': 13,
  'slots_30': 19,
  'slots_50': 21,
  'slots_100': 23,
  'slots_all': 25,
  'daily_boost': 27,
  'custom_message': 28
};

// Map prestige ranks to shop item IDs for price lookup
export const PRESTIGE_TO_SHOP_ID: Record<string, number> = {
  '🥉': 17,  // Bronze
  '🥈': 22,  // Silber
  '🥇': 26,  // Gold
  '💎': 29,  // Platin
  '👑': 30   // Legendary
};

// All refundable items with metadata
export const REFUNDABLE_ITEMS: Record<string, RefundableItem> = {
  // Prestige Ranks
  prestige_bronze: {
    type: 'prestige',
    rank: '🥉',
    symbol: '🥉',
    shopId: 17,
    name: 'Bronze Dachs Rang',
    price: SHOP_ITEMS[17].price,
    blockedBy: ['🥈', '🥇', '💎', '👑']  // Can't refund if user has higher rank
  },
  prestige_silver: {
    type: 'prestige',
    rank: '🥈',
    symbol: '🥈',
    shopId: 22,
    name: 'Silber Dachs Rang',
    price: SHOP_ITEMS[22].price,
    blockedBy: ['🥇', '💎', '👑']
  },
  prestige_gold: {
    type: 'prestige',
    rank: '🥇',
    symbol: '🥇',
    shopId: 26,
    name: 'Gold Dachs Rang',
    price: SHOP_ITEMS[26].price,
    blockedBy: ['💎', '👑']
  },
  prestige_platin: {
    type: 'prestige',
    rank: '💎',
    symbol: '💎',
    shopId: 29,
    name: 'Platin Dachs Rang',
    price: SHOP_ITEMS[29].price,
    blockedBy: ['👑']
  },
  prestige_legendary: {
    type: 'prestige',
    rank: '👑',
    symbol: '👑',
    shopId: 30,
    name: 'Legendary Dachs Rang',
    price: SHOP_ITEMS[30].price,
    blockedBy: []  // Highest rank, always refundable
  },
  // Slot Unlocks
  slots_20: {
    type: 'unlock',
    unlockKey: 'slots_20',
    symbol: '🎰',
    shopId: 13,
    name: '!slots 20 Unlock',
    price: SHOP_ITEMS[13].price,
    blockedBy: ['slots_30', 'slots_50', 'slots_100', 'slots_all']
  },
  slots_30: {
    type: 'unlock',
    unlockKey: 'slots_30',
    symbol: '🎰',
    shopId: 19,
    name: '!slots 30 Unlock',
    price: SHOP_ITEMS[19].price,
    blockedBy: ['slots_50', 'slots_100', 'slots_all']
  },
  slots_50: {
    type: 'unlock',
    unlockKey: 'slots_50',
    symbol: '🎰',
    shopId: 21,
    name: '!slots 50 Unlock',
    price: SHOP_ITEMS[21].price,
    blockedBy: ['slots_100', 'slots_all']
  },
  slots_100: {
    type: 'unlock',
    unlockKey: 'slots_100',
    symbol: '🎰',
    shopId: 23,
    name: '!slots 100 Unlock',
    price: SHOP_ITEMS[23].price,
    blockedBy: ['slots_all']
  },
  slots_all: {
    type: 'unlock',
    unlockKey: 'slots_all',
    symbol: '🎰',
    shopId: 25,
    name: '!slots all Unlock',
    price: SHOP_ITEMS[25].price,
    blockedBy: []  // Highest unlock, always refundable
  },
  // Other unlocks (no chain, always refundable)
  daily_boost: {
    type: 'unlock',
    unlockKey: 'daily_boost',
    symbol: '📈',
    shopId: 27,
    name: 'Daily Interest Boost',
    price: SHOP_ITEMS[27].price,
    blockedBy: []
  },
  custom_message: {
    type: 'unlock',
    unlockKey: 'custom_message',
    symbol: '💬',
    shopId: 28,
    name: 'Custom Messages',
    price: SHOP_ITEMS[28].price,
    blockedBy: []
  }
};

/**
 * Get refund price for an item
 */
export function getRefundPrice(itemKey: string): number {
  const item = REFUNDABLE_ITEMS[itemKey];
  return item ? item.price : 0;
}

/**
 * Get the previous rank in the prestige chain
 * Returns null if no previous rank exists
 */
export function getPreviousPrestigeRank(currentRank: string): string | null {
  const index = PRESTIGE_CHAIN.indexOf(currentRank);
  if (index <= 0) return null;
  return PRESTIGE_CHAIN[index - 1];
}
