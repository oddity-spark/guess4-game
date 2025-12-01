"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { UserProfile, getOrCreateProfile, getUserProfile } from "@/lib/auth";
import toast from "react-hot-toast";

export interface FarcasterUser {
  fid: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

interface AuthContextType {
  user: FarcasterUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const initAttempted = useRef(false);

  // Initialize auth from Farcaster context
  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const initializeAuth = async () => {
      try {
        console.log("🔵 AuthContext: Starting Farcaster initialization");

        // Check for stored user first (faster UX)
        const storedUser = localStorage.getItem("farcaster_user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser) as FarcasterUser;
            setUser(parsed);
            // Load profile in background
            getUserProfile(parsed.fid)
              .then(setProfile)
              .catch((err) => console.error("Failed to load stored profile:", err));
          } catch {
            localStorage.removeItem("farcaster_user");
          }
        }

        // Get fresh Farcaster context
        const context = await sdk.context;
        console.log("🔵 AuthContext: Farcaster context:", context);

        if (context?.user) {
          const farcasterUser: FarcasterUser = {
            fid: String(context.user.fid),
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          };

          console.log("🔵 AuthContext: Farcaster user found:", farcasterUser);
          setUser(farcasterUser);
          localStorage.setItem("farcaster_user", JSON.stringify(farcasterUser));

          // Get or create profile in database
          try {
            const userProfile = await getOrCreateProfile(
              farcasterUser.fid,
              farcasterUser.username || `user_${farcasterUser.fid}`,
              farcasterUser.displayName,
              farcasterUser.pfpUrl
            );
            setProfile(userProfile);
            console.log("🔵 AuthContext: Profile loaded/created:", userProfile);
          } catch (profileError) {
            console.error("❌ Failed to get/create profile:", profileError);
          }
        } else {
          console.log("🔵 AuthContext: No Farcaster user in context");
        }
      } catch (error) {
        console.error("❌ Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const handleSignIn = useCallback(async () => {
    setLoading(true);
    try {
      // Use quickAuth to get a verified JWT token
      const result = await sdk.experimental.quickAuth();

      if (!result?.token) {
        throw new Error("Failed to get authentication token");
      }

      // Verify the token with our backend
      const response = await fetch("/api/auth", {
        headers: {
          Authorization: `Bearer ${result.token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Authentication failed");
      }

      const data = await response.json();

      if (!data.success || !data.user?.fid) {
        throw new Error("Invalid authentication response");
      }

      // Get fresh context for user details
      const context = await sdk.context;

      const farcasterUser: FarcasterUser = {
        fid: String(data.user.fid),
        username: context?.user?.username,
        displayName: context?.user?.displayName,
        pfpUrl: context?.user?.pfpUrl,
      };

      setUser(farcasterUser);
      localStorage.setItem("farcaster_token", result.token);
      localStorage.setItem("farcaster_user", JSON.stringify(farcasterUser));

      // Get or create profile
      const userProfile = await getOrCreateProfile(
        farcasterUser.fid,
        farcasterUser.username || `user_${farcasterUser.fid}`,
        farcasterUser.displayName,
        farcasterUser.pfpUrl
      );
      setProfile(userProfile);

      toast.success("Signed in successfully!");
    } catch (error) {
      console.error("Sign in error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    localStorage.removeItem("farcaster_token");
    localStorage.removeItem("farcaster_user");
    setUser(null);
    setProfile(null);
    toast.success("Signed out successfully");
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      try {
        const userProfile = await getUserProfile(user.fid);
        setProfile(userProfile);
      } catch (error) {
        console.error("Failed to refresh profile:", error);
        toast.error("Failed to load profile data");
      }
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn: handleSignIn,
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
