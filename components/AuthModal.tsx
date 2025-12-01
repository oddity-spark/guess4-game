"use client";

import { useAuth } from "@/contexts/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { signIn, loading } = useAuth();

  if (!isOpen) return null;

  const handleSignIn = async () => {
    await signIn();
    onSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sign In with Farcaster
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-center space-y-6">
          <div className="text-6xl">🎯</div>

          <p className="text-gray-600 dark:text-gray-300">
            Sign in with your Farcaster account to play Guess the Number with friends!
          </p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.24 0.24H5.76C2.58 0.24 0 2.82 0 6v12c0 3.18 2.58 5.76 5.76 5.76h12.48c3.18 0 5.76-2.58 5.76-5.76V6c0-3.18-2.58-5.76-5.76-5.76zm-1.44 14.4c0 2.58-2.1 4.68-4.68 4.68H7.44V4.68h4.68c2.58 0 4.68 2.1 4.68 4.68v5.28z"/>
                </svg>
                Sign in with Farcaster
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your Farcaster identity will be used as your game profile
          </p>
        </div>
      </div>
    </div>
  );
}
