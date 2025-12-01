-- ============================================
-- STEP 4: Enable Row Level Security
-- ============================================
-- Run this fourth (after setup-3-indexes.sql)

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;
