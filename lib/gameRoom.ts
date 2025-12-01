import { createClient } from "@/utils/supabase/client";

export interface Guess {
  number: string;
  correctDigits: number;
  correctPositions: number;
}

export interface PlayerProfile {
  username: string;
  display_name: string | null;
}

export interface GameRoom {
  id?: number;
  room_code: string;
  player1_id?: string | null;
  player1_secret: string;
  player1_guesses: Guess[];
  player1_ready: boolean;
  player2_id?: string | null;
  player2_secret: string;
  player2_guesses: Guess[];
  player2_ready: boolean;
  current_turn: 1 | 2;
  game_started: boolean;
  winner: 1 | 2 | "tie" | null;
  finished_at?: string | null;
  created_at?: string;
  player1_profile?: PlayerProfile | null;
  player2_profile?: PlayerProfile | null;
  player1_time_remaining?: number; // seconds
  player2_time_remaining?: number; // seconds
  current_turn_player?: 1 | 2 | null;
  turn_started_at?: string | null;
  version?: number; // for optimistic locking
}

// Generate a random 6-digit room code
export const generateRoomCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create a new game room
export const createGameRoom = async (
  userId?: string,
  timeLimit?: number // in seconds, default 300 (5 minutes)
): Promise<string> => {
  const supabase = createClient();
  console.log("Creating game room for user:", userId, "with time limit:", timeLimit);
  const roomCode = generateRoomCode();

  const timeInSeconds = timeLimit || 300; // Default to 5 minutes

  const newRoom = {
    room_code: roomCode,
    player1_id: userId || null,
    player1_secret: "",
    player1_guesses: [],
    player1_ready: false,
    player2_id: null,
    player2_secret: "",
    player2_guesses: [],
    player2_ready: false,
    current_turn: 1,
    game_started: false,
    winner: null,
    player1_time_remaining: timeInSeconds,
    player2_time_remaining: timeInSeconds,
  };

  const { data, error } = await supabase.from("game_rooms").insert([newRoom]).select();

  console.log("Create room result:", { data, error });

  if (error) {
    console.error("Error creating room:", error);
    throw new Error(`Failed to create game room: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.error("No data returned from insert");
    throw new Error("Failed to create game room: No data returned");
  }

  return roomCode;
};

// Check if a room exists
export const checkRoomExists = async (roomCode: string): Promise<boolean> => {
  const supabase = createClient();
  console.log("Checking if room exists:", roomCode);
  const { data, error } = await supabase
    .from("game_rooms")
    .select("room_code")
    .eq("room_code", roomCode)
    .single();

  console.log("Room exists check result:", { exists: !!data, error });

  if (error) {
    console.error("Error checking room:", error);
    return false;
  }
  return !!data;
};

// Join a game room
export const joinGameRoom = async (
  roomCode: string,
  userId?: string
): Promise<boolean> => {
  const supabase = createClient();
  console.log("Attempting to join room:", { roomCode, userId });
  const exists = await checkRoomExists(roomCode);

  if (exists && userId) {
    // Update the room with player2_id
    const { data, error } = await supabase
      .from("game_rooms")
      .update({ player2_id: userId })
      .eq("room_code", roomCode)
      .is("player2_id", null)
      .select();

    console.log("Join room update result:", { data, error });

    if (error) {
      console.error("Error joining room:", error);
      throw new Error(`Failed to join room: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.warn("Room might already be full or doesn't exist");
      return false;
    }
  }

  return exists;
};

// Get game room data
export const getGameRoom = async (
  roomCode: string
): Promise<GameRoom | null> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_rooms")
    .select(`
      *,
      player1_profile:user_profiles!game_rooms_player1_id_fkey(username, display_name),
      player2_profile:user_profiles!game_rooms_player2_id_fkey(username, display_name)
    `)
    .eq("room_code", roomCode)
    .single();

  if (error) {
    console.error("Error fetching room:", error);
    return null;
  }

  if (!data) return null;

  return data as GameRoom;
};

// Set player's secret number
export const setPlayerSecret = async (
  roomCode: string,
  playerNumber: 1 | 2,
  secretNumber: string
): Promise<void> => {
  const supabase = createClient();
  const updateData =
    playerNumber === 1
      ? { player1_secret: secretNumber, player1_ready: true }
      : { player2_secret: secretNumber, player2_ready: true };

  const { error } = await supabase
    .from("game_rooms")
    .update(updateData)
    .eq("room_code", roomCode);

  if (error) {
    console.error("Error setting secret:", error);
    throw error;
  }
};

// Submit a guess
export const submitGuess = async (
  roomCode: string,
  playerNumber: 1 | 2,
  guess: Guess
): Promise<boolean> => {
  const supabase = createClient();
  // Get current room data
  const room = await getGameRoom(roomCode);
  if (!room) throw new Error("Room not found");

  const currentVersion = room.version || 1;

  // Calculate time elapsed for current turn
  let updatedPlayer1Time = room.player1_time_remaining ?? 300;
  let updatedPlayer2Time = room.player2_time_remaining ?? 300;

  if (room.turn_started_at && room.current_turn_player === playerNumber) {
    const turnStartTime = new Date(room.turn_started_at).getTime();
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - turnStartTime) / 1000);

    if (playerNumber === 1) {
      updatedPlayer1Time = Math.max(0, updatedPlayer1Time - elapsedSeconds);
      // Add 5 second bonus for making a move
      updatedPlayer1Time += 5;
    } else {
      updatedPlayer2Time = Math.max(0, updatedPlayer2Time - elapsedSeconds);
      // Add 5 second bonus for making a move
      updatedPlayer2Time += 5;
    }
  }

  const currentGuesses =
    playerNumber === 1 ? room.player1_guesses : room.player2_guesses;
  const updatedGuesses = [...currentGuesses, guess];

  const opponentGuesses =
    playerNumber === 1 ? room.player2_guesses : room.player1_guesses;

  // Determine winner only if both players have had equal turns
  let winner: 1 | 2 | "tie" | null = null;

  if (guess.correctPositions === 4) {
    // This player got it correct
    if (playerNumber === 1) {
      // Player 1 guessed correctly
      // Check if Player 2 has had the same number of turns
      if (opponentGuesses.length >= updatedGuesses.length) {
        // Player 2 already had equal or more turns, Player 1 wins
        winner = 1;
      }
      // Otherwise, Player 2 still needs their turn
    } else {
      // Player 2 guessed correctly
      // Player 2 always finishes after or at the same time as Player 1
      // Check if Player 1 also got it correct
      const player1GotItCorrect = opponentGuesses.some(
        (g) => g.correctPositions === 4
      );

      if (player1GotItCorrect) {
        // Both got it correct with equal turns - it's a tie!
        winner = "tie";
      } else {
        // Only Player 2 got it correct - Player 2 wins
        winner = 2;
      }
    }
  } else {
    // This player didn't get it correct
    // Check if opponent already got it correct and this was their final turn
    const opponentGotItCorrect = opponentGuesses.some(
      (g) => g.correctPositions === 4
    );

    if (opponentGotItCorrect) {
      // Opponent got it correct and this player just finished their equal turn
      winner = playerNumber === 1 ? 2 : 1;
    }
  }

  const nextPlayer = playerNumber === 1 ? 2 : 1;
  const updateData =
    playerNumber === 1
      ? {
          player1_guesses: updatedGuesses,
          player1_time_remaining: updatedPlayer1Time,
          player2_time_remaining: updatedPlayer2Time,
          current_turn: 2,
          current_turn_player: winner ? null : nextPlayer,
          turn_started_at: winner ? null : new Date().toISOString(),
          winner: winner,
        }
      : {
          player2_guesses: updatedGuesses,
          player1_time_remaining: updatedPlayer1Time,
          player2_time_remaining: updatedPlayer2Time,
          current_turn: 1,
          current_turn_player: winner ? null : nextPlayer,
          turn_started_at: winner ? null : new Date().toISOString(),
          winner: winner,
        };

  const { data, error } = await supabase
    .from("game_rooms")
    .update(updateData)
    .eq("room_code", roomCode)
    .eq("version", currentVersion) // Optimistic lock check
    .eq("current_turn", playerNumber) // Ensure it's still this player's turn
    .select();

  if (error) {
    console.error("Error submitting guess:", error);
    throw error;
  }

  // If no rows were updated, there was a version conflict or turn changed
  if (!data || data.length === 0) {
    console.warn("Version conflict or turn changed, guess not submitted");
    return false;
  }

  return true;
};

// Start the game when both players are ready
export const startGame = async (roomCode: string): Promise<boolean> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_rooms")
    .update({
      game_started: true,
      current_turn_player: 1,
      turn_started_at: new Date().toISOString(),
    })
    .eq("room_code", roomCode)
    .eq("game_started", false) // Only start if not already started
    .select();

  if (error) {
    console.error("Error starting game:", error);
    throw error;
  }

  // Return false if update didn't affect any rows (game already started)
  return data && data.length > 0;
};

// Subscribe to room updates
export const subscribeToRoom = (
  roomCode: string,
  callback: (room: GameRoom | null) => void
): (() => void) => {
  const supabase = createClient();
  // Initial fetch
  getGameRoom(roomCode).then(callback);

  // Set up polling as a fallback (every 2 seconds)
  const pollInterval = setInterval(() => {
    getGameRoom(roomCode).then(callback);
  }, 2000);

  // Subscribe to changes
  const channel = supabase
    .channel(`room:${roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_rooms",
        filter: `room_code=eq.${roomCode}`,
      },
      (payload) => {
        callback(payload.new as GameRoom);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    clearInterval(pollInterval);
    supabase.removeChannel(channel);
  };
};

// Update stats after game ends
export const updateGameStats = async (roomCode: string): Promise<void> => {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_user_stats_after_game", {
    p_room_code: roomCode,
  });

  if (error) {
    console.error("Error updating stats:", error);
    throw error;
  }
};

// Delete a game room
export const deleteGameRoom = async (roomCode: string): Promise<void> => {
  const supabase = createClient();
  const { error } = await supabase
    .from("game_rooms")
    .delete()
    .eq("room_code", roomCode);

  if (error) {
    console.error("Error deleting room:", error);
    throw error;
  }
};

// Send a game invite to a friend
export const sendGameInvite = async (roomCode: string, toUserId: string, fromUserId?: string): Promise<void> => {
  const supabase = createClient();

  // Get from_user_id from localStorage if not provided
  let currentUserId = fromUserId;
  if (!currentUserId && typeof window !== "undefined") {
    const storedUser = localStorage.getItem("farcaster_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        currentUserId = parsed.fid;
      } catch {
        // ignore
      }
    }
  }

  if (!currentUserId) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("game_invites")
    .insert({
      room_code: roomCode,
      from_user_id: currentUserId,
      to_user_id: toUserId,
    });

  if (error) {
    console.error("Error sending game invite:", error);
    throw new Error(`Failed to send game invite: ${error.message}`);
  }
};

// Get user's active room (unfinished game they're in)
export const getUserActiveRoom = async (userId: string): Promise<{ room: GameRoom; playerNumber: 1 | 2 } | null> => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("game_rooms")
    .select(`
      *,
      player1_profile:user_profiles!game_rooms_player1_id_fkey(username, display_name),
      player2_profile:user_profiles!game_rooms_player2_id_fkey(username, display_name)
    `)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .is("winner", null) // Game not finished
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  const room = data as GameRoom;
  const playerNumber = room.player1_id === userId ? 1 : 2;

  return { room, playerNumber };
};

// Handle time expiration (opponent wins)
export const handleTimeExpiration = async (
  roomCode: string,
  playerNumber: 1 | 2
): Promise<boolean> => {
  const supabase = createClient();

  // Opponent wins when this player runs out of time
  const winner = playerNumber === 1 ? 2 : 1;

  const { data, error } = await supabase
    .from("game_rooms")
    .update({
      winner: winner,
      current_turn_player: null,
      turn_started_at: null,
    })
    .eq("room_code", roomCode)
    .is("winner", null) // Only update if game hasn't ended yet
    .eq("current_turn_player", playerNumber) // Verify it's this player's turn
    .select();

  if (error) {
    console.error("Error handling time expiration:", error);
    throw error;
  }

  // Return false if no rows updated (game already ended or not this player's turn)
  return data && data.length > 0;
};

// Get current time remaining for a player (accounts for elapsed time)
export const getCurrentTimeRemaining = (room: GameRoom, playerNumber: 1 | 2): number => {
  const baseTime = playerNumber === 1
    ? (room.player1_time_remaining ?? 300)
    : (room.player2_time_remaining ?? 300);

  // If it's this player's turn and game is active, subtract elapsed time
  if (
    room.current_turn_player === playerNumber &&
    room.turn_started_at &&
    !room.winner
  ) {
    const turnStartTime = new Date(room.turn_started_at).getTime();
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - turnStartTime) / 1000);
    return Math.max(0, baseTime - elapsedSeconds);
  }

  return baseTime;
};

// Leave/end a game room
export const leaveGame = async (
  roomCode: string,
  userId: string,
  playerNumber: 1 | 2
): Promise<boolean> => {
  console.log("🚪 leaveGame: Player", playerNumber, "leaving room:", roomCode);

  const supabase = createClient();

  try {
    const room = await getGameRoom(roomCode);
    if (!room) return false;

    // If game hasn't started and player is alone, delete the room
    if (!room.game_started && !room.player2_id && playerNumber === 1) {
      console.log("🗑️ leaveGame: Deleting empty room");
      const { error } = await supabase
        .from("game_rooms")
        .delete()
        .eq("room_code", roomCode);

      if (error) throw error;
      return true;
    }

    // If game hasn't started but player 2 joined, remove player 2
    if (!room.game_started && room.player2_id && playerNumber === 2) {
      console.log("🚪 leaveGame: Removing player 2 from waiting room");
      const { error } = await supabase
        .from("game_rooms")
        .update({
          player2_id: null,
          player2_ready: false,
          player2_secret: null,
        })
        .eq("room_code", roomCode);

      if (error) throw error;
      return true;
    }

    // If game is active, declare the other player as winner
    if (room.game_started && !room.winner) {
      const winner = playerNumber === 1 ? "2" : "1";
      console.log("🏆 leaveGame: Declaring player", winner, "as winner");

      const { error } = await supabase
        .from("game_rooms")
        .update({
          winner,
          current_turn_player: null,
          turn_started_at: null,
        })
        .eq("room_code", roomCode)
        .is("winner", null);

      if (error) throw error;

      // Update stats for the game
      await updateGameStats(roomCode);
      return true;
    }

    // If game is already over, just allow leaving
    if (room.winner) {
      console.log("✅ leaveGame: Game already over, allowing exit");
      return true;
    }

    return true;
  } catch (error) {
    console.error("❌ leaveGame: Error:", error);
    return false;
  }
};
