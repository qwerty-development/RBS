// hooks/useBookingConfirmation.ts
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/supabase-provider';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

interface BookingConfirmationProps {
  restaurantId: string;
  bookingTime: Date;
  partySize: number;
  specialRequests?: string;
  occasion?: string;
  dietaryNotes?: string[];
  tablePreferences?: string[];
  bookingPolicy: 'instant' | 'request';
  expectedLoyaltyPoints?: number;
  appliedOfferId?: string;
  loyaltyRuleId?: string;
}

export const useBookingConfirmation = () => {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const confirmBooking = useCallback(async ({
    restaurantId,
    bookingTime,
    partySize,
    specialRequests,
    occasion,
    dietaryNotes,
    tablePreferences,
    bookingPolicy,
    expectedLoyaltyPoints,
    appliedOfferId,
    loyaltyRuleId
  }: BookingConfirmationProps) => {
    if (!profile?.id) {
      Alert.alert('Error', 'Please sign in to make a booking');
      return false;
    }

    setLoading(true);
    try {
      // Generate confirmation code
      const confirmationCode = `BK${Date.now().toString(36).toUpperCase()}`;
      
      // Set initial status based on booking policy
      const initialStatus = bookingPolicy === 'instant' ? 'confirmed' : 'pending';

      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: profile.id,
          restaurant_id: restaurantId,
          booking_time: bookingTime.toISOString(),
          party_size: partySize,
          status: initialStatus,
          special_requests: specialRequests,
          occasion,
          dietary_notes: dietaryNotes,
          table_preferences: tablePreferences,
          confirmation_code: confirmationCode,
          expected_loyalty_points: expectedLoyaltyPoints || 0,
          applied_offer_id: appliedOfferId,
          applied_loyalty_rule_id: loyaltyRuleId
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // If instant booking and loyalty rule exists, award points immediately
      if (bookingPolicy === 'instant' && loyaltyRuleId) {
        try {
          // Call the RPC function to award points
          const { error: loyaltyError } = await supabase.rpc(
            'award_restaurant_loyalty_points',
            { p_booking_id: booking.id }
          );

          if (loyaltyError) {
            console.error('Failed to award loyalty points:', loyaltyError);
            // Don't fail the booking, just log the error
          }
        } catch (err) {
          console.error('Error in loyalty points process:', err);
        }
      }

      // Apply offer if selected
      if (appliedOfferId) {
        try {
          const { error: offerError } = await supabase
            .from('user_offers')
            .insert({
              user_id: profile.id,
              offer_id: appliedOfferId,
              booking_id: booking.id
            });

          if (offerError) {
            console.error('Failed to apply offer:', offerError);
          }
        } catch (err) {
          console.error('Error applying offer:', err);
        }
      }

      // Success feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to success screen
      if (bookingPolicy === 'instant') {
        router.push({
          pathname: '/booking/success',
          params: {
            bookingId: booking.id,
            restaurantName: booking.restaurant?.name || '',
            bookingTime: bookingTime.toISOString(),
            partySize: partySize.toString(),
            confirmationCode,
            loyaltyPoints: expectedLoyaltyPoints?.toString() || '0'
          }
        });
      } else {
        router.push({
          pathname: '/booking/pending',
          params: {
            bookingId: booking.id,
            restaurantName: booking.restaurant?.name || '',
            bookingTime: bookingTime.toISOString(),
            partySize: partySize.toString()
          }
        });
      }

      return true;
    } catch (error: any) {
      console.error('Booking error:', error);
      Alert.alert(
        'Booking Failed',
        error.message || 'Unable to create booking. Please try again.'
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [profile, router]);

  // Handle booking status change (for request bookings)
  const handleBookingStatusChange = useCallback(async (
    bookingId: string,
    newStatus: 'confirmed' | 'declined_by_restaurant'
  ) => {
    try {
      // Update booking status
      const { error: statusError } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (statusError) throw statusError;

      // If confirmed and has loyalty rule, award points
      if (newStatus === 'confirmed') {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('applied_loyalty_rule_id')
          .eq('id', bookingId)
          .single();

        if (!bookingError && booking?.applied_loyalty_rule_id) {
          const { error: loyaltyError } = await supabase.rpc(
            'award_restaurant_loyalty_points',
            { p_booking_id: bookingId }
          );

          if (loyaltyError) {
            console.error('Failed to award loyalty points:', loyaltyError);
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      throw error;
    }
  }, []);

  // Handle booking cancellation
  const cancelBooking = useCallback(async (bookingId: string) => {
    try {
      // Get booking details first
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('status, applied_loyalty_rule_id, loyalty_points_earned')
        .eq('id', bookingId)
        .single();

      if (fetchError) throw fetchError;

      // Update booking status
      const { error: cancelError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled_by_user' })
        .eq('id', bookingId);

      if (cancelError) throw cancelError;

      // If points were awarded, refund them
      if (booking.loyalty_points_earned > 0 && booking.applied_loyalty_rule_id) {
        const { error: refundError } = await supabase.rpc(
          'refund_restaurant_loyalty_points',
          { p_booking_id: bookingId }
        );

        if (refundError) {
          console.error('Failed to refund loyalty points:', refundError);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      Alert.alert(
        'Cancellation Failed',
        error.message || 'Unable to cancel booking. Please try again.'
      );
      return false;
    }
  }, []);

  return {
    confirmBooking,
    handleBookingStatusChange,
    cancelBooking,
    loading
  };
};