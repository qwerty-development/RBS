// app/(protected)/_layout.tsx
import React, { useState, useEffect, useRef } from "react";
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

  // Prevent flickering by using a stable auth state
  const [stableAuthState, setStableAuthState] = useState<{
    initialized: boolean;
    hasAccess: boolean;
  }>({ initialized: false, hasAccess: false });

  const authCheckTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    console.log("🔐 Auth State Change:", {
      initialized,
      hasSession: !!session,
      isGuest,
      timestamp: Date.now(),
    });

    // Clear any existing timeout
    if (authCheckTimeout.current) {
      clearTimeout(authCheckTimeout.current);
    }

    // If not initialized, don't allow access yet
    if (!initialized) {
      setStableAuthState({ initialized: false, hasAccess: false });
      return;
    }

    // If initialized and we have session or guest mode, allow access
    const hasAccess = session || isGuest;

    if (hasAccess) {
      // Immediate access for valid states
      setStableAuthState({ initialized: true, hasAccess: true });
    } else {
      // Delay the "no access" state to prevent flickering during auth transitions
      authCheckTimeout.current = setTimeout(() => {
        setStableAuthState({ initialized: true, hasAccess: false });
      }, 1000); // 1 second grace period
    }

    return () => {
      if (authCheckTimeout.current) {
        clearTimeout(authCheckTimeout.current);
      }
    };
  }, [initialized, session, isGuest]);

  // Show loading while auth is stabilizing
  if (!stableAuthState.initialized) {
    console.log("⏳ Auth stabilizing, showing loading screen");
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

  // Show redirecting only after grace period
  if (!stableAuthState.hasAccess) {
    console.log("🚫 No stable access, showing redirecting screen");
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
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        {/* PLAYLIST ROUTES TEMPORARILY HIDDEN FOR APP STORE SUBMISSION */}
        {/*
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen name="playlist/add-restaurants" />
        <Stack.Screen name="playlist/[id]/collaborators" />
        <Stack.Screen name="playlist/join" />
        */}
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
