-- ============================================
-- STEP 2: Update game_rooms Table
-- ============================================
-- Run this second (after setup-1-tables.sql)

ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS player1_id UUID REFERENCES user_profiles(id);
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS player2_id UUID REFERENCES user_profiles(id);
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE;
