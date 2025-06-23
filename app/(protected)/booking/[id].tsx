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
  DollarSign,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { LoyaltyPointsCard } from "@/components/ui/loyalty-points-card";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// Enhanced types with comprehensive offer data
type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

type AppliedOfferDetails = {
  special_offer_id: string;
  special_offer_title: string;
  special_offer_description: string;
  discount_percentage: number;
  user_offer_id: string;
  redemption_code: string;
  used_at: string;
  claimed_at: string;
  estimated_savings: number;
  terms_conditions?: string[];
  valid_until: string;
  minimum_party_size?: number;
};

type LoyaltyActivity = {
  id: string;
  points_earned: number;
  activity_type: string;
  description: string;
  created_at: string;
  points_multiplier: number;
};

// Enhanced booking status configuration
const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Pending Confirmation",
    icon: AlertCircle,
    color: "#f59e0b",
    bgColor: "#fef3c7",
    description:
      "Your booking is waiting for restaurant confirmation. We'll notify you once it's confirmed.",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "#10b981",
    bgColor: "#d1fae5",
    description:
      "Your table is confirmed! Please arrive on time and show your confirmation code.",
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
    description:
      "Unfortunately, the restaurant couldn't accommodate your booking.",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "#3b82f6",
    bgColor: "#dbeafe",
    description:
      "Thank you for dining with us! We hope you had a great experience.",
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

// Enhanced Applied Offer Card Component
const AppliedOfferCard: React.FC<{
  offerDetails: AppliedOfferDetails;
  onCopyCode: () => void;
  onViewOffers: () => void;
  onShareOffer: () => void;
}> = ({ offerDetails, onCopyCode, onViewOffers, onShareOffer }) => {
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  return (
    <View className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 rounded-2xl p-6 mb-4 shadow-lg">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-3">
          <View className="bg-green-500 rounded-full p-2">
            <Gift size={24} color="white" />
          </View>
          <View>
            <Text className="font-bold text-xl text-green-800 dark:text-green-200">
              Special Offer Applied
            </Text>
            <Text className="text-green-700 dark:text-green-300 text-sm">
              Active discount on this booking
            </Text>
          </View>
        </View>

        <View className="bg-green-600 rounded-full px-4 py-2">
          <Text className="text-white font-bold text-lg">
            {offerDetails.discount_percentage}% OFF
          </Text>
        </View>
      </View>

      {/* Offer Details */}
      <View className="mb-4">
        <Text className="font-bold text-lg text-green-800 dark:text-green-200 mb-2">
          {offerDetails.special_offer_title}
        </Text>
        <Text className="text-green-700 dark:text-green-300 text-base leading-relaxed">
          {offerDetails.special_offer_description}
        </Text>
      </View>

      {/* Savings & Usage Info */}
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
              Estimated Savings
            </Text>
            <View className="flex-row items-center gap-2">
              <DollarSign size={20} color="#059669" />
              <Text className="text-green-800 dark:text-green-200 text-2xl font-bold">
                {offerDetails.estimated_savings.toFixed(2)}
              </Text>
            </View>
          </View>

          <View className="items-end">
            <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
              Status
            </Text>
            <View className="flex-row items-center gap-1">
              <CheckCircle size={16} color="#059669" />
              <Text className="text-green-800 dark:text-green-200 font-bold">
                Applied
              </Text>
            </View>
          </View>
        </View>

        {/* Usage timestamp */}
        <Text className="text-green-600 dark:text-green-400 text-xs">
          Used on {formatDate(offerDetails.used_at)}
        </Text>
      </View>

      {/* Redemption Code Section */}
      <View className="bg-green-100 dark:bg-green-800 rounded-xl border-2 border-dashed border-green-400 p-4 mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-green-700 dark:text-green-300 text-sm font-medium mb-1">
              Redemption Code
            </Text>
            <Text className="font-mono text-xl font-bold text-green-800 dark:text-green-200">
              {offerDetails.redemption_code.slice(-8).toUpperCase()}
            </Text>
          </View>
          <Pressable
            onPress={onCopyCode}
            className="bg-green-500 rounded-full p-3"
          >
            <Copy size={20} color="white" />
          </Pressable>
        </View>
        <Text className="text-green-600 dark:text-green-400 text-xs mt-2">
          This code was used for your discount
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-3 mb-4">
        <Button
          variant="outline"
          onPress={onShareOffer}
          className="flex-1 border-green-400"
        >
          <Share2 size={16} color="#059669" />
          <Text className="text-green-700 ml-2">Share Deal</Text>
        </Button>

        <Button
          variant="outline"
          onPress={onViewOffers}
          className="flex-1 border-green-400"
        >
          <Tag size={16} color="#059669" />
          <Text className="text-green-700 ml-2">More Offers</Text>
        </Button>
      </View>

      {/* Terms & Conditions */}
      {offerDetails.terms_conditions &&
        offerDetails.terms_conditions.length > 0 && (
          <View className="border-t border-green-200 dark:border-green-700 pt-4">
            <Text className="text-green-700 dark:text-green-300 text-sm font-medium mb-2">
              Terms & Conditions
            </Text>
            {offerDetails.terms_conditions.slice(0, 3).map((term, index) => (
              <Text
                key={index}
                className="text-green-600 dark:text-green-400 text-xs mb-1"
              >
                • {term}
              </Text>
            ))}
            {offerDetails.terms_conditions.length > 3 && (
              <Text className="text-green-600 dark:text-green-400 text-xs mt-1 font-medium">
                +{offerDetails.terms_conditions.length - 3} more terms
              </Text>
            )}
          </View>
        )}

      {/* Additional info */}
      <View className="mt-4 p-3 bg-green-200 dark:bg-green-900 rounded-lg">
        <Text className="text-green-800 dark:text-green-200 text-sm font-medium text-center">
          🎉 This offer saved you money on your dining experience!
        </Text>
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
  const [loyaltyActivity, setLoyaltyActivity] =
    useState<LoyaltyActivity | null>(null);
  const [appliedOfferDetails, setAppliedOfferDetails] =
    useState<AppliedOfferDetails | null>(null);

  // Extract coordinates from PostGIS geography type
  const extractLocationCoordinates = (location: any) => {
    if (!location) return null;

    if (typeof location === "string" && location.startsWith("POINT(")) {
      const coords = location.match(/POINT\(([^)]+)\)/);
      if (coords && coords[1]) {
        const [lng, lat] = coords[1].split(" ").map(Number);
        return { latitude: lat, longitude: lng };
      }
    }

    if (location.type === "Point" && Array.isArray(location.coordinates)) {
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

  // Enhanced fetch booking details with comprehensive offer data
  const fetchBookingDetails = useCallback(async () => {
    if (!params.id) return;

    try {
      // Fetch booking with enhanced data
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `
        )
        .eq("id", params.id)
        .single();

      if (bookingError) throw bookingError;

      if (!bookingData) {
        throw new Error("Booking not found");
      }

      setBooking(bookingData);

      // Check if review exists for completed bookings
      if (bookingData.status === "completed") {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("id")
          .eq("booking_id", params.id)
          .single();

        setHasReview(!!reviewData);
      }

      // Fetch loyalty activity for this booking
      if (profile?.id) {
        // Try to fetch from loyalty_activities table if it exists
        try {
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
        } catch (loyaltyError) {
          console.log(
            "Loyalty activities table not available or no data found"
          );
        }
      }

      // Enhanced: Fetch applied offer details using applied_offer_id
      if (bookingData.applied_offer_id) {
        console.log(
          "Fetching applied offer details for offer ID:",
          bookingData.applied_offer_id
        );

        try {
          // Get the special offer details
          const { data: specialOfferData, error: specialOfferError } =
            await supabase
              .from("special_offers")
              .select("*")
              .eq("id", bookingData.applied_offer_id)
              .single();

          if (specialOfferError) {
            console.error("Error fetching special offer:", specialOfferError);
          } else if (specialOfferData) {
            console.log("Found special offer:", specialOfferData.title);

            // Get the user_offer details for redemption code and usage info
            const { data: userOfferData, error: userOfferError } =
              await supabase
                .from("user_offers")
                .select("*")
                .eq("booking_id", params.id)
                .eq("user_id", profile?.id)
                .single();

            if (userOfferError) {
              console.error("Error fetching user offer:", userOfferError);
            }

            // Calculate estimated savings based on party size and price range
            const estimatedSavings = Math.round(
              bookingData.party_size *
                ((bookingData.restaurant.price_range || 2) * 30) *
                (specialOfferData.discount_percentage / 100)
            );

            const offerDetails: AppliedOfferDetails = {
              special_offer_id: specialOfferData.id,
              special_offer_title: specialOfferData.title,
              special_offer_description: specialOfferData.description,
              discount_percentage: specialOfferData.discount_percentage,
              user_offer_id: userOfferData?.id || "",
              redemption_code: userOfferData?.id || specialOfferData.id,
              used_at:
                userOfferData?.used_at ||
                userOfferData?.claimed_at ||
                bookingData.created_at,
              claimed_at: userOfferData?.claimed_at || bookingData.created_at,
              estimated_savings: estimatedSavings,
              terms_conditions: specialOfferData.terms_conditions,
              valid_until: specialOfferData.valid_until,
              minimum_party_size: specialOfferData.minimum_party_size,
            };

            console.log("Applied offer details:", offerDetails);
            setAppliedOfferDetails(offerDetails);
          }
        } catch (offerError) {
          console.error("Error fetching applied offer details:", offerError);
        }
      } else {
        console.log("No applied offer for this booking");
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
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
      appliedOfferDetails
        ? "Are you sure you want to cancel this booking? Your applied offer will be restored to your account."
        : "Are you sure you want to cancel this booking? This action cannot be undone.",
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
                  updated_at: new Date().toISOString(),
                })
                .eq("id", booking.id);

              if (error) throw error;

              // If there was an applied offer, restore it
              if (appliedOfferDetails?.user_offer_id) {
                try {
                  await supabase
                    .from("user_offers")
                    .update({
                      used_at: null,
                      booking_id: null,
                    })
                    .eq("id", appliedOfferDetails.user_offer_id);

                  console.log("Offer restored to user account");
                } catch (restoreError) {
                  console.error("Error restoring offer:", restoreError);
                }
              }

              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );

              // Refresh booking data
              await fetchBookingDetails();

              Alert.alert(
                "Success",
                appliedOfferDetails
                  ? "Your booking has been cancelled and your offer has been restored."
                  : "Your booking has been cancelled"
              );
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
  }, [booking, fetchBookingDetails, appliedOfferDetails]);

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

    const offerText = appliedOfferDetails
      ? ` I have a ${appliedOfferDetails.discount_percentage}% discount offer applied (Code: ${appliedOfferDetails.redemption_code.slice(-6).toUpperCase()}).`
      : "";
    const loyaltyText = loyaltyActivity
      ? ` I'm a loyalty member with ${loyaltyActivity.points_earned} points earned from this booking.`
      : "";

    const message = encodeURIComponent(
      `Hi! I have a booking at ${booking.restaurant.name} on ${new Date(
        booking.booking_time
      ).toLocaleDateString()} at ${new Date(
        booking.booking_time
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
        booking.party_size
      } people. Confirmation code: ${booking.confirmation_code}${offerText}${loyaltyText}`
    );

    const url = `whatsapp://send?phone=${booking.restaurant.whatsapp_number}&text=${message}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "WhatsApp is not installed");
    }
  }, [booking, appliedOfferDetails, loyaltyActivity]);

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

    const offerText = appliedOfferDetails
      ? ` Plus I saved ${appliedOfferDetails.discount_percentage}% with a special offer!`
      : "";
    const pointsText = loyaltyActivity
      ? ` I also earned ${loyaltyActivity.points_earned} loyalty points!`
      : "";

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
  }, [booking, appliedOfferDetails, loyaltyActivity]);

  // Enhanced copy confirmation code
  const copyConfirmationCode = useCallback(async () => {
    if (!booking?.confirmation_code) return;

    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Copied!",
      `Confirmation code ${booking.confirmation_code} copied to clipboard`
    );
  }, [booking]);

  // Copy offer redemption code
  const copyOfferCode = useCallback(async () => {
    if (!appliedOfferDetails?.redemption_code) return;

    await Clipboard.setStringAsync(appliedOfferDetails.redemption_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", "Offer redemption code copied to clipboard");
  }, [appliedOfferDetails]);

  // Share applied offer
  const shareAppliedOffer = useCallback(async () => {
    if (!appliedOfferDetails || !booking) return;

    try {
      await Share.share({
        message: `I saved ${appliedOfferDetails.discount_percentage}% at ${booking.restaurant.name} with a special offer! 🎉 Check out the app for more deals.`,
        title: "Great Deal Alert!",
      });
    } catch (error) {
      console.error("Error sharing offer:", error);
    }
  }, [appliedOfferDetails, booking]);

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
      pathname: "/booking/availability",
      params: {
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
        partySize: booking.party_size.toString(),
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
    return (
      new Date(booking.booking_time) > new Date() &&
      (booking.status === "pending" || booking.status === "confirmed")
    );
  };

  const isToday = () => {
    if (!booking) return false;
    return (
      new Date(booking.booking_time).toDateString() ===
      new Date().toDateString()
    );
  };

  const isTomorrow = () => {
    if (!booking) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (
      new Date(booking.booking_time).toDateString() === tomorrow.toDateString()
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
          <Text className="mt-4 text-muted-foreground">
            Loading booking details...
          </Text>
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
  const mapCoordinates = extractLocationCoordinates(
    booking.restaurant.location
  ) || {
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
                    <Text
                      className="text-sm text-muted-foreground"
                      numberOfLines={2}
                    >
                      {booking.restaurant.address}
                    </Text>
                  </View>

                  {/* Enhanced info badges */}
                  <View className="flex-row items-center gap-2">
                    {appliedOfferDetails && (
                      <View className="bg-green-100 px-2 py-1 rounded-full">
                        <Text className="text-green-700 text-xs font-bold">
                          {appliedOfferDetails.discount_percentage}% OFF APPLIED
                        </Text>
                      </View>
                    )}
                    {loyaltyActivity && (
                      <View className="bg-amber-100 px-2 py-1 rounded-full">
                        <Text className="text-amber-700 text-xs font-bold">
                          +{loyaltyActivity.points_earned} PTS
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
          {/* Applied Offer Card - Show prominently */}
          {appliedOfferDetails && (
            <AppliedOfferCard
              offerDetails={appliedOfferDetails}
              onCopyCode={copyOfferCode}
              onViewOffers={navigateToOffers}
              onShareOffer={shareAppliedOffer}
            />
          )}

          {/* Loyalty Points Card */}
          {loyaltyActivity && (
            <LoyaltyPointsCard
              pointsEarned={loyaltyActivity.points_earned}
              userTier={(booking as any).metadata?.userTier || "bronze"}
              tierMultiplier={loyaltyActivity.points_multiplier}
              hasOffer={!!appliedOfferDetails}
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
                  {isToday()
                    ? "Today"
                    : isTomorrow()
                      ? "Tomorrow"
                      : bookingDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
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
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Users size={20} color="#666" />
                <Text className="font-medium">
                  {booking.party_size}{" "}
                  {booking.party_size === 1 ? "Guest" : "Guests"}
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
          </View>
        </View>

        {/* Enhanced Special Requests */}
        {(booking.special_requests ||
          booking.occasion ||
          booking.dietary_notes ||
          booking.table_preferences) && (
          <View className="p-4 border-b border-border">
            <H3 className="mb-3">Special Requests</H3>
            <View className="bg-muted/30 rounded-lg p-4 space-y-3">
              {booking.occasion && (
                <View>
                  <Text className="font-medium flex-row items-center">
                    <Gift size={16} color="#666" className="mr-2" />
                    Occasion:
                  </Text>
                  <Text className="text-muted-foreground capitalize">
                    {booking.occasion}
                  </Text>
                </View>
              )}

              {booking.dietary_notes && booking.dietary_notes.length > 0 && (
                <View>
                  <Text className="font-medium flex-row items-center">
                    <Utensils size={16} color="#666" className="mr-2" />
                    Dietary Requirements:
                  </Text>
                  <Text className="text-muted-foreground">
                    {booking.dietary_notes.join(", ")}
                  </Text>
                </View>
              )}

              {booking.table_preferences &&
                booking.table_preferences.length > 0 && (
                  <View>
                    <Text className="font-medium flex-row items-center">
                      <Star size={16} color="#666" className="mr-2" />
                      Table Preferences:
                    </Text>
                    <Text className="text-muted-foreground">
                      {booking.table_preferences.join(", ")}
                    </Text>
                  </View>
                )}

              {booking.special_requests && (
                <View>
                  <Text className="font-medium flex-row items-center">
                    <MessageSquare size={16} color="#666" className="mr-2" />
                    Special Notes:
                  </Text>
                  <Text className="text-muted-foreground">
                    {booking.special_requests}
                  </Text>
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

          {(appliedOfferDetails || loyaltyActivity) && (
            <View className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <View className="flex-row items-center gap-2">
                <Info size={16} color="#3b82f6" />
                <Text className="text-sm text-blue-800 dark:text-blue-200 flex-1">
                  Your {appliedOfferDetails ? "discount offer and " : ""}loyalty
                  status will be mentioned when contacting the restaurant.
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
                <Text className="font-medium">
                  {booking.restaurant.address}
                </Text>
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
        {isUpcoming() &&
          (booking.status === "pending" || booking.status === "confirmed") && (
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
          {(booking.status === "completed" ||
            booking.status === "cancelled_by_user") && (
            <Button variant="secondary" onPress={bookAgain} className="flex-1">
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
              <Trophy size={16} color="#f59e0b" />
            </Button>
          )}

          {appliedOfferDetails && (
            <Button
              variant="outline"
              onPress={navigateToOffers}
              className="flex-none px-4"
            >
              <Tag size={16} color="#16a34a" />
            </Button>
          )}
        </View>

        {/* Enhanced bottom message */}
        {(appliedOfferDetails || loyaltyActivity) && (
          <Text className="text-center text-xs text-muted-foreground mt-3">
            {appliedOfferDetails && loyaltyActivity
              ? `🎉 You saved ${appliedOfferDetails.discount_percentage}% and earned ${loyaltyActivity.points_earned} points!`
              : appliedOfferDetails
                ? `💰 You saved ${appliedOfferDetails.discount_percentage}% with your special offer`
                : `⭐ You earned ${loyaltyActivity?.points_earned} loyalty points`}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
