-- ============================================
-- STEP 9: Stats update function
-- ============================================
-- Run this ninth (OPTIONAL but recommended)
-- This updates user stats when a game ends

CREATE OR REPLACE FUNCTION update_user_stats_after_game(p_room_code TEXT)
RETURNS void AS $$
DECLARE
  v_room RECORD;
  v_player1_guesses INTEGER;
  v_player2_guesses INTEGER;
BEGIN
  -- Get the game room details
  SELECT * INTO v_room
  FROM game_rooms
  WHERE room_code = p_room_code;

  -- If room not found or no winner, exit
  IF v_room.id IS NULL OR v_room.winner IS NULL THEN
    RETURN;
  END IF;

  -- If stats already updated (finished_at is set), exit to prevent double counting
  IF v_room.finished_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- Count guesses
  v_player1_guesses := jsonb_array_length(v_room.player1_guesses);
  v_player2_guesses := jsonb_array_length(v_room.player2_guesses);

  -- Update player 1 stats (if logged in)
  IF v_room.player1_id IS NOT NULL THEN
    INSERT INTO user_stats (
      user_id,
      total_games,
      games_won,
      games_lost,
      games_tied,
      total_guesses,
      best_guess_count,
      current_streak,
      longest_streak,
      last_played_at
    )
    VALUES (
      v_room.player1_id,
      1,
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
          CASE
            WHEN user_stats.best_guess_count IS NULL THEN v_player1_guesses
            WHEN v_player1_guesses < user_stats.best_guess_count THEN v_player1_guesses
            ELSE user_stats.best_guess_count
          END
        ELSE user_stats.best_guess_count
      END,
      current_streak = CASE
        WHEN v_room.winner = '1' THEN user_stats.current_streak + 1
        WHEN v_room.winner = '2' THEN 0
        ELSE user_stats.current_streak
      END,
      longest_streak = CASE
        WHEN v_room.winner = '1' AND (user_stats.current_streak + 1) > user_stats.longest_streak THEN user_stats.current_streak + 1
        ELSE user_stats.longest_streak
      END,
      last_played_at = NOW(),
      updated_at = NOW();
  END IF;

  -- Update player 2 stats (if logged in)
  IF v_room.player2_id IS NOT NULL THEN
    INSERT INTO user_stats (
      user_id,
      total_games,
      games_won,
      games_lost,
      games_tied,
      total_guesses,
      best_guess_count,
      current_streak,
      longest_streak,
      last_played_at
    )
    VALUES (
      v_room.player2_id,
      1,
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
          CASE
            WHEN user_stats.best_guess_count IS NULL THEN v_player2_guesses
            WHEN v_player2_guesses < user_stats.best_guess_count THEN v_player2_guesses
            ELSE user_stats.best_guess_count
          END
        ELSE user_stats.best_guess_count
      END,
      current_streak = CASE
        WHEN v_room.winner = '2' THEN user_stats.current_streak + 1
        WHEN v_room.winner = '1' THEN 0
        ELSE user_stats.current_streak
      END,
      longest_streak = CASE
        WHEN v_room.winner = '2' AND (user_stats.current_streak + 1) > user_stats.longest_streak THEN user_stats.current_streak + 1
        ELSE user_stats.longest_streak
      END,
      last_played_at = NOW(),
      updated_at = NOW();
  END IF;

  -- Mark game as finished
  UPDATE game_rooms
  SET finished_at = NOW()
  WHERE room_code = p_room_code;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
