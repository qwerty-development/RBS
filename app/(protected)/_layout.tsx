// app/(protected)/_layout.tsx
import React, { useState, useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { useAuth } from "@/context/supabase-provider";
import { GlobalChatTab } from "@/components/ui/global-chat-tab";
import { NotificationManager } from "@/components/notifications/NotificationManager";
import { View, ActivityIndicator, Text } from "react-native";
import { NetworkStatusBanner } from "@/components/network/NetworkStatusBanner";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { getThemedColors, getActivityIndicatorColor } from "@/lib/utils";
import { ProfileCompletionOnboarding } from "@/components/onboarding/ProfileCompletionOnboarding";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
  const { initialized, session, isGuest, profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  // Prevent flickering by using a stable auth state
  const [stableAuthState, setStableAuthState] = useState<{
    initialized: boolean;
    hasAccess: boolean;
  }>({ initialized: false, hasAccess: false });

  const authCheckTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
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

  // If onboarded is false, redirect to onboarding
  useEffect(() => {
    if (session && profile && profile.onboarded === false) {
      try {
        router.replace("/onboarding");
      } catch (e) {}
    }
  }, [session, profile?.onboarded]);

  // Show loading while auth is stabilizing
  if (!stableAuthState.initialized) {
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
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen name="playlist/add-restaurants" />
        <Stack.Screen name="playlist/[id]/collaborators" />
        <Stack.Screen name="playlist/join" />
        <Stack.Screen name="playlist/invitations" />
        <Stack.Screen name="restaurant/[id]" />
        <Stack.Screen name="booking/availability" />
        <Stack.Screen name="booking/create" />
        <Stack.Screen name="booking/request-sent" />
        <Stack.Screen name="booking/success" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="cuisine/[cuisineId]" />
        <Stack.Screen name="profile/loyalty" />
        <Stack.Screen name="profile/insights" />
        <Stack.Screen name="profile/notifications" />
        <Stack.Screen name="invitations" />
        <Stack.Screen name="friends/index" />
        <Stack.Screen name="friends/[id]" />
        <Stack.Screen name="legal/index" />
        <Stack.Screen name="legal/[documentType]" />
      </Stack>
      {!isGuest && <GlobalChatTab />}
      {!isGuest && <NotificationManager />}
      {!isGuest && <ProfileCompletionOnboarding />}
    </View>
  );
}
