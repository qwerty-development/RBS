// hooks/useBookingCreate.ts
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import {
  isValidDate,
  parseDate,
  isValidTime,
  TierType,
} from "@/lib/bookingUtils";
import {
  calculateBookingWindow,
  validateTableAssignment,
} from "@/lib/tableManagementUtils";
import { AvailabilityService } from "@/lib/AvailabilityService";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface UserOfferWithDetails {
  id: string;
  user_id: string;
  offer_id: string;
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

interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

export function useBookingCreate() {
  const params = useLocalSearchParams<any>();
  const { profile } = useAuth();
  const router = useRouter();

  // Core state
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOfferUserId, setSelectedOfferUserId] = useState<string | null>(
    params.offerId || params.preselectedOfferId || null
  );
  const [availableOffers, setAvailableOffers] = useState<UserOfferWithDetails[]>([]);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [turnTime, setTurnTime] = useState<number>(120);
  const [lastFormData, setLastFormData] = useState<BookingFormData | null>(null);
  const [isSlotAvailable, setIsSlotAvailable] = useState<boolean | null>(null);

  // Parse and validate parameters
  const restaurantId = params.restaurantId;
  const rawDate = params.date;
  const rawTime = params.time;
  const rawPartySize = params.partySize;
  const rawEarnablePoints = params.earnablePoints;

  const selectedTableIds = useMemo(() => {
    try {
      return params.tableIds ? JSON.parse(params.tableIds) : [];
    } catch (e) {
      console.error("Error parsing table IDs:", e);
      return [];
    }
  }, [params.tableIds]);

  const requiresCombination = params.requiresCombination === "true";

  // User data
  const userPoints = profile?.loyalty_points || 0;
  const userTier = (profile?.membership_tier as TierType) || "bronze";

  // Parsed booking details
  const bookingDate = useMemo(() => parseDate(rawDate), [rawDate]);
  const bookingTime = useMemo(
    () => (isValidTime(rawTime) ? rawTime! : "19:00"),
    [rawTime]
  );
  const partySize = useMemo(
    () => (rawPartySize ? Math.max(1, parseInt(rawPartySize, 10)) || 2 : 2),
    [rawPartySize]
  );
  const earnablePoints = useMemo(
    () =>
      rawEarnablePoints
        ? Math.max(0, parseInt(rawEarnablePoints, 10)) || 0
        : 0,
    [rawEarnablePoints]
  );
  const totalPartySize = partySize + invitedFriends.length;

  // Enhanced error handler
  const handleBookingError = useCallback(
    (error: any) => {
      console.error("Error creating booking:", error);
      // ... (rest of the error handling logic)
    },
    [router, lastFormData]
  );

  // Real-time availability check
  useEffect(() => {
    const checkAvailability = async () => {
      if (!restaurantId || !bookingDate || !bookingTime || !totalPartySize) return;

      const availabilityService = AvailabilityService.getInstance();
      const available = await availabilityService.areTablesAvailable(
        selectedTableIds,
        new Date(`${rawDate}T${rawTime}`),
        new Date(new Date(`${rawDate}T${rawTime}`).getTime() + turnTime * 60000)
      );

      if (!available) {
        Alert.alert(
          "Slot No Longer Available",
          "This time slot was just taken. Please go back and select a new time.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
      setIsSlotAvailable(available);
    };

    checkAvailability();
  }, [restaurantId, rawDate, rawTime, totalPartySize, selectedTableIds, turnTime, router]);

  // Data fetching
  const fetchData = useCallback(async () => {
    // ... (data fetching logic)
  }, [restaurantId, profile, bookingDate, bookingTime, partySize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const confirmAndSubmitBooking = (formData: BookingFormData) => {
    const selectedOffer = selectedOfferUserId
      ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
      : null;

    // Offer validation
    if (selectedOffer && new Date(selectedOffer.expires_at) < new Date()) {
      Alert.alert(
        "Offer Expired",
        "This offer has expired. Please select another offer or continue without one."
      );
      return;
    }

    if (
      selectedOffer &&
      selectedOffer.special_offer.minimum_party_size &&
      totalPartySize < selectedOffer.special_offer.minimum_party_size
    ) {
      Alert.alert(
        "Party Size Too Small",
        `This offer requires a minimum party size of ${selectedOffer.special_offer.minimum_party_size}.`
      );
      return;
    }

    let confirmationMessage = `Confirm your booking at ${restaurant?.name} for ${totalPartySize} on ${bookingDate.toLocaleDateString()} at ${bookingTime}.`;
    if (selectedOffer) {
      confirmationMessage += `\n\nOffer: ${selectedOffer.special_offer.title}`;
    }

    Alert.alert("Confirm Booking", confirmationMessage, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => submitBooking(formData) },
    ]);
  };

  const submitBooking = useCallback(
    async (formData: BookingFormData) => {
      // ... (booking submission logic)
    },
    [
      // ... (dependencies)
    ]
  );

  // ... (rest of the hook)

  return {
    // ... (state and actions)
    submitBooking: confirmAndSubmitBooking, // Expose the confirmation function
  };
}
