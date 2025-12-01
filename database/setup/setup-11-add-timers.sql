-- ============================================
-- STEP 11: Add timer fields to game_rooms
-- ============================================
-- Run this to add chess-style timers

-- Add timer columns
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS player1_time_remaining INTEGER DEFAULT 300, -- 5 minutes in seconds
ADD COLUMN IF NOT EXISTS player2_time_remaining INTEGER DEFAULT 300, -- 5 minutes in seconds
ADD COLUMN IF NOT EXISTS current_turn_player INTEGER CHECK (current_turn_player IN (1, 2)),
ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMP WITH TIME ZONE;

-- Add index for active game queries
CREATE INDEX IF NOT EXISTS idx_game_rooms_active_timer
ON game_rooms(winner)
WHERE winner IS NULL AND current_turn_player IS NOT NULL;

-- Update existing games to have default timer values
UPDATE game_rooms
SET
  player1_time_remaining = 300,
  player2_time_remaining = 300
WHERE player1_time_remaining IS NULL;
