// app/(protected)/(tabs)/_layout.tsx
import React, { useRef } from "react";
import { Tabs } from "expo-router";
import { Home, Search, Heart, Calendar, User, Bell } from "lucide-react-native";
import { ScrollView, View, Text } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { getThemedColors } from "@/lib/utils";
import { useNotificationsBadge } from "@/hooks/useNotificationsBadge";

export const homeScrollRef = useRef<ScrollView>(null);

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const { unreadCount } = useNotificationsBadge();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: themedColors.card,
          borderTopWidth: 1,
          borderTopColor: themedColors.border,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          overflow: "hidden", // ensure corners are clipped
          position: "absolute", // Ensure tab bar sits on top
          bottom: 0,
          left: 0,
          right: 0,
          // Add subtle elevation for better visual hierarchy
          shadowColor: themedColors.foreground,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: colorScheme === "dark" ? 0.25 : 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: themedColors.primary,
        tabBarInactiveTintColor: themedColors.mutedForeground,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
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
            const state = navigation.getState();
            const isHomeTabActive = state.routes[state.index]?.name === "index";
            if (isHomeTabActive && homeScrollRef.current) {
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
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color, size }) => (
            <Heart size={size} color={color} strokeWidth={2} />
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
      {/* Notifications inside Social tab icon with badge for simplicity */}
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          tabBarIcon: ({ color, size }) => (
            <View>
              <User size={size} color={color} strokeWidth={2} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    right: -4,
                    top: -4,
                    backgroundColor: "#EF4444",
                    borderRadius: 10,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 3,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
