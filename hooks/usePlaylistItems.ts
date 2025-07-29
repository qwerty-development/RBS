// hooks/usePlaylistItems.ts
import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { PlaylistItem } from "./usePlaylists";
import { playlistEventEmitter, PLAYLIST_EVENTS } from "@/lib/eventEmitter";

export const usePlaylistItems = (playlistId: string | null) => {
  const { profile } = useAuth();
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch playlist items
  const fetchItems = useCallback(async () => {
    if (!playlistId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("playlist_items")
        .select(
          `
          *,
          restaurant:restaurants (*),
          added_by_user:profiles!playlist_items_added_by_fkey (
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });

      if (error) throw error;

      setItems(data || []);
    } catch (error) {
      console.error("Error fetching playlist items:", error);
      Alert.alert("Error", "Failed to load playlist items");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playlistId]);

  // Add restaurant to playlist
  const addRestaurant = useCallback(
    async (restaurantId: string, note?: string): Promise<boolean> => {
      if (!profile?.id || !playlistId) return false;

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Get current max position
        const { data: maxPosData } = await supabase
          .from("playlist_items")
          .select("position")
          .eq("playlist_id", playlistId)
          .order("position", { ascending: false })
          .limit(1)
          .single();

        const nextPosition = (maxPosData?.position ?? -1) + 1;

        const { error } = await supabase.from("playlist_items").insert({
          playlist_id: playlistId,
          restaurant_id: restaurantId,
          added_by: profile.id,
          position: nextPosition,
          note: note?.trim() || null,
        });

        if (error) {
          if (error.code === "23505") {
            // Unique constraint violation
            Alert.alert("Info", "This restaurant is already in the playlist");
            return false;
          }
          throw error;
        }

        // Emit event to notify all components about playlist updates
        playlistEventEmitter.emit(PLAYLIST_EVENTS.RESTAURANT_ADDED, {
          restaurantId,
          playlistIds: [playlistId],
          successCount: 1,
        });
        
        // Also refresh local items
        await fetchItems();
        return true;
      } catch (error) {
        console.error("Error adding restaurant to playlist:", error);
        Alert.alert("Error", "Failed to add restaurant to playlist");
        return false;
      }
    },
    [profile?.id, playlistId, fetchItems],
  );

  // Remove restaurant from playlist
  const removeRestaurant = useCallback(
    async (itemId: string): Promise<boolean> => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { error } = await supabase
          .from("playlist_items")
          .delete()
          .eq("id", itemId);

        if (error) throw error;

        // Get the restaurant ID before filtering for event emission
        const removedItem = items.find(item => item.id === itemId);
        
        // Emit event to notify all components about restaurant removal
        if (removedItem && playlistId) {
          playlistEventEmitter.emit(PLAYLIST_EVENTS.RESTAURANT_REMOVED, {
            restaurantId: removedItem.restaurant_id,
            playlistIds: [playlistId],
            itemId,
          });
        }

        setItems((prev) => prev.filter((item) => item.id !== itemId));
        return true;
      } catch (error) {
        console.error("Error removing restaurant from playlist:", error);
        Alert.alert("Error", "Failed to remove restaurant");
        return false;
      }
    },
    [items, playlistId],
  );

  // Update item note
  const updateItemNote = useCallback(
    async (itemId: string, note: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("playlist_items")
          .update({ note: note.trim() || null })
          .eq("id", itemId);

        if (error) throw error;

        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, note: note.trim() || null } : item,
          ),
        );
        return true;
      } catch (error) {
        console.error("Error updating note:", error);
        Alert.alert("Error", "Failed to update note");
        return false;
      }
    },
    [],
  );

  // Reorder items
  const reorderItems = useCallback(
    async (fromIndex: number, toIndex: number): Promise<boolean> => {
      if (fromIndex === toIndex) return true;

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const newItems = [...items];
        const [movedItem] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, movedItem);

        // Update positions
        const updates = newItems.map((item, index) => ({
          id: item.id,
          position: index,
        }));

        // Optimistically update UI
        setItems(newItems.map((item, index) => ({ ...item, position: index })));

        // Update in database
        const { error } = await supabase.rpc("update_playlist_positions", {
          updates: updates,
        });

        if (error) throw error;

        return true;
      } catch (error) {
        console.error("Error reordering items:", error);
        Alert.alert("Error", "Failed to reorder items");
        await fetchItems(); // Revert to server state
        return false;
      }
    },
    [items, fetchItems],
  );

  // Check if restaurant is in playlist
  const isRestaurantInPlaylist = useCallback(
    (restaurantId: string): boolean => {
      return items.some((item) => item.restaurant_id === restaurantId);
    },
    [items],
  );

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Listen for playlist events and refresh items if this playlist is affected
  useEffect(() => {
    const handlePlaylistItemUpdate = (eventData: any) => {
      // Check if this event affects the current playlist
      if (!playlistId) return;
      
      const { playlistIds } = eventData;
      if (playlistIds && playlistIds.includes(playlistId)) {
        // This playlist was affected, refresh the items
        fetchItems();
      }
    };

    const handlePlaylistUpdate = () => {
      // For general playlist updates, always refresh to be safe
      if (playlistId) {
        fetchItems();
      }
    };

    // Listen for events that affect playlist items
    playlistEventEmitter.on(PLAYLIST_EVENTS.RESTAURANT_ADDED, handlePlaylistItemUpdate);
    playlistEventEmitter.on(PLAYLIST_EVENTS.RESTAURANT_REMOVED, handlePlaylistItemUpdate);
    playlistEventEmitter.on(PLAYLIST_EVENTS.UPDATED, handlePlaylistUpdate);

    // Cleanup event listeners
    return () => {
      playlistEventEmitter.off(PLAYLIST_EVENTS.RESTAURANT_ADDED, handlePlaylistItemUpdate);
      playlistEventEmitter.off(PLAYLIST_EVENTS.RESTAURANT_REMOVED, handlePlaylistItemUpdate);
      playlistEventEmitter.off(PLAYLIST_EVENTS.UPDATED, handlePlaylistUpdate);
    };
  }, [fetchItems, playlistId]);

  return {
    items,
    loading,
    refreshing,
    fetchItems,
    addRestaurant,
    removeRestaurant,
    updateItemNote,
    reorderItems,
    isRestaurantInPlaylist,
    handleRefresh,
  };
};
