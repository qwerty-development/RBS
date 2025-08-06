// hooks/useBookingConfirmation.ts
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/supabase-provider';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AvailabilityService } from '@/lib/AvailabilityService';

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
  tableIds?: string; // JSON string of table IDs array
  requiresCombination?: boolean;
  turnTime?: number;
  isGroupBooking?: boolean;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
}

interface BookingResult {
  booking: {
    id: string;
    confirmation_code: string;
    restaurant_name?: string;
    status: string;
    booking_time: string;
    party_size: number;
    loyalty_points_earned?: number;
    restaurant?: {
      name: string;
      id: string;
    };
  };
  tables?: Array<{
    id: string;
    table_number: string;
    table_type: string;
  }>;
}

export const useBookingConfirmation = () => {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  /**
   * Parse table IDs from JSON string safely
   */
  const parseTableIds = useCallback((tableIdsJson?: string): string[] => {
    if (!tableIdsJson) return [];
    
    try {
      const parsed = JSON.parse(tableIdsJson);
      return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
    } catch (e) {
      console.error('Error parsing table IDs:', e);
      return [];
    }
  }, []);

  /**
   * Validate table assignment before booking
   */
  const validateTableAssignment = useCallback(async (
    tableIds: string[],
    partySize: number,
    startTime: Date,
    endTime: Date
  ): Promise<{ valid: boolean; error?: string }> => {
    try {
      if (tableIds.length === 0) {
        return { valid: false, error: 'No tables selected' };
      }

      // Check for table conflicts
      const { data: conflict } = await supabase.rpc('check_booking_overlap', {
        p_table_ids: tableIds,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
      });

      if (conflict) {
        return { valid: false, error: 'Tables are no longer available for this time slot' };
      }

      // Verify total capacity
      const { data: tables } = await supabase
        .from('restaurant_tables')
        .select('capacity')
        .in('id', tableIds);

      const totalCapacity = tables?.reduce((sum, t) => sum + t.capacity, 0) || 0;

      if (totalCapacity < partySize) {
        return { valid: false, error: 'Selected tables do not have enough capacity' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating table assignment:', error);
      return { valid: false, error: 'Failed to validate table assignment' };
    }
  }, []);

  /**
   * Calculate booking end time based on turn time
   */
  const calculateEndTime = useCallback((startTime: Date, turnTimeMinutes: number = 120): Date => {
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + turnTimeMinutes);
    return endTime;
  }, []);

  /**
   * Handle loyalty points and offers for confirmed bookings
   */
  const handleLoyaltyAndOffers = useCallback(async (
    bookingId: string,
    loyaltyRuleId?: string,
    appliedOfferId?: string,
    userId?: string
  ) => {
    try {
      // Award loyalty points if rule exists
      if (loyaltyRuleId) {
        const { error: loyaltyError } = await supabase.rpc(
          'award_restaurant_loyalty_points',
          { p_booking_id: bookingId }
        );

        if (loyaltyError) {
          console.error('Failed to award loyalty points:', loyaltyError);
          // Don't fail the booking, just log the error
        }
      }

      // Apply offer if selected
      if (appliedOfferId && userId) {
        const { error: offerError } = await supabase
          .from('user_offers')
          .insert({
            user_id: userId,
            offer_id: appliedOfferId,
            booking_id: bookingId
          });

        if (offerError) {
          console.error('Failed to apply offer:', offerError);
        }
      }
    } catch (error) {
      console.error('Error handling loyalty and offers:', error);
    }
  }, []);

  /**
   * Main booking confirmation function
   */
  const confirmBooking = useCallback(async (props: BookingConfirmationProps) => {
    if (!profile?.id) {
      Alert.alert('Error', 'Please sign in to make a booking');
      return false;
    }

    setLoading(true);
    
    try {
      const {
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
        loyaltyRuleId,
        tableIds,
        requiresCombination,
        turnTime = 120,
        isGroupBooking = false,
        guestName,
        guestEmail,
        guestPhone
      } = props;

      // Parse table IDs
      const parsedTableIds = parseTableIds(tableIds);
      console.log('Booking confirmation - Parsed Table IDs:', parsedTableIds);

      // Calculate booking window
      const startTime = new Date(bookingTime);
      const endTime = calculateEndTime(startTime, turnTime);

      // Validate table assignment for instant bookings
      if (bookingPolicy === 'instant' && parsedTableIds.length > 0) {
        const validation = await validateTableAssignment(parsedTableIds, partySize, startTime, endTime);
        if (!validation.valid) {
          Alert.alert('Booking Error', validation.error || 'Table validation failed');
          return false;
        }
      }

      // Generate confirmation code
      const confirmationCode = `BK${Date.now().toString(36).toUpperCase()}`;
      
      // Set initial status based on booking policy
      const initialStatus = bookingPolicy === 'instant' ? 'confirmed' : 'pending';

      let bookingResult: BookingResult;

      // Use RPC function for instant bookings with table assignment
      if (bookingPolicy === 'instant' && parsedTableIds.length > 0) {
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          'create_booking_with_tables',
          {
            p_user_id: profile.id,
            p_restaurant_id: restaurantId,
            p_booking_time: bookingTime.toISOString(),
            p_party_size: partySize,
            p_table_ids: parsedTableIds,
            p_turn_time: turnTime,
            p_special_requests: specialRequests || null,
            p_occasion: occasion !== "none" ? occasion : null,
            p_dietary_notes: dietaryNotes || null,
            p_table_preferences: tablePreferences || null,
            p_is_group_booking: isGroupBooking,
            p_applied_offer_id: appliedOfferId || null,
          }
        );

        if (rpcError) {
          console.error('RPC Booking error:', rpcError);
          throw rpcError;
        }

        if (!rpcResult?.booking) {
          throw new Error('No booking data returned from RPC');
        }

        bookingResult = rpcResult;
      } else {
        // Create booking directly for request bookings or instant without specific tables
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            user_id: profile.id,
            restaurant_id: restaurantId,
            booking_time: bookingTime.toISOString(),
            party_size: partySize,
            status: initialStatus,
            special_requests: specialRequests,
            occasion: occasion !== "none" ? occasion : null,
            dietary_notes: dietaryNotes,
            table_preferences: tablePreferences,
            confirmation_code: confirmationCode,
            expected_loyalty_points: expectedLoyaltyPoints || 0,
            applied_offer_id: appliedOfferId,
            applied_loyalty_rule_id: loyaltyRuleId,
            turn_time_minutes: turnTime,
            is_group_booking: isGroupBooking,
            guest_name: guestName,
            guest_email: guestEmail,
            guest_phone: guestPhone
          })
          .select(`
            *,
            restaurant:restaurants(name, id)
          `)
          .single();

        if (bookingError) throw bookingError;

        bookingResult = {
          booking: {
            id: booking.id,
            confirmation_code: booking.confirmation_code,
            restaurant_name: booking.restaurant?.name,
            status: booking.status,
            booking_time: booking.booking_time,
            party_size: booking.party_size,
            loyalty_points_earned: booking.loyalty_points_earned,
            restaurant: booking.restaurant
          }
        };
      }

      // Handle loyalty points and offers for instant bookings
      if (bookingPolicy === 'instant') {
        await handleLoyaltyAndOffers(
          bookingResult.booking.id,
          loyaltyRuleId,
          appliedOfferId,
          profile.id
        );
      }

      // Success feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // CRITICAL: Clear availability cache after successful booking
      // This ensures time slots and tables are immediately updated for other users
      try {
        const availabilityService = AvailabilityService.getInstance();
        availabilityService.clearRestaurantCacheForDate(restaurantId, bookingTime);
        console.log('Availability cache cleared after successful booking');
      } catch (cacheError) {
        console.warn('Failed to clear availability cache:', cacheError);
        // Don't fail the booking if cache clearing fails
      }

      // Navigate based on booking type
      if (bookingPolicy === 'instant') {
        router.replace({
          pathname: '/booking/success',
          params: {
            bookingId: bookingResult.booking.id,
            restaurantName: bookingResult.booking.restaurant_name || 'Restaurant',
            bookingTime: bookingTime.toISOString(),
            partySize: partySize.toString(),
            confirmationCode: bookingResult.booking.confirmation_code,
            loyaltyPoints: (expectedLoyaltyPoints || 0).toString(),
            tableInfo: requiresCombination ? 'combined' : 'single',
            earnedPoints: (expectedLoyaltyPoints || 0).toString()
          }
        });
      } else {
        // For request bookings, navigate to request-sent screen or booking form
        if (parsedTableIds.length > 0) {
          // Already have table selection, go to request-sent
          router.replace({
            pathname: '/booking/request-sent',
            params: {
              bookingId: bookingResult.booking.id,
              restaurantName: bookingResult.booking.restaurant_name || 'Restaurant',
              bookingTime: bookingTime.toISOString(),
              partySize: partySize.toString()
            }
          });
        } else {
          // Navigate to booking form for request bookings
          router.push({
            pathname: '/booking/create',
            params: {
              restaurantId,
              date: bookingTime.toISOString(),
              time: `${bookingTime.getHours().toString().padStart(2, '0')}:${bookingTime.getMinutes().toString().padStart(2, '0')}`,
              partySize: partySize.toString(),
              tableIds: tableIds || '',
              requiresCombination: requiresCombination ? "true" : "false",
              loyaltyRuleId,
              expectedLoyaltyPoints: expectedLoyaltyPoints?.toString()
            }
          });
        }
      }

      return true;
    } catch (error: any) {
      console.error('Booking confirmation error:', error);
      
      // Handle specific error types
      if (error.code === 'P0001' && error.message?.includes('no longer available')) {
        Alert.alert(
          'Table No Longer Available',
          'This time slot was just booked. Please select another time.',
          [{ text: 'OK' }]
        );
      } else if (error.code === '23505') {
        Alert.alert(
          'Duplicate Booking',
          'You already have a booking for this time slot.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Booking Failed',
          error.message || 'Unable to create booking. Please try again.',
          [{ text: 'OK' }]
        );
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [profile, router, parseTableIds, validateTableAssignment, calculateEndTime, handleLoyaltyAndOffers]);

  /**
   * Handle booking status change (for request bookings)
   */
  const handleBookingStatusChange = useCallback(async (
    bookingId: string,
    newStatus: 'confirmed' | 'declined_by_restaurant'
  ) => {
    try {
      // Update booking status
      const { error: statusError } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (statusError) throw statusError;

      // If confirmed and has loyalty rule, award points
      if (newStatus === 'confirmed') {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('applied_loyalty_rule_id, user_id, applied_offer_id')
          .eq('id', bookingId)
          .single();

        if (!bookingError && booking) {
          await handleLoyaltyAndOffers(
            bookingId,
            booking.applied_loyalty_rule_id,
            booking.applied_offer_id,
            booking.user_id
          );
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      Alert.alert(
        'Update Failed',
        error.message || 'Unable to update booking status.'
      );
      return false;
    }
  }, [handleLoyaltyAndOffers]);

  /**
   * Handle booking cancellation
   */
  const cancelBooking = useCallback(async (bookingId: string) => {
    try {
      // Get booking details first
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('status, applied_loyalty_rule_id, loyalty_points_earned, user_id, booking_time')
        .eq('id', bookingId)
        .single();

      if (fetchError) throw fetchError;

      // Check if cancellation is allowed (e.g., not too close to booking time)
      const bookingTime = new Date(booking.booking_time);
      const now = new Date();
      const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilBooking < 2) {
        Alert.alert(
          'Cancellation Not Allowed',
          'Bookings cannot be cancelled less than 2 hours before the reservation time.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Update booking status
      const { error: cancelError } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled_by_user',
          updated_at: new Date().toISOString()
        })
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
      
      Alert.alert(
        'Booking Cancelled',
        'Your booking has been successfully cancelled.',
        [{ text: 'OK' }]
      );
      
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

  /**
   * Reschedule a booking
   */
  const rescheduleBooking = useCallback(async (
    bookingId: string,
    newBookingTime: Date,
    newTableIds?: string[]
  ) => {
    try {
      setLoading(true);

      // Get current booking details
      const { data: currentBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (fetchError) throw fetchError;

      // Calculate new end time
      const newEndTime = calculateEndTime(newBookingTime, currentBooking.turn_time_minutes);

      // Validate new time slot if table IDs provided
      if (newTableIds && newTableIds.length > 0) {
        const validation = await validateTableAssignment(
          newTableIds,
          currentBooking.party_size,
          newBookingTime,
          newEndTime
        );

        if (!validation.valid) {
          Alert.alert('Reschedule Error', validation.error || 'Time slot validation failed');
          return false;
        }
      }

      // Update booking
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          booking_time: newBookingTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Update table assignments if provided
      if (newTableIds && newTableIds.length > 0) {
        // Remove old table assignments
        await supabase
          .from('booking_tables')
          .delete()
          .eq('booking_id', bookingId);

        // Add new table assignments
        const tableAssignments = newTableIds.map(tableId => ({
          booking_id: bookingId,
          table_id: tableId
        }));

        await supabase
          .from('booking_tables')
          .insert(tableAssignments);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Booking Rescheduled',
        'Your booking has been successfully rescheduled.',
        [{ text: 'OK' }]
      );

      return true;
    } catch (error: any) {
      console.error('Error rescheduling booking:', error);
      Alert.alert(
        'Reschedule Failed',
        error.message || 'Unable to reschedule booking. Please try again.'
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [validateTableAssignment, calculateEndTime]);

  return {
    confirmBooking,
    handleBookingStatusChange,
    cancelBooking,
    rescheduleBooking,
    loading
  };
};