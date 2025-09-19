import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import * as Haptics from "expo-haptics";

export interface BookingInvitation {
  id: string;
  booking_id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message?: string;
  created_at: string;
  responded_at?: string;
  // Related data
  booking?: {
    id: string;
    booking_time: string;
    party_size: number;
    status: string;
    restaurant?: {
      id: string;
      name: string;
      main_image_url?: string;
      address?: string;
    };
  };
  from_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  to_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export const useBookingInvitations = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<BookingInvitation[]>([]);

  // Load received invitations for the current user
  const loadReceivedInvitations = useCallback(async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("booking_invites")
        .select(
          `
          *,
          booking:bookings!inner(
            id,
            booking_time,
            party_size,
            status,
            restaurant:restaurants(
              id,
              name,
              main_image_url,
              address
            )
          ),
          from_user:profiles!booking_invites_from_user_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("to_user_id", profile.id)
        .in("status", ["pending", "accepted"])
        .gte("booking.booking_time", now) // Only show future bookings
        .in("booking.status", ["pending", "confirmed"]) // Only show active bookings
        .order("created_at", { ascending: false });

      if (error) throw error;

      setInvitations(data || []);
    } catch (error) {
      console.error("Error loading invitations:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Load sent invitations for the current user
  const loadSentInvitations = useCallback(async () => {
    if (!profile?.id) return [];

    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("booking_invites")
        .select(
          `
          *,
          booking:bookings!inner(
            id,
            booking_time,
            party_size,
            status,
            restaurant:restaurants(
              id,
              name,
              main_image_url,
              address
            )
          ),
          to_user:profiles!booking_invites_to_user_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("from_user_id", profile.id)
        .gte("booking.booking_time", now) // Only show future bookings
        .in("booking.status", ["pending", "confirmed"]) // Only show active bookings
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as BookingInvitation[];
    } catch (error) {
      console.error("Error loading sent invitations:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Accept an invitation
  const acceptInvitation = useCallback(async (invitationId: string) => {
    try {
      console.log("Starting acceptInvitation for ID:", invitationId);

      // First, get the invitation details
      const { data: invitationData, error: inviteError } = await supabase
        .from("booking_invites")
        .select("booking_id, status")
        .eq("id", invitationId)
        .single();

      if (inviteError) {
        console.error("Error fetching invitation:", inviteError);
        throw new Error(`Failed to fetch invitation: ${inviteError.message}`);
      }

      if (!invitationData) {
        throw new Error("Invitation not found");
      }

      console.log("Invitation data:", invitationData);

      // Check if invitation is already processed
      if (invitationData.status !== "pending") {
        throw new Error(`Invitation is already ${invitationData.status}`);
      }

      // Now get the booking data - this should work with the new RLS policy
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("id, party_size, status, user_id")
        .eq("id", invitationData.booking_id)
        .single();

      if (bookingError) {
        console.error("Error fetching booking:", bookingError);
        throw new Error(`Failed to fetch booking: ${bookingError.message}`);
      }

      if (!bookingData) {
        throw new Error(
          `No booking found. Booking ID: ${invitationData.booking_id}`,
        );
      }

      console.log("Booking data found:", bookingData);

      // Update the invitation status
      const { error: updateError } = await supabase
        .from("booking_invites")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (updateError) {
        console.error("Error updating invitation status:", updateError);
        throw new Error(`Failed to update invitation: ${updateError.message}`);
      }

      console.log("Successfully updated invitation status");

      // Update the booking's party size to include the new attendee
      const currentPartySize = bookingData.party_size || 1;
      const newPartySize = currentPartySize + 1;

      console.log(
        `Updating party size from ${currentPartySize} to ${newPartySize}`,
      );

      const { error: partySizeError } = await supabase
        .from("bookings")
        .update({
          party_size: newPartySize,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitationData.booking_id);

      if (partySizeError) {
        console.error("Error updating party size:", partySizeError);
        // Don't throw here - the invitation was accepted successfully
        // Party size update is a nice-to-have but not critical
      } else {
        console.log("Successfully updated party size");
      }

      // Update local state
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invitationId
            ? {
                ...inv,
                status: "accepted",
                responded_at: new Date().toISOString(),
              }
            : inv,
        ),
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Invitation Accepted",
        "You've successfully joined this booking!",
      );

      console.log("Accept invitation completed successfully");
      return true;
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      const errorMessage = error?.message || "Unknown error occurred";
      Alert.alert("Error", `Failed to accept invitation: ${errorMessage}`);
      return false;
    }
  }, []);

  // Decline an invitation
  const declineInvitation = useCallback(async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("booking_invites")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (error) throw error;

      // Update local state
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Invitation Declined",
        "You've declined this booking invitation.",
      );

      return true;
    } catch (error: any) {
      console.error("Error declining invitation:", error);
      Alert.alert("Error", "Failed to decline invitation. Please try again.");
      return false;
    }
  }, []);

  // Cancel an invitation (for the person who sent it)
  const cancelInvitation = useCallback(async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("booking_invites")
        .update({
          status: "cancelled",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Invitation Cancelled", "The invitation has been cancelled.");

      return true;
    } catch (error: any) {
      console.error("Error cancelling invitation:", error);
      Alert.alert("Error", "Failed to cancel invitation. Please try again.");
      return false;
    }
  }, []);

  // Leave a booking (for invited users)
  const leaveBooking = useCallback(
    async (invitationId: string, bookingId: string) => {
      Alert.alert(
        "Leave Booking",
        "Are you sure you want to leave this booking? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: async () => {
              try {
                // First, get the current party size
                const { data: bookingData, error: bookingFetchError } =
                  await supabase
                    .from("bookings")
                    .select("party_size")
                    .eq("id", bookingId)
                    .single();

                if (bookingFetchError) throw bookingFetchError;

                // Update invitation status to cancelled
                const { error: inviteError } = await supabase
                  .from("booking_invites")
                  .update({
                    status: "cancelled",
                    responded_at: new Date().toISOString(),
                  })
                  .eq("id", invitationId);

                if (inviteError) throw inviteError;

                // Decrease the party size by 1 (but never go below 1)
                const newPartySize = Math.max(
                  1,
                  (bookingData.party_size || 1) - 1,
                );

                const { error: partySizeError } = await supabase
                  .from("bookings")
                  .update({
                    party_size: newPartySize,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", bookingId);

                if (partySizeError) {
                  console.error("Error updating party size:", partySizeError);
                  // Don't throw - the person still left successfully
                }

                // Check if this was the last person in the booking
                const { error: checkError } = await supabase
                  .from("booking_invites")
                  .select("id")
                  .eq("booking_id", bookingId)
                  .eq("status", "accepted");

                if (checkError) throw checkError;

                // Update local state
                setInvitations((prev) =>
                  prev.filter((inv) => inv.id !== invitationId),
                );

                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                Alert.alert(
                  "Left Booking",
                  "You've successfully left this booking.",
                );

                return true;
              } catch (error: any) {
                console.error("Error leaving booking:", error);
                Alert.alert(
                  "Error",
                  "Failed to leave booking. Please try again.",
                );
                return false;
              }
            },
          },
        ],
      );
    },
    [],
  );

  // Cancel entire booking (for the organizer)
  const cancelEntireBooking = useCallback(
    async (bookingId: string, onCancel?: () => Promise<boolean>) => {
      Alert.alert(
        "Cancel Entire Booking",
        "Are you sure you want to cancel this entire booking? This will cancel the reservation for everyone invited.",
        [
          { text: "Keep Booking", style: "cancel" },
          {
            text: "Cancel Booking",
            style: "destructive",
            onPress: async () => {
              try {
                // Cancel all invitations first
                const { error: invitesError } = await supabase
                  .from("booking_invites")
                  .update({
                    status: "cancelled",
                    responded_at: new Date().toISOString(),
                  })
                  .eq("booking_id", bookingId);

                if (invitesError) throw invitesError;

                // Cancel the main booking using the provided callback
                if (onCancel) {
                  const success = await onCancel();
                  if (success) {
                    await Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    Alert.alert(
                      "Booking Cancelled",
                      "The entire booking has been cancelled for all participants.",
                    );
                  }
                  return success;
                }

                return true;
              } catch (error: any) {
                console.error("Error cancelling entire booking:", error);
                Alert.alert(
                  "Error",
                  "Failed to cancel booking. Please try again.",
                );
                return false;
              }
            },
          },
        ],
      );
    },
    [],
  );

  // Get booking organizer info and determine user's role
  const getBookingOrganizerInfo = useCallback(async (bookingId: string) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          id,
          user_id,
          organizer_id,
          is_group_booking,
          user:profiles!user_id(id, full_name),
          organizer:profiles!organizer_id(id, full_name)
        `,
        )
        .eq("id", bookingId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error getting booking organizer info:", error);
      return null;
    }
  }, []);

  // Check if current user can cancel the entire booking
  const canCancelEntireBooking = useCallback(
    async (bookingId: string): Promise<boolean> => {
      if (!profile?.id) return false;

      const bookingInfo = await getBookingOrganizerInfo(bookingId);
      if (!bookingInfo) return false;

      // User can cancel entire booking if they are either the user_id or organizer_id
      return (
        bookingInfo.user_id === profile.id ||
        bookingInfo.organizer_id === profile.id
      );
    },
    [profile?.id, getBookingOrganizerInfo],
  );

  // Check if current user is just an invitee (can only leave, not cancel entire booking)
  const isInviteeOnly = useCallback(
    async (bookingId: string): Promise<boolean> => {
      if (!profile?.id) return false;

      const bookingInfo = await getBookingOrganizerInfo(bookingId);
      if (!bookingInfo) return true; // Default to invitee-only if can't determine

      // User is invitee-only if they are neither the user_id nor organizer_id
      return (
        bookingInfo.user_id !== profile.id &&
        bookingInfo.organizer_id !== profile.id
      );
    },
    [profile?.id, getBookingOrganizerInfo],
  );

  // Real-time subscription to invitations
  useEffect(() => {
    if (!profile?.id) return;

    // Load initial data
    loadReceivedInvitations();

    // Set up real-time subscription for invitations
    const invitationsChannel = supabase
      .channel("booking_invitations_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_invites",
          filter: `to_user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log("Invitation change for received:", payload);
          loadReceivedInvitations(); // Reload received invitations
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_invites",
          filter: `from_user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log("Invitation change for sent:", payload);
          // Note: We don't auto-reload sent invitations here since they're loaded on-demand
        },
      )
      .subscribe();

    // Also listen to booking changes that might affect invitations
    const bookingsChannel = supabase
      .channel("booking_changes_realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
        },
        (payload) => {
          console.log("Booking updated:", payload);
          // Reload invitations since booking details might have changed
          loadReceivedInvitations();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invitationsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [profile?.id, loadReceivedInvitations]);

  // Get only pending invitations for notifications
  const getPendingInvitations = useCallback(async () => {
    if (!profile?.id) return [];

    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("booking_invites")
        .select(
          `
          *,
          booking:bookings!inner(
            id,
            booking_time,
            party_size,
            status,
            restaurant:restaurants(
              id,
              name,
              main_image_url,
              address
            )
          ),
          from_user:profiles!booking_invites_from_user_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("to_user_id", profile.id)
        .eq("status", "pending")
        .gte("booking.booking_time", now) // Only show future bookings
        .in("booking.status", ["pending", "confirmed"]) // Only show active bookings
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as BookingInvitation[];
    } catch (error) {
      console.error("Error loading pending invitations:", error);
      return [];
    }
  }, [profile?.id]);

  return {
    invitations,
    loading,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,
    leaveBooking,
    cancelEntireBooking,
    loadReceivedInvitations,
    loadSentInvitations,
    getPendingInvitations,
    getBookingOrganizerInfo,
    canCancelEntireBooking,
    isInviteeOnly,
  };
};
