-- Duel Log: Records all completed duels with spin results
CREATE TABLE IF NOT EXISTS duel_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger TEXT NOT NULL,
  target TEXT NOT NULL,
  amount INTEGER NOT NULL,
  challenger_grid TEXT NOT NULL,
  target_grid TEXT NOT NULL,
  challenger_score INTEGER NOT NULL,
  target_score INTEGER NOT NULL,
  winner TEXT,
  pot INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Index for looking up duels by player
CREATE INDEX IF NOT EXISTS idx_duel_log_challenger ON duel_log(challenger);
CREATE INDEX IF NOT EXISTS idx_duel_log_target ON duel_log(target);
CREATE INDEX IF NOT EXISTS idx_duel_log_created ON duel_log(created_at DESC);
