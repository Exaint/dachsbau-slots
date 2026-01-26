-- Add last_spin_at column for atomic cooldown claims
-- Prevents race conditions when concurrent requests bypass KV eventual consistency
ALTER TABLE users ADD COLUMN last_spin_at INTEGER;
