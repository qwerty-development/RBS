import React, { useState } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { Users, Share2, Clock, UserPlus } from "lucide-react-native";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  SharedTableAvailability,
  SharedTableBooking,
} from "@/types/restaurant";
import { getTableTypeDisplayName } from "@/lib/tableManagementUtils";

interface SharedTableCardProps {
  tableAvailability: SharedTableAvailability;
  onBookSeat: (tableId: string, partySize: number) => Promise<void>;
  maxPartySize?: number;
  loading?: boolean;
}

export const SharedTableCard: React.FC<SharedTableCardProps> = ({
  tableAvailability,
  onBookSeat,
  maxPartySize = 4,
  loading = false,
}) => {
  const [selectedPartySize, setSelectedPartySize] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const [showBookingOptions, setShowBookingOptions] = useState(false);

  const {
    table,
    available_seats,
    occupied_seats,
    total_seats,
    current_bookings,
  } = tableAvailability;

  // Filter out private bookings (users who opted not to share info)
  const visibleBookings = current_bookings.filter(
    (booking) => booking.is_social,
  );

  const handleBookSeat = async (): Promise<void> => {
    if (selectedPartySize > available_seats) {
      Alert.alert(
        "Not enough seats",
        `Only ${available_seats} seats are available.`,
      );
      return;
    }

    setIsBooking(true);
    try {
      await onBookSeat(table.id, selectedPartySize);
      setShowBookingOptions(false);
      setSelectedPartySize(1);
    } catch (error: any) {
      Alert.alert(
        "Booking Failed",
        error.message || "Failed to book shared table seat",
      );
    } finally {
      setIsBooking(false);
    }
  };

  const getOccupancyColor = (): string => {
    const occupancyRate = occupied_seats / total_seats;
    if (occupancyRate < 0.5) return "text-green-600 dark:text-green-400";
    if (occupancyRate < 0.8) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getAvailabilityStatus = (): string => {
    if (available_seats === 0) return "Full";
    if (available_seats <= 2) return "Almost Full";
    return "Available";
  };

  return (
    <Card variant="subtle" className="mb-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center space-x-2">
          <Share2 size={20} className="text-purple-600 dark:text-purple-400" />
          <Text className="text-lg font-semibold">
            {table.table_number || "Shared Table"}
          </Text>
          <View className="bg-purple-100 dark:bg-purple-900/30 rounded-full px-3 py-1">
            <Text className="text-purple-800 dark:text-purple-200 text-sm font-medium">
              {getTableTypeDisplayName(table.table_type)}
            </Text>
          </View>
        </View>

        <Text className={`font-semibold ${getOccupancyColor()}`}>
          {getAvailabilityStatus()}
        </Text>
      </View>

      {/* Seat availability */}
      <View className="flex-row items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <View className="flex-row items-center space-x-2">
          <Users size={18} className="text-gray-600 dark:text-gray-400" />
          <Text className="text-gray-700 dark:text-gray-300">
            Seats: {available_seats} of {total_seats} available
          </Text>
        </View>

        <View className="flex-row space-x-1">
          {Array.from({ length: total_seats }, (_, index) => (
            <View
              key={index}
              className={`w-3 h-3 rounded-full ${
                index < occupied_seats ? "bg-red-500" : "bg-green-500"
              }`}
            />
          ))}
        </View>
      </View>

      {/* Current diners (only if they opted to share) */}
      {visibleBookings.length > 0 && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Currently dining ({visibleBookings.length}{" "}
            {visibleBookings.length === 1 ? "party" : "parties"}):
          </Text>
          {visibleBookings.map((booking) => (
            <View
              key={booking.booking_id}
              className="flex-row items-center justify-between py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-2"
            >
              <View className="flex-row items-center space-x-2">
                <UserPlus
                  size={16}
                  className="text-blue-600 dark:text-blue-400"
                />
                <Text className="text-blue-800 dark:text-blue-200">
                  {booking.user_name || "Guest"}
                </Text>
                <Text className="text-blue-600 dark:text-blue-400 text-sm">
                  (Party of {booking.party_size})
                </Text>
              </View>
              <View className="flex-row items-center space-x-1">
                <Clock size={14} className="text-blue-600 dark:text-blue-400" />
                <Text className="text-blue-600 dark:text-blue-400 text-sm">
                  {new Date(booking.booking_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Booking actions */}
      {available_seats > 0 ? (
        <View>
          {!showBookingOptions ? (
            <Button
              onPress={() => setShowBookingOptions(true)}
              className="w-full"
              variant="default"
              disabled={loading}
            >
              <Text className="text-white font-medium">Join This Table</Text>
            </Button>
          ) : (
            <View>
              {/* Party size selector */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Party Size:
                </Text>
                <View className="flex-row space-x-2">
                  {Array.from(
                    { length: Math.min(available_seats, maxPartySize) },
                    (_, index) => {
                      const size = index + 1;
                      return (
                        <TouchableOpacity
                          key={size}
                          onPress={() => setSelectedPartySize(size)}
                          className={`w-10 h-10 rounded-lg border-2 items-center justify-center ${
                            selectedPartySize === size
                              ? "border-purple-500 bg-purple-100 dark:bg-purple-900/30"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          <Text
                            className={`font-medium ${
                              selectedPartySize === size
                                ? "text-purple-700 dark:text-purple-300"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {size}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>
              </View>

              {/* Action buttons */}
              <View className="flex-row space-x-3">
                <Button
                  onPress={() => {
                    setShowBookingOptions(false);
                    setSelectedPartySize(1);
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={isBooking}
                >
                  <Text>Cancel</Text>
                </Button>

                <Button
                  onPress={handleBookSeat}
                  className="flex-1"
                  disabled={isBooking || selectedPartySize > available_seats}
                  loading={isBooking}
                >
                  <Text className="text-white font-medium">
                    Book {selectedPartySize}{" "}
                    {selectedPartySize === 1 ? "Seat" : "Seats"}
                  </Text>
                </Button>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <Text className="text-red-800 dark:text-red-200 text-center">
            Table is currently full
          </Text>
          <Text className="text-red-600 dark:text-red-400 text-sm text-center mt-1">
            Join the waitlist to be notified when seats become available
          </Text>
        </View>
      )}
    </Card>
  );
};
