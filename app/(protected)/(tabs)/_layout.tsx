import React from "react";
import { Tabs } from "expo-router";
import { Home, Search, Users, Calendar, Heart } from "lucide-react-native";

import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { homeScrollRef } from "@/app/(protected)/(tabs)/index";

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();

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
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color, size }) => (
            <Heart size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}