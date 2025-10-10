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
import React, { useEffect, useState, useRef } from "react";
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

// Initialize Sentry
Sentry.init({
  dsn: "https://3912f8e5caacfa65785887c17e0bf45e@o4510062241972224.ingest.us.sentry.io/4510062245052416",
  environment: __DEV__ ? "development" : "production",
  debug: false,
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.1,
});

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

  // EMERGENCY SPLASH DISMISSAL: Force hide splash after short delay
  useEffect(() => {
    const emergencyTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1500); // Short timer - deep links should dismiss immediately now

    return () => clearTimeout(emergencyTimer);
  }, []);

  // Handle early splash dismissal for deep links
  const handleSplashDismissRequest = () => {
    setSplashDismissRequested(true);
  };

  // Dismiss splash immediately if requested by deep link
  useEffect(() => {
    if (splashDismissRequested && showSplash) {
      setShowSplash(false);
    }
  }, [splashDismissRequested, showSplash]);

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
  const hasRedirectedToOnboarding = useRef(false);

  // Redirect users who haven't completed onboarding (only once)
  useEffect(() => {
    if (
      profile &&
      profile.onboarded === false &&
      !hasRedirectedToOnboarding.current
    ) {
      hasRedirectedToOnboarding.current = true;
      try {
        router.replace("/onboarding");
      } catch (e) {
        // ignore navigation errors during startup race conditions
      }
    }
  }, [profile?.onboarded]);

  useEffect(() => {
    initializeNotificationHandlers((deeplink: any) => {
      try {
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
        {/* Disable gestures for the entire protected group to block back-swipe from home */}
        <Stack.Screen name="(protected)" options={{ gestureEnabled: false }} />
        {/* Disable back-swipe on auth entry points to prevent navigating back to welcome */}
        <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
        <Stack.Screen name="sign-up" options={{ gestureEnabled: false }} />
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

export default Sentry.wrap(function RootLayout() {
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
});
