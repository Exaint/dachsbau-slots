-- Migration 0002: Achievements, Stats, and Unlocks
-- Run with: npx wrangler d1 execute dachsbau-slots-db --remote --file=migrations/0002_achievements_stats.sql

-- ============================================
-- Player Achievements (individual unlocks)
-- ============================================
CREATE TABLE IF NOT EXISTS player_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  UNIQUE(username, achievement_id)
);

-- Index for user achievement lookups
CREATE INDEX IF NOT EXISTS idx_player_achievements_user
  ON player_achievements(username);

-- Index for achievement statistics (how many have achievement X)
CREATE INDEX IF NOT EXISTS idx_player_achievements_achievement
  ON player_achievements(achievement_id);

-- ============================================
-- Achievement Global Stats (for rarity calculation)
-- ============================================
CREATE TABLE IF NOT EXISTS achievement_stats (
  achievement_id TEXT PRIMARY KEY,
  unlock_count INTEGER DEFAULT 0,
  last_updated INTEGER DEFAULT (unixepoch() * 1000)
);

-- ============================================
-- Player Statistics (gameplay stats)
-- ============================================
CREATE TABLE IF NOT EXISTS player_stats (
  username TEXT PRIMARY KEY,
  total_spins INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  biggest_win INTEGER DEFAULT 0,
  total_won INTEGER DEFAULT 0,
  total_lost INTEGER DEFAULT 0,
  total_transferred INTEGER DEFAULT 0,
  shop_purchases INTEGER DEFAULT 0,
  duels_played INTEGER DEFAULT 0,
  duels_won INTEGER DEFAULT 0,
  dailys_claimed INTEGER DEFAULT 0,
  streak_multiplier REAL DEFAULT 1.0,
  pending_rewards INTEGER DEFAULT 0,
  -- Triple collection tracking (for achievements)
  triple_dachs INTEGER DEFAULT 0,
  triple_diamond INTEGER DEFAULT 0,
  triple_star INTEGER DEFAULT 0,
  triple_watermelon INTEGER DEFAULT 0,
  triple_grapes INTEGER DEFAULT 0,
  triple_orange INTEGER DEFAULT 0,
  triple_lemon INTEGER DEFAULT 0,
  triple_cherry INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- ============================================
-- Player Unlocks (shop unlocks, features)
-- ============================================
CREATE TABLE IF NOT EXISTS player_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  unlock_key TEXT NOT NULL,
  unlocked_at INTEGER DEFAULT (unixepoch() * 1000),
  UNIQUE(username, unlock_key)
);

-- Index for user unlock lookups
CREATE INDEX IF NOT EXISTS idx_player_unlocks_user
  ON player_unlocks(username);

-- ============================================
-- Monthly Login Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_login (
  username TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  login_days TEXT NOT NULL DEFAULT '[]',
  claimed_milestones TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);
