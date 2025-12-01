-- ============================================
-- STEP 10: Leaderboard function
-- ============================================
-- Run this tenth (OPTIONAL but recommended)
-- This fetches the global leaderboard

-- Drop existing function first (in case it exists with different return type)
DROP FUNCTION IF EXISTS get_leaderboard(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_limit INTEGER DEFAULT 10,
  p_order_by TEXT DEFAULT 'games_won'
)
RETURNS TABLE (
  user_id UUID,
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
    CASE
      WHEN s.total_games > 0 THEN ROUND((s.games_won::NUMERIC / s.total_games) * 100, 1)
      ELSE 0
    END as win_rate,
    s.best_guess_count,
    s.current_streak,
    s.longest_streak,
    CASE
      WHEN s.total_games > 0 THEN ROUND(s.total_guesses::NUMERIC / s.total_games, 1)
      ELSE 0
    END as avg_guesses
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
        CASE
          WHEN s.total_games > 0 THEN (s.games_won::NUMERIC / s.total_games)
          ELSE 0
        END
      ELSE 0
    END DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
