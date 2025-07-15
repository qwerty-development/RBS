import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNetwork } from "@/context/network-provider";

interface OfflineAction {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

interface OfflineSyncOptions {
  storageKey?: string;
  maxRetries?: number;
  retryDelay?: number;
  onSyncStart?: () => void;
  onSyncComplete?: (successCount: number, failureCount: number) => void;
  onSyncError?: (error: Error) => void;
}

export function useOfflineSync(options: OfflineSyncOptions = {}) {
  const {
    storageKey = "offline_actions",
    maxRetries = 3,
    retryDelay = 1000,
    onSyncStart,
    onSyncComplete,
    onSyncError,
  } = options;

  const { isOnline } = useNetwork();
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout>(null);

  // Load pending actions from storage
  const loadPendingActions = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const actions = JSON.parse(stored);
        setPendingActions(actions);
      }
    } catch (error) {
      console.error("[OfflineSync] Failed to load pending actions:", error);
    }
  }, [storageKey]);

  // Save pending actions to storage
  const savePendingActions = useCallback(async (actions: OfflineAction[]) => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(actions));
    } catch (error) {
      console.error("[OfflineSync] Failed to save pending actions:", error);
    }
  }, [storageKey]);

  // Add action to offline queue
  const queueAction = useCallback(async (type: string, data: any) => {
    const action: OfflineAction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const newActions = [...pendingActions, action];
    setPendingActions(newActions);
    await savePendingActions(newActions);

    return action.id;
  }, [pendingActions, savePendingActions]);

  // Remove action from queue
  const removeAction = useCallback(async (actionId: string) => {
    const newActions = pendingActions.filter(action => action.id !== actionId);
    setPendingActions(newActions);
    await savePendingActions(newActions);
  }, [pendingActions, savePendingActions]);

  // Sync actions with server
  const syncActions = useCallback(async (
    syncHandler: (action: OfflineAction) => Promise<boolean>
  ) => {
    if (!isOnline || syncing || pendingActions.length === 0) {
      return;
    }

    setSyncing(true);
    onSyncStart?.();

    let successCount = 0;
    let failureCount = 0;
    const actionsToRetry: OfflineAction[] = [];

    try {
      for (const action of pendingActions) {
        try {
          const success = await syncHandler(action);
          
          if (success) {
            successCount++;
            await removeAction(action.id);
          } else {
            failureCount++;
            
            if (action.retryCount < maxRetries) {
              actionsToRetry.push({
                ...action,
                retryCount: action.retryCount + 1,
              });
            } else {
              console.warn("[OfflineSync] Action failed max retries:", action);
              await removeAction(action.id);
            }
          }
        } catch (error) {
          console.error("[OfflineSync] Sync error for action:", action, error);
          failureCount++;
          
          if (action.retryCount < maxRetries) {
            actionsToRetry.push({
              ...action,
              retryCount: action.retryCount + 1,
            });
          } else {
            await removeAction(action.id);
          }
        }
      }

      // Update retry actions
      if (actionsToRetry.length > 0) {
        const updatedActions = pendingActions.map(action => {
          const retryAction = actionsToRetry.find(retry => retry.id === action.id);
          return retryAction || action;
        });
        setPendingActions(updatedActions);
        await savePendingActions(updatedActions);

        // Schedule retry
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        
        syncTimeoutRef.current = setTimeout(() => {
          syncActions(syncHandler);
        }, retryDelay);
      }

      onSyncComplete?.(successCount, failureCount);
    } catch (error) {
      console.error("[OfflineSync] Sync failed:", error);
      onSyncError?.(error as Error);
    } finally {
      setSyncing(false);
    }
  }, [
    isOnline,
    syncing,
    pendingActions,
    maxRetries,
    retryDelay,
    onSyncStart,
    onSyncComplete,
    onSyncError,
    removeAction,
    savePendingActions,
  ]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0 && !syncing) {
      // Add small delay to ensure connection is stable
      const autoSyncTimeout = setTimeout(() => {
        // Trigger sync if syncActions is called with a handler
        console.log("[OfflineSync] Connection restored, ready to sync", pendingActions.length, "actions");
      }, 2000);

      return () => clearTimeout(autoSyncTimeout);
    }
  }, [isOnline, pendingActions.length, syncing]);

  // Load actions on mount
  useEffect(() => {
    loadPendingActions();
  }, [loadPendingActions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    pendingActions,
    syncing,
    queueAction,
    removeAction,
    syncActions,
    hasPendingActions: pendingActions.length > 0,
    pendingCount: pendingActions.length,
  };
}