import "./polyfills";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { Stack, router } from "expo-router";
import { AuthProvider, useAuth } from "@/context/supabase-provider";
import { NetworkProvider } from "@/context/network-provider";
import { ModalProvider } from "@/context/modal-provider";
import {
  DeepLinkProvider,
  useDeepLinkContext,
} from "@/context/deeplink-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { LogBox, View, Text } from "react-native";
import React, { useEffect, useState } from "react";
import * as Linking from "expo-linking";
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
import AnimatedSplashScreen from "@/components/AnimatedSplashScreen";

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

function RootLayoutWithSplashState() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashDismissRequested, setSplashDismissRequested] = useState(false);
  const [deepLinkDetected, setDeepLinkDetected] = useState(false);

  // Check for initial deep link on cold start
  useEffect(() => {
    const checkInitialDeepLink = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && !shouldIgnoreUrl(initialUrl)) {
          console.log(
            "Cold start deep link detected in root layout:",
            initialUrl,
          );
          setDeepLinkDetected(true);
          setSplashDismissRequested(true);
        }
      } catch (error) {
        console.warn("Failed to check initial URL:", error);
      }
    };

    checkInitialDeepLink();
  }, []);

  // Helper function to check if URL should be ignored
  const shouldIgnoreUrl = (url: string): boolean => {
    return (
      url.startsWith("exp://") ||
      url.startsWith("exps://") ||
      url.includes(":8081") ||
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.startsWith("file://") ||
      !url ||
      url.length < 5
    );
  };

  // Handle early splash dismissal for deep links
  const handleSplashDismissRequest = () => {
    console.log("Deep link requesting early splash dismissal");
    setSplashDismissRequested(true);
  };

  // Dismiss splash immediately if requested by deep link
  useEffect(() => {
    if (splashDismissRequested && showSplash) {
      console.log("Dismissing splash screen early for deep link");
      setShowSplash(false);
    }
  }, [splashDismissRequested, showSplash]);

  // Safety timeout to prevent splash screen from hanging indefinitely
  useEffect(() => {
    const maxSplashTime = deepLinkDetected ? 3000 : 5000; // Shorter timeout for deep links

    const timeout = setTimeout(() => {
      if (showSplash) {
        console.warn("Splash screen timeout reached, forcing dismissal");
        setShowSplash(false);
      }
    }, maxSplashTime);

    return () => clearTimeout(timeout);
  }, [showSplash, deepLinkDetected]);

  return (
    <DeepLinkProvider
      isSplashVisible={showSplash}
      onSplashDismissRequested={handleSplashDismissRequest}
    >
      <ModalProvider>
        <NavigationErrorBoundary>
          <RootLayoutContent
            showSplash={showSplash}
            setShowSplash={setShowSplash}
          />
        </NavigationErrorBoundary>
      </ModalProvider>
    </DeepLinkProvider>
  );
}

function RootLayoutContent({
  showSplash,
  setShowSplash,
}: {
  showSplash: boolean;
  setShowSplash: (show: boolean) => void;
}) {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const { profile } = useAuth();

  useEffect(() => {
    initializeNotificationHandlers((deeplink: any) => {
      try {
        console.log("Notification deep link received:", deeplink);

        // Handle legacy "app://" format by converting to "plate://" format
        let processedUrl = deeplink;
        if (deeplink.startsWith("app://")) {
          processedUrl = deeplink.replace("app://", "plate://");
        } else if (deeplink.startsWith("/")) {
          // Handle relative paths by adding the scheme
          processedUrl = `plate://${deeplink}`;
        }

        // The deep link will be handled by the DeepLinkProvider automatically
        // We can also manually trigger it if needed
        console.log("Processed notification URL:", processedUrl);
      } catch (e) {
        console.warn("Failed to process notification deep link:", e);
        // Fallback to direct navigation for critical paths
        try {
          router.push(deeplink as any);
        } catch (fallbackError) {
          console.error("Fallback navigation also failed:", fallbackError);
        }
      }
    });
    ensurePushPermissionsAndToken();
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
      {showSplash && (
        <AnimatedSplashScreen
          onAnimationComplete={() => setShowSplash(false)}
          skipAnimation={splashDismissRequested}
          fastMode={deepLinkDetected}
        />
      )}
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
            <RootLayoutWithSplashState />
          </AuthProvider>
        </NetworkProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
