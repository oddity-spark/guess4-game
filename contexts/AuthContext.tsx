"use client";

import { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { UserProfile, getUserProfile } from "@/lib/auth";
import toast from "react-hot-toast";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const hasShownSignInToast = useRef(false);
  const isInitialMount = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  const refreshProfile = async () => {
    if (user) {
      try {
        const userProfile = await getUserProfile(user.id);
        setProfile(userProfile);
      } catch (error) {
        console.error("Failed to refresh profile:", error);
        toast.error("Failed to load profile data");
      }
    }
  };

  useEffect(() => {
    console.log("🔵 AuthContext: Starting initialization");

    // Get initial session with getUser() instead of getSession()
    const initializeAuth = async () => {
      try {
        console.log("🔵 AuthContext: Calling supabase.auth.getUser()");
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        console.log("🔵 AuthContext: getUser result:", {
          hasUser: !!user,
          error,
        });

        if (error) {
          console.error("❌ Auth error:", error);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(user);

        // Fetch profile AFTER setting user
        if (user) {
          console.log("🔵 AuthContext: Fetching user profile for:", user.id);
          getUserProfile(user.id)
            .then((userProfile) => {
              console.log("🔵 AuthContext: Profile fetched:", userProfile);
              setProfile(userProfile);
            })
            .catch((profileError) => {
              console.error("❌ Profile error:", profileError);
              // Don't show error for missing profile - user might be in signup flow
            });
        } else {
          console.log("🔵 AuthContext: No user found");
        }
      } catch (error) {
        console.error("❌ Auth initialization error:", error);
        toast.error("Failed to initialize authentication");
      } finally {
        console.log("🔵 AuthContext: Initialization complete");
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes - DO NOT make async calls inside this callback
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔵 Auth state changed:", event);

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Skip toasts on initial mount (INITIAL_SESSION event)
      if (isInitialMount.current && event === "INITIAL_SESSION") {
        isInitialMount.current = false;
        // Silently load profile if user exists
        if (currentUser) {
          getUserProfile(currentUser.id)
            .then(setProfile)
            .catch((error) => console.error("Failed to load profile:", error));
        }
        return;
      }

      // Handle different auth events
      if (event === "SIGNED_OUT") {
        setProfile(null);
        hasShownSignInToast.current = false;
        toast.success("Signed out successfully");
      } else if (event === "SIGNED_IN") {
        // Only show toast for actual new sign-ins, not token refreshes or tab switches
        if (!hasShownSignInToast.current) {
          toast.success("Signed in successfully!");
          hasShownSignInToast.current = true;
        }
        // Fetch profile OUTSIDE the callback
        if (currentUser) {
          getUserProfile(currentUser.id)
            .then(setProfile)
            .catch((error) => console.error("Failed to load profile:", error));
        }
      } else if (event === "TOKEN_REFRESHED") {
        // Silently refresh profile
        if (currentUser) {
          getUserProfile(currentUser.id)
            .then(setProfile)
            .catch((error) => console.error("Failed to refresh profile:", error));
        }
      } else if (event === "USER_UPDATED") {
        if (currentUser) {
          getUserProfile(currentUser.id)
            .then(setProfile)
            .catch((error) => console.error("Failed to update profile:", error));
        }
      } else {
        // For other events, update profile if user exists
        if (currentUser) {
          getUserProfile(currentUser.id)
            .then(setProfile)
            .catch((error) => console.error("Profile error:", error));
        } else {
          setProfile(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sign out");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
