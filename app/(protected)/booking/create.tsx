// app/(protected)/booking/create.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Users,
  MessageSquare,
  Gift,
  ChevronLeft,
  Info,
  CheckCircle,
  Utensils,
  Star,
  X,
  UserPlus,
  Tag,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { H3, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { LoyaltyTierDisplay } from "@/components/loyalty/LoyaltyTierDisplay";
import { OfferCard } from "@/components/offers/OfferCard";
import { OffersSelection } from "@/components/offers/OffersSelection";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { SpecialRequirementsForm } from "@/components/booking/SpecialRequirementsForm";
import { TermsAcceptance } from "@/components/booking/TermsAcceptance";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { BookingCTA } from "@/components/booking/BookingCTA";
import { InviteFriends } from "@/components/booking/invite-friend";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import {
  OCCASIONS,
  DIETARY_RESTRICTIONS,
  TABLE_PREFERENCES,
  TierType,
  TIER_CONFIG,
  isValidDate,
  parseDate,
  isValidTime,
  formatBookingDate,
  formatBookingTime,
  calculateEarnablePoints,
  validateBookingForm,
} from "@/lib/bookingUtils";

// Enhanced Type Definitions
interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface UserOfferWithDetails {
  id: string; // user_offer id
  user_id: string;
  offer_id: string; // special_offer id
  claimed_at: string;
  used_at?: string;
  expires_at: string;
  special_offer: {
    id: string;
    title: string;
    description: string;
    discount_percentage: number;
    valid_until: string;
    restaurant_id: string;
    minimum_party_size?: number;
    terms_conditions?: string[];
  };
}

// Form Validation Schema
const bookingFormSchema = z.object({
  specialRequests: z.string().max(500, "Maximum 500 characters").optional(),
  occasion: z.string().optional(),
  dietaryRestrictions: z.array(z.string()).default([]),
  tablePreferences: z.array(z.string()).default([]),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, "You must accept the booking terms"),
});

// Friends Invitation Section Component
const FriendsInvitationSection: React.FC<{
  invitedFriends: string[];
  restaurantName: string;
  bookingTime: string;
  partySize: number;
  onInvitesSent: (friendIds: string[]) => void;
}> = ({
  invitedFriends,
  restaurantName,
  bookingTime,
  partySize,
  onInvitesSent,
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <View>
      <View className="flex-row items-center gap-3 mb-4">
        <UserPlus size={20} color="#3b82f6" />
        <Text className="font-semibold text-lg">Invite Friends</Text>
        {invitedFriends.length > 0 && (
          <View className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
            <Text className="text-blue-800 dark:text-blue-200 font-bold text-xs">
              {invitedFriends.length} Invited
            </Text>
          </View>
        )}
      </View>

      <Text className="text-sm text-muted-foreground mb-4">
        Share your dining experience with friends. They'll get a notification
        about your booking.
      </Text>

      <Pressable
        onPress={() => setShowInviteModal(true)}
        className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-4 items-center"
      >
        <UserPlus size={24} color="#3b82f6" />
        <Text className="font-medium text-blue-600 dark:text-blue-400 mt-2">
          {invitedFriends.length > 0
            ? "Manage Invitations"
            : "Invite Friends to Join"}
        </Text>
        <Text className="text-sm text-blue-500 dark:text-blue-400 text-center mt-1">
          Let your friends know about this booking
        </Text>
      </Pressable>

      {showInviteModal && (
        <InviteFriends
          visible={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInvite={onInvitesSent}
          restaurantName={restaurantName}
          bookingDateTime={bookingTime}
          currentInvitedFriends={invitedFriends}
          maxInvites={partySize - 1}
        />
      )}
    </View>
  );
};

export default function BookingCreateScreen() {
  // Route parameters with validation
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    date?: string;
    time?: string;
    partySize?: string;
    earnablePoints?: string;
    offerId?: string;
    preselectedOfferId?: string;
  }>();

  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // Validate and parse parameters
  const restaurantId = params.restaurantId;
  const rawDate = params.date;
  const rawTime = params.time;
  const rawPartySize = params.partySize;
  const rawEarnablePoints = params.earnablePoints;

  // Validation
  useEffect(() => {
    if (!restaurantId) {
      Alert.alert("Error", "Restaurant ID is required");
      router.back();
      return;
    }

    if (rawDate && !isValidDate(rawDate)) {
      Alert.alert("Error", "Invalid booking date provided");
      router.back();
      return;
    }

    if (rawTime && !isValidTime(rawTime)) {
      Alert.alert("Error", "Invalid booking time provided");
      router.back();
      return;
    }
  }, [restaurantId, rawDate, rawTime, router]);

  // Core state management
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOfferUserId, setSelectedOfferUserId] = useState<string | null>(
    null
  );
  const [availableOffers, setAvailableOffers] = useState<
    UserOfferWithDetails[]
  >([]);

  // Friends functionality state
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);

  // User data
  const [userPoints] = useState(profile?.loyalty_points || 0);
  const [userTier] = useState<TierType>(
    (profile?.membership_tier as TierType) || "bronze"
  );

  // Safely parse booking details from navigation
  const bookingDate = parseDate(rawDate);
  const bookingTime = isValidTime(rawTime) ? rawTime! : "19:00";
  const partySize = rawPartySize
    ? Math.max(1, parseInt(rawPartySize, 10)) || 2
    : 2;
  const earnablePoints = rawEarnablePoints
    ? Math.max(0, parseInt(rawEarnablePoints, 10)) || 0
    : 0;

  // Pre-selected offer handling
  const preselectedOfferId = params.offerId || params.preselectedOfferId;

  // Form setup
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      specialRequests: "",
      occasion: "none",
      dietaryRestrictions: profile?.dietary_restrictions || [],
      tablePreferences: [],
      acceptTerms: false,
    },
  });

  // Watch form values
  const watchedValues = watch();

  // Calculate total party size including invited friends
  const totalPartySize = partySize + invitedFriends.length;

  // Fetch restaurant and offers data
  const fetchData = useCallback(async () => {
    try {
      // Fetch restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      // Fetch user's available offers for this restaurant
      if (profile?.id) {
        try {
          const { data: userOffersData, error: offersError } = await supabase
            .from("user_offers")
            .select(
              `
              id,
              user_id,
              offer_id,
              claimed_at,
              used_at,
              expires_at,
              special_offer:special_offers (
                id,
                title,
                description,
                discount_percentage,
                valid_until,
                restaurant_id,
                minimum_party_size,
                terms_conditions
              )
            `
            )
            .eq("user_id", profile.id)
            .is("used_at", null)
            .gte("expires_at", new Date().toISOString());

          if (!offersError && userOffersData) {
            // Filter for this restaurant and properly type the data
            const restaurantOffers = userOffersData
              .filter(
                (offer) => offer.special_offer?.restaurant_id === restaurantId
              )
              .filter((offer) => offer.special_offer !== null)
              .map((offer) => ({
                ...offer,
                special_offer: offer.special_offer!,
              })) as UserOfferWithDetails[];

            setAvailableOffers(restaurantOffers);

            // Auto-select offer if one was pre-selected
            if (preselectedOfferId) {
              const matchingUserOffer = restaurantOffers.find(
                (offer) => offer.special_offer.id === preselectedOfferId
              );

              if (matchingUserOffer) {
                setSelectedOfferUserId(matchingUserOffer.id);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching offers:", error);
          setAvailableOffers([]);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load booking details");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [restaurantId, preselectedOfferId, profile]);

  // Handle friend invitations
  const handleInvitesSent = useCallback((friendIds: string[]) => {
    setInvitedFriends(friendIds);
  }, []);

  // Enhanced booking submission with proper date handling
  const submitBooking = useCallback(
    async (formData: BookingFormData) => {
      if (!restaurant || !profile?.id) return;

      setSubmitting(true);

      try {
        // Validate and create booking date time
        if (
          !isValidDate(bookingDate.toISOString()) ||
          !isValidTime(bookingTime)
        ) {
          throw new Error("Invalid booking date or time");
        }

        const bookingDateTime = new Date(bookingDate);
        const [hours, minutes] = bookingTime.split(":").map(Number);

        if (
          isNaN(hours) ||
          isNaN(minutes) ||
          hours < 0 ||
          hours > 23 ||
          minutes < 0 ||
          minutes > 59
        ) {
          throw new Error("Invalid booking time format");
        }

        bookingDateTime.setHours(hours, minutes, 0, 0);

        if (bookingDateTime <= new Date()) {
          throw new Error("Booking time must be in the future");
        }

        // Get selected offer details
        const selectedOffer = selectedOfferUserId
          ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
          : null;

        // Prepare booking data
        const bookingData = {
          user_id: profile.id,
          restaurant_id: restaurant.id,
          booking_time: bookingDateTime.toISOString(),
          party_size: totalPartySize,
          status:
            restaurant.booking_policy === "instant" ? "confirmed" : "pending",
          special_requests: formData.specialRequests,
          occasion: formData.occasion !== "none" ? formData.occasion : null,
          dietary_notes: formData.dietaryRestrictions,
          table_preferences: formData.tablePreferences,
          confirmation_code: `BK${Date.now().toString().slice(-8).toUpperCase()}`,
          is_group_booking: invitedFriends.length > 0,
          organizer_id: invitedFriends.length > 0 ? profile.id : null,
          attendees: totalPartySize,
          applied_offer_id: selectedOffer
            ? selectedOffer.special_offer.id
            : null,
        };

        // Create booking record
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert(bookingData)
          .select()
          .single();

        if (bookingError) {
          console.error("Booking creation error:", bookingError);
          throw bookingError;
        }

        // Handle friend invitations if any
        if (invitedFriends.length > 0) {
          try {
            const invites = invitedFriends.map((friendId) => ({
              booking_id: booking.id,
              from_user_id: profile.id,
              to_user_id: friendId,
              message: `Join me at ${restaurant.name} on ${bookingDateTime.toLocaleDateString()} at ${bookingTime}!`,
            }));

            await supabase.from("booking_invites").insert(invites);

            // Add organizer as confirmed attendee
            await supabase.from("booking_attendees").insert({
              booking_id: booking.id,
              user_id: profile.id,
              status: "confirmed",
              is_organizer: true,
            });
          } catch (friendError) {
            console.error("Failed to handle friend invitations:", friendError);
          }
        }

        // Mark the user_offer as used if an offer was selected
        if (selectedOfferUserId && selectedOffer) {
          try {
            await supabase
              .from("user_offers")
              .update({
                used_at: new Date().toISOString(),
              })
              .eq("id", selectedOfferUserId)
              .eq("user_id", profile.id);
          } catch (offerError) {
            console.error("Failed to mark offer as used:", offerError);
          }
        }

        // Award loyalty points
        if (earnablePoints > 0) {
          try {
            await supabase.rpc("award_loyalty_points", {
              p_user_id: profile.id,
              p_points: earnablePoints,
            });
          } catch (pointsError) {
            console.error("Failed to award loyalty points:", pointsError);
          }
        }

        // Haptic feedback
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        // Navigate to success screen
        const successParams = {
          bookingId: booking.id,
          restaurantName: restaurant.name,
          confirmationCode: booking.confirmation_code,
          earnedPoints: earnablePoints.toString(),
          appliedOffer: selectedOffer ? "true" : "false",
          invitedFriends: invitedFriends.length.toString(),
          isGroupBooking: invitedFriends.length > 0 ? "true" : "false",
          userTier,
        };

        if (selectedOffer) {
          Object.assign(successParams, {
            offerTitle: selectedOffer.special_offer.title,
            offerDiscount:
              selectedOffer.special_offer.discount_percentage.toString(),
          });
        }

        router.replace({
          pathname: "/booking/success",
          params: successParams,
        });
      } catch (error: any) {
        console.error("Error creating booking:", error);
        Alert.alert(
          "Booking Failed",
          error.message || "Failed to create booking. Please try again."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      restaurant,
      profile,
      bookingDate,
      bookingTime,
      totalPartySize,
      router,
      selectedOfferUserId,
      availableOffers,
      earnablePoints,
      userTier,
      invitedFriends,
    ]
  );

  // Helper functions for form arrays
  const toggleDietaryRestriction = useCallback(
    (restriction: string) => {
      const current = getValues("dietaryRestrictions");
      if (current.includes(restriction)) {
        setValue(
          "dietaryRestrictions",
          current.filter((r) => r !== restriction)
        );
      } else {
        setValue("dietaryRestrictions", [...current, restriction]);
      }
    },
    [getValues, setValue]
  );

  const toggleTablePreference = useCallback(
    (preference: string) => {
      const current = getValues("tablePreferences");
      if (current.includes(preference)) {
        setValue(
          "tablePreferences",
          current.filter((p) => p !== preference)
        );
      } else {
        setValue("tablePreferences", [...current, preference]);
      }
    },
    [getValues, setValue]
  );

  // Lifecycle management
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Restaurant not found</H3>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const selectedOffer = selectedOfferUserId
    ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
    : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <BookingHeader
          title="Complete Booking"
          subtitle={restaurant.name}
          onBack={() => router.back()}
        />

        {/* Booking Summary */}
        <BookingSummaryCard
          restaurant={restaurant}
          date={bookingDate}
          time={bookingTime}
          partySize={partySize}
          invitedFriendsCount={invitedFriends.length}
          userProfile={profile || {}}
          appliedOffer={selectedOffer}
          onRemoveOffer={() => setSelectedOfferUserId(null)}
          className="mx-4 mt-4"
        />

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4 py-4">
            {/* Loyalty Rewards */}
            {profile && earnablePoints > 0 && (
              <LoyaltyTierDisplay
                userTier={userTier}
                userPoints={userPoints}
                earnablePoints={earnablePoints}
              />
            )}

            {/* Friends Invitation Section */}
            <FriendsInvitationSection
              invitedFriends={invitedFriends}
              restaurantName={restaurant.name}
              bookingTime={bookingDate.toISOString()}
              partySize={partySize}
              onInvitesSent={handleInvitesSent}
            />

            {/* Offers Selection */}
            <OffersSelection
              availableOffers={availableOffers}
              selectedOfferUserId={selectedOfferUserId}
              onSelectOffer={setSelectedOfferUserId}
              partySize={totalPartySize}
            />

            {/* Special Requirements */}
            <SpecialRequirementsForm
              control={control}
              errors={errors}
              watchedValues={watchedValues}
              onToggleDietaryRestriction={toggleDietaryRestriction}
              onToggleTablePreference={toggleTablePreference}
              onSetOccasion={(occasionId) => setValue("occasion", occasionId)}
            />

            {/* Terms Acceptance */}
            <TermsAcceptance
              control={control}
              errors={errors}
              invitedFriendsCount={invitedFriends.length}
            />
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <BookingCTA
          onSubmit={handleSubmit(submitBooking)}
          isSubmitting={submitting}
          isDisabled={submitting || !watchedValues.acceptTerms}
          bookingPolicy={restaurant.booking_policy}
          invitedFriendsCount={invitedFriends.length}
          selectedOfferDiscount={
            selectedOffer?.special_offer.discount_percentage
          }
          earnablePoints={earnablePoints}
          userTier={TIER_CONFIG[userTier].name}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
