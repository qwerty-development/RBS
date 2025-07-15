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
import NetInfo, { NetInfoState, NetInfoStateType } from "@react-native-community/netinfo";
import { Platform } from "react-native";

// Types
type ConnectionQuality = "poor" | "fair" | "good" | "excellent";

type NetworkState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: NetInfoStateType;
  connectionQuality: ConnectionQuality;
  isSlowConnection: boolean;
  effectiveType: string | null;
  details: {
    strength?: number;
    ssid?: string;
    bssid?: string;
    frequency?: number;
    ipAddress?: string;
    subnet?: string;
    cellularGeneration?: string;
    carrier?: string;
  } | null;
};

type NetworkContextType = {
  networkState: NetworkState;
  isOnline: boolean;
  isOffline: boolean;
  refresh: () => Promise<void>;
  getConnectionInfo: () => NetworkState;
  // Connection speed testing
  testConnectionSpeed: () => Promise<{
    downloadSpeed: number; // Mbps
    latency: number; // ms
    quality: ConnectionQuality;
  }>;
  // Network change handlers
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
  testUrl: "https://httpbin.org/bytes/10240", // 10KB test file for better accuracy
  timeout: 10000,
  retries: 2,
};

export function NetworkProvider({ children }: PropsWithChildren) {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: null,
    isInternetReachable: null,
    type: NetInfoStateType.unknown,
    connectionQuality: "fair",
    isSlowConnection: false,
    effectiveType: null,
    details: null,
  });

  // Use ref for listeners to avoid re-renders
  const listenersRef = useRef<Set<(state: NetworkState) => void>>(new Set());
  const speedTestRef = useRef<Promise<any> | null>(null);

  // Determine connection quality based on type and details
  const getConnectionQuality = useCallback(
    (state: NetInfoState): ConnectionQuality => {
      if (!state.isConnected || !state.isInternetReachable) {
        return "poor";
      }

      switch (state.type) {
        case NetInfoStateType.wifi:
          if (state.details && 'strength' in state.details && typeof state.details.strength === 'number') {
            const strength = state.details.strength;
            if (strength >= -50) return "excellent";
            if (strength >= -60) return "good";
            if (strength >= -70) return "fair";
            return "poor";
          }
          return "good"; // Default for WiFi when strength unknown

        case NetInfoStateType.cellular:
          if (state.details && 'cellularGeneration' in state.details && state.details.cellularGeneration) {
            switch (state.details.cellularGeneration) {
              case "5g":
                return "excellent";
              case "4g":
                return "good";
              case "3g":
                return "fair";
              default:
                return "poor";
            }
          }
          return "fair"; // Default for cellular

        case NetInfoStateType.ethernet:
          return "excellent";

        case NetInfoStateType.bluetooth:
          return "poor";

        default:
          return "fair";
      }
    },
    []
  );

  // Check if connection is considered slow
  const isSlowConnection = useCallback((quality: ConnectionQuality): boolean => {
    return quality === "poor" || quality === "fair";
  }, []);

  // Update network state from NetInfo
  const updateNetworkState = useCallback(
    (state: NetInfoState | null) => {
      if (!state) {
        setNetworkState({
          isConnected: false,
          isInternetReachable: false,
          type: NetInfoStateType.unknown,
          connectionQuality: "poor",
          isSlowConnection: true,
          effectiveType: null,
          details: null,
        });
        return;
      }
      
      const quality = getConnectionQuality(state);
      
      // Helper function to safely extract details based on connection type
      const getConnectionDetails = (): NetworkState['details'] => {
        if (!state.details) return null;

        const baseDetails: NetworkState['details'] = {
          ipAddress: state.details.ipAddress || undefined,
          subnet: state.details.subnet || undefined,
        };

        // Type-specific details
        switch (state.type) {
          case NetInfoStateType.wifi:
            if ('ssid' in state.details) {
              return {
                ...baseDetails,
                ssid: state.details.ssid || undefined,
                bssid: state.details.bssid || undefined,
                frequency: state.details.frequency || undefined,
                strength: typeof state.details.strength === 'number' ? state.details.strength : undefined,
              };
            }
            break;
            
          case NetInfoStateType.cellular:
            if ('cellularGeneration' in state.details) {
              return {
                ...baseDetails,
                cellularGeneration: state.details.cellularGeneration || undefined,
                carrier: state.details.carrier || undefined,
              };
            }
            break;
            
          default:
            return baseDetails;
        }
        
        return baseDetails;
      };

      // Get effectiveType equivalent from cellular generation
      const getEffectiveType = (): string | null => {
        if (state.type === NetInfoStateType.cellular && 
            state.details && 
            'cellularGeneration' in state.details) {
          return state.details.cellularGeneration || null;
        }
        return null;
      };

      const newNetworkState: NetworkState = {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        connectionQuality: quality,
        isSlowConnection: isSlowConnection(quality),
        effectiveType: getEffectiveType(),
        details: getConnectionDetails(),
      };

      setNetworkState(newNetworkState);

      // Notify listeners
      listenersRef.current.forEach((callback) => callback(newNetworkState));
    },
    [getConnectionQuality, isSlowConnection]
  );

  // Test connection speed
  const testConnectionSpeed = useCallback(async () => {
    // Prevent multiple concurrent speed tests
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

        const response = await fetch(SPEED_TEST_CONFIG.testUrl, {
          method: "GET",
          cache: "no-cache",
          headers: {
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
          },
        });

        const latency = performance.now() - latencyStart;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const endTime = Date.now();
        
        const duration = (endTime - startTime) / 1000; // seconds
        const sizeInBits = blob.size * 8; // bits
        const speedBps = sizeInBits / duration; // bits per second
        const speedMbps = speedBps / (1024 * 1024); // Mbps

        // Determine quality based on speed and latency
        let quality: ConnectionQuality = "poor";
        
        for (const [qualityLevel, thresholds] of Object.entries(QUALITY_THRESHOLDS)) {
          if (speedMbps >= thresholds.minSpeed && latency <= thresholds.maxLatency) {
            quality = qualityLevel as ConnectionQuality;
            break;
          }
        }

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
  }, []);

  // Refresh network state
  const refresh = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      updateNetworkState(state);
    } catch (error) {
      console.error("[NetworkProvider] Failed to refresh network state:", error);
    }
  }, [updateNetworkState]);

  // Get current connection info
  const getConnectionInfo = useCallback(() => networkState, [networkState]);

  // Network change event handler
  const onNetworkChange = useCallback(
    (callback: (state: NetworkState) => void) => {
      listenersRef.current.add(callback);

      // Return cleanup function
      return () => {
        listenersRef.current.delete(callback);
      };
    },
    []
  );

  // Initialize NetInfo listener
  useEffect(() => {
    // Initial fetch
    NetInfo.fetch().then(updateNetworkState);

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkState);

    return () => {
      unsubscribe();
    };
  }, [updateNetworkState]);

  // Computed values
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

// Hook to use network context
export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  
  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }
  
  return context;
}

// Convenience hooks
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