import React from "react";
import { View } from "react-native";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  subtitle,
  action,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const displayDescription = description || subtitle;
  const displayAction = action || (actionLabel && onAction ? { label: actionLabel, onPress: onAction } : undefined);

  return (
    <View className="flex-1 items-center justify-center py-20 px-6">
      {icon}
      <H3 className="mt-4 text-center">{title}</H3>
      {displayDescription && <Muted className="mt-2 text-center">{displayDescription}</Muted>}
      {displayAction && (
        <Button variant="default" onPress={displayAction.onPress} className="mt-6">
          <Text>{displayAction.label}</Text>
        </Button>
      )}
    </View>
  );
}
