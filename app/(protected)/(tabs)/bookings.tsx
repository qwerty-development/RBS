// app/(protected)/(tabs)/bookings.tsx - Example with offline support
import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBookings } from "@/hooks/useBookings";
import { Feather } from "@expo/vector-icons";
import { formatDate } from "date-fns";

export default function BookingsScreen() {
  const {
    activeTab,
    bookings,
    loading,
    refreshing,
    processingBookingId,
    isFromCache,
    isOffline,
    setActiveTab,
    refresh,
    cancelBooking,
    navigateToBooking,
  } = useBookings();

  const currentBookings = activeTab === "upcoming" ? bookings.upcoming : bookings.past;

  if (loading && !isFromCache) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-gray-500">Loading bookings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      {/* Header */}
      <View className="px-4 py-2">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          My Bookings
        </Text>
        
        {/* Offline/Cache indicator */}
        {isFromCache && (
          <View className="flex-row items-center mt-2">
            <Feather 
              name={isOffline ? "wifi-off" : "clock"} 
              size={14} 
              color="#6B7280" 
            />
            <Text className="text-sm text-gray-500 ml-1">
              {isOffline ? "Showing offline data" : "Showing cached data"}
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 mb-4">
        <TouchableOpacity
          onPress={() => setActiveTab("upcoming")}
          className={`flex-1 py-2 mr-2 rounded-lg ${
            activeTab === "upcoming"
              ? "bg-blue-500"
              : "bg-gray-100 dark:bg-gray-800"
          }`}
        >
          <Text
            className={`text-center font-medium ${
              activeTab === "upcoming"
                ? "text-white"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            Upcoming ({bookings.upcoming.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("past")}
          className={`flex-1 py-2 ml-2 rounded-lg ${
            activeTab === "past"
              ? "bg-blue-500"
              : "bg-gray-100 dark:bg-gray-800"
          }`}
        >
          <Text
            className={`text-center font-medium ${
              activeTab === "past"
                ? "text-white"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            Past ({bookings.past.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bookings List */}
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            enabled={!isOffline} // Disable pull-to-refresh when offline
          />
        }
      >
        {currentBookings.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <Feather
              name="calendar"
              size={48}
              color="#9CA3AF"
            />
            <Text className="text-gray-500 mt-4">
              No {activeTab} bookings
            </Text>
          </View>
        ) : (
          currentBookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              onPress={() => navigateToBooking(booking.id)}
              className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-3"
              disabled={processingBookingId === booking.id}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="font-semibold text-lg text-gray-900 dark:text-white">
                    {booking.restaurant.name}
                  </Text>
                  <Text className="text-gray-600 dark:text-gray-400 mt-1">
                    {formatDate(booking.booking_time, "HH:mm")}
                  </Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-500">
                    {booking.guest_count} guests • Table {booking.selected_table_id || "TBD"}
                  </Text>
                  {pendingOfflineChanges.has(booking.id) && (
                    <View className="flex-row items-center mt-2">
                      <Feather name="upload-cloud" size={12} color="#F59E0B" />
                      <Text className="text-xs text-yellow-600 ml-1">
                        Changes pending sync
                      </Text>
                    </View>
                  )}
                </View>

                <View className="ml-3">
                  <View
                    className={`px-3 py-1 rounded-full ${
                      booking.status === "confirmed"
                        ? "bg-green-100"
                        : booking.status === "pending"
                        ? "bg-yellow-100"
                        : "bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        booking.status === "confirmed"
                          ? "text-green-800"
                          : booking.status === "pending"
                          ? "text-yellow-800"
                          : "text-gray-800"
                      }`}
                    >
                      {booking.status}
                    </Text>
                  </View>
                  
                  {activeTab === "upcoming" && booking.status !== "cancelled" && (
                    <TouchableOpacity
                      onPress={() => cancelBooking(booking.id)}
                      disabled={processingBookingId === booking.id || isOffline}
                      className="mt-2"
                    >
                      <Text className={`text-sm text-red-500 ${
                        (processingBookingId === booking.id || isOffline) ? "opacity-50" : ""
                      }`}>
                        {processingBookingId === booking.id 
                          ? "Cancelling..." 
                          : isOffline 
                          ? "Offline" 
                          : "Cancel"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              
              {/* Show if booking has offline changes pending */}
              {booking.offline_pending && (
                <View className="flex-row items-center mt-2">
                  <Feather name="upload-cloud" size={12} color="#F59E0B" />
                  <Text className="text-xs text-yellow-600 ml-1">
                    Changes pending sync
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}