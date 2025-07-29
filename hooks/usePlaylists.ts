// hooks/usePlaylists.ts
import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

export type Playlist = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  emoji: string;
  is_public: boolean;
  share_code: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  item_count?: number;
  collaborator_count?: number;
  last_updated?: string;
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
};

export type PlaylistItem = {
  id: string;
  playlist_id: string;
  restaurant_id: string;
  added_by: string;
  position: number;
  note: string | null;
  created_at: string;
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
  added_by_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
};

export type PlaylistCollaborator = {
  id: string;
  playlist_id: string;
  user_id: string;
  permission: "view" | "edit";
  invited_by: string;
  invited_at: string;
  accepted_at: string | null;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  invited_by_user?: {
    id: string;
    full_name: string;
  };
};

export const usePlaylists = () => {
  const { profile } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all playlists (own, collaborative, and public)
  const fetchPlaylists = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Fetch user's own playlists with stats
      const { data: ownPlaylists, error: ownError } = await supabase
        .from("playlist_stats")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (ownError) throw ownError;

      // Fetch playlists user collaborates on (get playlist IDs first)
      const { data: collaborations, error: collabError } = await supabase
        .from("playlist_collaborators")
        .select("playlist_id, permission, accepted_at")
        .eq("user_id", profile.id)
        .not("accepted_at", "is", null);

      if (collabError) throw collabError;

      let collaborativePlaylists: any[] = [];

      if (collaborations && collaborations.length > 0) {
        // Get the playlist IDs
        const collaborativePlaylistIds = collaborations.map(
          (c) => c.playlist_id,
        );

        // Fetch full playlist data with stats for collaborative playlists
        const { data: collabPlaylistsData, error: collabPlaylistsError } =
          await supabase
            .from("playlist_stats")
            .select("*")
            .in("id", collaborativePlaylistIds)
            .order("created_at", { ascending: false });

        if (collabPlaylistsError) throw collabPlaylistsError;

        // Fetch owner data for collaborative playlists
        const ownerIds = [
          ...new Set(collabPlaylistsData?.map((p) => p.user_id) || []),
        ];
        let ownersData: any[] = [];

        if (ownerIds.length > 0) {
          const { data: owners, error: ownersError } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", ownerIds);

          if (ownersError) throw ownersError;
          ownersData = owners || [];
        }

        if (collabPlaylistsError) throw collabPlaylistsError;

        // Add collaborative metadata to each playlist
        collaborativePlaylists = (collabPlaylistsData || []).map((playlist) => {
          const collaboration = collaborations.find(
            (c) => c.playlist_id === playlist.id,
          );
          const owner = ownersData.find((o) => o.id === playlist.user_id);
          return {
            ...playlist,
            is_collaborative: true,
            user_permission: collaboration?.permission,
            owner: owner || null,
          };
        });
      }

      // Combine and deduplicate playlists
      const allPlaylists = [...(ownPlaylists || []), ...collaborativePlaylists];

      // Remove duplicates (in case user owns and collaborates on same playlist)
      const uniquePlaylists = Array.from(
        new Map(allPlaylists.map((p) => [p.id, p])).values(),
      );

      setPlaylists(uniquePlaylists as Playlist[]);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      Alert.alert("Error", "Failed to load playlists");
      setError(String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // Create a new playlist
  const createPlaylist = useCallback(
    async (
      name: string,
      description?: string,
      emoji: string = "📍",
    ): Promise<Playlist | null> => {
      if (!profile?.id) return null;

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const { data, error } = await supabase
          .from("restaurant_playlists")
          .insert({
            user_id: profile.id,
            name: name.trim(),
            description: description?.trim() || null,
            emoji,
          })
          .select()
          .single();

        if (error) throw error;

        await fetchPlaylists();
        return data;
      } catch (error) {
        console.error("Error creating playlist:", error);
        Alert.alert("Error", "Failed to create playlist");
        setError("Failed to create playlist");
        return null;
      }
    },
    [profile?.id, fetchPlaylists],
  );

  // Update playlist details
  const updatePlaylist = useCallback(
    async (
      playlistId: string,
      updates: Partial<
        Pick<Playlist, "name" | "description" | "emoji" | "is_public">
      >,
    ): Promise<boolean> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const { error } = await supabase
          .from("restaurant_playlists")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", playlistId);

        if (error) throw error;

        await fetchPlaylists();
        return true;
      } catch (error) {
        console.error("Error updating playlist:", error);
        Alert.alert("Error", "Failed to update playlist");
        setError("Failed to update playlist");
        return false;
      }
    },
    [fetchPlaylists],
  );

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlaylists();
  }, [fetchPlaylists]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // ONLY ADD THIS ONE FUNCTION to your existing usePlaylists hook:

  const removePlaylistFromState = useCallback((playlistId: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  }, []);

  // ... keep all your existing functions (fetchPlaylists, createPlaylist, etc.) ...

  return {
    playlists,
    loading,
    refreshing,
    fetchPlaylists,
    createPlaylist,
    updatePlaylist,
    handleRefresh,
    removePlaylistFromState, // ADD this to your return statement
    error,
  };
};
