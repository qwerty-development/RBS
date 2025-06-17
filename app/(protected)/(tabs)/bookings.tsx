// app/(protected)/(tabs)/bookings.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Phone,
  MessageCircle,
  Star,
  ChevronRight,
  XCircle,
  CheckCircle,
  AlertCircle,
  Navigation,
  Share2,
  Copy,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

type TabType = "upcoming" | "past";

// Booking status configuration with Lebanese market considerations
const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Pending Confirmation",
    icon: AlertCircle,
    color: "#f59e0b",
    description: "Waiting for restaurant confirmation",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "#10b981",
    description: "Your table is reserved",
  },
  cancelled_by_user: {
    label: "Cancelled by You",
    icon: XCircle,
    color: "#6b7280",
    description: "You cancelled this booking",
  },
  declined_by_restaurant: {
    label: "Declined",
    icon: XCircle,
    color: "#ef4444",
    description: "Restaurant couldn't accommodate",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "#3b82f6",
    description: "Thank you for dining with us",
  },
  no_show: {
    label: "No Show",
    icon: AlertCircle,
    color: "#dc2626",
    description: "Booking was missed",
  },
};

export default function BookingsScreen() {
  // 1. Core State Management
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [bookings, setBookings] = useState<{
    upcoming: Booking[];
    past: Booking[];
  }>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  
  // 2. Refs for performance optimization
  const flatListRef = useRef<FlatList>(null);
  const hasInitialLoad = useRef(false);

  // 3. Data Fetching Functions
  const fetchBookings = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      const now = new Date().toISOString();
      
      // 3.1 Fetch upcoming bookings (pending, confirmed)
      const { data: upcomingData, error: upcomingError } = await supabase
        .from("bookings")
        .select(`
          *,
          restaurant:restaurants (*)
        `)
        .eq("user_id", profile.id)
        .in("status", ["pending", "confirmed"])
        .gte("booking_time", now)
        .order("booking_time", { ascending: true });
      
      if (upcomingError) throw upcomingError;
      
      // 3.2 Fetch past bookings (all statuses, past dates or completed/cancelled)
      const { data: pastData, error: pastError } = await supabase
        .from("bookings")
        .select(`
          *,
          restaurant:restaurants (*)
        `)
        .eq("user_id", profile.id)
        .or(`booking_time.lt.${now},status.in.(completed,cancelled_by_user,declined_by_restaurant,no_show)`)
        .order("booking_time", { ascending: false })
        .limit(50);
      
      if (pastError) throw pastError;
      
      setBookings({
        upcoming: upcomingData || [],
        past: pastData || [],
      });
    } catch (error) {
      console.error("Error fetching bookings:", error);
      Alert.alert("Error", "Failed to load bookings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // 4. Booking Actions
  const cancelBooking = useCallback(async (bookingId: string) => {
    // 4.1 Confirmation dialog
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setProcessingBookingId(bookingId);
            
            try {
              // 4.2 Update booking status
              const { error } = await supabase
                .from("bookings")
                .update({ 
                  status: "cancelled_by_user",
                  updated_at: new Date().toISOString()
                })
                .eq("id", bookingId);
              
              if (error) throw error;
              
              // 4.3 Haptic feedback
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              
              // 4.4 Refresh bookings
              fetchBookings();
              
              Alert.alert("Success", "Your booking has been cancelled");
            } catch (error) {
              console.error("Error cancelling booking:", error);
              Alert.alert("Error", "Failed to cancel booking");
            } finally {
              setProcessingBookingId(null);
            }
          },
        },
      ]
    );
  }, [fetchBookings]);

  // 5. Communication Actions
  const callRestaurant = useCallback(async (phoneNumber: string) => {
    const url = `tel:${phoneNumber}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to make phone call");
    }
  }, []);

  const messageRestaurant = useCallback(async (whatsappNumber: string, bookingDetails: Booking) => {
    // 5.1 Format WhatsApp message with booking details
    const message = encodeURIComponent(
      `Hi! I have a booking at ${bookingDetails.restaurant.name} on ${new Date(
        bookingDetails.booking_time
      ).toLocaleDateString()} at ${new Date(
        bookingDetails.booking_time
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
        bookingDetails.party_size
      } people. Confirmation code: ${bookingDetails.confirmation_code}`
    );
    
    const url = `whatsapp://send?phone=${whatsappNumber}&text=${message}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "WhatsApp is not installed");
    }
  }, []);

  // 6. Navigation Actions
  const openDirections = useCallback(async (restaurant: Database["public"]["Tables"]["restaurants"]["Row"]) => {
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${restaurant.location.lat},${restaurant.location.lng}`;
    const label = restaurant.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    
    if (url) {
      await Linking.openURL(url);
    }
  }, []);

  // 7. Sharing & Clipboard Actions
  const shareBooking = useCallback(async (booking: Booking) => {
    const shareMessage = `I have a reservation at ${booking.restaurant.name} on ${new Date(
      booking.booking_time
    ).toLocaleDateString()} at ${new Date(
      booking.booking_time
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
      booking.party_size
    } people.`;
    
    // Implementation depends on expo-sharing
    Alert.alert("Share", shareMessage);
  }, []);

  const copyConfirmationCode = useCallback(async (code: string) => {
    await Clipboard.setStringAsync(code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", `Confirmation code ${code} copied to clipboard`);
  }, []);

  // 8. Review Navigation
  const navigateToReview = useCallback((booking: Booking) => {
    router.push({
      pathname: "/review/create",
      params: {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
      },
    });
  }, [router]);

  // 9. Rebooking Action
  const bookAgain = useCallback((booking: Booking) => {
    router.push({
      pathname: "/booking/create",
      params: {
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
        partySize: booking.party_size.toString(),
        quickBook: "true",
      },
    });
  }, [router]);

  // 10. Restaurant Details Navigation
  const navigateToRestaurant = useCallback((restaurantId: string) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: restaurantId },
    });
  }, [router]);

  // 11. Lifecycle Management
  useEffect(() => {
    if (!hasInitialLoad.current && profile) {
      fetchBookings();
      hasInitialLoad.current = true;
    }
  }, [profile, fetchBookings]);

  // 12. Refresh Handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  // 13. Booking Card Component
  const BookingCard = ({ booking, isPast }: { booking: Booking; isPast: boolean }) => {
    const statusConfig = BOOKING_STATUS_CONFIG[booking.status];
    const StatusIcon = statusConfig.icon;
    const bookingDate = new Date(booking.booking_time);
    const isToday = bookingDate.toDateString() === new Date().toDateString();
    const isTomorrow = bookingDate.toDateString() === 
      new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();
    
    // 13.1 Check if review exists
    const [hasReview, setHasReview] = useState(false);
    
    useEffect(() => {
      const checkReview = async () => {
        if (booking.status === "completed") {
          const { data } = await supabase
            .from("reviews")
            .select("id")
            .eq("booking_id", booking.id)
            .single();
          
          setHasReview(!!data);
        }
      };
      checkReview();
    }, [booking.id, booking.status]);
    
    return (
      <Pressable
        onPress={() => navigateToRestaurant(booking.restaurant_id)}
        className="bg-card rounded-xl overflow-hidden mb-4 border border-border shadow-sm"
      >
        {/* 13.2 Restaurant Header */}
        <View className="flex-row p-4">
          <Image
            source={{ uri: booking.restaurant.main_image_url }}
            className="w-20 h-20 rounded-lg"
            contentFit="cover"
          />
          <View className="flex-1 ml-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <H3 className="mb-1 text-lg">{booking.restaurant.name}</H3>
                <P className="text-muted-foreground text-sm">
                  {booking.restaurant.cuisine_type}
                </P>
              </View>
              <ChevronRight size={20} color="#666" />
            </View>
            
            {/* 13.3 Status Badge */}
            <View className="flex-row items-center gap-2 mt-2">
              <StatusIcon size={16} color={statusConfig.color} />
              <Text
                className="text-sm font-medium"
                style={{ color: statusConfig.color }}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>
        
        {/* 13.4 Booking Details */}
        <View className="px-4 pb-4">
          <View className="bg-muted/50 rounded-lg p-3 mb-3">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center gap-2">
                <Calendar size={16} color="#666" />
                <Text className="font-medium text-sm">
                  {isToday ? "Today" : isTomorrow ? "Tomorrow" : bookingDate.toLocaleDateString()}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Clock size={16} color="#666" />
                <Text className="font-medium text-sm">
                  {bookingDate.toLocaleTimeString([], { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })}
                </Text>
              </View>
            </View>
            
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Users size={16} color="#666" />
                <Text className="text-sm text-muted-foreground">
                  {booking.party_size} {booking.party_size === 1 ? "Guest" : "Guests"}
                </Text>
              </View>
              
              {/* 13.5 Confirmation Code */}
              <Pressable
                onPress={() => copyConfirmationCode(booking.confirmation_code)}
                className="flex-row items-center gap-2 bg-background px-2 py-1 rounded border border-border"
              >
                <Copy size={14} color="#666" />
                <Text className="text-sm font-mono font-medium">
                  {booking.confirmation_code}
                </Text>
              </Pressable>
            </View>
          </View>
          
          {/* 13.6 Special Requests / Notes */}
          {(booking.special_requests || booking.occasion) && (
            <View className="bg-muted/30 rounded-lg p-3 mb-3">
              {booking.occasion && (
                <Text className="text-sm mb-1">
                  <Text className="font-medium">Occasion:</Text> {booking.occasion}
                </Text>
              )}
              {booking.special_requests && (
                <Text className="text-sm">
                  <Text className="font-medium">Special Requests:</Text>{" "}
                  {booking.special_requests}
                </Text>
              )}
            </View>
          )}
          
          {/* 13.7 Action Buttons */}
          <View className="gap-3">
            {/* Quick Action Buttons Row */}
            {!isPast && booking.status === "confirmed" && (
              <View className="flex-row gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => openDirections(booking.restaurant)}
                  className="flex-1"
                >
                  <View className="flex-row items-center gap-1">
                    <Navigation size={16} color="#3b82f6" />
                    <Text className="text-sm">Directions</Text>
                  </View>
                </Button>
                
                {booking.restaurant.phone_number && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => callRestaurant(booking.restaurant.phone_number!)}
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-1">
                      <Phone size={16} color="#10b981" />
                      <Text className="text-sm">Call</Text>
                    </View>
                  </Button>
                )}
                
                {booking.restaurant.whatsapp_number && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => messageRestaurant(booking.restaurant.whatsapp_number!, booking)}
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-1">
                      <MessageCircle size={16} color="#22c55e" />
                      <Text className="text-sm">WhatsApp</Text>
                    </View>
                  </Button>
                )}
              </View>
            )}
            
            {/* Main Action Buttons Row */}
            <View className="flex-row gap-2">
              {!isPast && (booking.status === "pending" || booking.status === "confirmed") && (
                <Button
                  size="sm"
                  variant="destructive"
                  onPress={() => cancelBooking(booking.id)}
                  disabled={processingBookingId === booking.id}
                  className="flex-1"
                >
                  {processingBookingId === booking.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <XCircle size={16} color="#fff" />
                      <Text className="text-sm text-white">Cancel</Text>
                    </View>
                  )}
                </Button>
              )}
              
              {isPast && booking.status === "completed" && !hasReview && (
                <Button
                  size="sm"
                  variant="default"
                  onPress={() => navigateToReview(booking)}
                  className="flex-1"
                >
                  <View className="flex-row items-center gap-1">
                    <Star size={16} color="#fff" />
                    <Text className="text-sm text-white">Rate Experience</Text>
                  </View>
                </Button>
              )}
              
              {isPast && (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => bookAgain(booking)}
                  className="flex-1"
                >
                  <View className="flex-row items-center gap-1">
                    <Calendar size={16} color="#000" />
                    <Text className="text-sm">Book Again</Text>
                  </View>
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onPress={() => shareBooking(booking)}
                className="px-4"
              >
                <Share2 size={16} color="#666" />
              </Button>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  // 14. Empty State Components
  const EmptyUpcoming = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Calendar size={64} color="#666" strokeWidth={1} />
      <H3 className="mt-4 text-center">No Upcoming Bookings</H3>
      <Muted className="mt-2 text-center px-8">
        Discover amazing restaurants and make your next reservation
      </Muted>
      <Button
        variant="default"
        className="mt-6"
        onPress={() => router.push("/search")}
      >
        <Text className="text-white">Explore Restaurants</Text>
      </Button>
    </View>
  );

  const EmptyPast = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Clock size={64} color="#666" strokeWidth={1} />
      <H3 className="mt-4 text-center">No Past Bookings</H3>
      <Muted className="mt-2 text-center px-8">
        Your completed bookings will appear here
      </Muted>
    </View>
  );

  // 15. Tab Component
  const TabButton = ({ 
    title, 
    isActive, 
    onPress, 
    count 
  }: { 
    title: string; 
    isActive: boolean; 
    onPress: () => void; 
    count: number;
  }) => (
    <Pressable
      onPress={onPress}
      className={`flex-1 py-4 items-center border-b-2 ${
        isActive ? "border-primary" : "border-transparent"
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Text
          className={`font-medium ${
            isActive ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {title}
        </Text>
        {count > 0 && (
          <View
            className={`px-2 py-0.5 rounded-full min-w-[20px] items-center ${
              isActive ? "bg-primary" : "bg-muted"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                isActive ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  // 16. Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  // 17. Main Render
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 17.1 Header */}
      <View className="px-4 pt-4 pb-2">
        <H2 className="text-2xl">My Bookings</H2>
      </View>
      
      {/* 17.2 Tabs */}
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
      
      {/* 17.3 Content */}
      <FlatList
        ref={flatListRef}
        data={activeTab === "upcoming" ? bookings.upcoming : bookings.past}
        renderItem={({ item }) => (
          <BookingCard booking={item} isPast={activeTab === "past"} />
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
          activeTab === "upcoming" ? <EmptyUpcoming /> : <EmptyPast />
        }
      />
    </SafeAreaView>
  );
}