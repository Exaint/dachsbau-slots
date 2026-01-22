-- Dachsbau Slots D1 Database Schema
-- Phase 1: Users table for leaderboard optimization

-- Haupt-User-Tabelle (ersetzt 6+ separate KV reads pro User)
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  balance INTEGER DEFAULT 0,
  prestige_rank TEXT,
  disclaimer_accepted INTEGER DEFAULT 0,
  leaderboard_hidden INTEGER DEFAULT 0,
  duel_opt_out INTEGER DEFAULT 0,
  is_blacklisted INTEGER DEFAULT 0,
  selfban_timestamp INTEGER,
  last_active_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Index für schnelle Leaderboard-Sortierung
CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance DESC);

-- Optimierter Index für Leaderboard-Query (filtert bereits)
CREATE INDEX IF NOT EXISTS idx_users_leaderboard ON users(balance DESC)
  WHERE disclaimer_accepted = 1 AND is_blacklisted = 0 AND leaderboard_hidden = 0 AND balance > 0;

-- Index für Username-Suche (case-insensitive via COLLATE NOCASE)
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(username COLLATE NOCASE);
