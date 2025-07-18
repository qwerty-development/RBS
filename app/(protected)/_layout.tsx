// app/(protected)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useAuth } from "@/context/supabase-provider";
import { GlobalChatTab } from "@/components/ui/global-chat-tab";
import { View, ActivityIndicator, Text } from "react-native";
import { NetworkStatusBanner } from "@/components/network/NetworkStatusBanner"; 

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
  const { initialized, session, isGuest } = useAuth();

  // Show loading while auth is initializing
  if (!initialized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "#fff", marginTop: 16 }}>Loading...</Text>
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
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "#fff", marginTop: 16 }}>Redirecting...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NetworkStatusBanner 
        position="top"
        autoDismiss={5000}
      />
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
      </Stack>
      {!isGuest && <GlobalChatTab />}
    </View>
  );
}