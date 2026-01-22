-- Migration 0003: Player Triples Tracking
-- Run with: npx wrangler d1 execute dachsbau-slots-db --remote --file=migrations/0003_player_triples.sql
--
-- Tracks when each triple was first hit and how many times

-- ============================================
-- Player Triples (detailed triple tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS player_triples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  triple_key TEXT NOT NULL,
  first_hit_at INTEGER NOT NULL,
  hit_count INTEGER DEFAULT 1,
  last_hit_at INTEGER NOT NULL,
  UNIQUE(username, triple_key)
);

-- Index for user triple lookups
CREATE INDEX IF NOT EXISTS idx_player_triples_user
  ON player_triples(username);

-- Index for global triple statistics
CREATE INDEX IF NOT EXISTS idx_player_triples_key
  ON player_triples(triple_key);

-- ============================================
-- Triple keys:
-- - dachs_single: 1x Dachs (any position)
-- - dachs_double: 2x Dachs (pair)
-- - dachs_triple: 3x Dachs (jackpot)
-- - diamond: 3x Diamond
-- - star: 3x Star
-- - watermelon: 3x Watermelon
-- - grapes: 3x Grapes
-- - orange: 3x Orange
-- - lemon: 3x Lemon
-- - cherry: 3x Cherry
-- ============================================
