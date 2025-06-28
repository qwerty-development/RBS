import React, { useState, useEffect } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { FolderOpen, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

interface PlaylistInfo {
  id: string;
  name: string;
  emoji: string;
  isOwner: boolean;
}

interface RestaurantPlaylistIndicatorProps {
  restaurantId: string;
}

export const RestaurantPlaylistIndicator: React.FC<RestaurantPlaylistIndicatorProps> = ({
  restaurantId,
}) => {
  const router = useRouter();
  const { profile } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaylists();
  }, [restaurantId, profile?.id]);

  const fetchPlaylists = async () => {
    if (!profile?.id) return;

    try {
      // Get playlists that contain this restaurant
      const { data, error } = await supabase
        .from('playlist_items')
        .select(`
          playlist:restaurant_playlists (
            id,
            name,
            emoji,
            user_id,
            is_public
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter to show only user's playlists or public playlists they have access to
      const userPlaylists = await Promise.all(
        (data || []).map(async (item) => {
          const playlist = item.playlist;
          if (!playlist) return null;

          // Check if user owns the playlist
          if (playlist.user_id === profile.id) {
            return {
              id: playlist.id,
              name: playlist.name,
              emoji: playlist.emoji,
              isOwner: true,
            };
          }

          // Check if user is a collaborator
          const { data: collab } = await supabase
            .from('playlist_collaborators')
            .select('id')
            .eq('playlist_id', playlist.id)
            .eq('user_id', profile.id)
            .single();

          if (collab || playlist.is_public) {
            return {
              id: playlist.id,
              name: playlist.name,
              emoji: playlist.emoji,
              isOwner: false,
            };
          }

          return null;
        })
      );

      setPlaylists(userPlaylists.filter(Boolean) as PlaylistInfo[]);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || playlists.length === 0) return null;

  return (
    <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 ml-3">
      <View className="flex-row items-center mb-3 ">
        <FolderOpen size={18} color="#6b7280" />
        <Muted className="ml-2 text-sm">In Your Playlists</Muted>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="-mx-4 px-4"
      >
        <View className="flex-row gap-2">
          {playlists.map((playlist) => (
            <Pressable
              key={playlist.id}
              onPress={() => router.push(`/playlist/${playlist.id}`)}
              className="bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 flex-row items-center"
            >
              <Text className="text-base mr-2">{playlist.emoji}</Text>
              <Text className="text-sm font-medium mr-1">{playlist.name}</Text>
              <ChevronRight size={14} color="#6b7280" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

