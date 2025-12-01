import { createClient } from "@/utils/supabase/client";

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserStats {
  user_id: string;
  total_games: number;
  games_won: number;
  games_lost: number;
  games_tied: number;
  total_guesses: number;
  best_guess_count: number | null;
  current_streak: number;
  longest_streak: number;
  last_played_at: string | null;
}

// Get or create user profile (for Farcaster auth)
export const getOrCreateProfile = async (
  fid: string,
  username: string,
  displayName?: string,
  avatarUrl?: string
): Promise<UserProfile> => {
  const supabase = createClient();
  console.log("👤 getOrCreateProfile: Looking for FID:", fid);

  // First, try to get existing profile
  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", fid)
    .single();

  if (existingProfile) {
    console.log("👤 getOrCreateProfile: Found existing profile:", existingProfile);

    // Update profile if Farcaster data changed
    if (
      existingProfile.username !== username ||
      existingProfile.display_name !== (displayName || username) ||
      existingProfile.avatar_url !== avatarUrl
    ) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("user_profiles")
        .update({
          username,
          display_name: displayName || username,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fid)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Failed to update profile:", updateError);
        return existingProfile;
      }

      console.log("👤 getOrCreateProfile: Updated profile:", updatedProfile);
      return updatedProfile;
    }

    return existingProfile;
  }

  // Profile doesn't exist, create it
  console.log("👤 getOrCreateProfile: Creating new profile for FID:", fid);

  const { data: newProfile, error: createError } = await supabase
    .from("user_profiles")
    .insert({
      id: fid,
      username,
      display_name: displayName || username,
      avatar_url: avatarUrl,
    })
    .select()
    .single();

  if (createError) {
    console.error("❌ Failed to create profile:", createError);
    throw new Error(`Failed to create user profile: ${createError.message}`);
  }

  // Also create user stats record
  const { error: statsError } = await supabase
    .from("user_stats")
    .insert({ user_id: fid })
    .single();

  if (statsError && statsError.code !== "23505") {
    // Ignore duplicate key error
    console.error("❌ Failed to create stats:", statsError);
  }

  console.log("✅ getOrCreateProfile: Created new profile:", newProfile);
  return newProfile;
};

// Get user profile
export const getUserProfile = async (
  userId: string
): Promise<UserProfile | null> => {
  const supabase = createClient();
  console.log("👤 getUserProfile: Fetching profile for user:", userId);

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    console.log("👤 getUserProfile: Result:", { data, error, hasData: !!data });

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned - profile doesn't exist
        console.log("👤 getUserProfile: Profile not found for user:", userId);
        return null;
      }
      console.error("❌ Error fetching user profile:", error);
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    console.log("✅ getUserProfile: Profile fetched successfully:", data);
    return data;
  } catch (err) {
    console.error("❌ getUserProfile: Caught exception:", err);
    throw err;
  }
};

// Get user stats
export const getUserStats = async (
  userId: string
): Promise<UserStats | null> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user stats:", error);
    throw new Error(`Failed to fetch user stats: ${error.message}`);
  }

  // Return null if no stats found (new user)
  return data;
};

// Search users by username
export const searchUsers = async (query: string): Promise<UserProfile[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .ilike("username", `%${query}%`)
    .limit(10);

  if (error) {
    console.error("Error searching users:", error);
    return [];
  }

  return data || [];
};

// Update user profile
export const updateUserProfile = async (
  userId: string,
  updates: Partial<Omit<UserProfile, "id" | "created_at">>
) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Check if username is available
export const isUsernameAvailable = async (
  username: string
): Promise<boolean> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("username")
    .eq("username", username)
    .single();

  // If no data found, username is available
  return !data && error?.code === "PGRST116";
};

// Get leaderboard
export const getLeaderboard = async (
  orderBy: "games_won" | "win_rate" | "longest_streak" = "games_won",
  limit: number = 10
) => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_limit: limit,
    p_order_by: orderBy,
  });

  if (error) {
    console.error("Error fetching leaderboard:", error);
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }

  return data || [];
};
