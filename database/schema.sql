-- ============================================
-- Guess4 Game - Complete Database Schema
-- For Farcaster Mini App (uses FID as user ID)
-- ============================================
-- Run this entire file in a fresh Supabase project

-- ============================================
-- 1. TABLES
-- ============================================

-- User profiles (FID is a TEXT, not UUID since we use Farcaster)
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,  -- Farcaster FID
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User stats
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  total_games INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_lost INTEGER DEFAULT 0,
  games_tied INTEGER DEFAULT 0,
  total_guesses INTEGER DEFAULT 0,
  best_guess_count INTEGER DEFAULT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_played_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game rooms
CREATE TABLE game_rooms (
  id BIGSERIAL PRIMARY KEY,
  room_code TEXT UNIQUE NOT NULL,
  player1_id TEXT REFERENCES user_profiles(id),
  player2_id TEXT REFERENCES user_profiles(id),
  player1_secret TEXT DEFAULT '',
  player2_secret TEXT DEFAULT '',
  player1_guesses JSONB DEFAULT '[]'::jsonb,
  player2_guesses JSONB DEFAULT '[]'::jsonb,
  player1_ready BOOLEAN DEFAULT FALSE,
  player2_ready BOOLEAN DEFAULT FALSE,
  current_turn INTEGER DEFAULT 1 CHECK (current_turn IN (1, 2)),
  game_started BOOLEAN DEFAULT FALSE,
  winner TEXT CHECK (winner IN ('1', '2', 'tie')),
  finished_at TIMESTAMP WITH TIME ZONE,
  -- Timer fields
  player1_time_remaining INTEGER DEFAULT 300,
  player2_time_remaining INTEGER DEFAULT 300,
  current_turn_player INTEGER CHECK (current_turn_player IN (1, 2)),
  turn_started_at TIMESTAMP WITH TIME ZONE,
  -- Optimistic locking
  version INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game invites
CREATE TABLE game_invites (
  id BIGSERIAL PRIMARY KEY,
  room_code TEXT REFERENCES game_rooms(room_code) ON DELETE CASCADE,
  from_user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  to_user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Friend requests
CREATE TABLE friend_requests (
  id BIGSERIAL PRIMARY KEY,
  from_user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

-- Friendships (denormalized for easier queries)
CREATE TABLE friendships (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX idx_game_rooms_code ON game_rooms(room_code);
CREATE INDEX idx_game_rooms_player1 ON game_rooms(player1_id);
CREATE INDEX idx_game_rooms_player2 ON game_rooms(player2_id);
CREATE INDEX idx_game_rooms_active ON game_rooms(winner) WHERE winner IS NULL;
CREATE INDEX idx_game_rooms_version ON game_rooms(room_code, version);

CREATE INDEX idx_game_invites_to_user ON game_invites(to_user_id);
CREATE INDEX idx_game_invites_from_user ON game_invites(from_user_id);
CREATE INDEX idx_game_invites_status ON game_invites(status);

CREATE INDEX idx_friend_requests_from_user ON friend_requests(from_user_id);
CREATE INDEX idx_friend_requests_to_user ON friend_requests(to_user_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);

CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Simple open policies (app handles auth via Farcaster)
CREATE POLICY "allow_all_profiles" ON user_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_stats" ON user_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rooms" ON game_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_invites" ON game_invites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_friend_requests" ON friend_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_friendships" ON friendships FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-increment game room version on update (optimistic locking)
CREATE OR REPLACE FUNCTION increment_game_room_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER game_room_version_trigger
  BEFORE UPDATE ON game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION increment_game_room_version();

-- Auto-create bidirectional friendship when request is accepted
CREATE OR REPLACE FUNCTION handle_friend_request_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO friendships (user_id, friend_id)
    VALUES (NEW.from_user_id, NEW.to_user_id)
    ON CONFLICT (user_id, friend_id) DO NOTHING;

    INSERT INTO friendships (user_id, friend_id)
    VALUES (NEW.to_user_id, NEW.from_user_id)
    ON CONFLICT (user_id, friend_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER friend_request_acceptance_trigger
  AFTER UPDATE ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_friend_request_acceptance();

-- ============================================
-- 5. STATS UPDATE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_user_stats_after_game(p_room_code TEXT)
RETURNS void AS $$
DECLARE
  v_room RECORD;
  v_player1_guesses INTEGER;
  v_player2_guesses INTEGER;
BEGIN
  SELECT * INTO v_room FROM game_rooms WHERE room_code = p_room_code;

  IF v_room.id IS NULL OR v_room.winner IS NULL THEN
    RETURN;
  END IF;

  IF v_room.finished_at IS NOT NULL THEN
    RETURN;
  END IF;

  v_player1_guesses := jsonb_array_length(v_room.player1_guesses);
  v_player2_guesses := jsonb_array_length(v_room.player2_guesses);

  -- Update player 1 stats
  IF v_room.player1_id IS NOT NULL THEN
    INSERT INTO user_stats (user_id, total_games, games_won, games_lost, games_tied, total_guesses, best_guess_count, current_streak, longest_streak, last_played_at)
    VALUES (
      v_room.player1_id, 1,
      CASE WHEN v_room.winner = '1' THEN 1 ELSE 0 END,
      CASE WHEN v_room.winner = '2' THEN 1 ELSE 0 END,
      CASE WHEN v_room.winner = 'tie' THEN 1 ELSE 0 END,
      v_player1_guesses,
      CASE WHEN v_room.winner = '1' THEN v_player1_guesses ELSE NULL END,
      CASE WHEN v_room.winner = '1' THEN 1 ELSE 0 END,
      CASE WHEN v_room.winner = '1' THEN 1 ELSE 0 END,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_games = user_stats.total_games + 1,
      games_won = user_stats.games_won + CASE WHEN v_room.winner = '1' THEN 1 ELSE 0 END,
      games_lost = user_stats.games_lost + CASE WHEN v_room.winner = '2' THEN 1 ELSE 0 END,
      games_tied = user_stats.games_tied + CASE WHEN v_room.winner = 'tie' THEN 1 ELSE 0 END,
      total_guesses = user_stats.total_guesses + v_player1_guesses,
      best_guess_count = CASE
        WHEN v_room.winner = '1' THEN
          CASE WHEN user_stats.best_guess_count IS NULL THEN v_player1_guesses
               WHEN v_player1_guesses < user_stats.best_guess_count THEN v_player1_guesses
               ELSE user_stats.best_guess_count END
        ELSE user_stats.best_guess_count END,
      current_streak = CASE WHEN v_room.winner = '1' THEN user_stats.current_streak + 1 WHEN v_room.winner = '2' THEN 0 ELSE user_stats.current_streak END,
      longest_streak = CASE WHEN v_room.winner = '1' AND (user_stats.current_streak + 1) > user_stats.longest_streak THEN user_stats.current_streak + 1 ELSE user_stats.longest_streak END,
      last_played_at = NOW(),
      updated_at = NOW();
  END IF;

  -- Update player 2 stats
  IF v_room.player2_id IS NOT NULL THEN
    INSERT INTO user_stats (user_id, total_games, games_won, games_lost, games_tied, total_guesses, best_guess_count, current_streak, longest_streak, last_played_at)
    VALUES (
      v_room.player2_id, 1,
      CASE WHEN v_room.winner = '2' THEN 1 ELSE 0 END,
      CASE WHEN v_room.winner = '1' THEN 1 ELSE 0 END,
      CASE WHEN v_room.winner = 'tie' THEN 1 ELSE 0 END,
      v_player2_guesses,
      CASE WHEN v_room.winner = '2' THEN v_player2_guesses ELSE NULL END,
      CASE WHEN v_room.winner = '2' THEN 1 ELSE 0 END,
      CASE WHEN v_room.winner = '2' THEN 1 ELSE 0 END,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_games = user_stats.total_games + 1,
      games_won = user_stats.games_won + CASE WHEN v_room.winner = '2' THEN 1 ELSE 0 END,
      games_lost = user_stats.games_lost + CASE WHEN v_room.winner = '1' THEN 1 ELSE 0 END,
      games_tied = user_stats.games_tied + CASE WHEN v_room.winner = 'tie' THEN 1 ELSE 0 END,
      total_guesses = user_stats.total_guesses + v_player2_guesses,
      best_guess_count = CASE
        WHEN v_room.winner = '2' THEN
          CASE WHEN user_stats.best_guess_count IS NULL THEN v_player2_guesses
               WHEN v_player2_guesses < user_stats.best_guess_count THEN v_player2_guesses
               ELSE user_stats.best_guess_count END
        ELSE user_stats.best_guess_count END,
      current_streak = CASE WHEN v_room.winner = '2' THEN user_stats.current_streak + 1 WHEN v_room.winner = '1' THEN 0 ELSE user_stats.current_streak END,
      longest_streak = CASE WHEN v_room.winner = '2' AND (user_stats.current_streak + 1) > user_stats.longest_streak THEN user_stats.current_streak + 1 ELSE user_stats.longest_streak END,
      last_played_at = NOW(),
      updated_at = NOW();
  END IF;

  UPDATE game_rooms SET finished_at = NOW() WHERE room_code = p_room_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. LEADERBOARD FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_limit INTEGER DEFAULT 10,
  p_order_by TEXT DEFAULT 'games_won'
)
RETURNS TABLE (
  user_id TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  total_games INTEGER,
  games_won INTEGER,
  games_lost INTEGER,
  games_tied INTEGER,
  win_rate NUMERIC,
  best_guess_count INTEGER,
  current_streak INTEGER,
  longest_streak INTEGER,
  avg_guesses NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    s.total_games,
    s.games_won,
    s.games_lost,
    s.games_tied,
    CASE WHEN s.total_games > 0 THEN ROUND((s.games_won::NUMERIC / s.total_games) * 100, 1) ELSE 0 END as win_rate,
    s.best_guess_count,
    s.current_streak,
    s.longest_streak,
    CASE WHEN s.total_games > 0 THEN ROUND(s.total_guesses::NUMERIC / s.total_games, 1) ELSE 0 END as avg_guesses
  FROM user_stats s
  JOIN user_profiles p ON s.user_id = p.id
  WHERE s.total_games > 0
  ORDER BY
    CASE
      WHEN p_order_by = 'games_won' THEN s.games_won
      WHEN p_order_by = 'longest_streak' THEN s.longest_streak
      ELSE s.games_won
    END DESC,
    CASE
      WHEN p_order_by = 'win_rate' THEN
        CASE WHEN s.total_games > 0 THEN (s.games_won::NUMERIC / s.total_games) ELSE 0 END
      ELSE 0
    END DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. REALTIME (Enable for game updates)
-- ============================================

-- Enable realtime for game_rooms and game_invites
-- Go to Supabase Dashboard > Database > Replication
-- And enable realtime for: game_rooms, game_invites
