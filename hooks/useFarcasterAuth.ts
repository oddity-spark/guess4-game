"use client";

import { useState, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";

export interface FarcasterUser {
  fid: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

interface UseFarcasterAuthReturn {
  signIn: () => Promise<FarcasterUser | null>;
  signOut: () => void;
  isSigningIn: boolean;
  error: string | null;
}

export function useFarcasterAuth(): UseFarcasterAuthReturn {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (): Promise<FarcasterUser | null> => {
    setIsSigningIn(true);
    setError(null);

    try {
      // Get the Farcaster context from the SDK
      const context = await sdk.context;

      if (!context?.user) {
        throw new Error("No Farcaster user context available");
      }

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

      // Build the user object from Farcaster context
      const user: FarcasterUser = {
        fid: String(data.user.fid),
        username: context.user.username,
        displayName: context.user.displayName,
        pfpUrl: context.user.pfpUrl,
      };

      // Store token for future requests
      localStorage.setItem("farcaster_token", result.token);
      localStorage.setItem("farcaster_user", JSON.stringify(user));

      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      console.error("Farcaster auth error:", err);
      return null;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("farcaster_token");
    localStorage.removeItem("farcaster_user");
  }, []);

  return {
    signIn,
    signOut,
    isSigningIn,
    error,
  };
}
