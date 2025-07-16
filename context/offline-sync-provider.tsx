// context/offline-sync-provider.tsx
import React, { createContext, useContext, useEffect } from "react";
import { offlineSync, SyncHandler } from "@/services/offlineSync";
import { supabase } from "@/config/supabase";
interface OfflineSyncContextType {}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(
  undefined
);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {


  useEffect(() => {
    // Register handlers for different offline actions
    const createBookingHandler: SyncHandler = async (action) => {
      const { restaurant_id, user_id, date, time, guests } = action.payload;
      const { error } = await supabase.from("bookings").insert({ restaurant_id, user_id, date, time, guests });
      if (error) throw error;
    };

    const addFavoriteHandler: SyncHandler = async (action) => {
        const { restaurant_id, user_id } = action.payload;
        const { error } = await supabase.from("favorites").insert({ restaurant_id, user_id });
        if (error) throw error;
    };

    const removeFavoriteHandler: SyncHandler = async (action) => {
        const { restaurant_id, user_id } = action.payload;
        const { error } = await supabase.from("favorites").delete().match({ restaurant_id, user_id });
        if (error) throw error;
    };

    offlineSync.registerSyncHandler("CREATE_BOOKING", createBookingHandler);
    offlineSync.registerSyncHandler("ADD_FAVORITE", addFavoriteHandler);
    offlineSync.registerSyncHandler("REMOVE_FAVORITE", removeFavoriteHandler);

  }, [supabase]);

  return (
    <OfflineSyncContext.Provider value={{}}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSyncContext must be used within an OfflineSyncProvider");
  }
  return context;
}
