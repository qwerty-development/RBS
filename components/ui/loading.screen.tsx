import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { colorScheme } = useColorScheme();
  
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator
        size="large"
        color={colorScheme === "dark" ? "#fff" : "#000"}
      />
      {message && <Muted className="mt-4">{message}</Muted>}
    </View>
  );
}