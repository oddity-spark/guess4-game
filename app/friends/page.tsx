"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  searchUsers,
  sendFriendRequest,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  getFriends,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  type Friend,
  type FriendRequest,
} from "@/lib/friends";
import { createGameRoom, sendGameInvite } from "@/lib/gameRoom";

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "add">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    username: string;
    display_name: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [friendsData, incomingData, outgoingData] = await Promise.all([
        getFriends(),
        getIncomingFriendRequests(),
        getOutgoingFriendRequests(),
      ]);
      setFriends(friendsData);
      setIncomingRequests(incomingData);
      setOutgoingRequests(outgoingData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load data");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchUsers(searchQuery);
      // Filter out self and existing friends
      const friendIds = new Set(friends.map(f => f.friend_id));
      const filtered = results.filter(
        r => r.id !== user?.id && !friendIds.has(r.id)
      );
      setSearchResults(filtered);
    } catch (error) {
      console.error("Error searching:", error);
      toast.error("Failed to search users");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    setLoading(true);
    try {
      await sendFriendRequest(userId);
      toast.success("Friend request sent!");
      setSearchQuery("");
      setSearchResults([]);
      loadData();
    } catch (error) {
      console.error("Error sending request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: number) => {
    setLoading(true);
    try {
      await acceptFriendRequest(requestId);
      toast.success("Friend request accepted!");
      loadData();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept request");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: number) => {
    setLoading(true);
    try {
      await rejectFriendRequest(requestId);
      toast.success("Friend request rejected");
      loadData();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject request");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (requestId: number) => {
    setLoading(true);
    try {
      await cancelFriendRequest(requestId);
      toast.success("Friend request cancelled");
      loadData();
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast.error("Failed to cancel request");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (friendshipId: number) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;

    setLoading(true);
    try {
      await removeFriend(friendshipId);
      toast.success("Friend removed");
      loadData();
    } catch (error) {
      console.error("Error removing friend:", error);
      toast.error("Failed to remove friend");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteToGame = async (friendId: string) => {
    setInvitingFriendId(friendId);
    try {
      const roomCode = await createGameRoom(user?.id);
      await sendGameInvite(roomCode, friendId);
      toast.success("Game invite sent!");
      // Redirect with 'created' flag to indicate we created this room
      router.push(`/?room=${roomCode}&created=true`);
    } catch (error) {
      console.error("Error inviting to game:", error);
      toast.error("Failed to send game invite");
    } finally {
      setInvitingFriendId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 mt-8">
          <h1 className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
            Friends
          </h1>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
          >
            Back to Game
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("friends")}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "friends"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors relative ${
              activeTab === "requests"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Requests
            {incomingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {incomingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "add"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Add Friends
          </button>
        </div>

        {/* Friends Tab */}
        {activeTab === "friends" && (
          <div className="space-y-3">
            {friends.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No friends yet. Add some friends to play with!
                </p>
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {friend.friend_profile?.display_name || friend.friend_profile?.username}
                    </p>
                    {friend.friend_profile?.display_name && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        @{friend.friend_profile.username}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInviteToGame(friend.friend_id)}
                      disabled={invitingFriendId === friend.friend_id}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors text-sm"
                    >
                      {invitingFriendId === friend.friend_id ? "Inviting..." : "Invite to Game"}
                    </button>
                    <button
                      onClick={() => handleRemove(friend.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            {/* Incoming Requests */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Incoming Requests
              </h2>
              <div className="space-y-3">
                {incomingRequests.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No incoming requests</p>
                  </div>
                ) : (
                  incomingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {request.from_user?.display_name || request.from_user?.username}
                        </p>
                        {request.from_user?.display_name && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            @{request.from_user.username}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(request.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Outgoing Requests */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Sent Requests
              </h2>
              <div className="space-y-3">
                {outgoingRequests.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No sent requests</p>
                  </div>
                ) : (
                  outgoingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {request.to_user?.display_name || request.to_user?.username}
                        </p>
                        {request.to_user?.display_name && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            @{request.to_user.username}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCancel(request.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Friends Tab */}
        {activeTab === "add" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Search for Users
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter username"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white min-w-0"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading || !searchQuery.trim()}
                  className="px-4 sm:px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="hidden sm:inline">Searching...</span>
                    </span>
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="space-y-3">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {result.display_name || result.username}
                    </p>
                    {result.display_name && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        @{result.username}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSendRequest(result.id)}
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors text-sm"
                  >
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
