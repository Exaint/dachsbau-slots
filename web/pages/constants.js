/**
 * Constants for HTML page generation
 */

import { ACHIEVEMENT_CATEGORIES } from '../../constants.js';

// Achievement category icons
export const CATEGORY_ICONS = {
  [ACHIEVEMENT_CATEGORIES.SPINNING]: '🎰',
  [ACHIEVEMENT_CATEGORIES.WINNING]: '🏆',
  [ACHIEVEMENT_CATEGORIES.COLLECTING]: '💰',
  [ACHIEVEMENT_CATEGORIES.SOCIAL]: '👥',
  [ACHIEVEMENT_CATEGORIES.DEDICATION]: '📅',
  [ACHIEVEMENT_CATEGORIES.SHOPPING]: '🛒',
  [ACHIEVEMENT_CATEGORIES.SPECIAL]: '⭐'
};

// Achievement category names (German)
export const CATEGORY_NAMES = {
  [ACHIEVEMENT_CATEGORIES.SPINNING]: 'Spinning',
  [ACHIEVEMENT_CATEGORIES.WINNING]: 'Winning',
  [ACHIEVEMENT_CATEGORIES.COLLECTING]: 'Sammeln',
  [ACHIEVEMENT_CATEGORIES.SOCIAL]: 'Social',
  [ACHIEVEMENT_CATEGORIES.DEDICATION]: 'Hingabe',
  [ACHIEVEMENT_CATEGORIES.SHOPPING]: 'Shopping',
  [ACHIEVEMENT_CATEGORIES.SPECIAL]: 'Spezial'
};

// Prestige rank display names and colors
export const PRESTIGE_RANK_NAMES = {
  '🥉': { name: 'Bronze', color: '#cd7f32' },
  '🥈': { name: 'Silber', color: '#c0c0c0' },
  '🥇': { name: 'Gold', color: '#ffd700' },
  '💎': { name: 'Diamant', color: '#b9f2ff' },
  '👑': { name: 'Legende', color: '#ff6b6b' }
};

// Role badge info with Twitch icons and colors
export const ROLE_BADGES = {
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
    label: 'Lead-Mod',
    color: '#00ad03'
  },
  admin: {
    icon: 'https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/1',
    label: 'Dachsbau-Slots Admin',
    color: '#9147ff'
  }
};
