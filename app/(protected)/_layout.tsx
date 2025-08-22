// app/(protected)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useAuth } from "@/context/supabase-provider";
import { GlobalChatTab } from "@/components/ui/global-chat-tab";
import { View, ActivityIndicator, Text } from "react-native";
import { NetworkStatusBanner } from "@/components/network/NetworkStatusBanner";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { getThemedColors, getActivityIndicatorColor } from "@/lib/utils";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
  const { initialized, session, isGuest } = useAuth();
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  // Show loading while auth is initializing
  if (!initialized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: themedColors.background,
        }}
        className="bg-background"
      >
        <ActivityIndicator
          size="large"
          color={getActivityIndicatorColor(colorScheme)}
        />
        <Text
          style={{ color: themedColors.foreground, marginTop: 16 }}
          className="text-foreground mt-4"
        >
          Loading...
        </Text>
      </View>
    );
  }

  // Allow access if user has session OR is a guest
  if (!session && !isGuest) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: themedColors.background,
        }}
        className="bg-background"
      >
        <ActivityIndicator
          size="large"
          color={getActivityIndicatorColor(colorScheme)}
        />
        <Text
          style={{ color: themedColors.foreground, marginTop: 16 }}
          className="text-foreground mt-4"
        >
          Redirecting...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: themedColors.background,
      }}
      className="bg-background"
    >
      <NetworkStatusBanner position="top" autoDismiss={5000} />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen name="playlist/add-restaurants" />
        <Stack.Screen name="playlist/[id]/collaborators" />
        <Stack.Screen name="playlist/join" />
        <Stack.Screen name="restaurant/[id]" />
        <Stack.Screen name="booking/availability" />
        <Stack.Screen name="cuisine/[cuisineId]" />
        <Stack.Screen name="profile/loyalty" />
        <Stack.Screen name="profile/insights" />
        <Stack.Screen name="profile/notifications" />
        <Stack.Screen name="legal/index" />
        <Stack.Screen name="legal/[documentType]" />
      </Stack>
      {!isGuest && <GlobalChatTab />}
    </View>
  );
}
