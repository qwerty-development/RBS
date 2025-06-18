import React from "react";
import { View, Pressable } from "react-native";
import { H1, H3, H4, Muted } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  return (
    <View className="px-4 mb-3 flex-row items-center justify-between">
      <View>
        <H4>{title}</H4>
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction}>
          <Text className="text-primary text-sm">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
