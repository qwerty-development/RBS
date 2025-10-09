import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Pressable,
  Alert,
  Share,
  LogBox,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Copy,
  Calendar,
  Users,
  Timer,
  Bell,
  Trophy,
  AlertCircle,
  Info,
  Gift,
  TableIcon,
  MapPin,
  Sparkles,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { NavigationHeader } from "@/components/ui/navigation-header";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { colors } from "@/constants/colors";

// Import components - WITH FIXES APPLIED
import {
  BookingDetailsHeader,
  BookingActionsBar,
  BookingContactSection,
  AppliedOfferCard,
  BookingInvitationsSection,
  EditableBookingFields,
} from "@/components/booking";
import { BookingTableInfo } from "@/components/booking/BookingTableInfo";

// Import custom hook
import { useBookingDetails } from "@/hooks/useBookingDetails";

// Import constants
import { BOOKING_STATUS_CONFIG } from "@/constants/bookingConstants";
import BookingDetailsScreenSkeleton from "@/components/skeletons/BookingDetailsScreenSkeleton";
// TEMP DISABLED: Share functionality requires deeplink
// import { useShare } from "@/hooks/useShare";

/**
 * Formats table preference text for display
 * Converts snake_case to Title Case (e.g., "window_seat" -> "Window Seat")
 */
const formatTablePreference = (preference: string): string => {
  // Handle common table preference values
  const formatted = preference
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return formatted;
};

LogBox.ignoreAllLogs();

// Types
interface LoyaltyRuleDetails {
  id: string;
  rule_name: string;
  points_to_award: number;
  restaurant_id: string;
}

// Component to show restaurant loyalty status
const RestaurantLoyaltyStatus: React.FC<{
  booking: any;
  rule: LoyaltyRuleDetails | null;
  wasRefunded: boolean;
}> = ({ booking, rule, wasRefunded }) => {
  if (!rule) return null;

  const isPending = booking.status === "pending";
  const isCancelled =
    booking.status === "cancelled_by_user" ||
    booking.status === "declined_by_restaurant";

  const primaryTextClass = `text-sm ${
    isCancelled
      ? "text-red-700 dark:text-red-300"
      : isPending
        ? "text-orange-700 dark:text-orange-300"
        : "text-purple-700 dark:text-purple-300"
  }`;

  const renderPrimaryMessage = () => {
    if (isPending) {
      const pointsToDisplay =
        booking.expected_loyalty_points ?? rule.points_to_award;
      return (
        <Text className={primaryTextClass}>
          {`You'll earn ${pointsToDisplay} points from "${rule.rule_name}" if confirmed`}
        </Text>
      );
    }

    if (isCancelled) {
      if (wasRefunded) {
        return (
          <Text className={primaryTextClass}>
            {`The ${booking.loyalty_points_earned || 0} points from "${rule.rule_name}" have been refunded to the restaurant`}
          </Text>
        );
      }
      return (
        <Text className={primaryTextClass}>
          No points were awarded for this cancelled booking
        </Text>
      );
    }

    return (
      <Text className={primaryTextClass}>
        {`You earned ${booking.loyalty_points_earned} points from "${rule.rule_name}"`}
      </Text>
    );
  };

  return (
    <View className="mx-4 mb-6">
      <View
        className={`border rounded-xl p-4 ${
          isCancelled
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            : isPending
              ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
              : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
        }`}
      >
        <View className="flex-row items-center mb-2">
          <Trophy
            size={20}
            color={isCancelled ? "#dc2626" : isPending ? "#f97316" : "#9333ea"}
          />
          <Text className="font-semibold text-lg ml-2">
            {isPending
              ? "Potential Loyalty Points"
              : isCancelled
                ? "Loyalty Points Status"
                : "Loyalty Points Earned"}
          </Text>
        </View>

        <View className="space-y-2">
          {renderPrimaryMessage()}

          {isCancelled && wasRefunded ? (
            <View className="flex-row items-start mt-2">
              <AlertCircle size={14} color="#dc2626" className="mt-0.5" />
              <Text className="text-xs text-red-600 dark:text-red-400 ml-2 flex-1">
                Points have been deducted from your account balance
              </Text>
            </View>
          ) : null}

          {isPending ? (
            <View className="flex-row items-start mt-2">
              <Timer size={14} color="#f97316" className="mt-0.5" />
              <Text className="text-xs text-orange-600 dark:text-orange-400 ml-2 flex-1">
                Points will be automatically added when your booking is
                confirmed
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default function BookingDetailsScreen() {
  const [isMounted, setIsMounted] = useState(false);

  // State for booking field updates
  const [bookingFields, setBookingFields] = useState<{
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
  }>({});

  // TEMP DISABLED: Share functionality requires deeplink
  // const { shareBooking: shareBookingWithDeepLink } = useShare();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const themeColors = useMemo(
    () => colors[colorScheme] ?? colors.light,
    [colorScheme],
  );

  // Enhanced validation and logging for booking ID from params
  const bookingId = useMemo(() => {
    let extractedId = "";
    try {
      if (typeof params.id === "string" && params.id.trim().length > 0) {
        extractedId = params.id.trim();
      } else if (Array.isArray(params.id) && params.id.length > 0) {
        extractedId = String(params.id[0]).trim();
      } else if (params.id) {
        extractedId = String(params.id).trim();
      }
    } catch (error) {
      console.error("[BookingDetails] Error extracting booking ID:", error);
    }
    return extractedId;
  }, [params]);

  // Restaurant loyalty state
  const [restaurantLoyaltyRule, setRestaurantLoyaltyRule] =
    useState<LoyaltyRuleDetails | null>(null);
  const [wasLoyaltyRefunded, setWasLoyaltyRefunded] = useState<boolean>(false);

  // Declined explanation state
  const [showDeclinedExplanation, setShowDeclinedExplanation] = useState(false);

  // Waitlist origin state
  const [isWaitlistOrigin, setIsWaitlistOrigin] = useState(false);

  // Use custom hook for all booking logic
  const {
    booking,
    loading,
    processing,
    hasReview,
    loyaltyActivity,
    appliedOfferDetails,
    assignedTables,
    isUpcoming,
    isToday,
    isTomorrow,
    cancelBooking,
    copyOfferCode,
  } = useBookingDetails(bookingId);

  // Initialize booking fields when booking data loads
  useEffect(() => {
    if (booking) {
      setBookingFields({
        occasion: booking.occasion,
        special_requests: booking.special_requests,
        dietary_notes: booking.dietary_notes,
      });
    }
  }, [booking]);

  // Handler for booking field updates
  const handleBookingFieldsUpdate = (updatedFields: {
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
  }) => {
    setBookingFields(updatedFields);
  };

  // Fetch restaurant loyalty details
  useEffect(() => {
    const fetchRestaurantLoyaltyDetails = async () => {
      if (!booking?.applied_loyalty_rule_id) return;

      try {
        const { data: ruleData, error } = await supabase
          .from("restaurant_loyalty_rules")
          .select("id, rule_name, points_to_award, restaurant_id")
          .eq("id", booking.applied_loyalty_rule_id)
          .single();

        if (!error && ruleData) {
          setRestaurantLoyaltyRule(ruleData);
        }

        // Check if loyalty was refunded (for cancelled bookings)
        if (
          booking.status === "cancelled_by_user" ||
          booking.status === "declined_by_restaurant"
        ) {
          const { data: refundData } = await supabase
            .from("restaurant_loyalty_transactions")
            .select("*")
            .eq("booking_id", booking.id)
            .eq("transaction_type", "refund")
            .single();

          if (refundData) {
            setWasLoyaltyRefunded(true);
          }
        }
      } catch (err) {
        console.error("Error fetching restaurant loyalty details:", err);
      }
    };

    fetchRestaurantLoyaltyDetails();
  }, [booking?.applied_loyalty_rule_id, booking?.status, booking?.id]);

  // Check if booking came from waitlist entry
  useEffect(() => {
    const checkWaitlistOrigin = async () => {
      if (!booking?.id) return;

      try {
        const { data: waitlistData } = await supabase
          .from("waitlist")
          .select("id, status")
          .eq("converted_booking_id", booking.id)
          .single();

        if (waitlistData) {
          setIsWaitlistOrigin(true);
        }
      } catch (err) {
        console.error("Error checking waitlist origin:", err);
      }
    };

    checkWaitlistOrigin();
  }, [booking?.id]);

  // Additional state for pending bookings
  const bookingDate = booking ? new Date(booking.booking_time) : new Date();

  // Check if pending booking has passed its time (should be treated as declined)
  const isPendingAndPassed =
    booking?.status === "pending" && bookingDate < new Date();
  const isPending = booking?.status === "pending" && !isPendingAndPassed;
  const isDeclined = booking?.status === "declined_by_restaurant";

  // Navigation handlers with error handling
  const navigateToReview = () => {
    try {
      if (!booking || !booking.restaurant) return;
      const params = new URLSearchParams({
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name || "",
        earnedPoints: loyaltyActivity?.points_earned?.toString() || "0",
      });
      router.push(`/review/create?${params.toString()}`);
    } catch (error) {
      console.error("[BookingDetails] Navigation to review failed:", error);
      Alert.alert("Error", "Failed to navigate to review page");
    }
  };

  const navigateToRestaurant = () => {
    try {
      if (!booking || !booking.restaurant_id) return;
      router.push(`/restaurant/${booking.restaurant_id}`);
    } catch (error) {
      console.error("[BookingDetails] Navigation to restaurant failed:", error);
      Alert.alert("Error", "Failed to navigate to restaurant page");
    }
  };

  const navigateToLoyalty = () => {
    try {
      router.push("/profile/loyalty");
    } catch (error) {
      console.error("[BookingDetails] Navigation to loyalty failed:", error);
    }
  };

  const navigateToOffers = () => {
    try {
      router.push("/offers");
    } catch (error) {
      console.error("[BookingDetails] Navigation to offers failed:", error);
    }
  };

  const bookAgain = () => {
    try {
      if (!booking || !booking.restaurant) return;
      const originalDate = new Date(booking.booking_time);
      const now = new Date();
      let suggestedDate = originalDate;
      if (originalDate < now) {
        suggestedDate = new Date(originalDate);
        suggestedDate.setDate(suggestedDate.getDate() + 7);
      }
      const params = new URLSearchParams({
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
        partySize: booking.party_size.toString(),
        suggestedDate: suggestedDate.toISOString(),
        originalDate: originalDate.toISOString(),
      });
      router.push(`/booking/availability?${params.toString()}`);
    } catch (error) {
      console.error("[BookingDetails] Book again failed:", error);
      Alert.alert("Error", "Failed to create new booking");
    }
  };

  // TEMP DISABLED: Share functionality requires deeplink
  // const shareBooking = async () => {
  //   if (!booking || !booking.restaurant) return;
  //   try {
  //     await shareBookingWithDeepLink(booking.id, booking.restaurant.name);
  //   } catch (error) {
  //     console.error("Error sharing booking:", error);
  //     const statusText = isPending ? "I've requested a table" : isDeclined ? "My booking request was declined" : "I have a reservation";
  //     const shareMessage = `${statusText} at ${booking.restaurant.name} on ${new Date(booking.booking_time).toLocaleDateString()} at ${new Date(booking.booking_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${booking.party_size} people.${booking.confirmation_code && !isPending ? ` Confirmation code: ${booking.confirmation_code}` : ""}`;
  //     await Share.share({ message: shareMessage, title: `Booking at ${booking.restaurant.name}` });
  //   }
  // };

  const copyConfirmationCode = async () => {
    if (!booking?.confirmation_code) return;
    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Copied!",
      `${isPending ? "Reference" : "Confirmation"} code ${booking.confirmation_code} copied to clipboard`,
    );
  };

  const shareAppliedOffer = async () => {
    if (!appliedOfferDetails || !booking || !booking.restaurant) return;
    try {
      await Share.share({
        message: `I saved ${appliedOfferDetails.discount_percentage}% at ${booking.restaurant.name} with a special offer! 🎉 Check out the app for more deals.`,
        title: "Great Deal Alert!",
      });
    } catch (error) {
      console.error("Error sharing offer:", error);
    }
  };

  // Enhanced validation: Check for missing or invalid booking ID
  if (
    isMounted &&
    (!bookingId ||
      bookingId === "" ||
      bookingId === "undefined" ||
      bookingId === "null")
  ) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <NavigationHeader
          title="Booking Details"
          onBack={() => router.back()}
          showShare={false}
        />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-bold text-center mb-2">
            Invalid Booking
          </Text>
          <Text className="text-center text-muted-foreground mb-4">
            No booking ID was provided. Please try accessing the booking from
            your bookings list.
          </Text>
          <Button
            variant="outline"
            onPress={() => router.push("/(protected)/(tabs)/bookings")}
          >
            <Text>Go to Bookings</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (loading || !isMounted || !bookingId) {
    return <BookingDetailsScreenSkeleton />;
  }

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <NavigationHeader
          title="Booking Details"
          onBack={() => router.back()}
          showShare={false}
        />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-bold text-center mb-2">
            Booking not found
          </Text>
          <Text className="text-center text-muted-foreground mb-4">
            The booking you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Additional validation: Ensure restaurant data exists
  if (!booking.restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <NavigationHeader
          title="Booking Details"
          onBack={() => router.back()}
          showShare={false}
        />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-bold text-center mb-2">Data Error</Text>
          <Text className="text-center text-muted-foreground mb-4">
            Restaurant information is missing for this booking. Please try again
            or contact support.
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Use declined status for pending bookings that have passed their time
  const effectiveStatus = isPendingAndPassed
    ? "declined_by_restaurant"
    : booking.status;
  const statusConfig =
    BOOKING_STATUS_CONFIG[
      effectiveStatus as keyof typeof BOOKING_STATUS_CONFIG
    ] || BOOKING_STATUS_CONFIG.pending;
  const finalStatusConfig = statusConfig || BOOKING_STATUS_CONFIG.pending;
  const StatusIcon = finalStatusConfig.icon;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header - TEMP DISABLED: Share functionality requires deeplink */}
      <NavigationHeader
        title="Booking Details"
        onBack={() => router.back()}
        showShare={false}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Restaurant Header - USING FIXED COMPONENT */}
        <BookingDetailsHeader
          restaurant={{
            id: booking.restaurant.id,
            name: booking.restaurant.name,
            cuisine_type: booking.restaurant.cuisine_type,
            address: booking.restaurant.address,
            main_image_url: booking.restaurant.main_image_url?.trim() || null,
          }}
          appliedOfferDetails={appliedOfferDetails}
          loyaltyActivity={loyaltyActivity}
          onPress={navigateToRestaurant}
        />

        {/* Status Section */}
        <View className="px-4 py-4 border-b border-border">
          <View
            className="p-4 rounded-lg"
            style={{ backgroundColor: finalStatusConfig.bgColor }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-3">
                <StatusIcon size={24} color={finalStatusConfig.color} />
                <Text
                  className="font-bold text-lg"
                  style={{ color: finalStatusConfig.color }}
                >
                  {finalStatusConfig.label}
                </Text>
              </View>
              {isDeclined ? (
                <Pressable
                  onPress={() =>
                    setShowDeclinedExplanation(!showDeclinedExplanation)
                  }
                >
                  <Info size={16} color={finalStatusConfig.color} />
                </Pressable>
              ) : null}
            </View>
            <Text
              className="text-sm"
              style={{ color: finalStatusConfig.color }}
            >
              {finalStatusConfig.description}
            </Text>
          </View>

          {/* Pending Status Extra Info */}
          {isPending ? (
            <View className="mt-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <View className="flex-row items-center gap-2 mb-2">
                <Timer size={20} color={themeColors.primary} />
                <Text className="font-semibold text-orange-800 dark:text-orange-200">
                  Response Expected Soon
                </Text>
              </View>
              <Text className="text-sm text-orange-700 dark:text-orange-300">
                The restaurant typically responds within a couple of minutes.
                We&apos;ll notify you immediately when they confirm.
              </Text>
              <View className="flex-row items-center gap-2 mt-3">
                <Bell size={16} color={themeColors.primary} />
                <Text className="text-xs text-orange-600 dark:text-orange-400">
                  Push notifications enabled
                </Text>
              </View>
            </View>
          ) : null}

          {/* Declined Status Extra Info */}
          {isDeclined && showDeclinedExplanation ? (
            <View className="mt-3 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              {isWaitlistOrigin ? (
                <Text className="text-sm text-red-700 dark:text-red-300">
                  You were waitlisted but the booking has expired. The
                  restaurant couldn&apos;t accommodate your request at this
                  time.
                </Text>
              ) : booking.decline_note && booking.decline_note.trim() ? (
                <View>
                  <Text className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                    Reason:
                  </Text>
                  <Text className="text-sm text-red-700 dark:text-red-300">
                    {booking.decline_note.trim()}
                  </Text>
                </View>
              ) : (
                <Text className="text-sm text-red-700 dark:text-red-300">
                  The restaurant couldn&apos;t accommodate your request at this
                  time. This could be due to full capacity or special events.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Restaurant Loyalty Status */}
        <RestaurantLoyaltyStatus
          booking={booking}
          rule={restaurantLoyaltyRule}
          wasRefunded={wasLoyaltyRefunded}
        />

        {/* Rewards Section - Only show for confirmed bookings with rewards */}
        {booking.status === "confirmed" && appliedOfferDetails ? (
          <View className="px-4 py-4 border-b border-border">
            <Text className="text-lg font-bold mb-4 text-foreground">
              Your Rewards
            </Text>
            {/* Applied Offer Card */}
            <AppliedOfferCard
              offerDetails={appliedOfferDetails}
              onCopyCode={copyOfferCode}
              onViewOffers={navigateToOffers}
              onShareOffer={shareAppliedOffer}
            />
          </View>
        ) : null}

        {/* Booking Information */}
        <View className="px-4 py-4">
          <Text className="text-lg font-bold mb-4 text-foreground">
            Booking Information
          </Text>

          {/* Main Booking Details Card */}
          <View className="bg-primary/5 rounded-lg p-3 mb-3 border border-primary/10">
            {/* Date and Time Row */}
            <View className="mb-4">
              <View className="flex-row items-start gap-3 mb-3">
                <View className="bg-primary/10 rounded-full p-2">
                  <Calendar size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    DATE & TIME
                  </Text>
                  <Text className="font-semibold text-base text-primary dark:text-white">
                    {isToday
                      ? "Today"
                      : isTomorrow
                        ? "Tomorrow"
                        : bookingDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                    {!isToday && !isTomorrow
                      ? `, ${bookingDate.getFullYear()}`
                      : ""}
                    {" at "}
                    {bookingDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>

              {/* Party Size */}
              <View className="flex-row items-center gap-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2">
                  <Users size={18} color={themeColors.primary} />
                </View>
                <View>
                  <Text className="text-xs text-muted-foreground mb-1">
                    GUESTS
                  </Text>
                  <Text className="font-medium text-foreground">
                    {`${booking.party_size} ${booking.party_size === 1 ? "Guest" : "Guests"}`}
                  </Text>
                </View>
              </View>

              {/* Expected Loyalty Points */}
              {booking.expected_loyalty_points &&
              booking.expected_loyalty_points > 0 ? (
                <View className="flex-row items-center gap-3 pt-3">
                  <View className="bg-primary/10 rounded-full p-2">
                    <Sparkles size={18} color={themeColors.primary} />
                  </View>
                  <View>
                    <Text className="text-xs text-muted-foreground mb-1">
                      LOYALTY POINTS
                    </Text>
                    <Text className="font-medium text-primary dark:text-white">
                      {`+${booking.expected_loyalty_points} points`}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Table Preferences */}
            {booking.table_preferences &&
            booking.table_preferences.length > 0 ? (
              <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <TableIcon size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    TABLE PREFERENCE
                  </Text>
                  <Text className="font-medium text-foreground">
                    {booking.table_preferences
                      .map(formatTablePreference)
                      .join(", ")}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Preferred Section */}
            {booking.preferred_section ? (
              <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <MapPin size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    PREFERRED SECTION
                  </Text>
                  <Text className="font-medium text-foreground capitalize">
                    {booking.preferred_section}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Special Offer */}
            {appliedOfferDetails ? (
              <View className="flex-row items-start gap-3 mb-3 pb-3 border-b border-border">
                <View className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <Gift size={18} color={themeColors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-1">
                    SPECIAL OFFER
                  </Text>
                  <Text className="font-medium text-foreground">
                    {appliedOfferDetails.special_offer_title}
                  </Text>
                  {appliedOfferDetails.discount_percentage ? (
                    <Text className="text-xs text-primary dark:text-white mt-0.5">
                      {`${appliedOfferDetails.discount_percentage}% discount applied`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Additional Information Section - Editable */}
            <EditableBookingFields
              bookingId={booking.id}
              currentValues={bookingFields}
              onUpdate={handleBookingFieldsUpdate}
              canEdit={
                booking.status === "pending" || booking.status === "confirmed"
              }
            />

            {/* Guest Information Section */}
            {booking.guest_name ||
            booking.guest_email ||
            booking.guest_phone ? (
              <View className="border-t border-primary/20 pt-3 mb-3">
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  Guest Information
                </Text>
                {booking.guest_name ? (
                  <Text className="text-primary dark:text-white mb-1">
                    {`Name: ${booking.guest_name}`}
                  </Text>
                ) : null}
                {booking.guest_email ? (
                  <Text className="text-primary dark:text-white mb-1">
                    {`Email: ${booking.guest_email}`}
                  </Text>
                ) : null}
                {booking.guest_phone ? (
                  <Text className="text-primary dark:text-white">
                    {`Phone: ${booking.guest_phone}`}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Confirmation Code Section */}
            {booking.confirmation_code ? (
              <View className="pt-3">
                <Text className="font-semibold mb-3 text-foreground">
                  {isPending ? "Reference Code" : "Confirmation Code"}
                </Text>
                <Pressable
                  onPress={copyConfirmationCode}
                  className="flex-row items-center justify-between bg-background rounded-lg p-3 border border-border"
                >
                  <Text className="font-mono font-bold text-xl tracking-wider text-foreground">
                    {booking.confirmation_code}
                  </Text>
                  <Copy size={20} color={themeColors.mutedForeground} />
                </Pressable>
                <Text className="text-xs text-muted-foreground mt-2">
                  {`Tap to copy • ${isPending ? "Use this code to reference your request" : "Show this code at the restaurant"}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Booking Invitations Section - USING FIXED COMPONENT */}
        <BookingInvitationsSection
          bookingId={booking.id}
          bookingUserId={booking.user_id}
        />

        {/* Table Assignment - Only show for confirmed bookings - USING FIXED COMPONENT */}
        {booking.status === "confirmed" ? (
          <BookingTableInfo
            tables={assignedTables}
            partySize={booking.party_size}
            loading={loading}
          />
        ) : null}

        {/* Contact Section */}
        {booking.restaurant ? (
          <BookingContactSection
            restaurant={{
              name: booking.restaurant.name,
              phone_number: booking.restaurant.phone_number,
              whatsapp_number: booking.restaurant.whatsapp_number,
            }}
            appliedOfferDetails={appliedOfferDetails}
            loyaltyActivity={loyaltyActivity}
          />
        ) : null}

        {/* Bottom padding */}
        <View className="h-48" />
      </ScrollView>

      {/* Actions Bar - USING FIXED COMPONENT */}
      {booking.restaurant ? (
        <View className="absolute bottom-4 left-0 right-0">
          <BookingActionsBar
            booking={{
              id: booking.id,
              status: booking.status,
              confirmation_code: booking.confirmation_code || "",
              booking_time: booking.booking_time,
              party_size: booking.party_size,
              restaurant: {
                id: booking.restaurant.id,
                name: booking.restaurant.name,
                phone_number: booking.restaurant.phone_number,
                whatsapp_number: booking.restaurant.whatsapp_number,
                location: booking.restaurant.location,
                staticCoordinates: booking.restaurant.staticCoordinates,
                coordinates: booking.restaurant.coordinates,
              },
            }}
            appliedOfferDetails={appliedOfferDetails}
            loyaltyActivity={loyaltyActivity}
            hasReview={hasReview}
            isUpcoming={isUpcoming}
            processing={processing}
            onCancel={cancelBooking}
            onReview={navigateToReview}
            onBookAgain={bookAgain}
            onNavigateToLoyalty={navigateToLoyalty}
            onNavigateToOffers={navigateToOffers}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
