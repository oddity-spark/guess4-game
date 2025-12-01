import { useState, useCallback } from "react";
import {
  createGameRoom,
  joinGameRoom,
  checkRoomExists,
  setPlayerSecret,
  submitGuess,
  type Guess,
} from "@/lib/gameRoom";
import toast from "react-hot-toast";

export function useCreateGameRoom() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (userId: string, timeLimit?: number) => {
    console.log("🎮 useCreateGameRoom: Creating room for user:", userId, "with time limit:", timeLimit);
    setLoading(true);
    setError(null);

    try {
      const roomCode = await createGameRoom(userId, timeLimit);
      console.log("✅ useCreateGameRoom: Room created:", roomCode);
      toast.success("Game room created! Share the code with your friend.");
      return roomCode;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create room";
      console.error("❌ useCreateGameRoom: Error:", err);
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}

export function useJoinGameRoom() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async (roomCode: string, userId: string) => {
    console.log("🎮 useJoinGameRoom: Joining room:", { roomCode, userId });
    setLoading(true);
    setError(null);

    try {
      // Check if room exists first
      const exists = await checkRoomExists(roomCode);
      if (!exists) {
        const msg = "Room not found. Please check the code and try again.";
        setError(msg);
        toast.error(msg);
        return false;
      }

      // Try to join
      const success = await joinGameRoom(roomCode, userId);

      if (!success) {
        const msg = "Unable to join room. It may be full or no longer available.";
        setError(msg);
        toast.error(msg);
        return false;
      }

      console.log("✅ useJoinGameRoom: Successfully joined room");
      toast.success("Joined game successfully!");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join room";
      console.error("❌ useJoinGameRoom: Error:", err);
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { join, loading, error };
}

export function useSetSecret() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSecret = useCallback(
    async (roomCode: string, playerNumber: 1 | 2, secret: string) => {
      console.log("🎮 useSetSecret: Setting secret for player", playerNumber);
      setLoading(true);
      setError(null);

      try {
        await setPlayerSecret(roomCode, playerNumber, secret);
        console.log("✅ useSetSecret: Secret set successfully");
        toast.success("Secret number set! Waiting for opponent...");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to set secret";
        console.error("❌ useSetSecret: Error:", err);
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { setSecret, loading, error };
}

export function useSubmitGuess() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (roomCode: string, playerNumber: 1 | 2, guess: Guess) => {
      console.log("🎮 useSubmitGuess: Submitting guess:", guess.number);
      setLoading(true);
      setError(null);

      try {
        const success = await submitGuess(roomCode, playerNumber, guess);

        if (!success) {
          toast.error("Turn changed or conflict detected. Please try again.");
          return false;
        }

        console.log("✅ useSubmitGuess: Guess submitted successfully");

        // Show feedback toast
        if (guess.correctPositions === 4) {
          toast.success("You guessed it! You win!");
        } else {
          toast.success(
            `${guess.correctDigits} digits, ${guess.correctPositions} positions`
          );
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to submit guess";
        console.error("❌ useSubmitGuess: Error:", err);
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { submit, loading, error };
}
