// hooks/useBookingDetails.ts
import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

type TableInfo = {
  id: string;
  table_number: string;
  table_type: string;
  capacity: number;
};

type Attendee = {
  id: string;
  user_id: string;
  status: "pending" | "confirmed" | "declined";
  is_organizer: boolean;
  profile: {
    full_name: string;
    avatar_url: string;
  };
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

export const useBookingDetails = (bookingId: string) => {
  const { profile } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [loyaltyActivity, setLoyaltyActivity] =
    useState<LoyaltyActivity | null>(null);
  const [appliedOfferDetails, setAppliedOfferDetails] =
    useState<AppliedOfferDetails | null>(null);
  const [assignedTables, setAssignedTables] = useState<TableInfo[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  // Enhanced fetch booking details with table and attendee information
  const fetchBookingDetails = useCallback(async () => {
    if (!bookingId) return;

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
        .eq("id", bookingId)
        .single();

      if (bookingError) throw bookingError;

      if (!bookingData) {
        throw new Error("Booking not found");
      }

      setBooking(bookingData);

      // Fetch assigned tables
      const { data: tablesData, error: tablesError } = await supabase
        .from("booking_tables")
        .select(
          `
          table:restaurant_tables (
            id,
            table_number,
            table_type,
            capacity
          )
        `
        )
        .eq("booking_id", bookingId);

      if (!tablesError && tablesData) {
        const tables = tablesData
          .map((bt) => bt.table)
          .filter((t): t is TableInfo => t !== null);
        setAssignedTables(tables);
      }

      // Fetch attendees
      const { data: attendeesData, error: attendeesError } = await supabase
        .from("booking_attendees")
        .select(
          `
          *,
          profile:profiles (full_name, avatar_url)
        `
        )
        .eq("booking_id", bookingId);

      if (!attendeesError && attendeesData) {
        setAttendees(attendeesData as Attendee[]);
      }

      // Check if review exists for completed bookings
      if (bookingData.status === "completed") {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("id")
          .eq("booking_id", bookingId)
          .single();

        setHasReview(!!reviewData);
      }

      // Fetch loyalty activity for this booking
      if (profile?.id) {
        try {
          const { data: loyaltyData } = await supabase
            .from("loyalty_activities")
            .select("*")
            .eq("user_id", profile.id)
            .eq("related_booking_id", bookingId)
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

      // Fetch applied offer details
      if (bookingData.applied_offer_id) {
        // ... (offer fetching logic)
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      Alert.alert("Error", "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  }, [bookingId, profile?.id]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`booking-details:${bookingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        () => fetchBookingDetails()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_attendees", filter: `booking_id=eq.${bookingId}` },
        () => fetchBookingDetails()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, fetchBookingDetails]);

  // ... (rest of the hook)

  return {
    booking,
    loading,
    processing,
    hasReview,
    loyaltyActivity,
    appliedOfferDetails,
    assignedTables,
    attendees,
    // ... (helper functions and actions)
    refresh: fetchBookingDetails,
  };
};