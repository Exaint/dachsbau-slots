-- Migration 0005: Player Items & Purchase Limits
-- Run with: npx wrangler d1 execute dachsbau-slots-db --remote --file=migrations/0005_player_items.sql
--
-- Backs up paid items (insurance, wildcards, guaranteed pairs, free spins, win multiplier)
-- and weekly purchase limits to D1 for data durability.

-- ============================================
-- Player Items Table
-- ============================================
-- Stores paid/activated items that would be lost if KV has issues
-- item_key: 'insurance', 'wildcard', 'guaranteedpair', 'winmulti', 'freespins'
-- value: count (insurance), 'active' (wildcard/guaranteedpair/winmulti), JSON (freespins)
CREATE TABLE IF NOT EXISTS player_items (
  username TEXT NOT NULL,
  item_key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (username, item_key)
);

CREATE INDEX IF NOT EXISTS idx_player_items_username ON player_items(username);

-- ============================================
-- Purchase Limits Table
-- ============================================
-- Tracks weekly purchase counts to prevent exploit if KV resets
-- item_type: 'bundle', 'dachsboost'
CREATE TABLE IF NOT EXISTS purchase_limits (
  username TEXT NOT NULL,
  item_type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  week_start TEXT NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (username, item_type)
);

-- ============================================
-- Streak Backup Columns on Users Table
-- ============================================
ALTER TABLE users ADD COLUMN streak_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN streak_losses INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN streak_multiplier REAL DEFAULT 1.0;
