// hooks/useNetworkMonitor.ts
import { useEffect, useRef, useCallback } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import { useNetwork } from "@/context/network-provider";

// Types
export interface NetworkMonitorConfig {
  // Alert configuration
  showOfflineAlert?: boolean;
  showOnlineAlert?: boolean;
  showSlowConnectionAlert?: boolean;
  alertDelay?: number; // Delay before showing alerts (ms)
  
  // Callbacks
  onOffline?: () => void;
  onOnline?: () => void;
  onConnectionChange?: (quality: string) => void;
  
  // Monitoring options
  checkAppState?: boolean; // Monitor when app comes to foreground
}

// Default configuration
const DEFAULT_CONFIG: Required<NetworkMonitorConfig> = {
  showOfflineAlert: true,
  showOnlineAlert: true,
  showSlowConnectionAlert: true,
  alertDelay: 3000,
  onOffline: () => {},
  onOnline: () => {},
  onConnectionChange: () => {},
  checkAppState: true,
};

// Alert messages
const ALERT_MESSAGES = {
  offline: {
    title: "No Internet Connection",
    message: "You're currently offline. Some features may not be available.",
  },
  online: {
    title: "Connection Restored",
    message: "You're back online!",
  },
  slowConnection: {
    title: "Slow Connection",
    message: "Your connection is slow. Things may take longer to load.",
  },
};

// Hook implementation
export function useNetworkMonitor(config: NetworkMonitorConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { isOnline, networkState, addListener, refresh } = useNetwork();
  
  // Refs to track state and timers
  const previousOnlineRef = useRef(isOnline);
  const previousQualityRef = useRef(networkState.quality);
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownInitialAlertRef = useRef(false);

  // Show alert with optional delay
  const showAlert = useCallback((
    title: string,
    message: string,
    delay: number = 0
  ) => {
    // Clear any pending alert
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }

    if (delay > 0) {
      alertTimerRef.current = setTimeout(() => {
        Alert.alert(title, message, [{ text: "OK" }]);
        alertTimerRef.current = null;
      }, delay);
    } else {
      Alert.alert(title, message, [{ text: "OK" }]);
    }
  }, []);

  // Handle offline state
  const handleOffline = useCallback(() => {
    finalConfig.onOffline();
    
    if (finalConfig.showOfflineAlert && hasShownInitialAlertRef.current) {
      showAlert(
        ALERT_MESSAGES.offline.title,
        ALERT_MESSAGES.offline.message,
        finalConfig.alertDelay
      );
    }
  }, [finalConfig, showAlert]);

  // Handle online state
  const handleOnline = useCallback(() => {
    // Clear any pending offline alert
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
    
    finalConfig.onOnline();
    
    if (finalConfig.showOnlineAlert && hasShownInitialAlertRef.current) {
      showAlert(
        ALERT_MESSAGES.online.title,
        ALERT_MESSAGES.online.message,
        0 // Show immediately
      );
    }
  }, [finalConfig, showAlert]);

  // Handle connection quality change
  const handleQualityChange = useCallback((quality: string) => {
    finalConfig.onConnectionChange(quality);
    
    if (
      finalConfig.showSlowConnectionAlert &&
      hasShownInitialAlertRef.current &&
      (quality === "poor" || quality === "fair") &&
      (previousQualityRef.current === "good" || previousQualityRef.current === "excellent")
    ) {
      showAlert(
        ALERT_MESSAGES.slowConnection.title,
        ALERT_MESSAGES.slowConnection.message,
        0
      );
    }
  }, [finalConfig, showAlert]);

  // Monitor network changes
  useEffect(() => {
    const cleanup = addListener((state) => {
      const currentlyOnline = state.isConnected && state.isInternetReachable;
      
      // Check for online/offline change
      if (previousOnlineRef.current !== currentlyOnline) {
        if (currentlyOnline) {
          handleOnline();
        } else {
          handleOffline();
        }
        previousOnlineRef.current = currentlyOnline;
      }
      
      // Check for quality change
      if (previousQualityRef.current !== state.quality) {
        handleQualityChange(state.quality);
        previousQualityRef.current = state.quality;
      }
    });

    // Mark that we've initialized
    setTimeout(() => {
      hasShownInitialAlertRef.current = true;
    }, 1000);

    return cleanup;
  }, [addListener, handleOnline, handleOffline, handleQualityChange]);

  // Monitor app state changes
  useEffect(() => {
    if (!finalConfig.checkAppState) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        // Refresh network state when app comes to foreground
        refresh();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [finalConfig.checkAppState, refresh]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    networkState,
    connectionQuality: networkState.quality,
  };
}