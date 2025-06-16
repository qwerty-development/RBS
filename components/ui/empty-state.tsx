import React from "react";
import { View } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-20 px-6">
      <Icon size={64} color="#666" strokeWidth={1} />
      <H3 className="mt-4 text-center">{title}</H3>
      {subtitle && (
        <Muted className="mt-2 text-center">{subtitle}</Muted>
      )}
      {actionLabel && onAction && (
        <Button variant="default" onPress={onAction} className="mt-6">
          <Text>{actionLabel}</Text>
        </Button>
      )}
    </View>
  );
}