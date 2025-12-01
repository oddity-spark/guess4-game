"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPendingInvites,
  getSentInvites,
  acceptInvite,
  declineInvite,
  GameInviteWithUser,
  subscribeToInvites,
} from "@/lib/invites";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InvitesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pendingInvites, setPendingInvites] = useState<GameInviteWithUser[]>([]);
  const [sentInvites, setSentInvites] = useState<GameInviteWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingInvite, setProcessingInvite] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchInvites = async () => {
      if (!user) return;

      setLoading(true);
      const [pending, sent] = await Promise.all([
        getPendingInvites(user.id),
        getSentInvites(user.id),
      ]);

      setPendingInvites(pending);
      setSentInvites(sent);
      setLoading(false);
    };

    fetchInvites();

    // Subscribe to new invites
    if (user) {
      const unsubscribe = subscribeToInvites(user.id, () => {
        fetchInvites();
      });

      return unsubscribe;
    }
  }, [user]);

  const handleAccept = async (inviteId: number, roomCode: string) => {
    setProcessingInvite(inviteId);
    try {
      await acceptInvite(inviteId);
      // Redirect to the game
      router.push(`/?room=${roomCode}`);
    } catch (error) {
      console.error("Error accepting invite:", error);
      alert("Failed to accept invite");
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleDecline = async (inviteId: number) => {
    setProcessingInvite(inviteId);
    try {
      await declineInvite(inviteId);
      // Refresh invites
      if (user) {
        const pending = await getPendingInvites(user.id);
        setPendingInvites(pending);
      }
    } catch (error) {
      console.error("Error declining invite:", error);
      alert("Failed to decline invite");
    } finally {
      setProcessingInvite(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading invites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 mt-8">
          <h1 className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
            Game Invites
          </h1>
          <Link
            href="/"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Back to Game
          </Link>
        </div>

        {/* Pending Invites */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>Received Invites</span>
            {pendingInvites.length > 0 && (
              <span className="bg-indigo-600 text-white text-sm font-bold px-2 py-1 rounded-full">
                {pendingInvites.length}
              </span>
            )}
          </h2>

          {pendingInvites.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-600 dark:text-gray-400">No pending invites</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {invite.from_user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          <span className="font-bold">
                            {invite.from_user.display_name || invite.from_user.username}
                          </span>{" "}
                          invited you to a game
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{invite.from_user.username} • Room: {invite.room_code}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(invite.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(invite.id, invite.room_code)}
                        disabled={processingInvite === invite.id}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        {processingInvite === invite.id ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Accept
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDecline(invite.id)}
                        disabled={processingInvite === invite.id}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sent Invites */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Sent Invites
          </h2>

          {sentInvites.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">📤</div>
              <p className="text-gray-600 dark:text-gray-400">No sent invites</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {invite.to_user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          Invited{" "}
                          <span className="font-bold">
                            {invite.to_user.display_name || invite.to_user.username}
                          </span>
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{invite.to_user.username} • Room: {invite.room_code}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(invite.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          invite.status === "accepted"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : invite.status === "declined"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : invite.status === "expired"
                            ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        }`}
                      >
                        {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
