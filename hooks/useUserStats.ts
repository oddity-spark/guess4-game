import { useState, useEffect, useCallback } from "react";
import { getUserStats, getLeaderboard, type UserStats } from "@/lib/auth";
import toast from "react-hot-toast";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  total_games: number;
  games_won: number;
  games_lost: number;
  games_tied: number;
  win_rate: number;
  best_guess_count: number | null;
  longest_streak: number;
}

export function useUserStats(userId: string | undefined) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log("📊 useUserStats: Fetching stats for user:", userId);
    setLoading(true);
    setError(null);

    try {
      const userStats = await getUserStats(userId);
      console.log("✅ useUserStats: Stats fetched:", userStats);
      setStats(userStats);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load stats";
      console.error("❌ useUserStats: Error:", err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export function useLeaderboard(
  orderBy: "games_won" | "win_rate" | "longest_streak" = "games_won",
  limit: number = 10
) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    console.log("🏆 useLeaderboard: Fetching leaderboard:", { orderBy, limit });
    setLoading(true);
    setError(null);

    try {
      const data = await getLeaderboard(orderBy, limit);
      console.log("✅ useLeaderboard: Leaderboard fetched:", data.length, "entries");
      setLeaderboard(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load leaderboard";
      console.error("❌ useLeaderboard: Error:", err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [orderBy, limit]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { leaderboard, loading, error, refetch: fetchLeaderboard };
}
