import React from "react";
import { View, Pressable, useColorScheme } from "react-native";
import { ChevronLeft, Share2 } from "lucide-react-native";
import { colors } from "@/constants/colors";
import { H3 } from "@/components/ui/typography";

interface NavigationHeaderProps {
  /** Title to display in the center */
  title: string;
  /** Function to call when back button is pressed */
  onBack?: () => void;
  /** Function to call when share button is pressed */
  onShare?: () => void;
  /** Whether to show the share button */
  showShare?: boolean;
  /** Additional class names for custom styling */
  className?: string;
}

export function NavigationHeader({
  title,
  onBack,
  onShare,
  showShare = false,
  className = "",
}: NavigationHeaderProps) {
  const colorScheme = useColorScheme();

  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3 border-b border-border bg-card ${className}`}
    >
      {/* Back Button */}
      <Pressable onPress={onBack} className="p-1 -ml-1">
        <ChevronLeft size={20} color={colors[colorScheme].foreground} />
      </Pressable>

      {/* Title */}
      <H3 className="text-foreground font-medium flex-1 text-center px-4">
        {title}
      </H3>

      {/* Share Button or Spacer */}
      {showShare ? (
        <Pressable onPress={onShare} className="p-1 -mr-1">
          <Share2 size={20} color={colors[colorScheme].foreground} />
        </Pressable>
      ) : (
        <View className="w-6" />
      )}
    </View>
  );
}
