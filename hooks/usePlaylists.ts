// hooks/usePlaylists.ts
import { useState, useCallback, useEffect, useRef } from "react";
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
  
  // Use ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Fetch all playlists (own, collaborative, and public)
  const fetchPlaylists = useCallback(async () => {
    if (!profile?.id) return;

    try {
      console.log("🎵 [usePlaylists] Starting to fetch playlists for user:", profile.id);
      
      // Fetch user's own playlists
      const { data: ownPlaylists, error: ownError } = await supabase
        .from("restaurant_playlists")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (ownError) {
        console.error("❌ [usePlaylists] Error fetching own playlists:", ownError);
        throw ownError;
      }

      console.log("✅ [usePlaylists] Fetched own playlists:", ownPlaylists);

      // Fetch playlists user collaborates on (get playlist IDs first)
      const { data: collaborations, error: collabError } = await supabase
        .from("playlist_collaborators")
        .select("playlist_id, permission, accepted_at")
        .eq("user_id", profile.id)
        .not("accepted_at", "is", null);

      if (collabError) {
        console.error("❌ [usePlaylists] Error fetching collaborations:", collabError);
        throw collabError;
      }

      console.log("✅ [usePlaylists] Fetched collaborations:", collaborations);

      let collaborativePlaylists: any[] = [];

      if (collaborations && collaborations.length > 0) {
        // Get the playlist IDs
        const collaborativePlaylistIds = collaborations.map(
          (c) => c.playlist_id,
        );

        console.log("🔗 [usePlaylists] Collaborative playlist IDs:", collaborativePlaylistIds);

        // Fetch full playlist data for collaborative playlists
        const { data: collabPlaylistsData, error: collabPlaylistsError } =
          await supabase
            .from("restaurant_playlists")
            .select("*")
            .in("id", collaborativePlaylistIds)
            .order("created_at", { ascending: false });

        if (collabPlaylistsError) {
          console.error("❌ [usePlaylists] Error fetching collaborative playlists:", collabPlaylistsError);
          throw collabPlaylistsError;
        }

        console.log("✅ [usePlaylists] Fetched collaborative playlists data:", collabPlaylistsData);

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

          if (ownersError) {
            console.error("❌ [usePlaylists] Error fetching owners:", ownersError);
            throw ownersError;
          }
          ownersData = owners || [];
          console.log("✅ [usePlaylists] Fetched owners data:", ownersData);
        }

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

        console.log("✅ [usePlaylists] Processed collaborative playlists:", collaborativePlaylists);
      }

      // Combine and deduplicate playlists
      const allPlaylists = [...(ownPlaylists || []), ...collaborativePlaylists];
      console.log("🔄 [usePlaylists] Combined all playlists:", allPlaylists);

      // Remove duplicates (in case user owns and collaborates on same playlist)
      const uniquePlaylists = Array.from(
        new Map(allPlaylists.map((p) => [p.id, p])).values(),
      );

      console.log("🔄 [usePlaylists] Unique playlists before stats:", uniquePlaylists);

      // Fetch item counts and collaborator counts for all playlists
      const playlistsWithStats = await Promise.all(
        uniquePlaylists.map(async (playlist, index) => {
          try {
            console.log(`📊 [usePlaylists] Fetching stats for playlist ${index + 1}/${uniquePlaylists.length}:`, {
              id: playlist.id,
              name: playlist.name
            });

            // Get item count
            const { count: itemCount, error: itemError } = await supabase
              .from("playlist_items")
              .select("*", { count: "exact", head: true })
              .eq("playlist_id", playlist.id);

            if (itemError) {
              console.error(`❌ [usePlaylists] Error fetching item count for playlist ${playlist.id}:`, itemError);
            } else {
              console.log(`✅ [usePlaylists] Item count for playlist ${playlist.id}:`, itemCount);
            }

            // Get collaborator count
            const { count: collaboratorCount, error: collabError } = await supabase
              .from("playlist_collaborators")
              .select("*", { count: "exact", head: true })
              .eq("playlist_id", playlist.id)
              .not("accepted_at", "is", null);

            if (collabError) {
              console.error(`❌ [usePlaylists] Error fetching collaborator count for playlist ${playlist.id}:`, collabError);
            } else {
              console.log(`✅ [usePlaylists] Collaborator count for playlist ${playlist.id}:`, collaboratorCount);
            }

            const playlistWithStats = {
              ...playlist,
              item_count: itemCount || 0,
              collaborator_count: collaboratorCount || 0,
            };

            console.log(`🎯 [usePlaylists] Final playlist data for ${playlist.name}:`, playlistWithStats);
            return playlistWithStats;
          } catch (statsError) {
            console.error(`💥 [usePlaylists] Error fetching stats for playlist ${playlist.id}:`, statsError);
            // Return playlist with default stats if there's an error
            const fallbackPlaylist = {
              ...playlist,
              item_count: 0,
              collaborator_count: 0,
            };
            console.log(`🔄 [usePlaylists] Using fallback data for ${playlist.name}:`, fallbackPlaylist);
            return fallbackPlaylist;
          }
        })
      );

      console.log("🎉 [usePlaylists] Final playlists with stats:", playlistsWithStats);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setPlaylists(playlistsWithStats as Playlist[]);
        setError(null); // Clear any previous errors
        console.log("✅ [usePlaylists] Successfully updated playlists state");
      }
    } catch (error) {
      console.error("💥 [usePlaylists] Error fetching playlists:", error);
      if (isMountedRef.current) {
        Alert.alert("Error", "Failed to load playlists");
        setError(String(error));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
        console.log("🏁 [usePlaylists] Fetch playlists completed");
      }
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

  // Refresh handler - memoized to prevent circular dependencies
  const handleRefresh = useCallback(async () => {
    if (isMountedRef.current) {
      setRefreshing(true);
      await fetchPlaylists();
    }
  }, [fetchPlaylists]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (profile?.id) {
      fetchPlaylists();
    }
  }, [profile?.id, fetchPlaylists]);

  // Optimistic playlist removal from state
  const removePlaylistFromState = useCallback((playlistId: string) => {
    if (isMountedRef.current) {
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    }
  }, []);

  return {
    playlists,
    loading,
    refreshing,
    fetchPlaylists,
    createPlaylist,
    updatePlaylist,
    handleRefresh,
    removePlaylistFromState,
    error,
  };
};
