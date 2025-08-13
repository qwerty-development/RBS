// hooks/useNotificationPreferences.ts
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/supabase-provider';
import { Database } from '@/types/supabase';

type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row'];
type NotificationPreferencesInsert = Database['public']['Tables']['notification_preferences']['Insert'];
type NotificationPreferencesUpdate = Database['public']['Tables']['notification_preferences']['Update'];

export interface NotificationPreferencesState {
  // Booking notifications
  booking_confirmations: boolean;
  booking_reminders: boolean;
  booking_cancellations: boolean;
  booking_modifications: boolean;
  
  // Waitlist notifications
  waitlist_available: boolean;
  waitlist_position_updates: boolean;
  waitlist_expired: boolean;
  
  // Offer notifications
  special_offers: boolean;
  loyalty_offers: boolean;
  expiring_offers: boolean;
  
  // Review notifications
  review_reminders: boolean;
  review_responses: boolean;
  review_featured: boolean;
  
  // Loyalty notifications
  points_earned: boolean;
  milestone_reached: boolean;
  rewards_available: boolean;
  rewards_expiring: boolean;
  
  // System notifications
  app_updates: boolean;
  maintenance_notices: boolean;
  security_alerts: boolean;
  
  // General settings
  push_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const defaultPreferences: NotificationPreferencesState = {
  // Booking notifications
  booking_confirmations: true,
  booking_reminders: true,
  booking_cancellations: true,
  booking_modifications: true,
  
  // Waitlist notifications
  waitlist_available: true,
  waitlist_position_updates: true,
  waitlist_expired: true,
  
  // Offer notifications
  special_offers: true,
  loyalty_offers: true,
  expiring_offers: true,
  
  // Review notifications
  review_reminders: true,
  review_responses: true,
  review_featured: true,
  
  // Loyalty notifications
  points_earned: true,
  milestone_reached: true,
  rewards_available: true,
  rewards_expiring: true,
  
  // System notifications
  app_updates: false,
  maintenance_notices: true,
  security_alerts: true,
  
  // General settings
  push_notifications_enabled: true,
  email_notifications_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00:00',
  quiet_hours_end: '08:00:00',
};

export function useNotificationPreferences() {
  const { profile } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferencesState>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No preferences found, use defaults
          setPreferences(defaultPreferences);
        } else {
          throw fetchError;
        }
      } else {
        // Convert database format to state format
        setPreferences({
          booking_confirmations: data.booking_confirmations,
          booking_reminders: data.booking_reminders,
          booking_cancellations: data.booking_cancellations,
          booking_modifications: data.booking_modifications,
          waitlist_available: data.waitlist_available,
          waitlist_position_updates: data.waitlist_position_updates,
          waitlist_expired: data.waitlist_expired,
          special_offers: data.special_offers,
          loyalty_offers: data.loyalty_offers,
          expiring_offers: data.expiring_offers,
          review_reminders: data.review_reminders,
          review_responses: data.review_responses,
          review_featured: data.review_featured,
          points_earned: data.points_earned,
          milestone_reached: data.milestone_reached,
          rewards_available: data.rewards_available,
          rewards_expiring: data.rewards_expiring,
          app_updates: data.app_updates,
          maintenance_notices: data.maintenance_notices,
          security_alerts: data.security_alerts,
          push_notifications_enabled: data.push_notifications_enabled,
          email_notifications_enabled: data.email_notifications_enabled,
          quiet_hours_enabled: data.quiet_hours_enabled,
          quiet_hours_start: data.quiet_hours_start || '22:00:00',
          quiet_hours_end: data.quiet_hours_end || '08:00:00',
        });
      }
    } catch (err: any) {
      console.error('Error fetching notification preferences:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Save preferences
  const savePreferences = useCallback(async (newPreferences: Partial<NotificationPreferencesState>) => {
    if (!profile?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setSaving(true);
      setError(null);

      const updatedPreferences = { ...preferences, ...newPreferences };
      
      // Prepare data for database
      const dbData: NotificationPreferencesUpdate = {
        booking_confirmations: updatedPreferences.booking_confirmations,
        booking_reminders: updatedPreferences.booking_reminders,
        booking_cancellations: updatedPreferences.booking_cancellations,
        booking_modifications: updatedPreferences.booking_modifications,
        waitlist_available: updatedPreferences.waitlist_available,
        waitlist_position_updates: updatedPreferences.waitlist_position_updates,
        waitlist_expired: updatedPreferences.waitlist_expired,
        special_offers: updatedPreferences.special_offers,
        loyalty_offers: updatedPreferences.loyalty_offers,
        expiring_offers: updatedPreferences.expiring_offers,
        review_reminders: updatedPreferences.review_reminders,
        review_responses: updatedPreferences.review_responses,
        review_featured: updatedPreferences.review_featured,
        points_earned: updatedPreferences.points_earned,
        milestone_reached: updatedPreferences.milestone_reached,
        rewards_available: updatedPreferences.rewards_available,
        rewards_expiring: updatedPreferences.rewards_expiring,
        app_updates: updatedPreferences.app_updates,
        maintenance_notices: updatedPreferences.maintenance_notices,
        security_alerts: updatedPreferences.security_alerts,
        push_notifications_enabled: updatedPreferences.push_notifications_enabled,
        email_notifications_enabled: updatedPreferences.email_notifications_enabled,
        quiet_hours_enabled: updatedPreferences.quiet_hours_enabled,
        quiet_hours_start: updatedPreferences.quiet_hours_start,
        quiet_hours_end: updatedPreferences.quiet_hours_end,
      };

      const { error: saveError } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: profile.id,
          ...dbData,
        }, {
          onConflict: 'user_id'
        });

      if (saveError) {
        throw saveError;
      }

      // Update local state
      setPreferences(updatedPreferences);
      
      return true;
    } catch (err: any) {
      console.error('Error saving notification preferences:', err);
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [profile?.id, preferences]);

  // Update a single preference
  const updatePreference = useCallback(async (key: keyof NotificationPreferencesState, value: boolean | string) => {
    const newPreferences = { [key]: value };
    await savePreferences(newPreferences);
  }, [savePreferences]);

  // Toggle all notifications
  const toggleAllNotifications = useCallback(async (enabled: boolean) => {
    const newPreferences: Partial<NotificationPreferencesState> = {
      push_notifications_enabled: enabled,
    };
    await savePreferences(newPreferences);
  }, [savePreferences]);

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    await savePreferences(defaultPreferences);
  }, [savePreferences]);

  // Load preferences on mount
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    saving,
    error,
    updatePreference,
    savePreferences,
    toggleAllNotifications,
    resetToDefaults,
    refetch: fetchPreferences,
  };
}
