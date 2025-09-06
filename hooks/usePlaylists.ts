// hooks/usePlaylists.ts
import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { playlistEventEmitter, PLAYLIST_EVENTS } from "@/lib/eventEmitter";
import { addBlockedUsersFilter } from "@/utils/blockingUtils";

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
      // Fetch user's own playlists
      const { data: ownPlaylists, error: ownError } = await supabase
        .from("restaurant_playlists")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (ownError) {
        console.error("Error fetching own playlists:", ownError);
        throw ownError;
      }

      // Fetch playlists user collaborates on (get playlist IDs first)
      const { data: collaborations, error: collabError } = await supabase
        .from("playlist_collaborators")
        .select("playlist_id, permission, accepted_at")
        .eq("user_id", profile.id)
        .not("accepted_at", "is", null);

      if (collabError) {
        console.error("Error fetching collaborations:", collabError);
        throw collabError;
      }

      let collaborativePlaylists: any[] = [];

      if (collaborations && collaborations.length > 0) {
        // Get the playlist IDs
        const collaborativePlaylistIds = collaborations.map(
          (c) => c.playlist_id,
        );

        // Fetch full playlist data for collaborative playlists
        const { data: collabPlaylistsData, error: collabPlaylistsError } =
          await supabase
            .from("restaurant_playlists")
            .select("*")
            .in("id", collaborativePlaylistIds)
            .order("created_at", { ascending: false });

        if (collabPlaylistsError) {
          console.error(
            "Error fetching collaborative playlists:",
            collabPlaylistsError,
          );
          throw collabPlaylistsError;
        }

        // Filter out playlists from blocked users
        let filteredCollabPlaylists = collabPlaylistsData || [];
        if (profile?.id) {
          const { getBlockedUserIds } = await import("@/utils/blockingUtils");
          const blockedUserIds = await getBlockedUserIds(profile.id);
          filteredCollabPlaylists = filteredCollabPlaylists.filter(
            playlist => !blockedUserIds.includes(playlist.user_id)
          );
        }

        // Fetch owner data for collaborative playlists
        const ownerIds = [
          ...new Set(filteredCollabPlaylists?.map((p) => p.user_id) || []),
        ];
        let ownersData: any[] = [];

        if (ownerIds.length > 0) {
          const { data: owners, error: ownersError } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", ownerIds);

          if (ownersError) {
            console.error("Error fetching owners:", ownersError);
            throw ownersError;
          }
          ownersData = owners || [];
        }

        // Add collaborative metadata to each playlist
        collaborativePlaylists = (filteredCollabPlaylists || []).map((playlist) => {
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

      // Fetch item counts and collaborator counts for all playlists
      const playlistsWithStats = await Promise.all(
        uniquePlaylists.map(async (playlist, index) => {
          try {
            // Get item count
            const { count: itemCount, error: itemError } = await supabase
              .from("playlist_items")
              .select("*", { count: "exact", head: true })
              .eq("playlist_id", playlist.id);

            if (itemError) {
              console.error(
                `Error fetching item count for playlist ${playlist.id}:`,
                itemError,
              );
            }

            // Get collaborator count
            const { count: collaboratorCount, error: collabError } =
              await supabase
                .from("playlist_collaborators")
                .select("*", { count: "exact", head: true })
                .eq("playlist_id", playlist.id)
                .not("accepted_at", "is", null);

            if (collabError) {
              console.error(
                `Error fetching collaborator count for playlist ${playlist.id}:`,
                collabError,
              );
            }

            const playlistWithStats = {
              ...playlist,
              item_count: itemCount || 0,
              collaborator_count: collaboratorCount || 0,
            };

            return playlistWithStats;
          } catch (statsError) {
            console.error(
              `Error fetching stats for playlist ${playlist.id}:`,
              statsError,
            );
            // Return playlist with default stats if there's an error
            const fallbackPlaylist = {
              ...playlist,
              item_count: 0,
              collaborator_count: 0,
            };
            return fallbackPlaylist;
          }
        }),
      );

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setPlaylists(playlistsWithStats as Playlist[]);
        setError(null); // Clear any previous errors
      }
    } catch (error) {
      console.error("Error fetching playlists:", error);
      if (isMountedRef.current) {
        Alert.alert("Error", "Failed to load playlists");
        setError(String(error));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
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

        // Emit event to notify all components about playlist creation
        playlistEventEmitter.emit(PLAYLIST_EVENTS.CREATED, {
          playlist: data,
        });

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

        // Emit event to notify all components about playlist update
        playlistEventEmitter.emit(PLAYLIST_EVENTS.UPDATED, {
          playlistId,
          updates,
        });

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

  // Listen for playlist events and refresh data
  useEffect(() => {
    const handlePlaylistUpdate = () => {
      if (isMountedRef.current && profile?.id) {
        fetchPlaylists();
      }
    };

    // Listen for all playlist events that should trigger a refresh
    playlistEventEmitter.on(PLAYLIST_EVENTS.UPDATED, handlePlaylistUpdate);
    playlistEventEmitter.on(PLAYLIST_EVENTS.CREATED, handlePlaylistUpdate);
    playlistEventEmitter.on(PLAYLIST_EVENTS.DELETED, handlePlaylistUpdate);
    playlistEventEmitter.on(
      PLAYLIST_EVENTS.RESTAURANT_ADDED,
      handlePlaylistUpdate,
    );
    playlistEventEmitter.on(
      PLAYLIST_EVENTS.RESTAURANT_REMOVED,
      handlePlaylistUpdate,
    );

    // Cleanup event listeners
    return () => {
      playlistEventEmitter.off(PLAYLIST_EVENTS.UPDATED, handlePlaylistUpdate);
      playlistEventEmitter.off(PLAYLIST_EVENTS.CREATED, handlePlaylistUpdate);
      playlistEventEmitter.off(PLAYLIST_EVENTS.DELETED, handlePlaylistUpdate);
      playlistEventEmitter.off(
        PLAYLIST_EVENTS.RESTAURANT_ADDED,
        handlePlaylistUpdate,
      );
      playlistEventEmitter.off(
        PLAYLIST_EVENTS.RESTAURANT_REMOVED,
        handlePlaylistUpdate,
      );
    };
  }, [fetchPlaylists, profile?.id]);

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
