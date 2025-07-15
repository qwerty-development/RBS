// context/network-provider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  PropsWithChildren,
} from "react";
import { Platform, AppState, AppStateStatus } from "react-native";

// Types
type ConnectionQuality = "poor" | "fair" | "good" | "excellent";
type NetworkType = "WIFI" | "CELLULAR" | "UNKNOWN";

type NetworkState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: NetworkType;
  connectionQuality: ConnectionQuality;
  isSlowConnection: boolean;
  effectiveType: string | null;
  details: {
    ipAddress?: string;
  } | null;
};

type NetworkContextType = {
  networkState: NetworkState;
  isOnline: boolean;
  isOffline: boolean;
  refresh: () => Promise<void>;
  getConnectionInfo: () => NetworkState;
  testConnectionSpeed: () => Promise<{
    downloadSpeed: number;
    latency: number;
    quality: ConnectionQuality;
  }>;
  onNetworkChange: (callback: (state: NetworkState) => void) => () => void;
};

const NetworkContext = createContext<NetworkContextType | null>(null);

// Connection quality thresholds
const QUALITY_THRESHOLDS = {
  excellent: { minSpeed: 10, maxLatency: 50 },
  good: { minSpeed: 5, maxLatency: 100 },
  fair: { minSpeed: 1, maxLatency: 200 },
  poor: { minSpeed: 0, maxLatency: Infinity },
};

// Speed test configuration
const SPEED_TEST_CONFIG = {
  testUrl: "https://httpbin.org/bytes/10240", // 10KB test file
  timeout: 10000,
  retries: 2,
};

export function NetworkProvider({ children }: PropsWithChildren) {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: null,
    isInternetReachable: null,
    type: "UNKNOWN",
    connectionQuality: "fair",
    isSlowConnection: false,
    effectiveType: null,
    details: null,
  });

  const listenersRef = useRef<Set<(state: NetworkState) => void>>(new Set());
  const speedTestRef = useRef<Promise<any> | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Test internet connectivity
  const testInternetConnectivity = useCallback(async (): Promise<boolean> => {
    const testUrls = [
      'https://www.google.com/generate_204',
      'https://httpbin.org/status/200',
      'https://1.1.1.1',
      'https://8.8.8.8',
    ];

    for (const url of testUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeoutId);
        
        if (response.ok || response.status === 204) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    
    return false;
  }, []);

  // Basic connection detection using fetch
  const detectConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Estimate connection type based on speed
  const estimateConnectionType = useCallback((speed: number): NetworkType => {
    if (speed > 10) return "WIFI"; // High speed likely WiFi
    if (speed > 1) return "CELLULAR"; // Medium speed likely cellular
    return "UNKNOWN";
  }, []);

  // Determine connection quality
  const getConnectionQuality = useCallback((speed?: number, latency?: number): ConnectionQuality => {
    if (speed !== undefined && latency !== undefined) {
      for (const [qualityLevel, thresholds] of Object.entries(QUALITY_THRESHOLDS)) {
        if (speed >= thresholds.minSpeed && latency <= thresholds.maxLatency) {
          return qualityLevel as ConnectionQuality;
        }
      }
    }
    return "fair"; // Default quality
  }, []);

  // Test connection speed
  const testConnectionSpeed = useCallback(async () => {
    if (speedTestRef.current) {
      return speedTestRef.current;
    }

    const performSpeedTest = async (): Promise<{
      downloadSpeed: number;
      latency: number;
      quality: ConnectionQuality;
    }> => {
      try {
        const startTime = Date.now();
        const latencyStart = performance.now();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SPEED_TEST_CONFIG.timeout);

        const response = await fetch(SPEED_TEST_CONFIG.testUrl, {
          method: "GET",
          cache: "no-cache",
          signal: controller.signal,
          headers: {
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
          },
        });

        clearTimeout(timeoutId);
        const latency = performance.now() - latencyStart;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const endTime = Date.now();
        
        const duration = (endTime - startTime) / 1000;
        const sizeInBits = blob.size * 8;
        const speedBps = sizeInBits / duration;
        const speedMbps = speedBps / (1024 * 1024);

        const quality = getConnectionQuality(speedMbps, latency);

        return {
          downloadSpeed: Math.round(speedMbps * 100) / 100,
          latency: Math.round(latency),
          quality,
        };
      } catch (error) {
        console.warn("[NetworkProvider] Speed test failed:", error);
        return {
          downloadSpeed: 0,
          latency: 999,
          quality: "poor" as ConnectionQuality,
        };
      }
    };

    speedTestRef.current = performSpeedTest();
    const result = await speedTestRef.current;
    speedTestRef.current = null;

    return result;
  }, [getConnectionQuality]);

  // Update network state
  const updateNetworkState = useCallback(async () => {
    try {
      // Check basic connectivity
      const isConnected = await detectConnection();
      let isInternetReachable = false;
      let type: NetworkType = "UNKNOWN";
      let quality: ConnectionQuality = "poor";

      if (isConnected) {
        // Test internet reachability
        isInternetReachable = await testInternetConnectivity();
        
        if (isInternetReachable) {
          // Run a quick speed test to estimate connection type and quality
          try {
            const speedResult = await testConnectionSpeed();
            type = estimateConnectionType(speedResult.downloadSpeed);
            quality = speedResult.quality;
          } catch {
            // Fallback values
            type = "UNKNOWN";
            quality = "fair";
          }
        }
      }

      const newNetworkState: NetworkState = {
        isConnected,
        isInternetReachable,
        type,
        connectionQuality: quality,
        isSlowConnection: quality === "poor" || quality === "fair",
        effectiveType: type.toLowerCase(),
        details: null, // We can't reliably get IP without native modules
      };

      setNetworkState(newNetworkState);
      listenersRef.current.forEach((callback) => callback(newNetworkState));
    } catch (error) {
      console.error("[NetworkProvider] Failed to update network state:", error);
      
      const offlineState: NetworkState = {
        isConnected: false,
        isInternetReachable: false,
        type: "UNKNOWN",
        connectionQuality: "poor",
        isSlowConnection: true,
        effectiveType: null,
        details: null,
      };

      setNetworkState(offlineState);
      listenersRef.current.forEach((callback) => callback(offlineState));
    }
  }, [detectConnection, testInternetConnectivity, testConnectionSpeed, estimateConnectionType]);

  // Refresh network state
  const refresh = useCallback(async () => {
    await updateNetworkState();
  }, [updateNetworkState]);

  // Get current connection info
  const getConnectionInfo = useCallback(() => networkState, [networkState]);

  // Network change event handler
  const onNetworkChange = useCallback(
    (callback: (state: NetworkState) => void) => {
      listenersRef.current.add(callback);
      return () => {
        listenersRef.current.delete(callback);
      };
    },
    []
  );

  // Setup network monitoring
  useEffect(() => {
    // Initial check
    updateNetworkState();

    // Poll every 10 seconds (less frequent to avoid performance issues)
    pollingIntervalRef.current = setInterval(() => {
      updateNetworkState();
    }, 10000);

    // Monitor app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        updateNetworkState();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Web-specific listeners
    if (Platform.OS === 'web') {
      const handleOnline = () => updateNetworkState();
      const handleOffline = () => updateNetworkState();
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          updateNetworkState();
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        subscription?.remove();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      subscription?.remove();
    };
  }, [updateNetworkState]);

  const isOnline = networkState.isConnected === true && networkState.isInternetReachable === true;
  const isOffline = !isOnline;

  const contextValue: NetworkContextType = {
    networkState,
    isOnline,
    isOffline,
    refresh,
    getConnectionInfo,
    testConnectionSpeed,
    onNetworkChange,
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
}

// Hooks
export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  
  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }
  
  return context;
}

export function useNetworkState(): NetworkState {
  const { networkState } = useNetwork();
  return networkState;
}

export function useConnectionStatus() {
  const { isOnline, isOffline, networkState } = useNetwork();
  return {
    isOnline,
    isOffline,
    isConnected: networkState.isConnected,
    isInternetReachable: networkState.isInternetReachable,
    isSlowConnection: networkState.isSlowConnection,
    connectionQuality: networkState.connectionQuality,
  };
}