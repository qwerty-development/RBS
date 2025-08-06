// components/playlists/PlaylistCard.tsx
import React from "react";
import {
  View,
  Pressable,
  ImageBackground,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Users, Lock, Globe, ChevronRight, Trash2 } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H4, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { Playlist } from "@/hooks/usePlaylists";
import { useDeletePlaylist } from "@/hooks/useDeletePlaylist";
import { useAuth } from "@/context/supabase-provider";
import { cn } from "@/lib/utils";

interface PlaylistCardProps {
  playlist: Playlist & {
    preview_images?: string[];
    is_collaborative?: boolean;
    user_permission?: "view" | "edit";
  };
  onPress: () => void;
  onDelete?: (playlistId: string) => void;
  variant?: "grid" | "list";
  className?: string;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onPress,
  onDelete,
  variant = "grid",
  className,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { profile } = useAuth();

  // Add safety checks for playlist data
  if (!playlist || !playlist.id) {
    return null;
  }

  // Sanitize all text values to prevent rendering errors
  const safeName = String(playlist.name || "Untitled Playlist");
  const safeDescription = playlist.description
    ? String(playlist.description)
    : null;
  const safeEmoji = String(playlist.emoji || "📍");
  const safeItemCount = Number(playlist.item_count) || 0;
  const safeCollaboratorCount = Number(playlist.collaborator_count) || 0;

  const { deletePlaylist, isDeleting } = useDeletePlaylist({
    onSuccess: (playlistId) => {
      if (onDelete) {
        onDelete(playlistId);
      }
    },
  });

  const isOwner = playlist.user_id === profile?.id;

  const handleDeletePress = async (e: any) => {
    e.stopPropagation();
    await deletePlaylist(playlist.id, safeName);
  };

  // List variant
  if (variant === "list") {
    try {
      return (
        <Pressable
          onPress={onPress}
          className={cn(
            "flex-row items-center p-4 bg-white dark:bg-gray-800",
            "border-b border-gray-200 dark:border-gray-700",
            "active:bg-gray-50 dark:active:bg-gray-700",
            className || "",
          )}
        >
          {/* Emoji Icon */}
          <View className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 items-center justify-center mr-3">
            <Text className="text-2xl">{safeEmoji}</Text>
          </View>

          {/* Content */}
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <H4 className="flex-1" numberOfLines={1}>
                {safeName}
              </H4>
              {playlist.is_public ? (
                <Globe size={14} color="#6b7280" />
              ) : (
                <Lock size={14} color="#6b7280" />
              )}
            </View>

            {safeDescription && (
              <Text
                className="text-sm text-muted-foreground mb-1"
                numberOfLines={1}
              >
                {safeDescription}
              </Text>
            )}

            <View className="flex-row items-center gap-3">
              <Text className="text-xs text-muted-foreground">
                {safeItemCount} restaurants
              </Text>
              {safeCollaboratorCount > 0 && (
                <View className="flex-row items-center gap-1">
                  <Users size={12} color="#6b7280" />
                  <Text className="text-xs text-muted-foreground">
                    {safeCollaboratorCount}
                  </Text>
                </View>
              )}
              {playlist.is_collaborative && (
                <View className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
                  <Text className="text-xs text-blue-700 dark:text-blue-300">
                    {playlist.user_permission === "edit"
                      ? "Can Edit"
                      : "Viewer"}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {isOwner && (
              <Pressable
                onPress={handleDeletePress}
                disabled={isDeleting}
                className="p-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Trash2 size={18} color="#ef4444" />
                )}
              </Pressable>
            )}
            <ChevronRight size={20} color="#6b7280" />
          </View>
        </Pressable>
      );
    } catch (error) {
      console.error("Error rendering playlist:", error);
      return (
        <View className="p-4 bg-red-50 dark:bg-red-900 rounded-lg m-2">
          <Text className="text-center text-red-600 dark:text-red-300">
            Error rendering playlist: {safeName}
          </Text>
        </View>
      );
    }
  }

  // Grid variant
  try {
    return (
      <Pressable
        onPress={onPress}
        className={cn(
          "bg-white dark:bg-gray-800 rounded-2xl overflow-hidden",
          "shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700",
          "active:scale-95 transition-transform",
          className || "",
        )}
      >
        {/* Cover Image */}
        <View className="h-32 bg-gray-100 dark:bg-gray-700 relative">
          {playlist.preview_images && playlist.preview_images.length > 0 ? (
            <ImageBackground
              source={{ uri: playlist.preview_images[0] }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            >
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.5)"]}
                style={{ flex: 1 }}
              />
            </ImageBackground>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-4xl">{safeEmoji}</Text>
            </View>
          )}

          {/* Badges */}
          <View className="absolute top-2 right-2 flex-row gap-2">
            {playlist.is_public ? (
              <View className="bg-white/90 dark:bg-gray-800/90 rounded-full p-1.5">
                <Globe size={14} color={isDark ? "#fff" : "#000"} />
              </View>
            ) : (
              <View className="bg-white/90 dark:bg-gray-800/90 rounded-full p-1.5">
                <Lock size={14} color={isDark ? "#fff" : "#000"} />
              </View>
            )}
            {playlist.is_collaborative && (
              <View className="bg-blue-500/90 rounded-full p-1.5">
                <Users size={14} color="#fff" />
              </View>
            )}
          </View>

          {/* Delete Button */}
          {isOwner && (
            <View className="absolute top-2 left-2">
              <Pressable
                onPress={handleDeletePress}
                disabled={isDeleting}
                className="bg-red-500/90 rounded-full p-1.5"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Trash2 size={14} color="#fff" />
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* Content */}
        <View className="p-3">
          <H4 numberOfLines={1} className="mb-1">
            {safeName}
          </H4>

          {safeDescription && (
            <Text
              className="text-sm text-muted-foreground mb-2"
              numberOfLines={2}
            >
              {safeDescription}
            </Text>
          )}

          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">
              {safeItemCount} restaurants
            </Text>

            {safeCollaboratorCount > 0 && (
              <View className="flex-row items-center gap-1">
                <Users size={12} color="#6b7280" />
                <Text className="text-xs text-muted-foreground">
                  +{safeCollaboratorCount}
                </Text>
              </View>
            )}
          </View>

          {playlist.owner && !playlist.is_collaborative && (
            <View className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Text className="text-xs text-muted-foreground">
                by {String(playlist.owner.full_name || "Unknown")}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  } catch (error) {
    console.error("Error rendering playlist:", error);
    return (
      <View className="p-4 bg-red-50 dark:bg-red-900 rounded-lg m-2">
        <Text className="text-center text-red-600 dark:text-red-300">
          Error rendering playlist: {safeName}
        </Text>
      </View>
    );
  }
};
