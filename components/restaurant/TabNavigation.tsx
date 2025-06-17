import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";

type TabType = "overview" | "menu" | "reviews";

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TabNavigation = ({
  activeTab,
  onTabChange,
}: TabNavigationProps) => {
  const tabs: TabType[] = ["overview", "menu", "reviews"];

  return (
    <View className="flex-row px-4 mb-4 gap-2">
      {tabs.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => onTabChange(tab)}
          className={`flex-1 py-2 rounded-lg ${
            activeTab === tab ? "bg-primary" : "bg-muted"
          }`}
        >
          <Text
            className={`text-center font-medium ${
              activeTab === tab ? "text-primary-foreground" : ""
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};
