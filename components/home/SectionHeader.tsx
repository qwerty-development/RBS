import React from "react";
import { View, Pressable } from "react-native";
import { H3, Muted } from "@/components/ui/typography";
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
        <H3>{title}</H3>
        <Muted className="text-sm">{subtitle}</Muted>
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction}>
          <Text className="text-primary text-sm">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
