// app/(protected)/booking/success.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CheckCircle,
  Calendar,
  Clock,
  Users,
  MapPin,
  Phone,
  Copy,
  Share2,
  Trophy,
  Gift,
  Star,
  ChevronRight,
  Camera,
  MessageSquare,
  Navigation,
  Home,
  QrCode,
  Sparkles,
  Crown,
  Award,
  Tag,
  Heart,
  ExternalLink,
  Percent,
  TrendingUp,
  Info,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { ShareBookingButton } from "@/components/social/ShareBookingButton";
import BookingSuccessScreenSkeleton from '@/components/skeletons/BookingSuccessScreenSkeleton';

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// Enhanced Type definitions
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
  estimated_savings: number;
  terms_conditions?: string[];
};

// Tier Configuration
const TIER_CONFIG = {
  bronze: { name: "Bronze", color: "#CD7F32", icon: Award },
  silver: { name: "Silver", color: "#C0C0C0", icon: Star },
  gold: { name: "Gold", color: "#FFD700", icon: Crown },
  platinum: { name: "Platinum", color: "#E5E4E2", icon: Sparkles },
} as const;

type TierType = keyof typeof TIER_CONFIG;

// Enhanced Success Animation Component
const SuccessAnimation: React.FC<{ hasOffer: boolean }> = ({ hasOffer }) => {
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCheckmark(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      if (hasOffer) {
        setTimeout(() => setShowConfetti(true), 500);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [hasOffer, scaleAnim]);

  return (
    <View className="items-center py-8 relative">
      {/* Confetti effect for offers */}
      {showConfetti && (
        <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center">
          <Text className="text-6xl">🎉</Text>
        </View>
      )}

      <Animated.View
        style={{ transform: [{ scale: scaleAnim }] }}
        className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-4"
      >
        <CheckCircle size={48} color="#10b981" />
      </Animated.View>

      <H1 className="text-3xl font-bold text-center mb-2">
        {hasOffer ? "Booking Confirmed with Savings!" : "Booking Confirmed!"}
      </H1>

      <Text className="text-center text-muted-foreground px-8 text-lg">
        {hasOffer
          ? "Your table is reserved and your special offer has been applied. You're all set!"
          : "Your table reservation has been successfully confirmed. We can't wait to serve you!"}
      </Text>
    </View>
  );
};

// Enhanced Applied Offer Showcase Component
const AppliedOfferShowcase: React.FC<{
  offerDetails: AppliedOfferDetails;
  onCopyCode: () => void;
  onShareOffer: () => void;
}> = ({ offerDetails, onCopyCode, onShareOffer }) => {
  return (
    <View className="mx-4 mb-6">
      <View className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 rounded-2xl p-6 shadow-lg">
        {/* Header with celebration */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <View className="bg-green-500 rounded-full p-2">
              <Gift size={24} color="white" />
            </View>
            <View>
              <Text className="font-bold text-xl text-green-800 dark:text-green-200">
                Offer Applied! 🎉
              </Text>
              <Text className="text-green-700 dark:text-green-300 text-sm">
                You're saving money on this booking
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

        {/* Savings Display */}
        <View className="bg-green-100 dark:bg-green-800 rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
                Estimated Savings
              </Text>
              <Text className="text-green-800 dark:text-green-200 text-2xl font-bold">
                {offerDetails.estimated_savings.toFixed(2)}
              </Text>
            </View>
            <View className="items-center">
              <Percent size={32} color="#059669" />
              <Text className="text-green-700 dark:text-green-300 text-xs mt-1">
                On your bill
              </Text>
            </View>
          </View>
        </View>

        {/* Redemption Code */}
        <View className="bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-green-400 p-4 mb-4">
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
            Show this code to your server to get your discount
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            onPress={onShareOffer}
            className="flex-1 border-green-400"
          >
            <View className="flex-row items-center justify-center gap-2">
              <Share2 size={16} color="#059669" />
              <Text className="text-green-700">Share Deal</Text>
            </View>
          </Button>

          <Button
            variant="outline"
            onPress={() => {
              /* Navigate to offers */
            }}
            className="flex-1 border-green-400"
          >
            <View className="flex-row items-center justify-center gap-2">
              <Tag size={16} color="#059669" />
              <Text className="text-green-700">More Offers</Text>
            </View>
          </Button>
        </View>

        {/* Terms if available */}
        {offerDetails.terms_conditions &&
          offerDetails.terms_conditions.length > 0 && (
            <View className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
              <Text className="text-green-700 dark:text-green-300 text-sm font-medium mb-2">
                Terms & Conditions
              </Text>
              {offerDetails.terms_conditions.slice(0, 2).map((term, index) => (
                <Text
                  key={index}
                  className="text-green-600 dark:text-green-400 text-xs mb-1"
                >
                  • {term}
                </Text>
              ))}
            </View>
          )}
      </View>
    </View>
  );
};

// Enhanced Booking Details Card
const BookingDetailsCard: React.FC<{
  booking: Booking;
  onCopyConfirmation: () => void;
  hasAppliedOffer: boolean;
}> = ({ booking, onCopyConfirmation, hasAppliedOffer }) => {
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const formatTime = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, []);

  return (
    <View className="bg-card border border-border rounded-xl p-6 mx-4 mb-4">
      {/* Restaurant Info */}
      <View className="flex-row items-center gap-4 mb-6">
        <Image
          source={{ uri: booking.restaurant.main_image_url }}
          className="w-20 h-20 rounded-xl"
          contentFit="cover"
        />
        <View className="flex-1">
          <H3 className="text-xl font-bold mb-1">{booking.restaurant.name}</H3>
          <Text className="text-muted-foreground mb-2">
            {booking.restaurant.cuisine_type}
          </Text>
          <View className="flex-row items-center gap-1">
            <Star size={14} color="#f59e0b" fill="#f59e0b" />
            <Text className="text-sm font-medium">
              {booking.restaurant.average_rating?.toFixed(1) || "4.5"}
            </Text>
            <Text className="text-sm text-muted-foreground">
              ({booking.restaurant.total_reviews || 0} reviews)
            </Text>
            {hasAppliedOffer && (
              <>
                <Text className="text-sm text-muted-foreground">•</Text>
                <View className="bg-green-100 px-2 py-1 rounded-full">
                  <Text className="text-green-700 text-xs font-bold">
                    OFFER APPLIED
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Booking Details */}
      <View className="space-y-4">
        <View className="flex-row items-center gap-3">
          <Calendar size={20} color="#3b82f6" />
          <View>
            <Text className="font-semibold">Date</Text>
            <Text className="text-muted-foreground">
              {formatDate(booking.booking_time)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <Clock size={20} color="#3b82f6" />
          <View>
            <Text className="font-semibold">Time</Text>
            <Text className="text-muted-foreground">
              {formatTime(booking.booking_time)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <Users size={20} color="#3b82f6" />
          <View>
            <Text className="font-semibold">Party Size</Text>
            <Text className="text-muted-foreground">
              {booking.party_size}{" "}
              {booking.party_size === 1 ? "guest" : "guests"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <MapPin size={20} color="#3b82f6" />
          <View className="flex-1">
            <Text className="font-semibold">Location</Text>
            <Text className="text-muted-foreground">
              {booking.restaurant.address}
            </Text>
          </View>
        </View>
      </View>

      {/* Enhanced Confirmation Code */}
      <View className="mt-6 p-4 bg-primary/10 rounded-xl">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-semibold text-primary mb-1">
              Confirmation Code
            </Text>
            <Text className="text-2xl font-mono font-bold text-primary">
              {booking.confirmation_code}
            </Text>
          </View>
          <Pressable
            onPress={onCopyConfirmation}
            className="bg-primary rounded-full p-3"
          >
            <Copy size={20} color="white" />
          </Pressable>
        </View>
        <Text className="text-xs text-primary/70 mt-2">
          Please show this code when you arrive at the restaurant
        </Text>
      </View>
    </View>
  );
};

// Enhanced Loyalty Rewards Card
const LoyaltyRewardsCard: React.FC<{
  earnedPoints: number;
  userTier: TierType;
  hasAppliedOffer: boolean;
}> = ({ earnedPoints, userTier, hasAppliedOffer }) => {
  const tierConfig = TIER_CONFIG[userTier];
  const IconComponent = tierConfig.icon;

  return (
    <View className="mx-4 mb-4">
      <View className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <Trophy size={24} color="#f59e0b" />
            <Text className="font-bold text-lg text-amber-800 dark:text-amber-200">
              {hasAppliedOffer ? "Double Win!" : "Points Earned!"}
            </Text>
          </View>
          <View className="flex-row items-center bg-amber-200 dark:bg-amber-800 px-3 py-1 rounded-full">
            <IconComponent size={16} color={tierConfig.color} />
            <Text className="font-bold text-sm ml-1 text-amber-800 dark:text-amber-200">
              {tierConfig.name.toUpperCase()}
            </Text>
          </View>
        </View>

        <View className="items-center">
          <Text className="text-4xl font-bold text-amber-800 dark:text-amber-200 mb-2">
            +{earnedPoints}
          </Text>
          <Text className="text-amber-700 dark:text-amber-300 text-center">
            {hasAppliedOffer
              ? "Loyalty points earned + discount applied!"
              : "Loyalty points have been added to your account"}
          </Text>
        </View>

        {hasAppliedOffer && (
          <View className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Text className="text-amber-800 dark:text-amber-200 text-sm font-medium text-center">
              🎯 You maximized your value with both points and savings!
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Enhanced Quick Actions Section
const QuickActionsSection: React.FC<{
  restaurant: any;
  onCallRestaurant: () => void;
  onGetDirections: () => void;
  onShareBooking: () => void;
  onAddToCalendar: () => void;
}> = ({
  restaurant,
  onCallRestaurant,
  onGetDirections,
  onShareBooking,
  onAddToCalendar,
}) => {
  return (
    <View className="mx-4 mb-6">
      <H3 className="mb-4">Quick Actions</H3>
      <View className="flex-row flex-wrap gap-3">
        <Pressable
          onPress={onCallRestaurant}
          className="bg-card border border-border rounded-xl p-4 items-center flex-1 min-w-[45%]"
        >
          <Phone size={24} color="#3b82f6" className="mb-2" />
          <Text className="font-medium text-center">Call Restaurant</Text>
          <Text className="text-xs text-muted-foreground text-center">
            Speak with them directly
          </Text>
        </Pressable>

        <Pressable
          onPress={onGetDirections}
          className="bg-card border border-border rounded-xl p-4 items-center flex-1 min-w-[45%]"
        >
          <Navigation size={24} color="#3b82f6" className="mb-2" />
          <Text className="font-medium text-center">Get Directions</Text>
          <Text className="text-xs text-muted-foreground text-center">
            Navigate to restaurant
          </Text>
        </Pressable>

        <Pressable
          onPress={onShareBooking}
          className="bg-card border border-border rounded-xl p-4 items-center flex-1 min-w-[45%]"
        >
          <Share2 size={24} color="#3b82f6" className="mb-2" />
          <Text className="font-medium text-center">Share Booking</Text>
          <Text className="text-xs text-muted-foreground text-center">
            Share with friends
          </Text>
        </Pressable>

        <Pressable
          onPress={onAddToCalendar}
          className="bg-card border border-border rounded-xl p-4 items-center flex-1 min-w-[45%]"
        >
          <Calendar size={24} color="#3b82f6" className="mb-2" />
          <Text className="font-medium text-center">Add to Calendar</Text>
          <Text className="text-xs text-muted-foreground text-center">
            Set a reminder
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default function BookingSuccessScreen() {
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const router = useRouter();

  const params = useLocalSearchParams<{
    bookingId: string;
    restaurantName?: string;
    confirmationCode?: string;
    earnedPoints?: string;
    appliedOffer?: string;
    userTier?: string;
    offerTitle?: string;
    offerDiscount?: string;
  }>();

  // State management
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [appliedOfferDetails, setAppliedOfferDetails] =
    useState<AppliedOfferDetails | null>(null);

  const earnedPoints = parseInt(params.earnedPoints || "0", 10);
  const userTier = (params.userTier as TierType) || "bronze";
  const hasAppliedOffer = params.appliedOffer === "true";

  // Enhanced fetch booking details with offer data
  const fetchBookingDetails = useCallback(async () => {
    try {
      // Fetch booking with restaurant details
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `
        )
        .eq("id", params.bookingId)
        .single();

      if (bookingError) throw bookingError;
      setBooking(bookingData);

      // Fetch applied offer details if applicable
      if (bookingData.applied_offer_id) {
        console.log(
          "Fetching applied offer details for:",
          bookingData.applied_offer_id
        );

        // Get the special offer details
        const { data: offerData, error: offerError } = await supabase
          .from("special_offers")
          .select("*")
          .eq("id", bookingData.applied_offer_id)
          .single();

        if (offerError) {
          console.error("Error fetching offer:", offerError);
        } else if (offerData) {
          // Get the user_offer details for redemption code
          const { data: userOfferData } = await supabase
            .from("user_offers")
            .select("*")
            .eq("booking_id", params.bookingId)
            .eq("user_id", profile?.id)
            .single();

          // Calculate estimated savings (rough estimate)
          const estimatedSavings = Math.round(
            bookingData.party_size *
              (bookingData.restaurant.price_range || 2) *
              25 *
              (offerData.discount_percentage / 100)
          );

          setAppliedOfferDetails({
            special_offer_id: offerData.id,
            special_offer_title: offerData.title,
            special_offer_description: offerData.description,
            discount_percentage: offerData.discount_percentage,
            user_offer_id: userOfferData?.id || "",
            redemption_code: userOfferData?.id || offerData.id,
            estimated_savings: estimatedSavings,
            terms_conditions: offerData.terms_conditions,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      Alert.alert("Error", "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  }, [params.bookingId, profile?.id]);

  // Enhanced event handlers
  const handleCopyConfirmation = useCallback(async () => {
    if (!booking?.confirmation_code) return;

    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", "Confirmation code copied to clipboard");
  }, [booking?.confirmation_code]);

  const handleCopyOfferCode = useCallback(async () => {
    if (!appliedOfferDetails?.redemption_code) return;

    await Clipboard.setStringAsync(appliedOfferDetails.redemption_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", "Offer redemption code copied to clipboard");
  }, [appliedOfferDetails?.redemption_code]);

  const handleShareOffer = useCallback(async () => {
    if (!appliedOfferDetails || !booking) return;

    try {
      await Share.share({
        message: `I just saved ${appliedOfferDetails.discount_percentage}% at ${booking.restaurant.name} with a special offer! 🎉 Check out the app for more deals.`,
        title: "Great Deal Alert!",
      });
    } catch (error) {
      console.error("Error sharing offer:", error);
    }
  }, [appliedOfferDetails, booking]);

  const handleCallRestaurant = useCallback(() => {
    if (booking?.restaurant.phone_number) {
      Linking.openURL(`tel:${booking.restaurant.phone_number}`);
    }
  }, [booking?.restaurant.phone_number]);

  const handleGetDirections = useCallback(() => {
    if (booking?.restaurant.address) {
      const url = `https://maps.google.com/?q=${encodeURIComponent(booking.restaurant.address)}`;
      Linking.openURL(url);
    }
  }, [booking?.restaurant.address]);

  const handleShareBooking = useCallback(async () => {
    if (!booking) return;

    const offerText = appliedOfferDetails
      ? ` Plus I saved ${appliedOfferDetails.discount_percentage}% with a special offer!`
      : "";

    try {
      await Share.share({
        message: `I just booked a table at ${booking.restaurant.name}! Confirmation: ${booking.confirmation_code}${offerText}`,
        title: "Restaurant Booking",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [booking, appliedOfferDetails]);

  const handleAddToCalendar = useCallback(() => {
    Alert.alert(
      "Add to Calendar",
      "This feature will open your calendar app to add the booking."
    );
  }, []);

  const handleGoHome = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleViewBooking = useCallback(() => {
    router.push({
      pathname: "/booking/[id]",
      params: { id: params.bookingId },
    });
  }, [router, params.bookingId]);

  // Effects
  useEffect(() => {
    fetchBookingDetails();
  }, [fetchBookingDetails]);

  if (loading) {
    return <BookingSuccessScreenSkeleton />;
  }

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Booking not found</H3>
          <Button variant="outline" onPress={handleGoHome} className="mt-4">
            <Text>Go Home</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Enhanced Success Animation */}
        <SuccessAnimation hasOffer={!!appliedOfferDetails} />

        {/* Applied Offer Showcase - Show prominently if available */}
        {appliedOfferDetails && (
          <AppliedOfferShowcase
            offerDetails={appliedOfferDetails}
            onCopyCode={handleCopyOfferCode}
            onShareOffer={handleShareOffer}
          />
        )}

        {/* Booking Details */}
        <BookingDetailsCard
          booking={booking}
          onCopyConfirmation={handleCopyConfirmation}
          hasAppliedOffer={!!appliedOfferDetails}
        />

        {/* Enhanced Loyalty & Rewards */}
        {earnedPoints > 0 && (
          <LoyaltyRewardsCard
            earnedPoints={earnedPoints}
            userTier={userTier}
            hasAppliedOffer={!!appliedOfferDetails}
          />
        )}

        {/* Value Summary for offers */}
        {appliedOfferDetails && (
          <View className="mx-4 mb-6">
            <View className="bg-card border border-border rounded-xl p-4">
              <View className="flex-row items-center mb-3">
                <TrendingUp size={20} color="#3b82f6" />
                <Text className="font-bold text-lg ml-2">Your Total Value</Text>
              </View>

              <View className="space-y-2">
                <View className="flex-row justify-between">
                  <Text className="text-muted-foreground">
                    Discount Savings
                  </Text>
                  <Text className="font-bold text-green-600">
                    {appliedOfferDetails.estimated_savings.toFixed(2)}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-muted-foreground">
                    Loyalty Points Value
                  </Text>
                  <Text className="font-bold text-amber-600">
                    {(earnedPoints * 0.05).toFixed(2)}
                  </Text>
                </View>

                <View className="border-t border-border pt-2">
                  <View className="flex-row justify-between">
                    <Text className="font-medium">Total Value Gained</Text>
                    <Text className="font-bold text-lg text-primary">
                      {(
                        appliedOfferDetails.estimated_savings +
                        earnedPoints * 0.05
                      ).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <QuickActionsSection
          restaurant={booking.restaurant}
          onCallRestaurant={handleCallRestaurant}
          onGetDirections={handleGetDirections}
          onShareBooking={handleShareBooking}
          onAddToCalendar={handleAddToCalendar}
        />

        <View className="h-6" />
      </ScrollView>

      {/* Enhanced Bottom Actions */}
      <View className="p-4 border-t border-border bg-background">
        <View className="flex-row gap-3 pb-4">
          <Button
            variant="outline"
            onPress={handleViewBooking}
            className="flex-1"
          >
            <View className="flex-row items-center justify-center gap-2">
              <Calendar size={16} color="#666" />
              <Text>View Booking</Text>
            </View>
          </Button>
          <Button onPress={handleGoHome} className="flex-1">
            <View className="flex-row items-center justify-center gap-2">
              <Home size={16} color="white" />
              <Text className="text-white">Done</Text>
            </View>
          </Button>
        </View>

        <ShareBookingButton
          bookingId={booking.id}
          restaurantId={booking.restaurant.id}
          restaurantName={booking.restaurant.name}
        />

        {/* Enhanced bottom message */}
        {appliedOfferDetails && (
          <Text className="text-center text-xs text-muted-foreground mt-3">
            🎉 Congrats on your {appliedOfferDetails.discount_percentage}%
            savings and {earnedPoints} loyalty points!
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
