// services/offlineSync.ts
import { supabase } from '@/config/supabase';
import { offlineStorage, OfflineAction } from '@/utils/offlineStorage';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

class OfflineSyncService {
  private syncInProgress = false;
  private maxRetries = 3;

  async syncOfflineActions(): Promise<{ success: boolean; synced: number; failed: number }> {
    if (this.syncInProgress) {
      console.log('[OfflineSync] Sync already in progress');
      return { success: false, synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const queue = await offlineStorage.getOfflineQueue();
      
      if (queue.length === 0) {
        console.log('[OfflineSync] No offline actions to sync');
        return { success: true, synced: 0, failed: 0 };
      }

      console.log(`[OfflineSync] Starting sync of ${queue.length} actions`);

      for (const action of queue) {
        const result = await this.processOfflineAction(action);
        
        if (result.success) {
          await offlineStorage.removeFromOfflineQueue(action.id);
          syncedCount++;
        } else {
          if (action.retryCount >= this.maxRetries) {
            await offlineStorage.removeFromOfflineQueue(action.id);
            failedCount++;
            console.error(`[OfflineSync] Action ${action.id} failed after ${this.maxRetries} retries`);
          } else {
            await offlineStorage.updateOfflineQueueAction(action.id, {
              retryCount: action.retryCount + 1
            });
          }
        }
      }

      // Haptic feedback on successful sync
      if (syncedCount > 0) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      return { success: true, synced: syncedCount, failed: failedCount };
    } catch (error) {
      console.error('[OfflineSync] Sync error:', error);
      return { success: false, synced: syncedCount, failed: failedCount };
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processOfflineAction(action: OfflineAction): Promise<{ success: boolean; error?: any }> {
    try {
      switch (action.type) {
        case 'CREATE_BOOKING':
          return await this.syncCreateBooking(action.payload);
        
        case 'UPDATE_BOOKING':
          return await this.syncUpdateBooking(action.payload);
        
        case 'ADD_FAVORITE':
          return await this.syncAddFavorite(action.payload);
        
        case 'REMOVE_FAVORITE':
          return await this.syncRemoveFavorite(action.payload);
        
        case 'UPDATE_PROFILE':
          return await this.syncUpdateProfile(action.payload);
        
        default:
          console.warn(`[OfflineSync] Unknown action type: ${action.type}`);
          return { success: false, error: 'Unknown action type' };
      }
    } catch (error) {
      console.error(`[OfflineSync] Error processing action ${action.type}:`, error);
      return { success: false, error };
    }
  }

  private async syncCreateBooking(payload: any): Promise<{ success: boolean; error?: any }> {
    const { data, error } = await supabase
      .from('bookings')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[OfflineSync] Create booking error:', error);
      return { success: false, error };
    }

    return { success: true };
  }

  private async syncUpdateBooking(payload: any): Promise<{ success: boolean; error?: any }> {
    const { id, ...updates } = payload;
    
    const { error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[OfflineSync] Update booking error:', error);
      return { success: false, error };
    }

    return { success: true };
  }

  private async syncAddFavorite(payload: any): Promise<{ success: boolean; error?: any }> {
    // Check if favorite already exists (might have been added while offline)
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', payload.user_id)
      .eq('restaurant_id', payload.restaurant_id)
      .single();

    if (existing) {
      console.log('[OfflineSync] Favorite already exists, skipping');
      return { success: true };
    }

    const { error } = await supabase
      .from('favorites')
      .insert(payload);

    if (error) {
      console.error('[OfflineSync] Add favorite error:', error);
      return { success: false, error };
    }

    return { success: true };
  }

  private async syncRemoveFavorite(payload: any): Promise<{ success: boolean; error?: any }> {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', payload.user_id)
      .eq('restaurant_id', payload.restaurant_id);

    if (error) {
      console.error('[OfflineSync] Remove favorite error:', error);
      return { success: false, error };
    }

    return { success: true };
  }

  private async syncUpdateProfile(payload: any): Promise<{ success: boolean; error?: any }> {
    const { id, ...updates } = payload;
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[OfflineSync] Update profile error:', error);
      return { success: false, error };
    }

    return { success: true };
  }

  // Check if there are pending offline actions
  async hasPendingActions(): Promise<boolean> {
    const queue = await offlineStorage.getOfflineQueue();
    return queue.length > 0;
  }

  // Get count of pending actions
  async getPendingActionsCount(): Promise<number> {
    const queue = await offlineStorage.getOfflineQueue();
    return queue.length;
  }
}

export const offlineSync = new OfflineSyncService();