import React, { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { Share2, Users } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { EmptyState } from "@/components/ui/empty-state";
import { SharedTableCard } from "./SharedTableCard";
import { useSharedTableAvailability } from "@/hooks/useSharedTableAvailability";

interface SharedTablesListProps {
  restaurantId: string;
  date: Date;
  onBookingSuccess?: (bookingId: string) => void;
}

export const SharedTablesList: React.FC<SharedTablesListProps> = ({
  restaurantId,
  date,
  onBookingSuccess,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const {
    sharedTables,
    loading,
    error,
    refresh,
    bookSharedTableSeat,
    isOffline,
  } = useSharedTableAvailability({
    restaurantId,
    date,
    enableRealtime: true,
  });

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleBookSeat = async (
    tableId: string,
    partySize: number,
  ): Promise<void> => {
    try {
      const booking = await bookSharedTableSeat(
        tableId,
        partySize,
        date,
        undefined, // special requests
        true, // social booking (allow others to see)
      );

      if (onBookingSuccess) {
        onBookingSuccess(booking.id);
      }
    } catch (error) {
      throw error; // Let the card component handle the error display
    }
  };

  if (loading && !refreshing) {
    return (
      <View className="p-4">
        <View className="flex-row items-center space-x-2 mb-4">
          <Share2 size={24} className="text-purple-600 dark:text-purple-400" />
          <Text className="text-xl font-bold">Shared Tables</Text>
        </View>

        {/* Loading skeleton */}
        <View className="space-y-4">
          {[1, 2, 3].map((index) => (
            <View
              key={index}
              className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 h-40 animate-pulse"
            />
          ))}
        </View>
      </View>
    );
  }

  if (error && !isOffline) {
    return (
      <View className="p-4">
        <View className="flex-row items-center space-x-2 mb-4">
          <Share2 size={24} className="text-purple-600 dark:text-purple-400" />
          <Text className="text-xl font-bold">Shared Tables</Text>
        </View>

        <EmptyState
          icon={<Users size={48} className="text-gray-400" />}
          title="Unable to Load Shared Tables"
          description={error}
          action={{
            label: "Try Again",
            onPress: handleRefresh,
          }}
        />
      </View>
    );
  }

  if (sharedTables.length === 0) {
    return (
      <View className="p-4">
        <View className="flex-row items-center space-x-2 mb-4">
          <Share2 size={24} className="text-purple-600 dark:text-purple-400" />
          <Text className="text-xl font-bold">Shared Tables</Text>
        </View>

        <EmptyState
          icon={<Share2 size={48} className="text-gray-400" />}
          title="No Shared Tables Available"
          description={
            isOffline
              ? "You're currently offline. Shared table information may not be up to date."
              : "This restaurant doesn't have shared tables available for your selected date and time."
          }
          action={
            !isOffline
              ? {
                  label: "Refresh",
                  onPress: handleRefresh,
                }
              : undefined
          }
        />
      </View>
    );
  }

  const availableTables = sharedTables.filter(
    (table) => table.available_seats > 0,
  );
  const fullTables = sharedTables.filter(
    (table) => table.available_seats === 0,
  );

  return (
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center space-x-2">
            <Share2
              size={24}
              className="text-purple-600 dark:text-purple-400"
            />
            <Text className="text-xl font-bold">Shared Tables</Text>
          </View>

          <View className="bg-purple-100 dark:bg-purple-900/30 rounded-full px-3 py-1">
            <Text className="text-purple-800 dark:text-purple-200 text-sm font-medium">
              {availableTables.length} Available
            </Text>
          </View>
        </View>

        {/* Offline indicator */}
        {isOffline && (
          <View className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <Text className="text-yellow-800 dark:text-yellow-200 text-sm text-center">
              You're offline. Information may not be current.
            </Text>
          </View>
        )}

        {/* Info note */}
        <View className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Text className="text-blue-800 dark:text-blue-200 text-sm">
            <Text className="font-medium">Shared tables</Text> let you dine
            alongside other guests, perfect for solo diners or small groups
            looking for a social experience. You can choose to share your dining
            status with others or keep it private.
          </Text>
        </View>

        {/* Available tables */}
        {availableTables.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Available Now
            </Text>
            {availableTables.map((tableAvailability) => (
              <SharedTableCard
                key={tableAvailability.table_id}
                tableAvailability={tableAvailability}
                onBookSeat={handleBookSeat}
                loading={loading}
              />
            ))}
          </View>
        )}

        {/* Full tables */}
        {fullTables.length > 0 && (
          <View>
            <Text className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Currently Full
            </Text>
            {fullTables.map((tableAvailability) => (
              <SharedTableCard
                key={tableAvailability.table_id}
                tableAvailability={tableAvailability}
                onBookSeat={handleBookSeat}
                loading={loading}
              />
            ))}
          </View>
        )}

        {/* Bottom padding for scroll */}
        <View className="h-6" />
      </View>
    </ScrollView>
  );
};
