import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

interface LoyaltyWidgetSkeletonProps {
  colorScheme: "light" | "dark";
}

export const LoyaltyWidgetSkeleton = ({ colorScheme }: LoyaltyWidgetSkeletonProps) => {
  return (
    <View className="mx-4 mb-6">
      <View
        className={`w-full rounded-lg p-4 ${
          colorScheme === "dark" ? "bg-neutral-800" : "bg-neutral-100"
        } overflow-hidden`}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <View className="h-5 w-32 rounded bg-gray-300 dark:bg-gray-700" />
            <View className="h-4 w-20 mt-1 rounded bg-gray-200 dark:bg-gray-600" />
          </View>
          <View className="h-8 w-16 rounded-full bg-gray-300 dark:bg-gray-700" />
        </View>
      </View>
    </View>
  );
};
