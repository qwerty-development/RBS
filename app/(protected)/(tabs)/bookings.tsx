// app/(protected)/(tabs)/bookings.tsx
import React from "react";
import { View, RefreshControl, ScrollView } from "react-native";
import { Calendar, Clock, UserPlus } from "lucide-react-native";
import { useRouter } from "expo-router";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TabButton } from "@/components/ui/tab-button";
import { PageHeader } from "@/components/ui/page-header";
import { BookingCard } from "@/components/booking/BookingCard";
import { useColorScheme } from "@/lib/useColorScheme";
import { useBookings } from "@/hooks/useBookings";
import { useAuth } from "@/context/supabase-provider";
import BookingsScreenSkeleton from "@/components/skeletons/BookingsScreenSkeleton";
import { getRefreshControlColor } from "@/lib/utils";

export default function BookingsScreen() {
  const router = useRouter();
  const { isGuest, convertGuestToUser } = useAuth();
  const { colorScheme } = useColorScheme();
  
  // --- Authenticated User Hooks (must be called before any early returns) ---
  const {
    activeTab,
    setActiveTab,
    bookings,
    loading,
    refreshing,
    processingBookingId,
    handleRefresh,
    navigateToBookingDetails,
    navigateToRestaurant,
    navigateToSearch,
    cancelBooking,
    rebookRestaurant,
    reviewBooking,
  } = useBookings();

  const currentBookings =
    activeTab === "upcoming" ? bookings.upcoming : bookings.past;

  // --- Guest View ---
  // If the user is a guest, show a call-to-action screen to sign up.
  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        {/* Header */}
        <View className="p-4">
          <H2>My Bookings</H2>
        </View>

        {/* Guest State */}
        <View className="flex-1 items-center justify-center px-6 -mt-10">
          <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-6">
            <Calendar size={48} className="text-primary" />
          </View>

          <H2 className="text-center mb-2">Book Your Table</H2>
          <P className="text-center text-muted-foreground mb-8">
            Create an account to make reservations at the best restaurants in
            Lebanon. It's quick, easy, and free!
          </P>

          <Button
            onPress={convertGuestToUser}
            size="lg"
            className="w-full max-w-xs"
          >
            <UserPlus size={20} color="#fff" />
            <Text className="ml-2 font-bold text-white">Sign Up to Book</Text>
          </Button>

          <Button
            onPress={() => router.push("/(protected)/(tabs)/search")}
            size="lg"
            variant="ghost"
            className="w-full max-w-xs mt-2"
          >
            <Text>Explore Restaurants</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // --- Loading State ---
  if (loading) {
    return <BookingsScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <PageHeader
        title="My Bookings"
        subtitle="Tap any booking for full details and options"
      />

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

      {/* Content with ScrollView for pull-to-refresh */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={getRefreshControlColor(colorScheme)}
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {currentBookings.length === 0 ? (
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
        ) : (
          <View className="p-4 pb-20">
            {currentBookings.map((item) => (
              <BookingCard
                key={item.id}
                booking={item}
                variant={activeTab}
                onPress={() => navigateToBookingDetails(item.id)}
                onCancel={cancelBooking}
                onRebook={rebookRestaurant}
                onReview={reviewBooking}
                onNavigateToRestaurant={navigateToRestaurant}
                processingBookingId={processingBookingId}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
