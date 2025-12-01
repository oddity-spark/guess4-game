"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserStats, useLeaderboard } from "@/hooks/useUserStats";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function StatsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [leaderboardType, setLeaderboardType] = useState<
    "games_won" | "win_rate" | "longest_streak"
  >("games_won");

  // Use custom hooks
  const { stats, loading: statsLoading } = useUserStats(user?.id);
  const { leaderboard, loading: leaderboardLoading } = useLeaderboard(
    leaderboardType,
    10
  );

  const loading = statsLoading || leaderboardLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl mx-auto mt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              No Stats Yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Play your first game to start tracking your statistics!
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Start Playing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const winRate =
    stats.total_games > 0
      ? ((stats.games_won / stats.total_games) * 100).toFixed(1)
      : "0.0";
  const avgGuesses =
    stats.total_games > 0
      ? (stats.total_guesses / stats.total_games).toFixed(1)
      : "0.0";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 mt-8">
          <h1 className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
            My Stats
          </h1>
          <Link
            href="/"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Back to Game
          </Link>
        </div>

        {/* User Info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {profile?.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile?.display_name || profile?.username}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                @{profile?.username}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
              {stats.total_games}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Games
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {stats.games_won}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Wins</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
              {stats.games_lost}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Losses
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
              {stats.games_tied}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Ties</div>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                Win Rate
              </span>
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {winRate}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-indigo-600 dark:bg-indigo-400 h-3 rounded-full transition-all"
                style={{ width: `${winRate}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Best Performance
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.best_guess_count
                ? `${stats.best_guess_count} guesses`
                : "N/A"}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Average Guesses
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {avgGuesses}
            </div>
          </div>
        </div>

        {/* Streaks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90 mb-1">Current Streak</div>
                <div className="text-4xl font-bold">{stats.current_streak}</div>
              </div>
              <div className="text-5xl">🔥</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90 mb-1">Longest Streak</div>
                <div className="text-4xl font-bold">{stats.longest_streak}</div>
              </div>
              <div className="text-5xl">🏆</div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Leaderboard
            </h2>
            <select
              value={leaderboardType}
              onChange={(e) => setLeaderboardType(e.target.value as "games_won" | "win_rate" | "longest_streak")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="games_won">Most Wins</option>
              <option value="win_rate">Best Win Rate</option>
              <option value="longest_streak">Longest Streak</option>
            </select>
          </div>

          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 p-4 rounded-lg ${
                  entry.user_id === user?.id
                    ? "bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-500"
                    : "bg-gray-50 dark:bg-gray-700"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0
                      ? "bg-yellow-500 text-white"
                      : index === 1
                      ? "bg-gray-400 text-white"
                      : index === 2
                      ? "bg-orange-600 text-white"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {index + 1}
                </div>

                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                  {entry.username.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {entry.display_name || entry.username}
                    {entry.user_id === user?.id && (
                      <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">
                        (You)
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    @{entry.username}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-gray-900 dark:text-white">
                    {leaderboardType === "games_won" && entry.games_won}
                    {leaderboardType === "win_rate" && `${entry.win_rate}%`}
                    {leaderboardType === "longest_streak" &&
                      entry.longest_streak}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {entry.total_games} games
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
