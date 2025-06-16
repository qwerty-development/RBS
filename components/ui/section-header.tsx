import React from "react";
import { View, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { H3, Muted } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
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
    <View className="flex-row items-center justify-between px-4 mb-3">
      <View className="flex-1">
        <H3>{title}</H3>
        {subtitle && <Muted className="text-sm mt-1">{subtitle}</Muted>}
      </View>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="flex-row items-center gap-1"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text className="text-primary text-sm">{actionLabel}</Text>
          <ChevronRight size={16} color="#3b82f6" />
        </Pressable>
      )}
    </View>
  );
}