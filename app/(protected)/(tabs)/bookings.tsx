// app/(protected)/(tabs)/bookings.tsx
import React from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Calendar, Clock } from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, Muted } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import { TabButton } from "@/components/ui/tab-button";
import { BookingCard } from "@/components/booking/BookingCard";
import { useColorScheme } from "@/lib/useColorScheme";
import { useBookings } from "@/hooks/useBookings";

export default function BookingsScreen() {
  const { colorScheme } = useColorScheme();
  const {
    // State
    activeTab,
    setActiveTab,
    bookings,
    loading,
    refreshing,
    processingBookingId,

    // Actions
    handleRefresh,
    navigateToBookingDetails,
    navigateToRestaurant,
    navigateToSearch,
    cancelBooking,
    rebookRestaurant,
    reviewBooking,
  } = useBookings();

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </View>
      </SafeAreaView>
    );
  }

  const currentBookings =
    activeTab === "upcoming" ? bookings.upcoming : bookings.past;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <H2 className="text-2xl">My Bookings</H2>
        <Muted className="text-sm mt-1">
          Tap any booking for full details and options
        </Muted>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-border bg-background">
        <TabButton
          title="Upcoming"
          isActive={activeTab === "upcoming"}
          onPress={() => setActiveTab("upcoming")}
          count={bookings.upcoming.length}
        />
        <TabButton
          title="Past"
          isActive={activeTab === "past"}
          onPress={() => setActiveTab("past")}
          count={bookings.past.length}
        />
      </View>

      {/* Content */}
      <FlatList
        data={currentBookings}
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            variant={activeTab}
            onPress={() => navigateToBookingDetails(item.id)}
            onCancel={cancelBooking}
            onRebook={rebookRestaurant}
            onReview={reviewBooking}
            onNavigateToRestaurant={navigateToRestaurant}
            processingBookingId={processingBookingId}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
        ListEmptyComponent={
          activeTab === "upcoming" ? (
            <EmptyState
              icon={Calendar}
              title="No Upcoming Bookings"
              subtitle="Discover amazing restaurants and make your next reservation"
              actionLabel="Explore Restaurants"
              onAction={navigateToSearch}
            />
          ) : (
            <EmptyState
              icon={Clock}
              title="No Past Bookings"
              subtitle="Your completed bookings will appear here"
            />
          )
        }
      />
    </SafeAreaView>
  );
}
