import "./polyfills";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/supabase-provider";
import { NetworkProvider } from "@/context/network-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { LogBox, Alert, View, Text } from "react-native";
import React, { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { ErrorBoundary, NavigationErrorBoundary } from "@/components/ErrorBoundary";
import { useNetworkMonitor } from "@/hooks/useNetworkMonitor";
import * as Sentry from "@sentry/react-native";
import { getThemedColors } from "@/lib/utils";

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
    // Don't show banner if still loading or not initialized
    if (isLoading || !hasInitialized) {
      setShowBanner(false);
      return;
    }

    // Add a small delay after initialization to ensure stable state
    const timer = setTimeout(() => {
      // Show banner if offline or poor connection
      const shouldShow = !isOnline || connectionQuality === "poor";
      setShowBanner(shouldShow);
    }, 1000); // 1 second delay after initialization

    return () => clearTimeout(timer);
  }, [isOnline, connectionQuality, isLoading, hasInitialized]);

  // Don't render anything if banner shouldn't be shown
  if (!showBanner) {
    return null;
  }

  const backgroundColor = !isOnline ? "#F44336" : "#FF9800";
  const message = !isOnline
    ? "No internet connection"
    : "Slow connection detected";

  return (
    <View
      style={{
        backgroundColor,
        paddingVertical: 8,
        paddingHorizontal: 16,
      }}
      className="bg-warning"
    >
      <Text
        style={{ color: "white", textAlign: "center", fontWeight: "500" }}
        className="text-warning-foreground text-center font-medium"
      >
        {message}
      </Text>
    </View>
  );
}

function RootLayoutContent() {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  // Hide warnings in development
  useEffect(() => {
    if (__DEV__) {
      LogBox.ignoreLogs([
        "Skipping duplicate check",
        "Non-serializable values were found",
        "Remote debugger",
        "VirtualizedLists should never be nested",
      ]);
    }
  }, []);

  // Handle over-the-air updates
  useEffect(() => {
    async function handleUpdates() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            "Update Available",
            "A new version of the app is available. Would you like to update now?",
            [
              { text: "Later", style: "cancel" },
              {
                text: "Update",
                onPress: async () => {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                },
              },
            ],
          );
        }
      } catch (error) {
        // Silently fail - updates aren't critical
        console.log("Update check failed:", error);
      }
    }

    if (!__DEV__) {
      handleUpdates();
    }
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
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary 
      showDetails={__DEV__}
      onError={(error, errorInfo) => {
        // Custom error logging
        console.error('Root Error:', error);
        console.error('Error Info:', errorInfo);
        
        // Additional error tracking
        if (!__DEV__) {
          Sentry.withScope((scope) => {
            scope.setTag('location', 'root_layout');
            scope.setLevel('fatal');
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
