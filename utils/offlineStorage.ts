// utils/offlineStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '@/types/supabase';

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Restaurant;
};
type Favorite = Database["public"]["Tables"]["favorites"]["Row"];

const STORAGE_KEYS = {
  RESTAURANTS: '@booklet_restaurants',
  BOOKINGS: '@booklet_bookings',
  FAVORITES: '@booklet_favorites',
  USER_PROFILE: '@booklet_user_profile',
  LAST_SYNC: '@booklet_last_sync',
};

class OfflineStorageManager {
  // Save data to cache
  async cacheRestaurants(restaurants: Restaurant[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RESTAURANTS, JSON.stringify(restaurants));
      await this.updateLastSync('restaurants');
    } catch (error) {
      console.error('[OfflineStorage] Failed to cache restaurants:', error);
    }
  }

  async cacheBookings(bookings: { upcoming: Booking[]; past: Booking[] }): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
      await this.updateLastSync('bookings');
    } catch (error) {
      console.error('[OfflineStorage] Failed to cache bookings:', error);
    }
  }

  async cacheFavorites(favorites: Favorite[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      await this.updateLastSync('favorites');
    } catch (error) {
      console.error('[OfflineStorage] Failed to cache favorites:', error);
    }
  }

  async cacheUserProfile(profile: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      await this.updateLastSync('profile');
    } catch (error) {
      console.error('[OfflineStorage] Failed to cache user profile:', error);
    }
  }

  // Retrieve cached data
  async getCachedRestaurants(): Promise<Restaurant[] | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RESTAURANTS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[OfflineStorage] Failed to get cached restaurants:', error);
      return null;
    }
  }

  async getCachedBookings(): Promise<{ upcoming: Booking[]; past: Booking[] } | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BOOKINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[OfflineStorage] Failed to get cached bookings:', error);
      return null;
    }
  }

  async getCachedFavorites(): Promise<Favorite[] | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[OfflineStorage] Failed to get cached favorites:', error);
      return null;
    }
  }

  async getCachedUserProfile(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[OfflineStorage] Failed to get cached user profile:', error);
      return null;
    }
  }

  // Sync metadata
  async updateLastSync(dataType: string): Promise<void> {
    try {
      const syncData = await this.getLastSyncData();
      syncData[dataType] = Date.now();
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, JSON.stringify(syncData));
    } catch (error) {
      console.error('[OfflineStorage] Failed to update last sync:', error);
    }
  }

  async getLastSyncData(): Promise<Record<string, number>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[OfflineStorage] Failed to get last sync data:', error);
      return {};
    }
  }

  // Check if cached data is stale (older than 30 minutes)
  async isCacheStale(dataType: string, maxAge: number = 30 * 60 * 1000): Promise<boolean> {
    const syncData = await this.getLastSyncData();
    const lastSync = syncData[dataType];
    
    if (!lastSync) return true;
    
    return Date.now() - lastSync > maxAge;
  }

  // Clear all cached data
  async clearAllCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.RESTAURANTS,
        STORAGE_KEYS.BOOKINGS,
        STORAGE_KEYS.FAVORITES,
        STORAGE_KEYS.USER_PROFILE,
        STORAGE_KEYS.LAST_SYNC,
      ]);
    } catch (error) {
      console.error('[OfflineStorage] Failed to clear cache:', error);
    }
  }

  // Get cache size
  async getCacheSize(): Promise<number> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      let totalSize = 0;

      for (const key of keys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += new Blob([data]).size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('[OfflineStorage] Failed to calculate cache size:', error);
      return 0;
    }
  }
}

export const offlineStorage = new OfflineStorageManager();