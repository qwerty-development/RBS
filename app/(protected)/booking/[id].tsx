// app/(protected)/booking/[id].tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Calendar,
  Clock,
  Users,
  MapPin,
  Phone,
  MessageCircle,
  Star,
  XCircle,
  CheckCircle,
  AlertCircle,
  Navigation,
  Share2,
  Copy,
  Edit3,
  Receipt,
  Camera,
  MessageSquare,
  Heart,
  Utensils,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

// Booking status configuration
const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Pending Confirmation",
    icon: AlertCircle,
    color: "#f59e0b",
    bgColor: "#fef3c7",
    description: "Your booking is waiting for restaurant confirmation. We'll notify you once it's confirmed.",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "#10b981",
    bgColor: "#d1fae5",
    description: "Your table is confirmed! Please arrive on time and show your confirmation code.",
  },
  cancelled_by_user: {
    label: "Cancelled by You",
    icon: XCircle,
    color: "#6b7280",
    bgColor: "#f3f4f6",
    description: "You cancelled this booking.",
  },
  declined_by_restaurant: {
    label: "Declined by Restaurant",
    icon: XCircle,
    color: "#ef4444",
    bgColor: "#fee2e2",
    description: "Unfortunately, the restaurant couldn't accommodate your booking.",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "#3b82f6",
    bgColor: "#dbeafe",
    description: "Thank you for dining with us! We hope you had a great experience.",
  },
  no_show: {
    label: "No Show",
    icon: AlertCircle,
    color: "#dc2626",
    bgColor: "#fee2e2",
    description: "This booking was marked as a no-show.",
  },
};

export default function BookingDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [hasReview, setHasReview] = useState(false);

  // Extract coordinates from PostGIS geography type
  const extractLocationCoordinates = (location: any) => {
    if (!location) return null;
    
    if (typeof location === 'string' && location.startsWith('POINT(')) {
      const coords = location.match(/POINT\(([^)]+)\)/);
      if (coords && coords[1]) {
        const [lng, lat] = coords[1].split(' ').map(Number);
        return { latitude: lat, longitude: lng };
      }
    }
    
    if (location.type === 'Point' && Array.isArray(location.coordinates)) {
      const [lng, lat] = location.coordinates;
      return { latitude: lat, longitude: lng };
    }
    
    if (location.lat && location.lng) {
      return { latitude: location.lat, longitude: location.lng };
    }
    
    if (location.latitude && location.longitude) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    
    return null;
  };

  // Fetch booking details
  const fetchBookingDetails = useCallback(async () => {
    if (!params.id) return;
    
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          restaurant:restaurants (*)
        `)
        .eq("id", params.id)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        throw new Error("Booking not found");
      }
      
      setBooking(data);
      
      // Check if review exists for completed bookings
      if (data.status === "completed") {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("id")
          .eq("booking_id", params.id)
          .single();
        
        setHasReview(!!reviewData);
      }
    } catch (error) {
      console.error("Error fetching booking:", error);
      Alert.alert("Error", "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  // Cancel booking
  const cancelBooking = useCallback(async () => {
    if (!booking) return;
    
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setProcessing(true);
            
            try {
              const { error } = await supabase
                .from("bookings")
                .update({ 
                  status: "cancelled_by_user",
                  updated_at: new Date().toISOString()
                })
                .eq("id", booking.id);
              
              if (error) throw error;
              
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              // Refresh booking data
              await fetchBookingDetails();
              
              Alert.alert("Success", "Your booking has been cancelled");
            } catch (error) {
              console.error("Error cancelling booking:", error);
              Alert.alert("Error", "Failed to cancel booking");
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  }, [booking, fetchBookingDetails]);

  // Communication actions
  const callRestaurant = useCallback(async () => {
    if (!booking?.restaurant.phone_number) return;
    
    const url = `tel:${booking.restaurant.phone_number}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to make phone call");
    }
  }, [booking]);

  const messageRestaurant = useCallback(async () => {
    if (!booking?.restaurant.whatsapp_number) return;
    
    const message = encodeURIComponent(
      `Hi! I have a booking at ${booking.restaurant.name} on ${new Date(
        booking.booking_time
      ).toLocaleDateString()} at ${new Date(
        booking.booking_time
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
        booking.party_size
      } people. Confirmation code: ${booking.confirmation_code}`
    );
    
    const url = `whatsapp://send?phone=${booking.restaurant.whatsapp_number}&text=${message}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "WhatsApp is not installed");
    }
  }, [booking]);

  // Open directions
  const openDirections = useCallback(async () => {
    if (!booking?.restaurant.location) return;
    
    const coords = extractLocationCoordinates(booking.restaurant.location);
    if (!coords) {
      Alert.alert("Error", "Location data not available");
      return;
    }
    
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    
    const latLng = `${coords.latitude},${coords.longitude}`;
    const label = encodeURIComponent(booking.restaurant.name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    
    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        Alert.alert("Error", "Unable to open maps");
      }
    }
  }, [booking]);

  // Share booking
  const shareBooking = useCallback(async () => {
    if (!booking) return;
    
    const shareMessage = `I have a reservation at ${booking.restaurant.name} on ${new Date(
      booking.booking_time
    ).toLocaleDateString()} at ${new Date(
      booking.booking_time
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
      booking.party_size
    } people. Confirmation code: ${booking.confirmation_code}`;
    
    try {
      await Share.share({
        message: shareMessage,
        title: `Booking at ${booking.restaurant.name}`,
      });
    } catch (error) {
      console.error("Error sharing booking:", error);
    }
  }, [booking]);

  // Copy confirmation code
  const copyConfirmationCode = useCallback(async () => {
    if (!booking?.confirmation_code) return;
    
    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", `Confirmation code ${booking.confirmation_code} copied to clipboard`);
  }, [booking]);

  // Navigation actions
  const navigateToReview = useCallback(() => {
    if (!booking) return;
    
    router.push({
      pathname: "/review/create",
      params: {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
      },
    });
  }, [booking, router]);

  const navigateToRestaurant = useCallback(() => {
    if (!booking) return;
    
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: booking.restaurant_id },
    });
  }, [booking, router]);

  const bookAgain = useCallback(() => {
    if (!booking) return;
    
    router.push({
      pathname: "/booking/create",
      params: {
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
        partySize: booking.party_size.toString(),
        quickBook: "true",
      },
    });
  }, [booking, router]);

  // Lifecycle
  useEffect(() => {
    fetchBookingDetails();
  }, [fetchBookingDetails]);

  // Helper functions
  const isUpcoming = () => {
    if (!booking) return false;
    return new Date(booking.booking_time) > new Date() && 
           (booking.status === "pending" || booking.status === "confirmed");
  };

  const isToday = () => {
    if (!booking) return false;
    return new Date(booking.booking_time).toDateString() === new Date().toDateString();
  };

  const isTomorrow = () => {
    if (!booking) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return new Date(booking.booking_time).toDateString() === tomorrow.toDateString();
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Booking not found</H3>
          <P className="text-center text-muted-foreground mb-4">
            The booking you're looking for doesn't exist or has been removed.
          </P>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = BOOKING_STATUS_CONFIG[booking.status];
  const StatusIcon = statusConfig.icon;
  const bookingDate = new Date(booking.booking_time);
  const mapCoordinates = extractLocationCoordinates(booking.restaurant.location) || {
    latitude: 33.8938,
    longitude: 35.5018,
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </Pressable>
        <H2>Booking Details</H2>
        <Pressable onPress={shareBooking} className="p-2 -mr-2">
          <Share2 size={24} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Restaurant Header */}
        <Pressable
          onPress={navigateToRestaurant}
          className="bg-card border-b border-border"
        >
          <View className="flex-row p-4">
            <Image
              source={{ uri: booking.restaurant.main_image_url }}
              className="w-24 h-24 rounded-lg"
              contentFit="cover"
            />
            <View className="flex-1 ml-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <H3 className="mb-1">{booking.restaurant.name}</H3>
                  <P className="text-muted-foreground text-sm mb-2">
                    {booking.restaurant.cuisine_type}
                  </P>
                  <View className="flex-row items-center gap-1">
                    <MapPin size={14} color="#666" />
                    <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                      {booking.restaurant.address}
                    </Text>
                  </View>
                </View>
                <View className="ml-2">
                  <ChevronRight size={20} color="#666" />
                </View>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Status Section */}
        <View className="p-4 border-b border-border">
          <View 
            className="p-4 rounded-lg"
            style={{ backgroundColor: statusConfig.bgColor }}
          >
            <View className="flex-row items-center gap-3 mb-2">
              <StatusIcon size={24} color={statusConfig.color} />
              <Text 
                className="font-bold text-lg"
                style={{ color: statusConfig.color }}
              >
                {statusConfig.label}
              </Text>
            </View>
            <Text className="text-sm" style={{ color: statusConfig.color }}>
              {statusConfig.description}
            </Text>
          </View>
        </View>

        {/* Booking Details */}
        <View className="p-4 border-b border-border">
          <H3 className="mb-4">Booking Information</H3>
          
          <View className="bg-muted/50 rounded-lg p-4 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <Calendar size={20} color="#666" />
                <Text className="font-medium text-lg">
                  {isToday() ? "Today" : isTomorrow() ? "Tomorrow" : bookingDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long", 
                    day: "numeric",
                    year: "numeric"
                  })}
                </Text>
              </View>
            </View>
            
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <Clock size={20} color="#666" />
                <Text className="font-medium text-lg">
                  {bookingDate.toLocaleTimeString([], { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })}
                </Text>
              </View>
            </View>
            
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Users size={20} color="#666" />
                <Text className="font-medium">
                  {booking.party_size} {booking.party_size === 1 ? "Guest" : "Guests"}
                </Text>
              </View>
            </View>
          </View>

          {/* Confirmation Code */}
          <View className="bg-card border border-border rounded-lg p-4">
            <Text className="font-medium mb-2">Confirmation Code</Text>
            <Pressable
              onPress={copyConfirmationCode}
              className="flex-row items-center justify-between bg-muted rounded-lg p-3"
            >
              <Text className="font-mono font-bold text-xl tracking-wider">
                {booking.confirmation_code}
              </Text>
              <Copy size={20} color="#666" />
            </Pressable>
            <Text className="text-xs text-muted-foreground mt-2">
              Tap to copy • Show this code at the restaurant
            </Text>
          </View>
        </View>

        {/* Special Requests */}
        {(booking.special_requests || booking.occasion) && (
          <View className="p-4 border-b border-border">
            <H3 className="mb-3">Special Requests</H3>
            <View className="bg-muted/30 rounded-lg p-4">
              {booking.occasion && (
                <View className="mb-2">
                  <Text className="font-medium">Occasion:</Text>
                  <Text className="text-muted-foreground">{booking.occasion}</Text>
                </View>
              )}
              {booking.special_requests && (
                <View>
                  <Text className="font-medium">Notes:</Text>
                  <Text className="text-muted-foreground">{booking.special_requests}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Contact Options */}
        <View className="p-4 border-b border-border">
          <H3 className="mb-3">Contact Restaurant</H3>
          <View className="gap-2">
            {booking.restaurant.phone_number && (
              <Button
                variant="outline"
                onPress={callRestaurant}
                className="w-full"
              >
                <View className="flex-row items-center gap-2">
                  <Phone size={20} color="#10b981" />
                  <Text>Call Restaurant</Text>
                </View>
              </Button>
            )}
            
            {booking.restaurant.whatsapp_number && (
              <Button
                variant="outline"
                onPress={messageRestaurant}
                className="w-full"
              >
                <View className="flex-row items-center gap-2">
                  <MessageCircle size={20} color="#25D366" />
                  <Text>WhatsApp</Text>
                </View>
              </Button>
            )}
          </View>
        </View>

        {/* Location & Directions */}
        <View className="p-4 border-b border-border">
          <H3 className="mb-3">Location</H3>
          <Pressable
            onPress={openDirections}
            className="bg-card rounded-lg overflow-hidden border border-border"
          >
            <MapView
              style={{ height: 200 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: mapCoordinates.latitude,
                longitude: mapCoordinates.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={mapCoordinates}
                title={booking.restaurant.name}
                description={booking.restaurant.address}
              />
            </MapView>
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="font-medium">{booking.restaurant.address}</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Tap for directions
                </Text>
              </View>
              <Navigation size={20} color="#3b82f6" />
            </View>
          </Pressable>
        </View>

        {/* Bottom padding */}
        <View className="h-20" />
      </ScrollView>

      {/* Bottom Actions */}
      <View className="p-4 border-t border-border bg-background">
        {isUpcoming() && (booking.status === "pending" || booking.status === "confirmed") && (
          <View className="flex-row gap-3 mb-3">
            <Button
              variant="outline"
              onPress={openDirections}
              className="flex-1"
            >
              <View className="flex-row items-center gap-2">
                <Navigation size={16} />
                <Text>Directions</Text>
              </View>
            </Button>
            
            <Button
              variant="destructive"
              onPress={cancelBooking}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <XCircle size={16} />
                  <Text>Cancel</Text>
                </View>
              )}
            </Button>
          </View>
        )}
        
        {booking.status === "completed" && !hasReview && (
          <Button
            variant="default"
            onPress={navigateToReview}
            className="w-full mb-3"
          >
            <View className="flex-row items-center gap-2">
              <Star size={16} />
              <Text>Rate Your Experience</Text>
            </View>
          </Button>
        )}
        
        {(booking.status === "completed" || booking.status === "cancelled_by_user") && (
          <Button
            variant="secondary"
            onPress={bookAgain}
            className="w-full"
          >
            <View className="flex-row items-center gap-2">
              <Calendar size={16} />
              <Text>Book Again</Text>
            </View>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}