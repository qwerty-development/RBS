// app/(protected)/(tabs)/_layout.tsx
import React from "react";
import { Tabs, usePathname } from "expo-router";
import { Home, Search, Users, Calendar, Heart, User } from "lucide-react-native";
import { View } from "react-native";

import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { homeScrollRef } from "@/app/(protected)/(tabs)/index";
import { useAuth } from "@/context/supabase-provider";

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const { isGuest } = useAuth();
  const pathname = usePathname();

  // Guest indicator badge component
  const GuestBadge = () => (
    <View className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:
            colorScheme === "dark"
              ? colors.dark.background
              : colors.light.background,
          borderTopWidth: 1,
          borderTopColor:
            colorScheme === "dark" ? colors.dark.border : colors.light.border,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor:
          colorScheme === "dark" ? colors.dark.primary : colors.light.primary,
        tabBarInactiveTintColor:
          colorScheme === "dark"
            ? colors.dark.mutedForeground
            : colors.light.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={2} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Check if the home tab is already active
            const state = navigation.getState();
            const isHomeTabActive = state.routes[state.index]?.name === "index";

            if (isHomeTabActive && homeScrollRef.current) {
              // Prevent default navigation and scroll to top
              e.preventDefault();
              homeScrollRef.current.scrollTo({ y: 0, animated: true });
            }
          },
        })}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => (
            <Search size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <Users size={size} color={color} strokeWidth={2} />
              {isGuest && focused && <GuestBadge />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <Calendar size={size} color={color} strokeWidth={2} />
              {isGuest && focused && <GuestBadge />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <Heart size={size} color={color} strokeWidth={2} />
              {isGuest && focused && <GuestBadge />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}