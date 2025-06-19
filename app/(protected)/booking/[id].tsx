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
  Trophy,
  Gift,
  Tag,
  Percent,
  QrCode,
  TrendingUp,
  Award,
  Crown,
  Sparkles,
  ExternalLink,
  Info,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { useLoyalty } from "@/hooks/useLoyalty";
import { useOffers } from "@/hooks/useOffers";

// Enhanced types with loyalty and offers data
type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
  metadata?: {
    earnablePoints?: number;
    selectedOfferId?: string;
    userTier?: string;
    bookingSource?: string;
    quickBook?: boolean;
    offerDiscount?: number;
    tierMultiplier?: number;
  };
};

type LoyaltyActivity = {
  id: string;
  points_earned: number;
  activity_type: string;
  description: string;
  created_at: string;
  points_multiplier: number;
};

type AppliedOffer = {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  redemption_code: string;
  used_at: string;
  restaurant_name: string;
};

// Enhanced booking status configuration
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

// Tier configuration for display
const TIER_DISPLAY_CONFIG = {
  bronze: { name: "Bronze", color: "#CD7F32", icon: Award },
  silver: { name: "Silver", color: "#C0C0C0", icon: Star },
  gold: { name: "Gold", color: "#FFD700", icon: Crown },
  platinum: { name: "Platinum", color: "#E5E4E2", icon: Sparkles },
};

// Loyalty Points Card Component
const LoyaltyPointsCard: React.FC<{
  pointsEarned: number;
  userTier: string;
  tierMultiplier?: number;
  onViewLoyalty: () => void;
}> = ({ pointsEarned, userTier, tierMultiplier = 1, onViewLoyalty }) => {
  const tierConfig = TIER_DISPLAY_CONFIG[userTier as keyof typeof TIER_DISPLAY_CONFIG] || TIER_DISPLAY_CONFIG.bronze;
  const IconComponent = tierConfig.icon;

  return (
    <Pressable
      onPress={onViewLoyalty}
      className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-4 mb-4"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Trophy size={20} color="#3b82f6" />
          <Text className="font-bold text-lg ml-2">Loyalty Points Earned</Text>
        </View>
        <View className="flex-row items-center bg-primary/20 px-3 py-1 rounded-full">
          <IconComponent size={14} color={tierConfig.color} />
          <Text className="font-bold text-sm ml-1" style={{ color: tierConfig.color }}>
            {tierConfig.name.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View className="flex-row items-center justify-between">
        <View>
          <View className="flex-row items-center mb-1">
            <Text className="text-3xl font-bold text-primary">+{pointsEarned}</Text>
            <Text className="text-sm text-muted-foreground ml-2">points</Text>
          </View>
          {tierMultiplier > 1 && (
            <Text className="text-xs text-green-600">
              {tierConfig.name} bonus: {((tierMultiplier - 1) * 100).toFixed(0)}% extra
            </Text>
          )}
        </View>
        
        <View className="items-center">
          <ChevronRight size={20} color="#3b82f6" />
          <Text className="text-xs text-primary">View Rewards</Text>
        </View>
      </View>
      
      <Text className="text-xs text-muted-foreground mt-2">
        Points awarded after successful dining experience
      </Text>
    </Pressable>
  );
};

// Applied Offer Card Component
const AppliedOfferCard: React.FC<{
  offer: AppliedOffer;
  savings: number;
  onViewOffers: () => void;
}> = ({ offer, savings, onViewOffers }) => {
  return (
    <Pressable
      onPress={onViewOffers}
      className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4 mb-4"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Tag size={20} color="#16a34a" />
          <Text className="font-bold text-lg ml-2 text-green-800 dark:text-green-200">
            Offer Applied
          </Text>
        </View>
        <View className="bg-green-600 rounded-full px-3 py-1">
          <Text className="text-white font-bold text-sm">
            {offer.discount_percentage}% OFF
          </Text>
        </View>
      </View>
      
      <View className="mb-3">
        <Text className="font-bold text-green-800 dark:text-green-200 mb-1">
          {offer.title}
        </Text>
        <Text className="text-sm text-green-700 dark:text-green-300">
          {offer.description}
        </Text>
      </View>
      
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-green-600 dark:text-green-400">
            Estimated savings: AED {savings.toFixed(2)}
          </Text>
          <Text className="text-xs text-green-600 dark:text-green-400">
            Code: {offer.redemption_code.slice(-6).toUpperCase()}
          </Text>
        </View>
        
        <View className="items-center">
          <ChevronRight size={20} color="#16a34a" />
          <Text className="text-xs text-green-600">View Offers</Text>
        </View>
      </View>
    </Pressable>
  );
};

// Booking Value Summary Component
const BookingValueSummary: React.FC<{
  pointsEarned: number;
  savings?: number;
  tier: string;
}> = ({ pointsEarned, savings = 0, tier }) => {
  const totalValue = savings + (pointsEarned * 0.05); // Assume 1 point = 0.05 AED value

  return (
    <View className="bg-card border border-border rounded-xl p-4 mb-4">
      <View className="flex-row items-center mb-3">
        <TrendingUp size={20} color="#3b82f6" />
        <Text className="font-bold text-lg ml-2">Your Rewards Summary</Text>
      </View>
      
      <View className="space-y-2">
        {savings > 0 && (
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground">Offer Discount</Text>
            <Text className="font-bold text-green-600">-AED {savings.toFixed(2)}</Text>
          </View>
        )}
        
        <View className="flex-row justify-between">
          <Text className="text-muted-foreground">Loyalty Points Value</Text>
          <Text className="font-bold text-primary">~AED {(pointsEarned * 0.05).toFixed(2)}</Text>
        </View>
        
        {totalValue > 0 && (
          <>
            <View className="border-t border-border pt-2">
              <View className="flex-row justify-between">
                <Text className="font-medium">Total Value Gained</Text>
                <Text className="font-bold text-lg text-primary">AED {totalValue.toFixed(2)}</Text>
              </View>
            </View>
            
            <Text className="text-xs text-center text-muted-foreground mt-2">
              You're maximizing your dining value as a {tier.toUpperCase()} member!
            </Text>
          </>
        )}
      </View>
    </View>
  );
};

export default function BookingDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  
  // Enhanced state management
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [loyaltyActivity, setLoyaltyActivity] = useState<LoyaltyActivity | null>(null);
  const [appliedOffer, setAppliedOffer] = useState<AppliedOffer | null>(null);

  // Hooks integration
  const { userPoints, userTier, TIER_CONFIG } = useLoyalty();
  const { offers } = useOffers();

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

  // Enhanced fetch booking details with loyalty and offers data
  const fetchBookingDetails = useCallback(async () => {
    if (!params.id) return;
    
    try {
      // Fetch booking with enhanced data
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

      // Fetch loyalty activity for this booking
      if (profile?.id) {
        const { data: loyaltyData } = await supabase
          .from("loyalty_activities")
          .select("*")
          .eq("user_id", profile.id)
          .eq("related_booking_id", params.id)
          .eq("activity_type", "booking_completed")
          .single();
        
        if (loyaltyData) {
          setLoyaltyActivity(loyaltyData);
        }
      }

      // Fetch applied offer data
      if (data.metadata?.selectedOfferId) {
        const { data: userOfferData } = await supabase
          .from("user_offers")
          .select(`
            *,
            special_offer:special_offers (
              title,
              description,
              discount_percentage
            )
          `)
          .eq("offer_id", data.metadata.selectedOfferId)
          .eq("user_id", profile?.id)
          .eq("booking_id", params.id)
          .single();
        
        if (userOfferData && userOfferData.special_offer) {
          setAppliedOffer({
            id: userOfferData.id,
            title: userOfferData.special_offer.title,
            description: userOfferData.special_offer.description,
            discount_percentage: userOfferData.special_offer.discount_percentage,
            redemption_code: userOfferData.id,
            used_at: userOfferData.used_at || userOfferData.claimed_at,
            restaurant_name: data.restaurant.name,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching booking:", error);
      Alert.alert("Error", "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  }, [params.id, profile?.id]);

  // Enhanced cancel booking with loyalty points handling
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
              
              // Note: In a real implementation, you might want to handle
              // loyalty points refund or offer restoration here
              
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

  // Enhanced communication actions
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
    
    const offerText = appliedOffer ? ` I have a ${appliedOffer.discount_percentage}% discount offer applied.` : '';
    const pointsText = loyaltyActivity ? ` I'm a ${userTier.toUpperCase()} loyalty member.` : '';
    
    const message = encodeURIComponent(
      `Hi! I have a booking at ${booking.restaurant.name} on ${new Date(
        booking.booking_time
      ).toLocaleDateString()} at ${new Date(
        booking.booking_time
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
        booking.party_size
      } people. Confirmation code: ${booking.confirmation_code}${offerText}${pointsText}`
    );
    
    const url = `whatsapp://send?phone=${booking.restaurant.whatsapp_number}&text=${message}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "WhatsApp is not installed");
    }
  }, [booking, appliedOffer, loyaltyActivity, userTier]);

  // Enhanced directions
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

  // Enhanced share booking with rewards info
  const shareBooking = useCallback(async () => {
    if (!booking) return;
    
    const offerText = appliedOffer ? ` I got ${appliedOffer.discount_percentage}% off with a special offer!` : '';
    const pointsText = loyaltyActivity ? ` Plus I earned ${loyaltyActivity.points_earned} loyalty points!` : '';
    
    const shareMessage = `I have a reservation at ${booking.restaurant.name} on ${new Date(
      booking.booking_time
    ).toLocaleDateString()} at ${new Date(
      booking.booking_time
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
      booking.party_size
    } people.${offerText}${pointsText} Confirmation code: ${booking.confirmation_code}`;
    
    try {
      await Share.share({
        message: shareMessage,
        title: `Booking at ${booking.restaurant.name}`,
      });
    } catch (error) {
      console.error("Error sharing booking:", error);
    }
  }, [booking, appliedOffer, loyaltyActivity]);

  // Enhanced copy confirmation code
  const copyConfirmationCode = useCallback(async () => {
    if (!booking?.confirmation_code) return;
    
    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", `Confirmation code ${booking.confirmation_code} copied to clipboard`);
  }, [booking]);

  // Enhanced navigation actions
  const navigateToReview = useCallback(() => {
    if (!booking) return;
    
    router.push({
      pathname: "/review/create",
      params: {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
        earnedPoints: loyaltyActivity?.points_earned?.toString() || "0",
      },
    });
  }, [booking, router, loyaltyActivity]);

  const navigateToRestaurant = useCallback(() => {
    if (!booking) return;
    
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: booking.restaurant_id },
    });
  }, [booking, router]);

  const navigateToLoyalty = useCallback(() => {
    router.push("/profile/loyalty");
  }, [router]);

  const navigateToOffers = useCallback(() => {
    router.push("/offers");
  }, [router]);

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

  // Calculate estimated savings
  const estimatedSavings = appliedOffer ? 
    (100 * appliedOffer.discount_percentage / 100) : 0; // Rough estimate

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
          <Text className="mt-4 text-muted-foreground">Loading booking details...</Text>
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
      {/* Enhanced Header */}
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
        {/* Enhanced Restaurant Header */}
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
                  <View className="flex-row items-center gap-1 mb-2">
                    <MapPin size={14} color="#666" />
                    <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                      {booking.restaurant.address}
                    </Text>
                  </View>
                  
                  {/* Enhanced info badges */}
                  <View className="flex-row items-center gap-2">
                    {appliedOffer && (
                      <View className="bg-green-100 px-2 py-1 rounded-full">
                        <Text className="text-green-700 text-xs font-bold">
                          {appliedOffer.discount_percentage}% OFF
                        </Text>
                      </View>
                    )}
                    {loyaltyActivity && (
                      <View className="bg-primary/10 px-2 py-1 rounded-full">
                        <Text className="text-primary text-xs font-bold">
                          +{loyaltyActivity.points_earned} pts
                        </Text>
                      </View>
                    )}
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

        {/* Enhanced Rewards Section */}
        <View className="p-4">
          {/* Loyalty Points Card */}
          {loyaltyActivity && (
            <LoyaltyPointsCard
              pointsEarned={loyaltyActivity.points_earned}
              userTier={booking.metadata?.userTier || userTier}
              tierMultiplier={loyaltyActivity.points_multiplier}
              onViewLoyalty={navigateToLoyalty}
            />
          )}

          {/* Applied Offer Card */}
          {appliedOffer && (
            <AppliedOfferCard
              offer={appliedOffer}
              savings={estimatedSavings}
              onViewOffers={navigateToOffers}
            />
          )}

          {/* Booking Value Summary */}
          {(loyaltyActivity || appliedOffer) && (
            <BookingValueSummary
              pointsEarned={loyaltyActivity?.points_earned || 0}
              savings={estimatedSavings}
              tier={booking.metadata?.userTier || userTier}
            />
          )}
        </View>

        {/* Enhanced Booking Details */}
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

          {/* Enhanced Confirmation Code */}
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
            
            {/* Additional codes if applicable */}
            {appliedOffer && (
              <View className="mt-3 pt-3 border-t border-border">
                <Text className="font-medium mb-2">Offer Redemption Code</Text>
                <View className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <Text className="font-mono font-bold text-green-800 dark:text-green-200">
                    {appliedOffer.redemption_code.slice(-8).toUpperCase()}
                  </Text>
                  <Text className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Show for {appliedOffer.discount_percentage}% discount
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Enhanced Special Requests */}
        {(booking.special_requests || booking.occasion || booking.dietary_notes || booking.table_preferences) && (
          <View className="p-4 border-b border-border">
            <H3 className="mb-3">Special Requests</H3>
            <View className="bg-muted/30 rounded-lg p-4 space-y-3">
              {booking.occasion && (
                <View>
                  <Text className="font-medium flex-row items-center">
                    <Gift size={16} color="#666" className="mr-2" />
                    Occasion:
                  </Text>
                  <Text className="text-muted-foreground capitalize">{booking.occasion}</Text>
                </View>
              )}
              
              {booking.dietary_notes && booking.dietary_notes.length > 0 && (
                <View>
                  <Text className="font-medium flex-row items-center">
                    <Utensils size={16} color="#666" className="mr-2" />
                    Dietary Requirements:
                  </Text>
                  <Text className="text-muted-foreground">{booking.dietary_notes.join(", ")}</Text>
                </View>
              )}
              
              {booking.table_preferences && booking.table_preferences.length > 0 && (
                <View>
                  <Text className="font-medium flex-row items-center">
                    <Star size={16} color="#666" className="mr-2" />
                    Table Preferences:
                  </Text>
                  <Text className="text-muted-foreground">{booking.table_preferences.join(", ")}</Text>
                </View>
              )}
              
              {booking.special_requests && (
                <View>
                  <Text className="font-medium flex-row items-center">
                    <MessageSquare size={16} color="#666" className="mr-2" />
                    Special Notes:
                  </Text>
                  <Text className="text-muted-foreground">{booking.special_requests}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Enhanced Contact Options */}
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
          
          {(appliedOffer || loyaltyActivity) && (
            <View className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <View className="flex-row items-center gap-2">
                <Info size={16} color="#3b82f6" />
                <Text className="text-sm text-blue-800 dark:text-blue-200 flex-1">
                  Your loyalty status and applied offers will be mentioned when contacting the restaurant.
                </Text>
              </View>
            </View>
          )}
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

      {/* Enhanced Bottom Actions */}
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
        
        {/* Enhanced quick actions */}
        <View className="flex-row gap-3">
          {(booking.status === "completed" || booking.status === "cancelled_by_user") && (
            <Button
              variant="secondary"
              onPress={bookAgain}
              className="flex-1"
            >
              <View className="flex-row items-center gap-2">
                <Calendar size={16} />
                <Text>Book Again</Text>
              </View>
            </Button>
          )}
          
          {loyaltyActivity && (
            <Button
              variant="outline"
              onPress={navigateToLoyalty}
              className="flex-none px-4"
            >
              <Trophy size={16} color="#3b82f6" />
            </Button>
          )}
          
          {appliedOffer && (
            <Button
              variant="outline"
              onPress={navigateToOffers}
              className="flex-none px-4"
            >
              <Tag size={16} color="#16a34a" />
            </Button>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}