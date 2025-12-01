"use client";

import { useState, useEffect, useRef } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import {
  subscribeToRoom,
  startGame,
  updateGameStats,
  sendGameInvite,
  getUserActiveRoom,
  handleTimeExpiration,
  getCurrentTimeRemaining,
  leaveGame,
  type GameRoom,
  type Guess,
} from "@/lib/gameRoom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateGameRoom,
  useJoinGameRoom,
  useSetSecret,
  useSubmitGuess,
} from "@/hooks/useGameRoom";
import { getFriends } from "@/lib/friends";
import AuthModal from "@/components/AuthModal";
import UserMenu from "@/components/UserMenu";
import toast from "react-hot-toast";

type GamePhase = "menu" | "setup" | "waiting" | "playing" | "gameover";

export default function Home() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const { user } = useAuth();

  // Initialize the MiniKit frame
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Custom hooks for game operations
  const { create: createRoom, loading: isCreatingRoom } = useCreateGameRoom();
  const { join: joinRoom, loading: isJoiningRoom } = useJoinGameRoom();
  const { setSecret: setRoomSecret, loading: isSettingSecret } = useSetSecret();
  const { submit: submitGameGuess, loading: isSubmittingGuess } =
    useSubmitGuess();

  // Game state
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [roomCode, setRoomCode] = useState("");
  const [playerNumber, setPlayerNumber] = useState<1 | 2 | null>(null);
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [mySecret, setMySecret] = useState("");
  const [guessInput, setGuessInput] = useState("");

  // UI state
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [secretError, setSecretError] = useState("");
  const [guessError, setGuessError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFriendInvite, setShowFriendInvite] = useState(false);
  const [friends, setFriends] = useState<
    Array<{
      id: number;
      friend_id: string;
      friend_profile?: { username: string; display_name: string | null };
    }>
  >([]);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);

  // Notepad state
  const [showNotepad, setShowNotepad] = useState(false);
  const [crossedNumbers, setCrossedNumbers] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");

  // Timer state
  const [player1TimeRemaining, setPlayer1TimeRemaining] = useState(300);
  const [player2TimeRemaining, setPlayer2TimeRemaining] = useState(300);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedTimeControl, setSelectedTimeControl] = useState(300); // Default 5 minutes

  // Load friends when user is signed in
  useEffect(() => {
    let isMounted = true;

    if (user) {
      getFriends()
        .then((friends) => {
          if (isMounted) setFriends(friends);
        })
        .catch((error) => console.error("Failed to load friends:", error));
    } else {
      setFriends([]);
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Consolidated initialization: Check URL params, then active room
  useEffect(() => {
    if (!user || phase !== "menu") return;
    if (typeof window === "undefined") return;

    let isMounted = true; // Cleanup flag to prevent state updates after unmount

    // Priority 1: Check URL parameters first (invite/share flow)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    const createdParam = urlParams.get("created");

    if (roomParam) {
      if (createdParam === "true") {
        // We created this room (sent an invite), so we're Player 1
        if (isMounted) {
          setRoomCode(roomParam);
          setPlayerNumber(1);
          setPhase("waiting");
          toast.success("Waiting for your friend to accept the invite...");
        }
      } else {
        // We're joining an existing room (accepted an invite), so we're Player 2
        handleJoinRoom(roomParam);
      }
      // Clean up URL
      window.history.replaceState({}, "", "/");
      return; // Skip active room check since URL params take priority
    }

    // Priority 2: Check for active room (page reload/return)
    getUserActiveRoom(user.fid)
      .then((activeRoom) => {
        if (!isMounted) return; // Don't update state if unmounted

        if (activeRoom) {
          const { room, playerNumber } = activeRoom;
          console.log(
            "Found active room:",
            room.room_code,
            "as player",
            playerNumber
          );

          setRoomCode(room.room_code);
          setPlayerNumber(playerNumber);
          setGameRoom(room);

          // Extract and set the player's secret from the room data
          const playerSecret =
            playerNumber === 1 ? room.player1_secret : room.player2_secret;
          if (playerSecret) {
            setMySecret(playerSecret);
          }

          // Determine the correct phase based on room state
          if (room.winner) {
            setPhase("gameover");
          } else if (room.game_started) {
            setPhase("playing");
          } else if (
            playerNumber === 1 &&
            room.player1_ready &&
            !room.player2_ready
          ) {
            setPhase("waiting");
          } else if (
            playerNumber === 2 &&
            room.player2_ready &&
            !room.player1_ready
          ) {
            setPhase("waiting");
          } else if (playerNumber === 1 && !room.player1_ready) {
            setPhase("setup");
          } else if (playerNumber === 2 && !room.player2_ready) {
            setPhase("setup");
          } else if (!room.player2_id) {
            setPhase("waiting");
            toast.success("Rejoined your active game room");
          } else {
            setPhase("waiting");
          }
        }
      })
      .catch((error) =>
        console.error("Failed to check for active room:", error)
      );

    return () => {
      isMounted = false; // Cleanup flag
    };
  }, [user, phase]);

  // Subscribe to room updates
  useEffect(() => {
    if (!roomCode) return;

    // Track if game start has been triggered to prevent duplicate calls
    let gameStartTriggered = false;

    const unsubscribe = subscribeToRoom(roomCode, (room) => {
      setGameRoom(() => {
        if (!room) return null;

        // Use setGameRoom callback to ensure we're working with latest state
        // This prevents stale closure issues

        // Auto-start game when both players are ready (once)
        if (
          !gameStartTriggered &&
          !room.game_started &&
          room.player1_ready &&
          room.player2_ready
        ) {
          gameStartTriggered = true;
          startGame(roomCode).catch((error) => {
            console.error("Failed to start game:", error);
            gameStartTriggered = false; // Reset on failure
          });
        }

        // Phase transitions based on room state
        setPhase((currentPhase) => {
          // Winner detected - move to gameover
          if (room.winner && currentPhase !== "gameover") {
            updateGameStats(roomCode).catch(console.error);
            return "gameover";
          }

          // Game started - move to playing
          if (
            room.game_started &&
            !room.winner &&
            (currentPhase === "waiting" || currentPhase === "setup")
          ) {
            return "playing";
          }

          // Friend joined - move to setup
          if (
            currentPhase === "waiting" &&
            room.player2_id &&
            playerNumber === 1 &&
            !room.player1_ready
          ) {
            toast.success("Your friend joined! Set your secret number.");
            return "setup";
          }

          return currentPhase; // No change
        });

        return room;
      });
    });

    return () => unsubscribe();
  }, [roomCode, playerNumber]); // Removed 'phase' from dependencies to avoid stale closures

  // Timer management - update timers every second and check for expiration
  useEffect(() => {
    if (!gameRoom || phase !== "playing" || gameRoom.winner) {
      // Clear timer when not in active playing phase
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    // Guard: Clear any existing interval before creating new one
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Use refs for stable values to avoid recreating interval on every gameRoom change
    const roomRef = { current: gameRoom };
    const playerRef = { current: playerNumber };
    const roomCodeRef = { current: roomCode };

    // Track if time expiration has been triggered
    let timeExpirationTriggered = false;

    const updateTimers = () => {
      const currentRoom = roomRef.current;
      if (!currentRoom || currentRoom.winner) {
        // Game ended, stop updating
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        return;
      }

      const p1Time = getCurrentTimeRemaining(currentRoom, 1);
      const p2Time = getCurrentTimeRemaining(currentRoom, 2);

      setPlayer1TimeRemaining(p1Time);
      setPlayer2TimeRemaining(p2Time);

      // Check for time expiration (only once)
      const currentPlayer = playerRef.current;
      if (currentPlayer && !currentRoom.winner && !timeExpirationTriggered) {
        if (currentPlayer === 1 && p1Time <= 0) {
          timeExpirationTriggered = true;
          handleTimeExpiration(roomCodeRef.current, 1).catch((error) => {
            console.error("Failed to handle time expiration:", error);
            toast.error("Failed to process time expiration");
          });
        } else if (currentPlayer === 2 && p2Time <= 0) {
          timeExpirationTriggered = true;
          handleTimeExpiration(roomCodeRef.current, 2).catch((error) => {
            console.error("Failed to handle time expiration:", error);
            toast.error("Failed to process time expiration");
          });
        }
      }
    };

    // Update immediately
    updateTimers();

    // Set up interval to update every second
    timerIntervalRef.current = setInterval(updateTimers, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameRoom, phase, playerNumber, roomCode]);

  // Validate number: 4 digits, no 0, no repeating digits
  const validateSecretNumber = (num: string): string | null => {
    if (num.length !== 4) return "Must be exactly 4 digits";
    if (!/^\d+$/.test(num)) return "Must contain only digits";
    if (num.includes("0")) return "Cannot contain 0";
    if (new Set(num).size !== 4) return "Cannot have repeating digits";
    return null;
  };

  // Copy room code to clipboard
  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Calculate feedback for a guess
  const evaluateGuess = (
    guess: string,
    secret: string
  ): { correctDigits: number; correctPositions: number } => {
    let correctPositions = 0;
    let correctDigits = 0;

    for (let i = 0; i < 4; i++) {
      if (guess[i] === secret[i]) {
        correctPositions++;
      }
    }

    for (const digit of guess) {
      if (secret.includes(digit)) {
        correctDigits++;
      }
    }

    return { correctDigits, correctPositions };
  };

  // Handle creating a new room
  const handleCreateRoom = async () => {
    if (!user) {
      toast.error("Please sign in to create a game");
      setShowAuthModal(true);
      return;
    }

    try {
      const code = await createRoom(user.fid, selectedTimeControl);
      setRoomCode(code);
      setPlayerNumber(1);
      setPhase("setup");
    } catch (error) {
      // Error handling is done in the hook
      console.error("Error creating room:", error);
    }
  };

  // Handle joining a room
  const handleJoinRoom = async (code?: string) => {
    // Use provided code or fall back to input field
    const roomCodeToJoin = code || joinCodeInput;

    if (!user) {
      toast.error("Please sign in to join a game");
      setShowAuthModal(true);
      return;
    }

    if (roomCodeToJoin.length !== 6) {
      toast.error("Room code must be 6 digits");
      return;
    }

    try {
      const success = await joinRoom(roomCodeToJoin, user.fid);
      if (success) {
        // When joining an existing room, you are always Player 2
        setRoomCode(roomCodeToJoin);
        setPlayerNumber(2);
        setPhase("setup");

        // Show success message when joining via invite
        if (code) {
          toast.success("Joined game room!");
        }
      }
    } catch (error) {
      // Error handling is done in the hook
      console.error("Error joining room:", error);
    }
  };

  // Handle setting secret number
  const handleSetSecret = async () => {
    setSecretError("");

    const error = validateSecretNumber(mySecret);
    if (error) {
      setSecretError(error);
      toast.error(error);
      return;
    }

    if (!playerNumber || !roomCode) {
      toast.error("Game session error. Please try again.");
      return;
    }

    try {
      const success = await setRoomSecret(roomCode, playerNumber, mySecret);
      if (success) {
        setPhase("waiting");
      }
    } catch (error) {
      // Error handling is done in the hook
      console.error("Error setting secret:", error);
    }
  };

  // Handle submitting a guess
  const handleSubmitGuess = async () => {
    setGuessError("");

    // Validate guess - only check length and digits, allow 0 and repeats
    if (guessInput.length !== 4) {
      setGuessError("Must be exactly 4 digits");
      toast.error("Must be exactly 4 digits");
      return;
    }
    if (!/^\d+$/.test(guessInput)) {
      setGuessError("Must contain only digits");
      toast.error("Must contain only digits");
      return;
    }

    if (!gameRoom || !playerNumber) {
      toast.error("Game session error. Please try again.");
      return;
    }

    // Get opponent's secret
    const opponentSecret =
      playerNumber === 1 ? gameRoom.player2_secret : gameRoom.player1_secret;

    // Validate opponent has set their secret
    if (!opponentSecret || opponentSecret.length !== 4) {
      toast.error("Opponent hasn't set their secret yet. Please wait.");
      return;
    }

    const { correctDigits, correctPositions } = evaluateGuess(
      guessInput,
      opponentSecret
    );

    const newGuess: Guess = {
      number: guessInput,
      correctDigits,
      correctPositions,
    };

    try {
      const success = await submitGameGuess(roomCode, playerNumber, newGuess);
      if (success) {
        setGuessInput("");
      }
    } catch (error) {
      // Error handling is done in the hook
      console.error("Error submitting guess:", error);
    }
  };

  // Handle new game
  const handleNewGame = () => {
    setPhase("menu");
    setRoomCode("");
    setPlayerNumber(null);
    setGameRoom(null);
    setMySecret("");
    setGuessInput("");
    setJoinCodeInput("");
    setSecretError("");
    setGuessError("");
    // Reset notepad
    setCrossedNumbers(new Set());
    setNotes("");
    setShowNotepad(false);
  };

  // Toggle crossed number
  const toggleCrossedNumber = (num: number) => {
    setCrossedNumbers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(num)) {
        newSet.delete(num);
      } else {
        newSet.add(num);
      }
      return newSet;
    });
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle inviting a friend to a new game
  const handleInviteFriend = async (friendId: string) => {
    if (!user) {
      toast.error("Please sign in to invite friends");
      setShowAuthModal(true);
      return;
    }

    setInvitingFriendId(friendId);
    try {
      const code = await createRoom(user.fid, selectedTimeControl);
      await sendGameInvite(code, friendId);

      // Transition to waiting state with room info
      setRoomCode(code);
      setPlayerNumber(1);
      setPhase("waiting");
      setShowFriendInvite(false);

      toast.success("Game invite sent! Waiting for your friend to join...");
    } catch (error) {
      console.error("Failed to invite friend:", error);
      toast.error("Failed to send invite");
    } finally {
      setInvitingFriendId(null);
    }
  };

  const handleLeaveGame = async () => {
    if (!roomCode || !playerNumber || !user) return;

    const confirmLeave = window.confirm(
      "Are you sure you want to leave this game? If the game is active, you will forfeit."
    );

    if (!confirmLeave) return;

    try {
      const success = await leaveGame(roomCode, user.fid, playerNumber);
      if (success) {
        // Reset all game state
        setRoomCode("");
        setPlayerNumber(null);
        setMySecret("");
        setGameRoom(null);
        setPhase("menu");
        toast.success("Left the game");
      } else {
        toast.error("Failed to leave game");
      }
    } catch (error) {
      console.error("Error leaving game:", error);
      toast.error("Failed to leave game");
    }
  };

  const isMyTurn = gameRoom?.current_turn === playerNumber;
  const myGuesses =
    playerNumber === 1 ? gameRoom?.player1_guesses : gameRoom?.player2_guesses;
  const opponentGuesses =
    playerNumber === 1 ? gameRoom?.player2_guesses : gameRoom?.player1_guesses;

  // Helper functions to get player display names
  const getMyDisplayName = () => {
    if (!gameRoom || !playerNumber) return "You";
    const profile =
      playerNumber === 1 ? gameRoom.player1_profile : gameRoom.player2_profile;
    return profile?.display_name || profile?.username || "You";
  };

  const getOpponentDisplayName = () => {
    if (!gameRoom || !playerNumber) return "Opponent";
    const profile =
      playerNumber === 1 ? gameRoom.player2_profile : gameRoom.player1_profile;
    return profile?.display_name || profile?.username || "Opponent";
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header with Auth */}
        <div className="flex items-center justify-between mb-8 mt-8">
          <h1 className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
            Guess the Number
          </h1>

          <div className="flex items-center gap-3">
            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
          }}
        />

        {/* Menu Phase */}
        {phase === "menu" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
              Play with a friend on separate devices!
            </p>

            {/* Time Control Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Time Control
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "1 min", value: 60 },
                  { label: "3 min", value: 180 },
                  { label: "5 min", value: 300 },
                  { label: "10 min", value: 600 },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTimeControl(option.value)}
                    className={`py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                      selectedTimeControl === option.value
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isCreatingRoom}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors flex items-center justify-center"
            >
              {isCreatingRoom && (
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {isCreatingRoom ? "Creating..." : "Create New Game"}
            </button>

            {user && friends.length > 0 && (
              <button
                onClick={() => setShowFriendInvite(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors flex items-center justify-center"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Invite a Friend
              </button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                  OR
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
                placeholder="Enter 6-digit room code"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-center tracking-widest"
              />
              <button
                onClick={() => handleJoinRoom()}
                disabled={isJoiningRoom}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors flex items-center justify-center"
              >
                {isJoiningRoom && (
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                {isJoiningRoom ? "Joining..." : "Join Game"}
              </button>
            </div>
          </div>
        )}

        {/* Setup Phase */}
        {phase === "setup" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-6">
            <div className="bg-indigo-100 dark:bg-indigo-900 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                Room Code
              </p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100 tracking-widest">
                  {roomCode}
                </p>
                <button
                  onClick={handleCopyRoomCode}
                  className="p-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-lg transition-colors"
                  title="Copy room code"
                >
                  {copied ? (
                    <svg
                      className="w-6 h-6 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6 text-indigo-900 dark:text-indigo-100"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {copied
                  ? "Copied to clipboard!"
                  : "Share this code with your friend"}
              </p>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
              Playing as:{" "}
              <span className="font-semibold">{getMyDisplayName()}</span>
              <br />
              Choose your 4-digit secret number
              <br />
              (1-9, no repeating digits, no 0)
            </p>

            <div className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={mySecret}
                onChange={(e) => setMySecret(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSetSecret()}
                placeholder="Enter your secret number"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-center tracking-widest"
              />
              {secretError && (
                <p className="text-red-500 text-sm text-center">
                  {secretError}
                </p>
              )}
              <button
                onClick={handleSetSecret}
                disabled={isSettingSecret}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors flex items-center justify-center"
              >
                {isSettingSecret && (
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                {isSettingSecret ? "Setting..." : "Set Secret Number"}
              </button>
              <button
                onClick={handleLeaveGame}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Leave Game
              </button>
            </div>
          </div>
        )}

        {/* Waiting Phase */}
        {phase === "waiting" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="animate-pulse">
              <div className="text-6xl mb-4">
                {gameRoom?.player2_id ? "⏳" : "📨"}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {gameRoom?.player2_id
                  ? "Waiting for opponent..."
                  : "Waiting for friend to accept invite..."}
              </h2>
            </div>

            <div className="bg-indigo-100 dark:bg-indigo-900 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Room Code
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-2xl tracking-widest text-indigo-900 dark:text-indigo-100">
                  {roomCode}
                </span>
                <button
                  onClick={handleCopyRoomCode}
                  className="p-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-lg transition-colors"
                  title="Copy room code"
                >
                  {copied ? (
                    <svg
                      className="w-5 h-5 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-indigo-900 dark:text-indigo-100"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {copied ? "Copied!" : "Share this code"}
              </p>
            </div>

            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {gameRoom?.player2_id
                  ? "Your secret number is set. The game will start automatically when your opponent joins and sets their number."
                  : "Your friend will receive a notification. They can also join using the room code above."}
              </p>
            </div>

            <button
              onClick={handleLeaveGame}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Leave Game
            </button>
          </div>
        )}

        {/* Playing Phase */}
        {phase === "playing" && gameRoom && (
          <div className="space-y-6">
            {/* Current turn info */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                    {isMyTurn
                      ? `${getMyDisplayName()}'s Turn`
                      : `${getOpponentDisplayName()}'s Turn`}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Your secret: {mySecret}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowNotepad(!showNotepad)}
                    className="p-2 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 rounded-lg transition-colors"
                    title="Toggle notepad"
                  >
                    <svg
                      className="w-6 h-6 text-yellow-700 dark:text-yellow-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Playing as
                    </p>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {getMyDisplayName()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timer Display */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Player 1 Timer */}
                <div
                  className={`rounded-lg p-3 ${
                    playerNumber === 1
                      ? "bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                >
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    {gameRoom.player1_profile?.display_name ||
                      gameRoom.player1_profile?.username ||
                      "Player 1"}
                  </div>
                  <div
                    className={`text-2xl font-mono font-bold ${
                      player1TimeRemaining <= 30
                        ? "text-red-600 dark:text-red-400"
                        : player1TimeRemaining <= 60
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {formatTime(player1TimeRemaining)}
                  </div>
                  {gameRoom.current_turn_player === 1 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Active
                      </span>
                    </div>
                  )}
                </div>

                {/* Player 2 Timer */}
                <div
                  className={`rounded-lg p-3 ${
                    playerNumber === 2
                      ? "bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                >
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    {gameRoom.player2_profile?.display_name ||
                      gameRoom.player2_profile?.username ||
                      "Player 2"}
                  </div>
                  <div
                    className={`text-2xl font-mono font-bold ${
                      player2TimeRemaining <= 30
                        ? "text-red-600 dark:text-red-400"
                        : player2TimeRemaining <= 60
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {formatTime(player2TimeRemaining)}
                  </div>
                  {gameRoom.current_turn_player === 2 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Active
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {isMyTurn ? (
                <div className="space-y-3">
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSubmitGuess()}
                    placeholder="Enter your guess"
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-center tracking-widest"
                  />
                  {guessError && (
                    <p className="text-red-500 text-sm text-center">
                      {guessError}
                    </p>
                  )}
                  <button
                    onClick={handleSubmitGuess}
                    disabled={isSubmittingGuess}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {isSubmittingGuess && (
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {isSubmittingGuess ? "Submitting..." : "Submit Guess"}
                  </button>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-gray-600 dark:text-gray-300">
                    Waiting for opponent to make their guess...
                  </p>
                </div>
              )}
            </div>

            {/* Guess history */}
            <div className="grid grid-cols-2 gap-4">
              {/* My guesses */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                <h3 className="font-bold text-center text-gray-800 dark:text-gray-200 mb-3 text-sm">
                  {getMyDisplayName()}
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {myGuesses?.map((guess, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-xs"
                    >
                      <div className="font-mono text-center text-lg font-bold text-gray-900 dark:text-white tracking-wider">
                        {guess.number}
                      </div>
                      <div className="text-center text-gray-600 dark:text-gray-300 mt-1">
                        {guess.correctDigits} digit
                        {guess.correctDigits !== 1 ? "s" : ""},{" "}
                        {guess.correctPositions} position
                        {guess.correctPositions !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opponent's guesses */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                <h3 className="font-bold text-center text-gray-800 dark:text-gray-200 mb-3 text-sm">
                  {getOpponentDisplayName()}
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {opponentGuesses?.map((guess, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-xs"
                    >
                      <div className="font-mono text-center text-lg font-bold text-gray-900 dark:text-white tracking-wider">
                        {guess.number}
                      </div>
                      <div className="text-center text-gray-600 dark:text-gray-300 mt-1">
                        {guess.correctDigits} digit
                        {guess.correctDigits !== 1 ? "s" : ""},{" "}
                        {guess.correctPositions} position
                        {guess.correctPositions !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Leave Game button */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4">
              <button
                onClick={handleLeaveGame}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Forfeit Game
              </button>
            </div>
          </div>
        )}

        {/* Notepad Modal */}
        {showNotepad && phase === "playing" && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Game Notes
                </h3>
                <button
                  onClick={() => setShowNotepad(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Number grid for crossing out */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cross out numbers:
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => toggleCrossedNumber(num)}
                      className={`aspect-square rounded-lg font-bold text-lg transition-all ${
                        crossedNumbers.has(num)
                          ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 line-through"
                          : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes textarea */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your notes:
                </h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Write your strategy, observations, or hints here..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white resize-none"
                  rows={4}
                />
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowNotepad(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Game Over Phase */}
        {phase === "gameover" && gameRoom && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="text-6xl mb-4">
              {gameRoom.winner === "tie"
                ? "🤝"
                : Number(gameRoom.winner) === playerNumber
                ? "🎉"
                : "😔"}
            </div>
            <h2 className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
              {gameRoom.winner === "tie"
                ? "It's a Tie!"
                : Number(gameRoom.winner) === playerNumber
                ? "You Win!"
                : "You Lose!"}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {gameRoom.winner === "tie" ? (
                <>
                  Both players guessed correctly in{" "}
                  {gameRoom.player1_guesses.length} attempt
                  {gameRoom.player1_guesses.length !== 1 ? "s" : ""}!
                </>
              ) : (
                <>
                  {/* Check if someone ran out of time */}
                  {(Number(gameRoom.winner) === 1 && player2TimeRemaining === 0) ||
                  (Number(gameRoom.winner) === 2 && player1TimeRemaining === 0) ? (
                    <>
                      {Number(gameRoom.winner) === playerNumber
                        ? "Your opponent ran out of time!"
                        : "You ran out of time!"}
                    </>
                  ) : (
                    <>
                      {Number(gameRoom.winner) === playerNumber
                        ? `You guessed the number in ${
                            playerNumber === 1
                              ? gameRoom.player1_guesses.length
                              : gameRoom.player2_guesses.length
                          } attempt${
                            (playerNumber === 1
                              ? gameRoom.player1_guesses.length
                              : gameRoom.player2_guesses.length) !== 1
                              ? "s"
                              : ""
                          }!`
                        : `${
                            gameRoom.winner === 1
                              ? gameRoom.player1_profile?.display_name ||
                                gameRoom.player1_profile?.username ||
                                "Player 1"
                              : gameRoom.player2_profile?.display_name ||
                                gameRoom.player2_profile?.username ||
                                "Player 2"
                          } guessed the number in ${
                            Number(gameRoom.winner) === 1
                              ? gameRoom.player1_guesses.length
                              : gameRoom.player2_guesses.length
                          } attempt${
                            (Number(gameRoom.winner) === 1
                              ? gameRoom.player1_guesses.length
                              : gameRoom.player2_guesses.length) !== 1
                              ? "s"
                              : ""
                          }!`}
                    </>
                  )}
                </>
              )}
            </p>
            {user && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 text-sm">
                <p className="text-indigo-900 dark:text-indigo-100">
                  Your stats have been updated!
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleNewGame}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
              >
                Play Again
              </button>
              {user && (
                <a
                  href="/stats"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors text-center"
                >
                  View Stats
                </a>
              )}
            </div>
          </div>
        )}

        {/* Friend Invite Modal */}
        {showFriendInvite && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Invite a Friend
                  </h2>
                  <button
                    onClick={() => setShowFriendInvite(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Select a friend to invite to a new game
                </p>

                <div className="space-y-2">
                  {friends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleInviteFriend(friend.friend_id)}
                      disabled={invitingFriendId === friend.friend_id}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                          {(
                            friend.friend_profile?.display_name ||
                            friend.friend_profile?.username ||
                            "?"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {friend.friend_profile?.display_name ||
                              friend.friend_profile?.username}
                          </p>
                          {friend.friend_profile?.display_name && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              @{friend.friend_profile.username}
                            </p>
                          )}
                        </div>
                      </div>
                      {invitingFriendId === friend.friend_id ? (
                        <svg
                          className="animate-spin h-5 w-5 text-indigo-600"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-indigo-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {friends.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      You don&apos;t have any friends yet
                    </p>
                    <a
                      href="/friends"
                      className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                      Add Friends
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
