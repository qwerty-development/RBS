import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

interface FavoritesSectionHeaderProps {
  title: string;
}

export const FavoritesSectionHeader: React.FC<FavoritesSectionHeaderProps> = ({
  title,
}) => {
  if (!title) return null;

  return (
    <View className="bg-background px-4 py-2">
      <Text className="font-semibold text-muted-foreground">{title}</Text>
    </View>
  );
};
