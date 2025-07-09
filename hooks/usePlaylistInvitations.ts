// hooks/usePlaylistInvitations.ts
import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

export type PlaylistInvitation = {
  id: string;
  playlist_id: string;
  user_id: string;
  permission: "view" | "edit";
  invited_by: string;
  invited_at: string;
  playlist: {
    id: string;
    name: string;
    description: string | null;
    emoji: string;
    user_id: string;
    item_count: number;
  };
  invited_by_user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
};

export const usePlaylistInvitations = () => {
  const { profile } = useAuth();
  const [invitations, setInvitations] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch pending invitations for the current user
  const fetchInvitations = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("playlist_collaborators")
        .select(
          `
          id,
          playlist_id,
          user_id,
          permission,
          invited_by,
          invited_at,
          playlist:restaurant_playlists (
            id,
            name,
            description,
            emoji,
            user_id
          ),
          invited_by_user:profiles!playlist_collaborators_invited_by_fkey (
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("user_id", profile.id)
        .is("accepted_at", null)
        .order("invited_at", { ascending: false });

      if (error) throw error;

      // Fetch item counts for each playlist
      const playlistIds = data?.map((inv) => inv.playlist_id) || [];
      let itemCounts: Record<string, number> = {};

      if (playlistIds.length > 0) {
        const { data: itemCountData, error: countError } = await supabase
          .from("playlist_items")
          .select("playlist_id")
          .in("playlist_id", playlistIds);

        if (!countError && itemCountData) {
          itemCounts = itemCountData.reduce(
            (acc, item) => {
              acc[item.playlist_id] = (acc[item.playlist_id] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          );
        }
      }

      // Combine data with item counts
      const invitationsWithCounts = (data || []).map((inv) => ({
        ...inv,
        playlist: {
          ...inv.playlist,
          item_count: itemCounts[inv.playlist_id] || 0,
        },
      }));

      setInvitations(invitationsWithCounts);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      Alert.alert("Error", "Failed to load invitations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // Accept invitation
  const acceptInvitation = useCallback(
    async (invitationId: string): Promise<boolean> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const { error } = await supabase
          .from("playlist_collaborators")
          .update({
            accepted_at: new Date().toISOString(),
          })
          .eq("id", invitationId);

        if (error) throw error;

        // Remove from local state
        setInvitations((prev: any[]) =>
          prev.filter((inv: { id: string }) => inv.id !== invitationId),
        );

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        return true;
      } catch (error) {
        console.error("Error accepting invitation:", error);
        Alert.alert("Error", "Failed to accept invitation");
        return false;
      }
    },
    [],
  );

  // Reject invitation
  const rejectInvitation = useCallback(
    async (invitationId: string): Promise<boolean> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { error } = await supabase
          .from("playlist_collaborators")
          .delete()
          .eq("id", invitationId);

        if (error) throw error;

        // Remove from local state
        setInvitations((prev: any[]) =>
          prev.filter((inv: { id: string }) => inv.id !== invitationId),
        );

        return true;
      } catch (error) {
        console.error("Error rejecting invitation:", error);
        Alert.alert("Error", "Failed to reject invitation");
        return false;
      }
    },
    [],
  );

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInvitations();
  }, [fetchInvitations]);

  // Auto-fetch on mount and user change
  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return {
    invitations,
    loading,
    refreshing,
    fetchInvitations,
    acceptInvitation,
    rejectInvitation,
    handleRefresh,
    pendingCount: invitations.length,
  };
};
