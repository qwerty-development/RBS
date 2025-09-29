import React from "react";
import { View, Pressable } from "react-native";
import { ArrowLeft, Share2, Settings } from "lucide-react-native";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeAreaView } from "@/components/safe-area-view";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/useColorScheme";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";

const PlaylistDetailsSkeletonItem = () => (
  <View className="mb-3">
    <View className="flex-row items-center p-3 bg-white dark:bg-gray-800 rounded-2xl">
      <Skeleton className="w-20 h-20 rounded-lg" />
      <View className="ml-3 flex-1">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md mt-2" />
        <Skeleton className="h-3 w-1/4 rounded-md mt-2" />
      </View>
    </View>
  </View>
);

export const PlaylistDetailsSkeleton = ({ count = 5 }: { count?: number }) => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const handleBack = () => {
    router.back();
  };
  
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Real Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleBack}
            className="w-10 h-10 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft
              size={20}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-3xl">📋</Text>
              <Skeleton className="h-6 w-32 rounded-md" />
            </View>
            <Muted>Loading restaurants...</Muted>
          </View>
          <View className="flex-row gap-2">
            <View className="w-10 h-10 items-center justify-center rounded-full bg-muted">
              <Share2
                size={20}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </View>
            <View className="w-10 h-10 items-center justify-center rounded-full bg-muted">
              <Settings
                size={20}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </View>
          </View>
        </View>
      </View>

      <View className="p-4">
        {Array.from({ length: count }).map((_, index) => (
          <PlaylistDetailsSkeletonItem key={index} />
        ))}
      </View>
    </SafeAreaView>
  );
};
