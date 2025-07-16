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

// Types
export type ConnectionQuality = "poor" | "fair" | "good" | "excellent" | "unknown";

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetInfoStateType;
  quality: ConnectionQuality;
  details: {
    cellularGeneration?: string;
    isConnectionExpensive?: boolean;
  };
}

export interface NetworkContextType {
  // State
  networkState: NetworkState;
  isOnline: boolean;
  isOffline: boolean;
  isLoading: boolean;
  hasInitialized: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  
  // Listeners
  addListener: (callback: (state: NetworkState) => void) => () => void;
}

// Default state
const DEFAULT_NETWORK_STATE: NetworkState = {
  isConnected: false,
  isInternetReachable: false,
  type: NetInfoStateType.unknown,
  quality: "unknown",
  details: {},
};

// Context
const NetworkContext = createContext<NetworkContextType | null>(null);

// Provider component
export function NetworkProvider({ children }: PropsWithChildren) {
  const [networkState, setNetworkState] = useState<NetworkState>(DEFAULT_NETWORK_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const listenersRef = useRef<Set<(state: NetworkState) => void>>(new Set());
  const lastUpdateRef = useRef<number>(0);

  // Determine connection quality based on network type
  const getConnectionQuality = useCallback((state: NetInfoState): ConnectionQuality => {
    if (!state.isConnected || !state.isInternetReachable) {
      return "poor";
    }

    switch (state.type) {
      case NetInfoStateType.wifi:
      case NetInfoStateType.ethernet:
        return "excellent";
      
      case NetInfoStateType.cellular:
        const generation = state.details?.cellularGeneration;
        if (generation === "5g") return "excellent";
        if (generation === "4g") return "good";
        if (generation === "3g") return "fair";
        return "poor";
      
      case NetInfoStateType.bluetooth:
        return "poor";
      
      default:
        return "unknown";
    }
  }, []);

  // Process NetInfo state into our format
  const processNetworkState = useCallback((state: NetInfoState): NetworkState => {
    const quality = getConnectionQuality(state);
    
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
      quality,
      details: {
        cellularGeneration: state.details?.cellularGeneration,
        isConnectionExpensive: state.details?.isConnectionExpensive,
      },
    };
  }, [getConnectionQuality]);

  // Update network state and notify listeners
  const updateNetworkState = useCallback((state: NetInfoState) => {
    // Throttle updates to prevent excessive re-renders
    const now = Date.now();
    if (now - lastUpdateRef.current < 500) {
      return;
    }
    lastUpdateRef.current = now;

    const newState = processNetworkState(state);
    
    // Mark as initialized and not loading when we get the first real update
    if (!hasInitialized) {
      setHasInitialized(true);
      setIsLoading(false);
    }
    
    setNetworkState(prevState => {
      // Only update if state actually changed
      if (
        prevState.isConnected === newState.isConnected &&
        prevState.isInternetReachable === newState.isInternetReachable &&
        prevState.type === newState.type &&
        prevState.quality === newState.quality
      ) {
        return prevState;
      }
      
      // Notify listeners
      listenersRef.current.forEach(listener => {
        try {
          listener(newState);
        } catch (error) {
          console.error("[NetworkProvider] Listener error:", error);
        }
      });
      
      return newState;
    });
  }, [processNetworkState, hasInitialized]);

  // Manually refresh network state
  const refresh = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      updateNetworkState(state);
    } catch (error) {
      console.error("[NetworkProvider] Refresh error:", error);
      // Only set loading to false if we haven't initialized yet
      if (!hasInitialized) {
        setIsLoading(false);
      }
    }
  }, [updateNetworkState, hasInitialized]);

  // Add listener for network changes
  const addListener = useCallback((callback: (state: NetworkState) => void) => {
    listenersRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  // Initialize network monitoring
  useEffect(() => {
    // Initial fetch
    refresh();

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkState);

    return () => {
      unsubscribe();
    };
  }, [refresh, updateNetworkState]);

  // Context value
  const value: NetworkContextType = {
    networkState,
    isOnline: networkState.isConnected && networkState.isInternetReachable,
    isOffline: !networkState.isConnected || !networkState.isInternetReachable,
    isLoading,
    hasInitialized,
    refresh,
    addListener,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

// Hook to use network context
export function useNetwork() {
  const context = useContext(NetworkContext);
  
  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }
  
  return context;
}

// Convenience hook for connection status
export function useConnectionStatus() {
  const { networkState, isOnline, isOffline, isLoading, hasInitialized } = useNetwork();
  
  return {
    isOnline,
    isOffline,
    isLoading,
    hasInitialized,
    isConnected: networkState.isConnected,
    isInternetReachable: networkState.isInternetReachable,
    connectionType: networkState.type,
    connectionQuality: networkState.quality,
  };
}