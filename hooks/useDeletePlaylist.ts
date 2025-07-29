import { useState, useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { playlistEventEmitter, PLAYLIST_EVENTS } from "@/lib/eventEmitter";

interface UseDeletePlaylistOptions {
  onSuccess?: (playlistId: string) => void;
  onError?: (error: Error) => void;
}

export const useDeletePlaylist = (options?: UseDeletePlaylistOptions) => {
  const { profile } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const deletePlaylist = useCallback(
    async (playlistId: string, playlistName: string): Promise<boolean> => {
      if (!profile?.id) {
        Alert.alert("Error", "You must be logged in to delete playlists");
        return false;
      }

      return new Promise((resolve) => {
        Alert.alert(
          "Delete Playlist",
          `Are you sure you want to delete "${playlistName}"? This action cannot be undone.`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => resolve(false),
            },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                try {
                  setIsDeleting(true);
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

                  // First verify the user owns this playlist
                  const { data: playlistData, error: fetchError } =
                    await supabase
                      .from("restaurant_playlists")
                      .select("user_id")
                      .eq("id", playlistId)
                      .single();

                  if (fetchError) throw fetchError;

                  if (playlistData.user_id !== profile.id) {
                    throw new Error(
                      "You don't have permission to delete this playlist",
                    );
                  }

                  // Delete the playlist (cascade will handle related data)
                  const { error: deleteError } = await supabase
                    .from("restaurant_playlists")
                    .delete()
                    .eq("id", playlistId)
                    .eq("user_id", profile.id); // Extra safety check

                  if (deleteError) throw deleteError;

                  // Emit event to notify all components about playlist deletion
                  playlistEventEmitter.emit(PLAYLIST_EVENTS.DELETED, {
                    playlistId,
                    playlistName,
                  });

                  await Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );

                  if (options?.onSuccess) {
                    options.onSuccess(playlistId);
                  }

                  resolve(true);
                } catch (error: any) {
                  console.error("Error deleting playlist:", error);

                  const errorMessage =
                    error.message || "Failed to delete playlist";
                  Alert.alert("Error", errorMessage);

                  if (options?.onError) {
                    options.onError(error);
                  }

                  resolve(false);
                } finally {
                  setIsDeleting(false);
                }
              },
            },
          ],
        );
      });
    },
    [profile?.id, options],
  );

  const deletePlaylistSilent = useCallback(
    async (playlistId: string): Promise<boolean> => {
      if (!profile?.id) return false;

      try {
        setIsDeleting(true);

        // Verify ownership
        const { data: playlistData, error: fetchError } = await supabase
          .from("restaurant_playlists")
          .select("user_id")
          .eq("id", playlistId)
          .single();

        if (fetchError) throw fetchError;

        if (playlistData.user_id !== profile.id) {
          throw new Error("You don't have permission to delete this playlist");
        }

        // Delete the playlist
        const { error: deleteError } = await supabase
          .from("restaurant_playlists")
          .delete()
          .eq("id", playlistId)
          .eq("user_id", profile.id);

        if (deleteError) throw deleteError;

        // Emit event to notify all components about playlist deletion
        playlistEventEmitter.emit(PLAYLIST_EVENTS.DELETED, {
          playlistId,
        });

        if (options?.onSuccess) {
          options.onSuccess(playlistId);
        }

        return true;
      } catch (error: any) {
        console.error("Error deleting playlist silently:", error);

        if (options?.onError) {
          options.onError(error);
        }

        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [profile?.id, options],
  );

  return {
    deletePlaylist,
    deletePlaylistSilent,
    isDeleting,
  };
};
