import { createClient } from "@/utils/supabase/client";

export interface GameInvite {
  id: number;
  room_code: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined" | "expired";
  created_at: string;
  expires_at: string;
}

export interface GameInviteWithUser extends GameInvite {
  from_user: {
    username: string;
    display_name: string | null;
  };
  to_user: {
    username: string;
    display_name: string | null;
  };
}

// Create a game invite
export const createGameInvite = async (
  roomCode: string,
  fromUserId: string,
  toUserId: string
): Promise<GameInvite> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_invites")
    .insert({
      room_code: roomCode,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Get pending invites for a user
export const getPendingInvites = async (
  userId: string
): Promise<GameInviteWithUser[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_invites")
    .select(
      `
      *,
      from_user:user_profiles!game_invites_from_user_id_fkey(username, display_name),
      to_user:user_profiles!game_invites_to_user_id_fkey(username, display_name)
    `
    )
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching invites:", error);
    return [];
  }

  return data as GameInviteWithUser[];
};

// Get sent invites for a user
export const getSentInvites = async (
  userId: string
): Promise<GameInviteWithUser[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_invites")
    .select(
      `
      *,
      from_user:user_profiles!game_invites_from_user_id_fkey(username, display_name),
      to_user:user_profiles!game_invites_to_user_id_fkey(username, display_name)
    `
    )
    .eq("from_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching sent invites:", error);
    return [];
  }

  return data as GameInviteWithUser[];
};

// Accept an invite
export const acceptInvite = async (inviteId: number): Promise<GameInvite> => {
  const supabase = createClient();
  const { data, error} = await supabase
    .from("game_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Decline an invite
export const declineInvite = async (inviteId: number): Promise<GameInvite> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_invites")
    .update({ status: "declined" })
    .eq("id", inviteId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Subscribe to invite updates
export const subscribeToInvites = (
  userId: string,
  callback: (invite: GameInvite) => void
): (() => void) => {
  const supabase = createClient();
  const channel = supabase
    .channel(`invites:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "game_invites",
        filter: `to_user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as GameInvite);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
