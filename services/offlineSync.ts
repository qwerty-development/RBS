// services/offlineSync.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import netInfo from "@react-native-community/netinfo";
import { EventEmitter } from "@/lib/eventEmitter";

// Types
export interface OfflineAction<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
}

export interface SyncResult {
  actionId: string;
  success: boolean;
  error?: Error;
}

export type SyncHandler<T = any> = (action: OfflineAction<T>) => Promise<void>;

interface OfflineSyncManagerConfig {
  storageKey?: string;
  maxRetries?: number;
  retryDelay?: number;
  retryMultiplier?: number;
}

const DEFAULT_CONFIG: Required<OfflineSyncManagerConfig> = {
  storageKey: "@offline_queue",
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
};

class OfflineSyncManager extends EventEmitter {
  private queue: OfflineAction[] = [];
  private config: Required<OfflineSyncManagerConfig>;
  private syncInProgress = false;
  private handlers: Map<string, SyncHandler> = new Map();
  public isOnline = false;

  constructor(config: OfflineSyncManagerConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.init();
  }

  private async init() {
    await this.loadQueue();
    this.isOnline = (await netInfo.fetch()).isInternetReachable ?? false;

    netInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      if (online && !this.isOnline) {
        this.isOnline = true;
        this.emit("reconnected");
        this.sync();
      } else if (!online) {
        this.isOnline = false;
      }
    });

    AppState.addEventListener("change", this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === "active" && this.isOnline) {
      this.sync();
    }
  };

  private async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(this.config.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        this.emit("queueChanged", this.queue);
      }
    } catch (error) {
      console.error("[OfflineSyncManager] Failed to load queue:", error);
    }
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem(this.config.storageKey, JSON.stringify(this.queue));
      this.emit("queueChanged", this.queue);
    } catch (error) {
      console.error("[OfflineSyncManager] Failed to save queue:", error);
    }
  }

  registerSyncHandler(type: string, handler: SyncHandler) {
    this.handlers.set(type, handler);
  }

  async queueAction<T>(type: string, payload: T): Promise<string> {
    const action: OfflineAction<T> = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: this.config.maxRetries,
    };

    this.queue.push(action);
    await this.saveQueue();
    this.emit("actionQueued", action);

    // Trigger sync if online
    if (this.isOnline) {
      this.sync();
    }

    return action.id;
  }

  async sync() {
    if (this.syncInProgress || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.emit("syncStatusChanged", true);
    this.emit("syncStart");

    const results: SyncResult[] = [];
    const processingQueue = [...this.queue];

    for (const action of processingQueue) {
      const handler = this.handlers.get(action.type);
      if (handler) {
        const result = await this.processAction(action, handler);
        results.push(result);
      }
    }

    this.syncInProgress = false;
    this.emit("syncStatusChanged", false);
    this.emit("syncComplete", results);
  }

  private async processAction(action: OfflineAction, handler: SyncHandler): Promise<SyncResult> {
    try {
      await handler(action);
      await this.removeAction(action.id);
      return { actionId: action.id, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (action.retries < action.maxRetries) {
        await this.updateAction(action.id, {
          retries: action.retries + 1,
          lastError: errorMessage,
        });
        return { actionId: action.id, success: false, error: new Error("Action will be retried.") };
      } else {
        await this.removeAction(action.id); // Max retries reached
        return { actionId: action.id, success: false, error: error as Error };
      }
    }
  }

  private async removeAction(actionId: string) {
    this.queue = this.queue.filter(a => a.id !== actionId);
    await this.saveQueue();
  }

  private async updateAction(actionId: string, updates: Partial<OfflineAction>) {
    this.queue = this.queue.map(a => (a.id === actionId ? { ...a, ...updates } : a));
    await this.saveQueue();
  }

  getQueue() {
    return this.queue;
  }

  hasPendingActions() {
    return this.queue.length > 0;
  }
}

export const offlineSync = new OfflineSyncManager();
