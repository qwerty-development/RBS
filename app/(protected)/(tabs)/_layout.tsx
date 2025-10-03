// app/(protected)/(tabs)/_layout.tsx
import React, { useMemo, useRef } from "react";
import { Tabs } from "expo-router";
import { Home, Search, Heart, Calendar, User } from "lucide-react-native";
import { ScrollView } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";
import { useBookingsStore } from "@/stores";
import CustomTabBar, { /* types opt */ } from "@/components/CustomTabBar";

export let homeScrollRef: React.RefObject<ScrollView> | null = null;

export default function TabsLayout() {
  const scrollRef = useRef<ScrollView>(null);
  homeScrollRef = scrollRef as React.RefObject<ScrollView>;

  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const isDark = colorScheme === "dark";

  const { upcomingBookings } = useBookingsStore();
  const upcomingCount = useMemo(
    () => (upcomingBookings || []).length,
    [upcomingBookings]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" }, // hide native bar
      }}
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          primary={themedColors.primary}
          primaryForeground={themedColors.primaryForeground}
          mutedForeground={themedColors.mutedForeground}
          isDark={isDark}
          upcomingCount={upcomingCount}
          onReselectHome={() => {
            homeScrollRef?.current?.scrollTo({ y: 0, animated: true });
          }}
          // optional: pass a noise texture if you have one
          // noiseSource={require("@/assets/noise.png")}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorites" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen name="social" options={{ title: "Social" }} />
    </Tabs>
  );
}
