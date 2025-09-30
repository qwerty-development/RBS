// hooks/usePlaylistSharing.ts
import { useState, useCallback } from "react";
import { Alert, Share } from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { PlaylistCollaborator } from "./usePlaylists";

export const usePlaylistSharing = (playlistId: string | null) => {
  const { profile } = useAuth();
  const [collaborators, setCollaborators] = useState<PlaylistCollaborator[]>(
    [],
  );
  const [pendingInvites, setPendingInvites] = useState<PlaylistCollaborator[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  // Fetch collaborators
  const fetchCollaborators = useCallback(async () => {
    if (!playlistId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("playlist_collaborators")
        .select(
          `
          *,
          user:profiles!playlist_collaborators_user_id_fkey (
            id,
            full_name,
            avatar_url
          ),
          invited_by_user:profiles!playlist_collaborators_invited_by_fkey (
            id,
            full_name
          )
        `,
        )
        .eq("playlist_id", playlistId)
        .order("invited_at", { ascending: false });

      if (error) throw error;

      const accepted = data?.filter((c) => c.accepted_at) || [];
      const pending = data?.filter((c) => !c.accepted_at) || [];

      setCollaborators(accepted);
      setPendingInvites(pending);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  // Make playlist public/private
  const togglePublicAccess = useCallback(
    async (
      isPublic: boolean,
    ): Promise<{ success: boolean; shareCode?: string }> => {
      if (!playlistId) return { success: false };

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const { data, error } = await supabase
          .from("restaurant_playlists")
          .update({
            is_public: isPublic,
            updated_at: new Date().toISOString(),
          })
          .eq("id", playlistId)
          .select("share_code")
          .single();

        if (error) throw error;

        return {
          success: true,
          shareCode: data?.share_code || undefined,
        };
      } catch (error) {
        console.error("Error toggling public access:", error);
        Alert.alert("Error", "Failed to update sharing settings");
        return { success: false };
      }
    },
    [playlistId],
  );

  // Share playlist link
  const sharePlaylist = useCallback(
    async (playlistName: string, shareCode: string): Promise<void> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const shareUrl = `https://yourapp.com/playlist/${shareCode}`;
        const message = `Check out my restaurant playlist "${playlistName}"!\n\n${shareUrl}`;

        await Share.share({
          message,
          title: `Restaurant Playlist: ${playlistName}`,
        });
      } catch (error) {
        console.error("Error sharing playlist:", error);
      }
    },
    [],
  );

  // Copy share link
  const copyShareLink = useCallback(
    async (shareCode: string): Promise<void> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const shareUrl = `https://yourapp.com/playlist/${shareCode}`;
        await Clipboard.setStringAsync(shareUrl);

        Alert.alert("Success", "Share link copied to clipboard!");
      } catch (error) {
        console.error("Error copying link:", error);
        Alert.alert("Error", "Failed to copy link");
      }
    },
    [],
  );

  // Invite collaborator
  const inviteCollaborator = useCallback(
    async (
      userId: string,
      permission: "view" | "edit" = "view",
    ): Promise<boolean> => {
      if (!profile?.id || !playlistId) return false;

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const { error } = await supabase.from("playlist_collaborators").insert({
          playlist_id: playlistId,
          user_id: userId,
          permission,
          invited_by: profile.id,
        });

        if (error) {
          if (error.code === "23505") {
            Alert.alert("Info", "User is already invited to this playlist");
            return false;
          }
          throw error;
        }

        await fetchCollaborators();
        return true;
      } catch (error) {
        console.error("Error inviting collaborator:", error);
        Alert.alert("Error", "Failed to send invitation");
        return false;
      }
    },
    [profile?.id, playlistId, fetchCollaborators],
  );

  // Accept collaboration invite
  const acceptInvite = useCallback(
    async (inviteId: string): Promise<boolean> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const { error } = await supabase
          .from("playlist_collaborators")
          .update({
            accepted_at: new Date().toISOString(),
          })
          .eq("id", inviteId);

        if (error) throw error;

        return true;
      } catch (error) {
        console.error("Error accepting invite:", error);
        Alert.alert("Error", "Failed to accept invitation");
        return false;
      }
    },
    [],
  );

  // Remove collaborator
  const removeCollaborator = useCallback(
    async (collaboratorId: string): Promise<boolean> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { error } = await supabase
          .from("playlist_collaborators")
          .delete()
          .eq("id", collaboratorId);

        if (error) throw error;

        setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
        setPendingInvites((prev) =>
          prev.filter((c) => c.id !== collaboratorId),
        );

        return true;
      } catch (error) {
        console.error("Error removing collaborator:", error);
        Alert.alert("Error", "Failed to remove collaborator");
        return false;
      }
    },
    [],
  );

  // Update collaborator permission
  const updateCollaboratorPermission = useCallback(
    async (
      collaboratorId: string,
      permission: "view" | "edit",
    ): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("playlist_collaborators")
          .update({ permission })
          .eq("id", collaboratorId);

        if (error) throw error;

        setCollaborators((prev) =>
          prev.map((c) => (c.id === collaboratorId ? { ...c, permission } : c)),
        );

        return true;
      } catch (error) {
        console.error("Error updating permission:", error);
        Alert.alert("Error", "Failed to update permission");
        return false;
      }
    },
    [],
  );

  // Join playlist by share code
  const joinPlaylistByCode = useCallback(
    async (
      shareCode: string,
    ): Promise<{ success: boolean; playlistId?: string }> => {
      if (!profile?.id) return { success: false };

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Find playlist by share code
        const { data: playlist, error: findError } = await supabase
          .from("restaurant_playlists")
          .select("id, name, user_id")
          .eq("share_code", shareCode.toUpperCase())
          .eq("is_public", true)
          .single();

        if (findError || !playlist) {
          Alert.alert("Error", "Invalid or expired share code");
          return { success: false };
        }

        // Check if user is already a collaborator or owner
        if (playlist.user_id === profile.id) {
          Alert.alert("Info", "You already own this playlist");
          return { success: true, playlistId: playlist.id };
        }

        const { data: existing } = await supabase
          .from("playlist_collaborators")
          .select("id")
          .eq("playlist_id", playlist.id)
          .eq("user_id", profile.id)
          .single();

        if (existing) {
          Alert.alert("Info", "You already have access to this playlist");
          return { success: true, playlistId: playlist.id };
        }

        // Add as collaborator with view permission
        const { error: addError } = await supabase
          .from("playlist_collaborators")
          .insert({
            playlist_id: playlist.id,
            user_id: profile.id,
            permission: "view",
            invited_by: playlist.user_id,
            accepted_at: new Date().toISOString(),
          });

        if (addError) throw addError;

        Alert.alert("Success", `You've joined the playlist "${playlist.name}"`);
        return { success: true, playlistId: playlist.id };
      } catch (error) {
        console.error("Error joining playlist:", error);
        Alert.alert("Error", "Failed to join playlist");
        return { success: false };
      }
    },
    [profile?.id],
  );

  // Leave playlist (for collaborators)
  const leavePlaylist = useCallback(
    async (playlistName: string): Promise<boolean> => {
      if (!profile?.id || !playlistId) {
        Alert.alert("Error", "Missing user or playlist information");
        return false;
      }

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { error } = await supabase
          .from("playlist_collaborators")
          .delete()
          .eq("playlist_id", playlistId)
          .eq("user_id", profile.id)
          .select();

        if (error) {
          console.error("Error leaving playlist:", error);

          // Check for RLS error
          if (
            error.message?.includes("policy") ||
            error.code === "42501" ||
            error.code === "PGRST301"
          ) {
            Alert.alert(
              "Permission Error",
              "You don't have permission to leave this playlist. Please contact support.",
            );
          } else {
            Alert.alert("Error", `Failed to leave playlist: ${error.message}`);
          }

          throw error;
        }

        Alert.alert(
          "Left Playlist",
          `You've left the playlist "${playlistName}"`,
        );
        return true;
      } catch (error: any) {
        console.error("Error leaving playlist:", error);
        return false;
      }
    },
    [profile?.id, playlistId],
  );

  return {
    collaborators,
    pendingInvites,
    loading,
    fetchCollaborators,
    togglePublicAccess,
    sharePlaylist,
    copyShareLink,
    inviteCollaborator,
    acceptInvite,
    removeCollaborator,
    updateCollaboratorPermission,
    joinPlaylistByCode,
    leavePlaylist,
  };
};
