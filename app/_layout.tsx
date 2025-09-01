import "./polyfills";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { Stack, router } from "expo-router";
import { AuthProvider, useAuth } from "@/context/supabase-provider";
import { NetworkProvider } from "@/context/network-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { LogBox, View, Text } from "react-native";
import React, { useEffect, useState } from "react";
import {
  ErrorBoundary,
  NavigationErrorBoundary,
} from "@/components/ErrorBoundary";
import { useNetworkMonitor } from "@/hooks/useNetworkMonitor";
import * as Sentry from "@sentry/react-native";
import { getThemedColors } from "@/lib/utils";
import {
  initializeNotificationHandlers,
  ensurePushPermissionsAndToken,
  registerDeviceForPush,
} from "@/lib/notifications/setup";
import { metaTracker } from "@/lib/metaTracking";
import * as TrackingTransparency from "expo-tracking-transparency";

LogBox.ignoreAllLogs();

// Network status bar component
function NetworkStatusBar() {
  const { isOnline, connectionQuality, isLoading, hasInitialized } =
    useNetworkMonitor({
      showOfflineAlert: true,
      showOnlineAlert: false,
      alertDelay: 5000,
    });

  const [showBanner, setShowBanner] = useState(false);

  // Control banner visibility with proper initialization checks
  useEffect(() => {
    if (isLoading || !hasInitialized) {
      setShowBanner(false);
      return;
    }

    const timer = setTimeout(() => {
      const shouldShow = !isOnline || connectionQuality === "poor";
      setShowBanner(shouldShow);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOnline, connectionQuality, isLoading, hasInitialized]);

  if (!showBanner) {
    return null;
  }

  const backgroundColor = !isOnline ? "#F44336" : "#FF9800";

  return (
    <View
      style={{
        backgroundColor,
        paddingVertical: 8,
        paddingHorizontal: 16,
      }}
      className="bg-warning"
    ></View>
  );
}

function RootLayoutContent() {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const { profile } = useAuth();

  useEffect(() => {
    initializeNotificationHandlers((deeplink: any) => {
      try {
        if (deeplink.startsWith("app://")) {
          const path: any = deeplink.replace("app://", "/");
          router.push(path);
        } else {
          router.push(deeplink);
        }
      } catch (e) {
        console.warn("Failed to navigate from notification:", e);
      }
    });
    ensurePushPermissionsAndToken();

    // Request tracking transparency permission and initialize Meta tracking
    const initializeTracking = async () => {
      try {
        // Request tracking permission on iOS 14+
        const { status } =
          await TrackingTransparency.requestTrackingPermissionsAsync();

        if (status === "granted") {
          console.log("Tracking permission granted");
        } else {
          console.log("Tracking permission denied");
        }

        // Initialize Meta tracking regardless of permission status
        // (SDK will handle permission status internally)
        metaTracker.trackAppInstall();
      } catch (error) {
        console.warn("Error requesting tracking permission:", error);
        // Still track app install even if permission request fails
        metaTracker.trackAppInstall();
      }
    };

    initializeTracking();

    return () => {
      // handlers cleaned up on unmount if needed
    };
  }, []);

  useEffect(() => {
    if (profile?.id) {
      registerDeviceForPush(profile.id);
    }
  }, [profile?.id]);

  // Hide warnings in development
  useEffect(() => {
    LogBox.ignoreLogs([
      "Clerk:",
      "Clerk has been loaded with development keys",
      "Unsupported Server Component type",
      "Warning: TNodeChildrenRenderer",
      'You seem to update props of the "TRenderEngineProvider" component',
      "Text strings must be rendered within a <Text> component",
      "VirtualizedLists should never be nested inside plain ScrollViews",
    ]);
  }, []);

  return (
    <>
      <NetworkStatusBar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: themedColors.background,
          },
        }}
      >
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth/google/callback"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="oauth-callback" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary
      showDetails={__DEV__}
      onError={(error, errorInfo) => {
        console.error("Root Error:", error);
        console.error("Error Info:", errorInfo);
        if (!__DEV__) {
          Sentry.withScope((scope) => {
            scope.setTag("location", "root_layout");
            scope.setLevel("fatal");
            Sentry.captureException(error);
          });
        }
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NetworkProvider>
          <AuthProvider>
            <NavigationErrorBoundary>
              <RootLayoutContent />
            </NavigationErrorBoundary>
          </AuthProvider>
        </NetworkProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
