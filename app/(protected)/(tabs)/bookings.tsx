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
  Info,
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

  // 4. Navigation Functions
  const navigateToBookingDetails = useCallback((bookingId: string) => {
    router.push({
      pathname: "/booking/[id]",
      params: { id: bookingId },
    });
  }, [router]);

  const navigateToRestaurant = useCallback((restaurantId: string) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: restaurantId },
    });
  }, [router]);

  // 5. Quick Actions (for immediate access from the list)
  const quickCancelBooking = useCallback(async (bookingId: string, event: any) => {
    // Stop event propagation to prevent navigating to booking details
    event.stopPropagation();
    
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setProcessingBookingId(bookingId);
            
            try {
              const { error } = await supabase
                .from("bookings")
                .update({ 
                  status: "cancelled_by_user",
                  updated_at: new Date().toISOString()
                })
                .eq("id", bookingId);
              
              if (error) throw error;
              
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              
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

  const quickCallRestaurant = useCallback(async (phoneNumber: string, event: any) => {
    event.stopPropagation();
    
    const url = `tel:${phoneNumber}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to make phone call");
    }
  }, []);

  const openDirections = useCallback(async (restaurant: Database["public"]["Tables"]["restaurants"]["Row"], event: any) => {
    event.stopPropagation();
    
    // Extract coordinates from PostGIS geography type
    let coords = null;
    if (restaurant.location) {
      if (typeof restaurant.location === 'string' && restaurant.location.startsWith('POINT(')) {
        const coordsMatch = restaurant.location.match(/POINT\(([^)]+)\)/);
        if (coordsMatch && coordsMatch[1]) {
          const [lng, lat] = coordsMatch[1].split(' ').map(Number);
          coords = { latitude: lat, longitude: lng };
        }
      } else if (restaurant.location.coordinates && Array.isArray(restaurant.location.coordinates)) {
        const [lng, lat] = restaurant.location.coordinates;
        coords = { latitude: lat, longitude: lng };
      } else if (restaurant.location.lat && restaurant.location.lng) {
        coords = { latitude: restaurant.location.lat, longitude: restaurant.location.lng };
      }
    }
    
    if (!coords) {
      Alert.alert("Error", "Location data not available");
      return;
    }
    
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${coords.latitude},${coords.longitude}`;
    const label = restaurant.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    
    if (url) {
      await Linking.openURL(url);
    }
  }, []);

  const copyConfirmationCode = useCallback(async (code: string, event: any) => {
    event.stopPropagation();
    
    await Clipboard.setStringAsync(code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", `Confirmation code ${code} copied to clipboard`);
  }, []);

  // 6. Lifecycle Management
  useEffect(() => {
    if (!hasInitialLoad.current && profile) {
      fetchBookings();
      hasInitialLoad.current = true;
    }
  }, [profile, fetchBookings]);

  // 7. Refresh Handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  // 8. Booking Card Component
  const BookingCard = ({ booking, isPast }: { booking: Booking; isPast: boolean }) => {
    const statusConfig = BOOKING_STATUS_CONFIG[booking.status];
    const StatusIcon = statusConfig.icon;
    const bookingDate = new Date(booking.booking_time);
    const isToday = bookingDate.toDateString() === new Date().toDateString();
    const isTomorrow = bookingDate.toDateString() === 
      new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();
    
    // 8.1 Check if review exists
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
        onPress={() => navigateToBookingDetails(booking.id)}
        className="bg-card rounded-xl overflow-hidden mb-4 border border-border shadow-sm"
      >
        {/* 8.2 Restaurant Header */}
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
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    navigateToRestaurant(booking.restaurant_id);
                  }}
                  className="p-1"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Info size={16} color="#3b82f6" />
                </Pressable>
                <ChevronRight size={20} color="#666" />
              </View>
            </View>
            
            {/* 8.3 Status Badge */}
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
        
        {/* 8.4 Booking Details */}
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
              
              {/* 8.5 Confirmation Code */}
              <Pressable
                onPress={(e) => copyConfirmationCode(booking.confirmation_code, e)}
                className="flex-row items-center gap-2 bg-background px-2 py-1 rounded border border-border"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Copy size={14} color="#666" />
                <Text className="text-sm font-mono font-medium">
                  {booking.confirmation_code}
                </Text>
              </Pressable>
            </View>
          </View>
          
          {/* 8.6 Special Requests / Notes Preview */}
          {(booking.special_requests || booking.occasion) && (
            <View className="bg-muted/30 rounded-lg p-3 mb-3">
              {booking.occasion && (
                <Text className="text-sm mb-1">
                  <Text className="font-medium">Occasion:</Text> {booking.occasion}
                </Text>
              )}
              {booking.special_requests && (
                <Text className="text-sm" numberOfLines={2}>
                  <Text className="font-medium">Special Requests:</Text>{" "}
                  {booking.special_requests}
                </Text>
              )}
            </View>
          )}
          
          {/* 8.7 Quick Action Buttons */}
          <View className="flex-row gap-2">
            {/* Quick Actions for Upcoming Bookings */}
            {!isPast && booking.status === "confirmed" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={(e) => openDirections(booking.restaurant, e)}
                  className="flex-1"
                >
                  <View className="flex-row items-center gap-1">
                    <Navigation size={14} color="#3b82f6" />
                    <Text className="text-xs">Directions</Text>
                  </View>
                </Button>
                
                {booking.restaurant.phone_number && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={(e) => quickCallRestaurant(booking.restaurant.phone_number!, e)}
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-1">
                      <Phone size={14} color="#10b981" />
                      <Text className="text-xs">Call</Text>
                    </View>
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="destructive"
                  onPress={(e) => quickCancelBooking(booking.id, e)}
                  disabled={processingBookingId === booking.id}
                  className="flex-1"
                >
                  {processingBookingId === booking.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <XCircle size={14} color="#fff" />
                      <Text className="text-xs text-white">Cancel</Text>
                    </View>
                  )}
                </Button>
              </>
            )}
            
            {/* Quick Actions for Pending Bookings */}
            {!isPast && booking.status === "pending" && (
              <Button
                size="sm"
                variant="destructive"
                onPress={(e) => quickCancelBooking(booking.id, e)}
                disabled={processingBookingId === booking.id}
                className="w-full"
              >
                {processingBookingId === booking.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View className="flex-row items-center gap-1">
                    <XCircle size={14} color="#fff" />
                    <Text className="text-sm text-white">Cancel Booking</Text>
                  </View>
                )}
              </Button>
            )}
            
            {/* Actions for Past Bookings */}
            {isPast && (
              <>
                {booking.status === "completed" && !hasReview && (
                  <Button
                    size="sm"
                    variant="default"
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({
                        pathname: "/review/create",
                        params: {
                          bookingId: booking.id,
                          restaurantId: booking.restaurant_id,
                          restaurantName: booking.restaurant.name,
                        },
                      });
                    }}
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-1">
                      <Star size={14} color="#fff" />
                      <Text className="text-xs text-white">Rate</Text>
                    </View>
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push({
                      pathname: "/booking/create",
                      params: {
                        restaurantId: booking.restaurant_id,
                        restaurantName: booking.restaurant.name,
                        partySize: booking.party_size.toString(),
                        quickBook: "true",
                      },
                    });
                  }}
                  className="flex-1"
                >
                  <View className="flex-row items-center gap-1">
                    <Calendar size={14} color="#000" />
                    <Text className="text-xs">Book Again</Text>
                  </View>
                </Button>
              </>
            )}
          </View>
          
          {/* 8.8 Tap for Details Hint */}
          <View className="mt-3 pt-3 border-t border-border">
            <Text className="text-xs text-center text-muted-foreground">
              Tap for full booking details
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  // 9. Empty State Components
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

  // 10. Tab Component
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

  // 11. Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  // 12. Main Render
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 12.1 Header */}
      <View className="px-4 pt-4 pb-2">
        <H2 className="text-2xl">My Bookings</H2>
        <Muted className="text-sm mt-1">
          Tap any booking for full details and options
        </Muted>
      </View>
      
      {/* 12.2 Tabs */}
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
      
      {/* 12.3 Content */}
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