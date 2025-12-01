import { createClient } from "@/utils/supabase/client";

export interface FriendRequest {
  id: number;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  from_user?: {
    username: string;
    display_name: string | null;
  };
  to_user?: {
    username: string;
    display_name: string | null;
  };
}

export interface Friend {
  id: number;
  user_id: string;
  friend_id: string;
  created_at: string;
  friend_profile?: {
    username: string;
    display_name: string | null;
  };
}

// Search for users by username
export const searchUsers = async (query: string): Promise<Array<{
  id: string;
  username: string;
  display_name: string | null;
}>> => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, username, display_name")
    .ilike("username", `%${query}%`)
    .limit(10);

  if (error) {
    console.error("Error searching users:", error);
    throw new Error(`Failed to search users: ${error.message}`);
  }

  return data || [];
};

// Send a friend request
export const sendFriendRequest = async (fromUserId: string, toUserId: string): Promise<void> => {
  const supabase = createClient();

  if (!fromUserId) throw new Error("Not authenticated");

  // Check if already friends or request exists
  const { data: existingRequest } = await supabase
    .from("friend_requests")
    .select("id, status")
    .or(`and(from_user_id.eq.${fromUserId},to_user_id.eq.${toUserId}),and(from_user_id.eq.${toUserId},to_user_id.eq.${fromUserId})`)
    .single();

  if (existingRequest) {
    if (existingRequest.status === "pending") {
      throw new Error("Friend request already exists");
    } else if (existingRequest.status === "accepted") {
      throw new Error("Already friends");
    }
  }

  const { error } = await supabase
    .from("friend_requests")
    .insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      status: "pending",
    });

  if (error) {
    console.error("Error sending friend request:", error);
    throw new Error(`Failed to send friend request: ${error.message}`);
  }
};

// Get incoming friend requests
export const getIncomingFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
  const supabase = createClient();

  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("friend_requests")
    .select(`
      *,
      from_user:user_profiles!friend_requests_from_user_id_fkey(username, display_name)
    `)
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching friend requests:", error);
    throw new Error(`Failed to fetch friend requests: ${error.message}`);
  }

  return data as FriendRequest[];
};

// Get outgoing friend requests
export const getOutgoingFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
  const supabase = createClient();

  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("friend_requests")
    .select(`
      *,
      to_user:user_profiles!friend_requests_to_user_id_fkey(username, display_name)
    `)
    .eq("from_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching sent requests:", error);
    throw new Error(`Failed to fetch sent requests: ${error.message}`);
  }

  return data as FriendRequest[];
};

// Accept a friend request
export const acceptFriendRequest = async (requestId: number): Promise<void> => {
  const supabase = createClient();

  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error("Error accepting friend request:", error);
    throw new Error(`Failed to accept friend request: ${error.message}`);
  }
};

// Reject a friend request
export const rejectFriendRequest = async (requestId: number): Promise<void> => {
  const supabase = createClient();

  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error("Error rejecting friend request:", error);
    throw new Error(`Failed to reject friend request: ${error.message}`);
  }
};

// Cancel a sent friend request
export const cancelFriendRequest = async (requestId: number): Promise<void> => {
  const supabase = createClient();

  const { error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", requestId);

  if (error) {
    console.error("Error canceling friend request:", error);
    throw new Error(`Failed to cancel friend request: ${error.message}`);
  }
};

// Get list of friends
export const getFriends = async (userId?: string): Promise<Friend[]> => {
  const supabase = createClient();

  // If no userId provided, get from localStorage (for backward compatibility)
  let currentUserId = userId;
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

  const { data, error } = await supabase
    .from("friendships")
    .select(`
      *,
      friend_profile:user_profiles!friendships_friend_id_fkey(username, display_name)
    `)
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching friends:", error);
    throw new Error(`Failed to fetch friends: ${error.message}`);
  }

  return data as Friend[];
};

// Remove a friend (unfriend)
export const removeFriend = async (friendshipId: number, userId: string): Promise<void> => {
  const supabase = createClient();

  if (!userId) throw new Error("Not authenticated");

  // Get the friendship to find the friend_id
  const { data: friendship } = await supabase
    .from("friendships")
    .select("friend_id")
    .eq("id", friendshipId)
    .eq("user_id", userId)
    .single();

  if (!friendship) {
    throw new Error("Friendship not found");
  }

  // Delete both sides of the friendship
  const { error: error1 } = await supabase
    .from("friendships")
    .delete()
    .eq("user_id", userId)
    .eq("friend_id", friendship.friend_id);

  const { error: error2 } = await supabase
    .from("friendships")
    .delete()
    .eq("user_id", friendship.friend_id)
    .eq("friend_id", userId);

  if (error1 || error2) {
    console.error("Error removing friend:", error1 || error2);
    throw new Error("Failed to remove friend");
  }
};
