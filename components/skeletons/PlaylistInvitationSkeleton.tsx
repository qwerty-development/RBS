import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";

const PlaylistInvitationSkeletonItem = () => (
  <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-200 dark:border-gray-700">
    <View className="flex-row items-start justify-between mb-3">
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Skeleton className="w-8 h-8 rounded-md mr-2" />
          <Skeleton className="h-6 w-3/4 rounded-md" />
        </View>
        <Skeleton className="h-4 w-full rounded-md mb-2" />
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </View>
      </View>
    </View>

    <View className="flex-row items-center mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <Skeleton className="w-10 h-10 rounded-full mr-3" />
      <View className="flex-1">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md mt-2" />
      </View>
    </View>

    <View className="flex-row gap-3">
      <Skeleton className="h-10 flex-1 rounded-md" />
      <Skeleton className="h-10 flex-1 rounded-md" />
    </View>
  </View>
);

export const PlaylistInvitationSkeleton = ({
  count = 3,
}: {
  count?: number;
}) => {
  return (
    <View className="p-4">
      {Array.from({ length: count }).map((_, index) => (
        <PlaylistInvitationSkeletonItem key={index} />
      ))}
    </View>
  );
};
