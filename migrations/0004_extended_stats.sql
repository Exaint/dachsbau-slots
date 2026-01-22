-- Migration 0004: Extended Stats Tracking
-- Run with: npx wrangler d1 execute dachsbau-slots-db --remote --file=migrations/0004_extended_stats.sql
--
-- Adds new columns for comprehensive achievement tracking

-- ============================================
-- Loss Tracking
-- ============================================
ALTER TABLE player_stats ADD COLUMN losses INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN biggest_loss INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN max_loss_streak INTEGER DEFAULT 0;

-- ============================================
-- Item/Buff Usage Tracking
-- ============================================
ALTER TABLE player_stats ADD COLUMN chaos_spins INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN reverse_chaos_spins INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN wheel_spins INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN mystery_boxes INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN peek_tokens INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN insurance_triggers INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN wild_cards_used INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN guaranteed_pairs_used INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN free_spins_used INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN diamond_mines INTEGER DEFAULT 0;

-- ============================================
-- Duel Extended Tracking
-- ============================================
ALTER TABLE player_stats ADD COLUMN duels_lost INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN max_duel_streak INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN total_duel_winnings INTEGER DEFAULT 0;

-- ============================================
-- Transfer Extended Tracking
-- ============================================
ALTER TABLE player_stats ADD COLUMN transfers_received INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN transfers_sent_count INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN bank_donations INTEGER DEFAULT 0;

-- ============================================
-- Time/Activity Tracking
-- ============================================
ALTER TABLE player_stats ADD COLUMN play_days INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN first_spin_at INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN max_daily_streak INTEGER DEFAULT 0;

-- ============================================
-- Spin Type Tracking
-- ============================================
ALTER TABLE player_stats ADD COLUMN all_in_spins INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN high_bet_spins INTEGER DEFAULT 0;

-- ============================================
-- Dachs Tracking (singles/pairs already in player_triples)
-- ============================================
ALTER TABLE player_stats ADD COLUMN total_dachs_seen INTEGER DEFAULT 0;

-- ============================================
-- Hourly Jackpot Tracking
-- ============================================
ALTER TABLE player_stats ADD COLUMN hourly_jackpots INTEGER DEFAULT 0;
