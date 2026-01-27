/**
 * Constants for HTML page generation
 */

import { ACHIEVEMENT_CATEGORIES } from '../../constants.js';
import { BOT_ACCOUNTS } from '../../config.js';

// R2 base URL for assets
export const R2_BASE = 'https://pub-2d28b359704a4690be75021ee4a502d3.r2.dev';

// Achievement category icons (using R2 images)
export const CATEGORY_ICONS: Record<string, string> = {
  [ACHIEVEMENT_CATEGORIES.SPINNING]: `<img src="${R2_BASE}/Slots.png" alt="Spinning" class="category-icon-img" loading="lazy" width="28" height="28">`,
  [ACHIEVEMENT_CATEGORIES.WINNING]: `<img src="${R2_BASE}/Winning.png" alt="Winning" class="category-icon-img" loading="lazy" width="28" height="28">`,
  [ACHIEVEMENT_CATEGORIES.LOSING]: `<img src="${R2_BASE}/Loosing.png" alt="Loosing" class="category-icon-img" loading="lazy" width="28" height="28">`,
  [ACHIEVEMENT_CATEGORIES.COLLECTING]: `<img src="${R2_BASE}/Sammeln.png" alt="Sammeln" class="category-icon-img" loading="lazy" width="28" height="28">`,
  [ACHIEVEMENT_CATEGORIES.SOCIAL]: `<img src="${R2_BASE}/Social.png" alt="Social" class="category-icon-img" loading="lazy" width="28" height="28">`,
  [ACHIEVEMENT_CATEGORIES.DEDICATION]: `<img src="${R2_BASE}/Hingabe.png" alt="Hingabe" class="category-icon-img" loading="lazy" width="28" height="28">`,
  [ACHIEVEMENT_CATEGORIES.SHOPPING]: `<img src="${R2_BASE}/Shopping.png" alt="Shopping" class="category-icon-img" loading="lazy" width="28" height="28">`,
  [ACHIEVEMENT_CATEGORIES.ITEMS]: `<img src="${R2_BASE}/Items.png" alt="Items" class="category-icon-img" loading="lazy" width="28" height="28">`,
  [ACHIEVEMENT_CATEGORIES.SPECIAL]: `<img src="${R2_BASE}/Spezial.png" alt="Spezial" class="category-icon-img" loading="lazy" width="28" height="28">`
};

// Achievement category names (German)
export const CATEGORY_NAMES: Record<string, string> = {
  [ACHIEVEMENT_CATEGORIES.SPINNING]: 'Spinning',
  [ACHIEVEMENT_CATEGORIES.WINNING]: 'Winning',
  [ACHIEVEMENT_CATEGORIES.LOSING]: 'Loosing',
  [ACHIEVEMENT_CATEGORIES.COLLECTING]: 'Sammeln',
  [ACHIEVEMENT_CATEGORIES.SOCIAL]: 'Social',
  [ACHIEVEMENT_CATEGORIES.DEDICATION]: 'Hingabe',
  [ACHIEVEMENT_CATEGORIES.SHOPPING]: 'Shopping',
  [ACHIEVEMENT_CATEGORIES.ITEMS]: 'Items',
  [ACHIEVEMENT_CATEGORIES.SPECIAL]: 'Spezial'
};

// Prestige rank display info
export interface PrestigeRankInfo {
  name: string;
  color: string;
}

// Prestige rank display names and colors
export const PRESTIGE_RANK_NAMES: Record<string, PrestigeRankInfo> = {
  '🥉': { name: 'Bronze', color: '#cd7f32' },
  '🥈': { name: 'Silber', color: '#c0c0c0' },
  '🥇': { name: 'Gold', color: '#ffd700' },
  '💎': { name: 'Diamant', color: '#b9f2ff' },
  '👑': { name: 'Legende', color: '#ff6b6b' }
};

// Role badge info
export interface RoleBadge {
  icon: string;
  label: string;
  color: string;
}

// Role badge info with Twitch icons and colors
export const ROLE_BADGES: Record<string, RoleBadge> = {
  broadcaster: {
    icon: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1',
    label: 'Streamerin',
    color: '#e91916'
  },
  moderator: {
    icon: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1',
    label: 'Moderator',
    color: '#00ad03'
  },
  vip: {
    icon: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3',
    label: 'VIP',
    color: '#e005b9'
  },
  leadmod: {
    icon: 'https://assets.help.twitch.tv/article/img/000002212-07.png',
    label: 'Lead-Moderator',
    color: '#00ad03'
  },
  admin: {
    icon: 'https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/1',
    label: 'Dachsbau-Slots Admin',
    color: '#9147ff'
  },
  bot: {
    icon: 'https://assets.help.twitch.tv/article/img/000002722-19.png',
    label: 'Bot',
    color: '#00c8af'
  }
};

// Admin/special user badge overrides (role badges shown on profile)
// Bot-Einträge werden automatisch aus BOT_ACCOUNTS (config.ts) generiert
const botOverrides: Record<string, string[]> = {};
for (const botName of BOT_ACCOUNTS) {
  botOverrides[botName] = ['bot'];
}

export const ADMIN_ROLE_OVERRIDES: Record<string, string[]> = {
  'exaint_': ['leadmod', 'admin'],
  'frechhdachs': ['broadcaster', 'admin'],
  ...botOverrides
};
