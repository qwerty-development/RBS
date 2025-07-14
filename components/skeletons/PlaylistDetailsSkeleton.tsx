
import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeAreaView } from "@/components/safe-area-view";

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
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-6 w-6 rounded-md" />
          <View className="flex-1 mx-2 items-center">
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="h-4 w-48 rounded-md mt-2" />
          </View>
          <Skeleton className="h-6 w-6 rounded-md" />
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
