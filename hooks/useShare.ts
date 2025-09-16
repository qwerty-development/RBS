import { useCallback } from "react";
import { Alert, Share, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useShareableLinks } from "@/context/deeplink-provider";

export interface ShareOptions {
  title?: string;
  message?: string;
  url?: string;
  dialogTitle?: string;
  subject?: string;
}

export interface UseShareReturn {
  // Core sharing functions
  shareGeneric: (options: ShareOptions) => Promise<boolean>;
  shareText: (text: string, title?: string) => Promise<boolean>;
  shareUrl: (url: string, title?: string, message?: string) => Promise<boolean>;

  // Content-specific sharing functions
  shareRestaurant: (
    restaurantId: string,
    restaurantName?: string,
  ) => Promise<boolean>;
  shareRestaurantMenu: (
    restaurantId: string,
    restaurantName?: string,
  ) => Promise<boolean>;
  shareBooking: (
    bookingId: string,
    restaurantName?: string,
  ) => Promise<boolean>;
  sharePlaylist: (
    playlistId: string,
    playlistName?: string,
  ) => Promise<boolean>;
  sharePlaylistJoin: (
    joinCode: string,
    playlistName?: string,
  ) => Promise<boolean>;
  shareSocialPost: (postId: string, postContent?: string) => Promise<boolean>;

  // Utility functions
  copyToClipboard: (text: string, feedbackMessage?: string) => Promise<void>;
  getShareableLink: (path: string, preferUniversal?: boolean) => string;
}

export function useShare(): UseShareReturn {
  const {
    getRestaurantLink,
    getRestaurantMenuLink,
    getBookingLink,
    getPlaylistLink,
    getPlaylistJoinLink,
    getSocialPostLink,
    shareLink,
  } = useShareableLinks();

  // Generic share function
  const shareGeneric = useCallback(
    async (options: ShareOptions): Promise<boolean> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (!options.url && !options.message) {
          throw new Error("Either URL or message must be provided");
        }

        const shareOptions: any = {
          title: options.title || "Check this out!",
          message:
            Platform.OS === "ios"
              ? options.message || options.url || ""
              : `${options.message || ""} ${options.url || ""}`.trim(),
          url: Platform.OS === "ios" ? options.url : undefined,
        };

        if (options.subject) {
          shareOptions.subject = options.subject;
        }

        const result = await Share.share(shareOptions, {
          dialogTitle: options.dialogTitle || "Share",
          subject: options.subject,
        });

        if (result.action === Share.sharedAction) {
          return true;
        } else if (result.action === Share.dismissedAction) {
          return false;
        }

        return false;
      } catch (error) {
        console.error("Share error:", error);

        // Fallback to clipboard if share fails
        if (options.url) {
          try {
            await copyToClipboard(options.url, "Link copied to clipboard");
            return true;
          } catch (clipboardError) {
            console.error("Clipboard fallback error:", clipboardError);
          }
        }

        Alert.alert(
          "Share Failed",
          "Unable to share at this time. Please try again later.",
          [{ text: "OK" }],
        );
        return false;
      }
    },
    [],
  );

  // Share plain text
  const shareText = useCallback(
    async (text: string, title?: string): Promise<boolean> => {
      return shareGeneric({
        message: text,
        title: title || "Share",
      });
    },
    [shareGeneric],
  );

  // Share URL with optional message
  const shareUrl = useCallback(
    async (url: string, title?: string, message?: string): Promise<boolean> => {
      return shareGeneric({
        url,
        title: title || "Check this out!",
        message,
      });
    },
    [shareGeneric],
  );

  // Share restaurant
  const shareRestaurant = useCallback(
    async (restaurantId: string, restaurantName?: string): Promise<boolean> => {
      const url = getRestaurantLink(restaurantId, true);
      const message = restaurantName
        ? `Check out ${restaurantName} on Plate!`
        : "Check out this restaurant on Plate!";

      return shareGeneric({
        url,
        title: restaurantName || "Restaurant",
        message,
        subject: `${restaurantName || "Restaurant"} - Plate`,
      });
    },
    [getRestaurantLink, shareGeneric],
  );

  // Share restaurant menu
  const shareRestaurantMenu = useCallback(
    async (restaurantId: string, restaurantName?: string): Promise<boolean> => {
      const url = getRestaurantMenuLink(restaurantId, true);
      const message = restaurantName
        ? `Check out the menu at ${restaurantName} on Plate!`
        : "Check out this restaurant menu on Plate!";

      return shareGeneric({
        url,
        title: restaurantName ? `${restaurantName} Menu` : "Restaurant Menu",
        message,
        subject: `Menu - ${restaurantName || "Restaurant"} - Plate`,
      });
    },
    [getRestaurantMenuLink, shareGeneric],
  );

  // Share booking
  const shareBooking = useCallback(
    async (bookingId: string, restaurantName?: string): Promise<boolean> => {
      const url = getBookingLink(bookingId, true);
      const message = restaurantName
        ? `See my reservation at ${restaurantName} on Plate!`
        : "See my reservation on Plate!";

      return shareGeneric({
        url,
        title: "My Reservation",
        message,
        subject: `Reservation - ${restaurantName || "Restaurant"} - Plate`,
      });
    },
    [getBookingLink, shareGeneric],
  );

  // Share playlist
  const sharePlaylist = useCallback(
    async (playlistId: string, playlistName?: string): Promise<boolean> => {
      const url = getPlaylistLink(playlistId, true);
      const message = playlistName
        ? `Check out my "${playlistName}" playlist on Plate!`
        : "Check out my restaurant playlist on Plate!";

      return shareGeneric({
        url,
        title: playlistName || "My Playlist",
        message,
        subject: `Playlist - ${playlistName || "My Playlist"} - Plate`,
      });
    },
    [getPlaylistLink, shareGeneric],
  );

  // Share playlist join code
  const sharePlaylistJoin = useCallback(
    async (joinCode: string, playlistName?: string): Promise<boolean> => {
      const url = getPlaylistJoinLink(joinCode, true);
      const message = playlistName
        ? `Join my "${playlistName}" playlist on Plate! Use code: ${joinCode}`
        : `Join my restaurant playlist on Plate! Use code: ${joinCode}`;

      return shareGeneric({
        url,
        title: playlistName ? `Join "${playlistName}"` : "Join My Playlist",
        message,
        subject: `Join Playlist - ${playlistName || "Restaurant Playlist"} - Plate`,
      });
    },
    [getPlaylistJoinLink, shareGeneric],
  );

  // Share social post
  const shareSocialPost = useCallback(
    async (postId: string, postContent?: string): Promise<boolean> => {
      const url = getSocialPostLink(postId, true);
      const previewContent = postContent
        ? postContent.substring(0, 100) +
          (postContent.length > 100 ? "..." : "")
        : "";
      const message = previewContent
        ? `Check out this post on Plate: "${previewContent}"`
        : "Check out this post on Plate!";

      return shareGeneric({
        url,
        title: "Social Post",
        message,
        subject: "Social Post - Plate",
      });
    },
    [getSocialPostLink, shareGeneric],
  );

  // Copy to clipboard with feedback
  const copyToClipboard = useCallback(
    async (text: string, feedbackMessage?: string): Promise<void> => {
      try {
        await Clipboard.setStringAsync(text);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        // Show user feedback
        Alert.alert("Copied!", feedbackMessage || "Copied to clipboard", [
          { text: "OK" },
        ]);
      } catch (error) {
        console.error("Clipboard error:", error);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        Alert.alert("Copy Failed", "Unable to copy to clipboard", [
          { text: "OK" },
        ]);
      }
    },
    [],
  );

  // Get shareable link for any path
  const getShareableLink = useCallback(
    (path: string, preferUniversal: boolean = true): string => {
      return shareLink(path, preferUniversal);
    },
    [shareLink],
  );

  return {
    // Core sharing functions
    shareGeneric,
    shareText,
    shareUrl,

    // Content-specific sharing functions
    shareRestaurant,
    shareRestaurantMenu,
    shareBooking,
    sharePlaylist,
    sharePlaylistJoin,
    shareSocialPost,

    // Utility functions
    copyToClipboard,
    getShareableLink,
  };
}

export default useShare;
