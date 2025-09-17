import React, { createContext, useContext, ReactNode } from "react";
import { router } from "expo-router";
import { useDeepLink, type DeepLinkState } from "@/hooks/useDeepLink";
import { generateDeepLink, generateUniversalLink } from "@/lib/deeplink";

interface DeepLinkContextType {
  // State
  state: DeepLinkState;
  isAuthenticated: boolean;

  // Actions
  handleDeepLink: (url: string) => Promise<boolean>;
  clearCache: () => void;

  // Utilities
  isUrlSupported: (url: string) => boolean;
  generateAppLink: (path: string) => string;
  generateWebLink: (path: string) => string;
  shareLink: (path: string, preferUniversal?: boolean) => string;
}

const DeepLinkContext = createContext<DeepLinkContextType | null>(null);

interface DeepLinkProviderProps {
  children: ReactNode;
  isSplashVisible?: boolean;
  onSplashDismissRequested?: () => void;
}

export function DeepLinkProvider({
  children,
  isSplashVisible = false,
  onSplashDismissRequested,
}: DeepLinkProviderProps) {
  const { state, isAuthenticated, handleDeepLink, clearCache, isUrlSupported } =
    useDeepLink({
      autoHandle: true,
      fallbackPath: "/",
      enableLogging: __DEV__,
      processDelay: 1500, // Allow time for auth to initialize
      isSplashVisible,
      onSplashDismissRequested,

      onAuthRequired: (url) => {
        console.log(
          "Deep link requires authentication, redirecting to sign-in:",
          url,
        );
        // Store the intended URL in a way that can be retrieved after sign-in
        // For now, just navigate to sign-in
        try {
          router.push("/sign-in");
        } catch (error) {
          console.warn("Failed to navigate to sign-in:", error);
        }
      },

      onNavigationSuccess: (url, path) => {
        console.log("Deep link navigation successful:", url, "→", path);
      },

      onNavigationError: (url, error) => {
        console.error("Deep link navigation error:", url, error);
        // Optionally show user-friendly error message
      },
    });

  // Generate app-specific deep link
  const generateAppLink = (path: string): string => {
    return generateDeepLink(path, "plate");
  };

  // Generate universal web link
  const generateWebLink = (path: string): string => {
    return generateUniversalLink(path, "plate-app.com");
  };

  // Generate shareable link (prefers universal links)
  const shareLink = (path: string, preferUniversal: boolean = true): string => {
    if (preferUniversal) {
      return generateWebLink(path);
    }
    return generateAppLink(path);
  };

  const contextValue: DeepLinkContextType = {
    // State
    state,
    isAuthenticated,

    // Actions
    handleDeepLink,
    clearCache,

    // Utilities
    isUrlSupported,
    generateAppLink,
    generateWebLink,
    shareLink,
  };

  return (
    <DeepLinkContext.Provider value={contextValue}>
      {children}
    </DeepLinkContext.Provider>
  );
}

export function useDeepLinkContext(): DeepLinkContextType {
  const context = useContext(DeepLinkContext);

  if (!context) {
    throw new Error(
      "useDeepLinkContext must be used within a DeepLinkProvider",
    );
  }

  return context;
}

// Convenience hook for generating links
export function useShareableLinks() {
  const { generateAppLink, generateWebLink, shareLink } = useDeepLinkContext();

  return {
    // Generate restaurant links
    getRestaurantLink: (restaurantId: string, preferUniversal?: boolean) =>
      shareLink(`/restaurant/${restaurantId}`, preferUniversal),

    getRestaurantMenuLink: (restaurantId: string, preferUniversal?: boolean) =>
      shareLink(`/restaurant/${restaurantId}/menu`, preferUniversal),

    getRestaurantReviewsLink: (
      restaurantId: string,
      preferUniversal?: boolean,
    ) => shareLink(`/restaurant/${restaurantId}/reviews`, preferUniversal),

    // Generate booking links
    getBookingLink: (bookingId: string, preferUniversal?: boolean) =>
      shareLink(`/booking/${bookingId}`, preferUniversal),

    // Generate playlist links
    getPlaylistLink: (playlistId: string, preferUniversal?: boolean) =>
      shareLink(`/playlist/${playlistId}`, preferUniversal),

    getPlaylistJoinLink: (code: string, preferUniversal?: boolean) =>
      shareLink(`/playlist/join/${code}`, preferUniversal),

    // Generate social links
    getSocialPostLink: (postId: string, preferUniversal?: boolean) =>
      shareLink(`/social/post/${postId}`, preferUniversal),

    getUserProfileLink: (userId: string, preferUniversal?: boolean) =>
      shareLink(`/social/profile/${userId}`, preferUniversal),

    // Generate cuisine links
    getCuisineLink: (cuisineId: string, preferUniversal?: boolean) =>
      shareLink(`/cuisine/${cuisineId}`, preferUniversal),

    // Generic link generation
    generateAppLink,
    generateWebLink,
    shareLink,
  };
}
