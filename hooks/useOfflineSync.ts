// hooks/useOfflineSync.ts
import { useState, useEffect } from "react";
import { offlineSync, OfflineAction, SyncHandler, SyncResult } from "@/services/offlineSync";

export function useOfflineSync<T = any>() {
  const [queue, setQueue] = useState<OfflineAction[]>(offlineSync.getQueue());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleQueueChange = (newQueue: OfflineAction[]) => {
      setQueue(newQueue);
    };
    const handleSyncStatusChange = (isSyncing: boolean) => {
      setSyncing(isSyncing);
    };
    const handleSyncError = (err: Error) => {
      setError(err);
    };

    offlineSync.on("queueChanged", handleQueueChange);
    offlineSync.on("syncStatusChanged", handleSyncStatusChange);
    offlineSync.on("syncError", handleSyncError);

    // Initial sync attempt when hook mounts if there are pending actions and online
    if (offlineSync.hasPendingActions() && offlineSync.isOnline) {
      offlineSync.sync();
    }

    return () => {
      offlineSync.off("queueChanged", handleQueueChange);
      offlineSync.off("syncStatusChanged", handleSyncStatusChange);
      offlineSync.off("syncError", handleSyncError);
    };
  }, []);

  return {
    queue,
    queueLength: queue.length,
    syncing,
    error,
    queueAction: offlineSync.queueAction.bind(offlineSync),
    hasPendingActions: offlineSync.hasPendingActions.bind(offlineSync),
    sync: offlineSync.sync.bind(offlineSync),
  };
}
