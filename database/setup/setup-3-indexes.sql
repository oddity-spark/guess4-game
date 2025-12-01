-- ============================================
-- STEP 3: Create Indexes
-- ============================================
-- Run this third (after setup-2-game-rooms-updates.sql)

CREATE INDEX IF NOT EXISTS idx_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_player1_id ON game_rooms(player1_id);
CREATE INDEX IF NOT EXISTS idx_player2_id ON game_rooms(player2_id);
CREATE INDEX IF NOT EXISTS idx_invite_to_user ON game_invites(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_invite_room_code ON game_invites(room_code);
