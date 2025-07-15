import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { LogBox, Alert } from "react-native";
import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkProvider } from "@/context/network-provider";
import * as Sentry from "@sentry/react-native";
import { OfflineIndicator } from "@/components/OfflineIndicator";

// Enhanced Sentry configuration
Sentry.init({
  // Use environment variable in production, fallback to hardcoded for development
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || 
    (__DEV__ 
      ? undefined // Don't send errors in development unless explicitly set
      : "https://596c39f50e8604dcd468a29a63c1f442@o4509672135065600.ingest.de.sentry.io/4509672139587664"
    ),
  
  // Enhanced context collection
  sendDefaultPii: true,
  
  // Performance monitoring - more aggressive in dev, conservative in production
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
  
  // Session Replay configuration
  replaysSessionSampleRate: __DEV__ ? 0.5 : 0.1, // 50% in dev, 10% in production
  replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
  
  // Enhanced integrations
  integrations: [
    Sentry.mobileReplayIntegration({
      // Enhanced replay options
      maskAllText: false, // Set to true if you handle sensitive data
      maskAllImages: false,
    }),
    Sentry.feedbackIntegration({
      // Feedback widget configuration
      showBranding: false,
      showName: true,
      showEmail: true,
    }),
  ],

  // Better error filtering and processing
  beforeSend: (event, hint) => {
    // Enhanced logging in development
    if (__DEV__) {
      console.log("🚨 Sentry Error:", event.exception?.values?.[0]?.value || event.message);
      console.log("📍 Error Context:", event.tags, event.extra);
    }
    
    const error = hint.originalException;
    
    // Filter out noisy development errors
    if (__DEV__) {
      // Network errors during development (common with local services)
      if (error?.message?.includes("Network request failed")) {
        console.log("🚫 Filtered: Network error in development");
        return null;
      }
      
      // React Navigation errors that aren't actionable
      if (error?.message?.includes("The action") && error?.message?.includes("was not handled")) {
        console.log("🚫 Filtered: React Navigation error");
        return null;
      }
      
      // Metro bundler connection errors
      if (error?.message?.includes("Metro") || error?.message?.includes("bundler")) {
        console.log("🚫 Filtered: Metro bundler error");
        return null;
      }
    }
    
    // Filter out known non-critical errors in production
    if (!__DEV__) {
      // Network timeout errors (user can retry)
      if (error?.message?.includes("timeout") || error?.message?.includes("TIMEOUT")) {
        return null;
      }
      
      // User cancellation errors (not real errors)
      if (error?.message?.includes("cancelled") || error?.message?.includes("canceled")) {
        return null;
      }
    }
    
    // Add environment context to all errors
    if (event.tags) {
      event.tags.environment = __DEV__ ? "development" : "production";
      event.tags.app_version = "1.0.0"; // Update this with your actual version
    }
    
    return event;
  },
  
  // Enhanced error grouping
  beforeSendTransaction: (transaction) => {
    // Don't send development transactions unless explicitly needed
    if (__DEV__ && transaction.name?.includes("dev")) {
      return null;
    }
    return transaction;
  },
  
  // Initial scope configuration
  initialScope: {
    tags: {
      component: "root_layout",
      platform: "react-native",
    },
    contexts: {
      app: {
        name: "Booklet",
        version: "1.0.0",
        environment: __DEV__ ? "development" : "production",
      },
      device: {
        simulator: __DEV__,
      },
    },
  },
  
  // Enhanced debugging and development features
  debug: __DEV__, // Verbose logging in development
  spotlight: __DEV__, // Enable Spotlight in development
  
  // Better crash detection
  enableNativeCrashHandling: true,
  enableNativeNagger: false, // Disable native debugger warnings
  
  // Session and performance tracking
  enableAutoSessionTracking: true,
  autoSessionTracking: true,
  enableUserInteractionTracing: true,
  enableAppStartTracking: true,
  
  // Release tracking
  release: __DEV__ ? "development" : undefined, // Let EAS handle production releases
  environment: __DEV__ ? "development" : "production",
});

LogBox.ignoreAllLogs();

// Enhanced error boundary with Sentry integration
function SentryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorBoundary error={error} resetError={resetError} />
      )}
      showDialog={!__DEV__} // Show Sentry user feedback dialog in production
      dialogOptions={{
        title: "Something went wrong",
        subtitle: "Help us improve by reporting this error",
        subtitle2: "Your feedback helps make the app better.",
        labelName: "Name (optional)",
        labelEmail: "Email (optional)", 
        labelComments: "What happened?",
        labelSubmit: "Send Report",
        labelClose: "Close",
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

function AppLayout() {
  const { colorScheme } = useColorScheme();
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);

  // Enhanced update checking with Sentry tracking
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        Sentry.addBreadcrumb({
          message: "Checking for updates",
          category: "app.updates",
          level: "info",
        });

        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log("[RootLayout] Update available, downloading...");
          
          Sentry.addBreadcrumb({
            message: "Update available, downloading",
            category: "app.updates", 
            level: "info",
            data: { manifestCreatedAt: update.manifest?.createdAt },
          });

          const result = await Updates.fetchUpdateAsync();

          if (result.isNew) {
            Sentry.addBreadcrumb({
              message: "New update downloaded",
              category: "app.updates",
              level: "info",
            });
            setShowUpdateAlert(true);
          }
        } else {
          console.log("[RootLayout] No updates available");
          Sentry.addBreadcrumb({
            message: "No updates available",
            category: "app.updates",
            level: "info",
          });
        }
      } catch (error) {
        console.error("[RootLayout] Update check error:", error);
        Sentry.captureException(error, {
          tags: { operation: "update_check" },
          level: "warning", // Non-critical error
        });
      }
    };

    checkForUpdates();
  }, []);

  useEffect(() => {
    if (showUpdateAlert) {
      Sentry.addBreadcrumb({
        message: "Showing update alert to user",
        category: "app.updates",
        level: "info",
      });

      Alert.alert(
        "Update Available",
        "A new version has been downloaded. Restart the app to apply the update.",
        [
          {
            text: "Later",
            style: "cancel",
            onPress: () => {
              Sentry.addBreadcrumb({
                message: "User deferred update",
                category: "app.updates",
                level: "info",
              });
              setShowUpdateAlert(false);
            },
          },
          {
            text: "Restart Now",
            onPress: async () => {
              Sentry.addBreadcrumb({
                message: "User accepted update, restarting",
                category: "app.updates",
                level: "info",
              });
              setShowUpdateAlert(false);
              
              try {
                await Updates.reloadAsync();
              } catch (error) {
                Sentry.captureException(error, {
                  tags: { operation: "update_reload" },
                  level: "error",
                });
                console.error("Failed to reload after update:", error);
              }
            },
          },
        ],
      );
    }
  }, [showUpdateAlert]);

  // Track app lifecycle events
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: "App layout mounted",
      category: "app.lifecycle",
      level: "info",
      data: {
        colorScheme,
        timestamp: new Date().toISOString(),
      },
    });

    // Add device/environment context
    Sentry.setContext("app_state", {
      colorScheme,
      development: __DEV__,
      timestamp: new Date().toISOString(),
    });

    return () => {
      Sentry.addBreadcrumb({
        message: "App layout unmounting",
        category: "app.lifecycle",
        level: "info",
      });
    };
  }, [colorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NetworkProvider>
        <AuthProvider>
          <SentryErrorBoundary>
            <Stack
              screenOptions={{ headerShown: false, gestureEnabled: false }}
            >
              <Stack.Screen name="(protected)" />
              <Stack.Screen name="welcome" />
              <Stack.Screen
                name="sign-up"
                options={{
                  presentation: "modal",
                  headerShown: true,
                  headerTitle: "Sign Up",
                  headerStyle: {
                    backgroundColor:
                      colorScheme === "dark"
                        ? colors.dark.background
                        : colors.light.background,
                  },
                  headerTintColor:
                    colorScheme === "dark"
                      ? colors.dark.foreground
                      : colors.light.foreground,
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="sign-in"
                options={{
                  presentation: "modal",
                  headerShown: true,
                  headerTitle: "Sign In",
                  headerStyle: {
                    backgroundColor:
                      colorScheme === "dark"
                        ? colors.dark.background
                        : colors.light.background,
                  },
                  headerTintColor:
                    colorScheme === "dark"
                      ? colors.dark.foreground
                      : colors.light.foreground,
                  gestureEnabled: true,
                }}
              />
            </Stack>
            <OfflineIndicator />
          </SentryErrorBoundary>
        </AuthProvider>
      </NetworkProvider>
    </GestureHandlerRootView>
  );
}

// Export with enhanced Sentry wrapping
export default Sentry.wrap(AppLayout);