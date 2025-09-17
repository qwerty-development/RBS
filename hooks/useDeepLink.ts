import { useEffect, useCallback, useState, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import {
  parseDeepLinkUrl,
  navigateToDeepLink,
  isSupportedDeepLink,
  DEEP_LINK_ROUTES,
  type DeepLinkRoute,
} from "@/lib/deeplink";
import { useAuth } from "@/context/supabase-provider";

export interface DeepLinkState {
  initialUrl: string | null;
  lastProcessedUrl: string | null;
  isProcessing: boolean;
  error: string | null;
}

export interface DeepLinkHookOptions {
  // Whether to handle deep links automatically
  autoHandle?: boolean;

  // Fallback path when navigation fails
  fallbackPath?: string;

  // Custom handler for protected routes when user is not authenticated
  onAuthRequired?: (url: string) => void;

  // Custom handler for successful navigation
  onNavigationSuccess?: (url: string, path: string) => void;

  // Custom handler for navigation errors
  onNavigationError?: (url: string, error: Error) => void;

  // Delay before processing deep links (to allow auth to initialize)
  processDelay?: number;

  // Whether to log deep link activities for debugging
  enableLogging?: boolean;

  // Whether splash screen is currently showing (prevents navigation during splash)
  isSplashVisible?: boolean;

  // Callback when deep link should dismiss splash screen early
  onSplashDismissRequested?: () => void;
}

const DEFAULT_OPTIONS: Required<DeepLinkHookOptions> = {
  autoHandle: true,
  fallbackPath: "/",
  onAuthRequired: () => {},
  onNavigationSuccess: () => {},
  onNavigationError: () => {},
  processDelay: 1000,
  enableLogging: __DEV__,
  isSplashVisible: false,
  onSplashDismissRequested: () => {},
};

export function useDeepLink(options: DeepLinkHookOptions = {}) {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const { session, isGuest, initialized: authInitialized } = useAuth();

  const [state, setState] = useState<DeepLinkState>({
    initialUrl: null,
    lastProcessedUrl: null,
    isProcessing: false,
    error: null,
  });

  const [isMounted, setIsMounted] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const processedUrls = useRef<Set<string>>(new Set());
  const processingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeepLink = useRef<string | null>(null);
  const isAuthenticated = Boolean(session) || isGuest;

  const log = useCallback(
    (message: string, ...args: any[]) => {
      if (finalOptions.enableLogging) {
        console.log(`[DeepLink] ${message}`, ...args);
      }
    },
    [finalOptions.enableLogging],
  );

  // Check if URL should be ignored (development URLs, etc.)
  const shouldIgnoreUrl = useCallback((url: string): boolean => {
    // Ignore Expo development URLs
    if (url.startsWith("exp://")) return true;
    if (url.startsWith("exps://")) return true;

    // Ignore Metro bundler URLs
    if (url.includes(":8081")) return true;
    if (url.includes("localhost")) return true;
    if (url.includes("127.0.0.1")) return true;

    // Ignore file URLs
    if (url.startsWith("file://")) return true;

    // Ignore empty or invalid URLs
    if (!url || url.length < 5) return true;

    return false;
  }, []);

  // Process a deep link URL
  const processDeepLink = useCallback(
    async (url: string): Promise<boolean> => {
      // First check: ignore development/invalid URLs immediately
      if (shouldIgnoreUrl(url)) {
        log("Ignoring development/invalid URL:", url);
        return false;
      }

      if (!url || processedUrls.current.has(url)) {
        log("Skipping already processed URL:", url);
        return false;
      }

      if (!isMounted || !isNavigationReady) {
        log("Navigation not ready, delaying deep link processing:", url, {
          isMounted,
          isNavigationReady,
        });
        return false;
      }

      if (!authInitialized) {
        log("Auth not initialized, delaying deep link processing:", url);
        return false;
      }

      // If splash screen is visible, store the URL and defer navigation
      if (finalOptions.isSplashVisible) {
        log("Splash screen visible, storing pending deep link:", url);
        pendingDeepLink.current = url;

        // Process the URL to validate it, but don't navigate yet
        const { route } = parseDeepLinkUrl(url);
        if (isSupportedDeepLink(url) && !route?.protected) {
          // For non-protected routes, we can dismiss splash early
          log(
            "Non-protected route detected, requesting early splash dismissal",
          );
          finalOptions.onSplashDismissRequested();
        }

        setState((prev) => ({
          ...prev,
          initialUrl: url,
          isProcessing: false,
        }));

        return false;
      }

      log("Processing deep link:", url);

      setState((prev) => ({
        ...prev,
        isProcessing: true,
        error: null,
        lastProcessedUrl: url,
      }));

      try {
        const { route, path } = parseDeepLinkUrl(url);

        if (!isSupportedDeepLink(url)) {
          log("Unsupported deep link, using fallback:", url);

          if (finalOptions.autoHandle) {
            router.push(finalOptions.fallbackPath as any);
          }

          setState((prev) => ({ ...prev, isProcessing: false }));
          return false;
        }

        // Check if route requires authentication
        if (route?.protected && !isAuthenticated) {
          log("Protected route requires authentication:", url, path);

          finalOptions.onAuthRequired(url);

          // Store the URL for later processing after auth
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            initialUrl: url,
          }));

          return false;
        }

        // Navigate to the deep link
        const success = navigateToDeepLink(url, {
          isAuthenticated,
          canNavigate: isMounted && isNavigationReady,
          fallbackPath: finalOptions.fallbackPath,
          onAuthRequired: () => finalOptions.onAuthRequired(url),
        });

        if (success) {
          processedUrls.current.add(url);
          finalOptions.onNavigationSuccess(url, path);
          log("Deep link navigation successful:", url, "→", path);
        } else {
          throw new Error("Navigation failed");
        }

        setState((prev) => ({ ...prev, isProcessing: false }));
        return success;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        log("Deep link processing failed:", url, errorMessage);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));

        finalOptions.onNavigationError(
          url,
          error instanceof Error ? error : new Error(errorMessage),
        );
        return false;
      }
    },
    [
      shouldIgnoreUrl,
      isMounted,
      isNavigationReady,
      authInitialized,
      isAuthenticated,
      finalOptions,
      log,
    ],
  );

  // Handle app state changes (for when app is opened from background)
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        log("App became active, checking for pending deep links");

        // Clear processing timeout and check for new URLs
        if (processingTimeout.current) {
          clearTimeout(processingTimeout.current);
          processingTimeout.current = null;
        }
      }
    },
    [log],
  );

  // Handle incoming URL while app is running
  const handleUrl = useCallback(
    ({ url }: { url: string }) => {
      log("Received URL while app is running:", url);

      // Immediately ignore development URLs
      if (shouldIgnoreUrl(url)) {
        log("Ignoring development URL in handleUrl:", url);
        return;
      }

      if (processingTimeout.current) {
        clearTimeout(processingTimeout.current);
      }

      processingTimeout.current = setTimeout(() => {
        processDeepLink(url);
      }, finalOptions.processDelay);
    },
    [shouldIgnoreUrl, processDeepLink, finalOptions.processDelay, log],
  );

  // Get initial URL when app starts
  const getInitialUrl = useCallback(async () => {
    try {
      const initialUrl = await Linking.getInitialURL();
      log("Initial URL detected:", initialUrl);

      if (initialUrl) {
        // Immediately ignore development URLs
        if (shouldIgnoreUrl(initialUrl)) {
          log("Ignoring development URL in getInitialUrl:", initialUrl);
          return;
        }

        setState((prev) => ({ ...prev, initialUrl }));

        if (
          finalOptions.autoHandle &&
          authInitialized &&
          isMounted &&
          isNavigationReady
        ) {
          processingTimeout.current = setTimeout(() => {
            processDeepLink(initialUrl);
          }, finalOptions.processDelay);
        }
      }
    } catch (error) {
      log("Failed to get initial URL:", error);
    }
  }, [
    shouldIgnoreUrl,
    processDeepLink,
    finalOptions.autoHandle,
    finalOptions.processDelay,
    authInitialized,
    isMounted,
    isNavigationReady,
    log,
  ]);

  // Process pending deep link after authentication
  useEffect(() => {
    if (
      authInitialized &&
      isAuthenticated &&
      isMounted &&
      isNavigationReady &&
      state.initialUrl &&
      !processedUrls.current.has(state.initialUrl)
    ) {
      // Double-check URL filtering before processing
      if (shouldIgnoreUrl(state.initialUrl)) {
        log("Ignoring development URL in auth effect:", state.initialUrl);
        return;
      }

      log("Auth completed, processing pending deep link:", state.initialUrl);
      processDeepLink(state.initialUrl);
    }
  }, [
    shouldIgnoreUrl,
    authInitialized,
    isAuthenticated,
    isMounted,
    isNavigationReady,
    state.initialUrl,
    processDeepLink,
    log,
  ]);

  // Process pending deep link when splash screen is dismissed
  useEffect(() => {
    if (
      !finalOptions.isSplashVisible &&
      pendingDeepLink.current &&
      authInitialized &&
      isMounted &&
      isNavigationReady &&
      !processedUrls.current.has(pendingDeepLink.current)
    ) {
      const url = pendingDeepLink.current;
      log("Splash screen dismissed, processing pending deep link:", url);

      // Clear the pending URL to prevent re-processing
      pendingDeepLink.current = null;

      // Process the deep link
      processDeepLink(url);
    }
  }, [
    finalOptions.isSplashVisible,
    authInitialized,
    isMounted,
    isNavigationReady,
    processDeepLink,
    log,
  ]);

  // Set mounting state
  useEffect(() => {
    setIsMounted(true);

    // Give the navigation system time to initialize
    const navigationTimer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 500); // Small delay to ensure navigation is ready

    return () => {
      setIsMounted(false);
      setIsNavigationReady(false);
      clearTimeout(navigationTimer);
    };
  }, []);

  // Set up deep link listeners
  useEffect(() => {
    log("Setting up deep link listeners");

    // Get initial URL
    getInitialUrl();

    // Listen for URL events
    const urlSubscription = Linking.addEventListener("url", handleUrl);

    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      log("Cleaning up deep link listeners");
      urlSubscription?.remove();
      appStateSubscription?.remove();

      if (processingTimeout.current) {
        clearTimeout(processingTimeout.current);
      }
    };
  }, [getInitialUrl, handleUrl, handleAppStateChange, log]);

  // Manual deep link processing
  const handleDeepLink = useCallback(
    async (url: string): Promise<boolean> => {
      return await processDeepLink(url);
    },
    [processDeepLink],
  );

  // Clear processed URLs cache
  const clearCache = useCallback(() => {
    processedUrls.current.clear();
    setState((prev) => ({
      ...prev,
      error: null,
      lastProcessedUrl: null,
    }));
    log("Deep link cache cleared");
  }, [log]);

  // Get available routes
  const getAvailableRoutes = useCallback((): DeepLinkRoute[] => {
    return DEEP_LINK_ROUTES;
  }, []);

  // Check if a URL is supported
  const isUrlSupported = useCallback((url: string): boolean => {
    return isSupportedDeepLink(url);
  }, []);

  return {
    // State
    state,
    isAuthenticated,

    // Actions
    handleDeepLink,
    clearCache,

    // Utilities
    getAvailableRoutes,
    isUrlSupported,
    parseUrl: parseDeepLinkUrl,
  };
}

export default useDeepLink;
