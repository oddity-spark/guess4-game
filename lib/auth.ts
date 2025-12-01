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

// Sign up with email and password
export const signUp = async (
  email: string,
  password: string,
  username: string,
  displayName?: string
) => {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: displayName || username,
      },
    },
  });

  if (error) throw error;
  return data;
};

// Sign in with email and password
export const signIn = async (email: string, password: string) => {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

// Sign out
export const signOut = async () => {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Get current user
export const getCurrentUser = async () => {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
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
      console.error("❌ Error fetching user profile:", error);
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    if (!data) {
      console.error("❌ No profile data returned for user:", userId);
      throw new Error("Profile not found");
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
