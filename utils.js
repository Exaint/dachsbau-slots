import { SYMBOL_WEIGHTS, TOTAL_WEIGHT } from './constants.js';
import { ADMINS } from './config.js';

// OPTIMIZED: Function to get weighted random symbol (saves memory)
function getWeightedSymbol() {
  const rand = Math.random() * TOTAL_WEIGHT;
  let cumulative = 0;
  for (const { symbol, weight } of SYMBOL_WEIGHTS) {
    cumulative += weight;
    if (rand < cumulative) return symbol;
  }
  return '⭐'; // Fallback
}

// Helper function to check if user is admin (uses config.js)
function isAdmin(username) {
  const lowerUsername = username.toLowerCase();
  return ADMINS.includes(lowerUsername);
}

function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '');
  if (clean.length < 1 || clean.length > 25) return null;
  return clean;
}

function validateAmount(amount, min = 1, max = 100000) {
  const parsed = parseInt(amount, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getCurrentDate() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function getWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function isLeaderboardBlocked(username) {
  const leaderboardBlocklist = ['dachsbank'];
  return leaderboardBlocklist.includes(username.toLowerCase());
}

export {
  getWeightedSymbol,
  isAdmin,
  sanitizeUsername,
  validateAmount,
  getCurrentMonth,
  getCurrentDate,
  getWeekStart,
  isLeaderboardBlocked
};
