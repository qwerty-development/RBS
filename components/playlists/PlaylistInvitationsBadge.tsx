// components/playlists/PlaylistInvitationsBadge.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { Mail } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { usePlaylistInvitations } from "@/hooks/usePlaylistInvitations";

interface PlaylistInvitationsBadgeProps {
  /**
   * Custom onPress handler. If not provided, navigates to invitations screen
   */
  onPress?: () => void;
  /**
   * Custom icon size
   */
  iconSize?: number;
  /**
   * Show as button style or just badge
   */
  variant?: "button" | "icon";
  /**
   * Custom styling
   */
  className?: string;
}

export const PlaylistInvitationsBadge: React.FC<PlaylistInvitationsBadgeProps> = ({
  onPress,
  iconSize = 20,
  variant = "button",
  className = "",
}) => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { pendingCount } = usePlaylistInvitations();

  const handlePress = onPress || (() => router.push("/playlist/invitations"));

  if (pendingCount === 0) {
    return null;
  }

  const baseClasses = variant === "button" 
    ? "p-2 bg-gray-100 dark:bg-gray-800 rounded-lg relative"
    : "relative";

  return (
    <Pressable
      onPress={handlePress}
      className={`${baseClasses} ${className}`}
    >
      <Mail size={iconSize} color={colorScheme === "dark" ? "#fff" : "#000"} />
      <View className="absolute -top-1 -right-1 bg-primary rounded-full min-w-5 h-5 items-center justify-center px-1">
        <Text className="text-white text-xs font-bold">
          {pendingCount > 9 ? '9+' : pendingCount}
        </Text>
      </View>
    </Pressable>
  );
};

// Hook-only version for just getting the count
export const usePlaylistInvitationsCount = () => {
  const { pendingCount } = usePlaylistInvitations();
  return pendingCount;
};