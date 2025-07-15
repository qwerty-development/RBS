
// hooks/useNetworkMonitor.ts
import { useEffect, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { useNetwork } from "@/context/network-provider";

interface NetworkMonitorOptions {
  showOfflineAlert?: boolean;
  showSlowConnectionAlert?: boolean;
  alertThreshold?: number; // ms - how long to wait before showing alert
  onConnectionLost?: () => void;
  onConnectionRestored?: () => void;
  onSlowConnection?: () => void;
  onConnectionImproved?: () => void;
}

export function useNetworkMonitor(options: NetworkMonitorOptions = {}) {
  const {
    showOfflineAlert = true,
    showSlowConnectionAlert = true,
    alertThreshold = 3000,
    onConnectionLost,
    onConnectionRestored,
    onSlowConnection,
    onConnectionImproved,
  } = options;

  const { networkState, isOnline, onNetworkChange } = useNetwork();
  const previousState = useRef({
    isOnline: isOnline,
    isSlowConnection: networkState.isSlowConnection,
  });
  const alertTimeoutRef = useRef<NodeJS.Timeout>(null);

  const showAlert = useCallback((title: string, message: string) => {
    Alert.alert(title, message, [{ text: "OK" }]);
  }, []);

  const handleConnectionLost = useCallback(() => {
    onConnectionLost?.();
    
    if (showOfflineAlert) {
      // Clear any pending alert
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      
      // Show alert after threshold
      alertTimeoutRef.current = setTimeout(() => {
        showAlert(
          "Connection Lost",
          "You're currently offline. Some features may not work until connection is restored."
        );
      }, alertThreshold);
    }
  }, [onConnectionLost, showOfflineAlert, alertThreshold, showAlert]);

  const handleConnectionRestored = useCallback(() => {
    // Clear pending offline alert
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
    
    onConnectionRestored?.();
    
    if (showOfflineAlert) {
      showAlert(
        "Connection Restored",
        "You're back online! All features are now available."
      );
    }
  }, [onConnectionRestored, showOfflineAlert, showAlert]);

  const handleSlowConnection = useCallback(() => {
    onSlowConnection?.();
    
    if (showSlowConnectionAlert) {
      showAlert(
        "Slow Connection",
        "Your connection appears to be slow. Some features may take longer to load."
      );
    }
  }, [onSlowConnection, showSlowConnectionAlert, showAlert]);

  const handleConnectionImproved = useCallback(() => {
    onConnectionImproved?.();
  }, [onConnectionImproved]);

  // Monitor network changes
  useEffect(() => {
    const cleanup = onNetworkChange((state) => {
      const currentOnline = state.isConnected === true && state.isInternetReachable === true;
      const currentSlow = state.isSlowConnection;
      
      // Connection state changes
      if (previousState.current.isOnline !== currentOnline) {
        if (currentOnline) {
          handleConnectionRestored();
        } else {
          handleConnectionLost();
        }
      }
      
      // Connection quality changes
      if (previousState.current.isSlowConnection !== currentSlow) {
        if (currentSlow && currentOnline) {
          handleSlowConnection();
        } else if (!currentSlow && currentOnline) {
          handleConnectionImproved();
        }
      }
      
      previousState.current = {
        isOnline: currentOnline,
        isSlowConnection: currentSlow,
      };
    });

    return cleanup;
  }, [
    onNetworkChange,
    handleConnectionLost,
    handleConnectionRestored,
    handleSlowConnection,
    handleConnectionImproved,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    isSlowConnection: networkState.isSlowConnection,
    connectionQuality: networkState.connectionQuality,
    networkType: networkState.type,
  };
}
