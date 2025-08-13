// app/(protected)/profile/notification-settings.tsx
import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Switch,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, BellOff, Clock, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { SafeAreaView } from '@/components/safe-area-view';
import { Text } from '@/components/ui/text';
import { H2, H3, Muted } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useColorScheme } from '@/lib/useColorScheme';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useNotificationContext } from '@/context/notification-provider';

interface PreferenceItemProps {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

function PreferenceItem({ title, description, value, onValueChange, disabled }: PreferenceItemProps) {
  const { colorScheme } = useColorScheme();
  
  const handleToggle = async (newValue: boolean) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onValueChange(newValue);
    } catch (error) {
      console.error('Error updating preference:', error);
    }
  };

  return (
    <View className="flex-row items-center justify-between py-4 px-4 border-b border-border">
      <View className="flex-1 mr-4">
        <Text className="font-medium text-base">{title}</Text>
        <Muted className="text-sm mt-1">{description}</Muted>
      </View>
      <Switch
        value={value}
        onValueChange={handleToggle}
        disabled={disabled}
        trackColor={{ false: '#767577', true: '#3b82f6' }}
        thumbColor={value ? '#ffffff' : '#f4f3f4'}
      />
    </View>
  );
}

interface PreferenceSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function PreferenceSection({ title, icon, children }: PreferenceSectionProps) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center px-4 py-3 bg-muted/30">
        {icon}
        <H3 className="ml-2 text-lg">{title}</H3>
      </View>
      <View className="bg-card">
        {children}
      </View>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { hasPermission, requestPermissions } = useNotificationContext();
  const {
    preferences,
    loading,
    saving,
    error,
    updatePreference,
    toggleAllNotifications,
    resetToDefaults,
  } = useNotificationPreferences();

  const [showQuietHours, setShowQuietHours] = useState(false);

  const handleRequestPermissions = async () => {
    try {
      const granted = await requestPermissions();
      if (granted) {
        await toggleAllNotifications(true);
        Alert.alert(
          'Permissions Granted',
          'You will now receive push notifications.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Permissions Denied',
          'Please enable notifications in your device settings to receive push notifications.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions.');
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all notification preferences to their default values. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetToDefaults();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Notification preferences have been reset to defaults.');
            } catch (error) {
              console.error('Error resetting preferences:', error);
              Alert.alert('Error', 'Failed to reset preferences.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-muted-foreground">Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2 border-b border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => router.back()}
              className="mr-3 p-2 rounded-full bg-muted"
            >
              <ArrowLeft
                size={20}
                color={colorScheme === 'dark' ? '#fff' : '#000'}
              />
            </Pressable>
            <View>
              <H2 className="text-2xl">Notification Settings</H2>
              <Muted className="text-sm">Customize your notification preferences</Muted>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Global Settings */}
        <PreferenceSection
          title="General"
          icon={<Settings size={20} color="#3b82f6" />}
        >
          {!hasPermission && (
            <View className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-border">
              <View className="flex-row items-center mb-2">
                <BellOff size={16} color="#f59e0b" />
                <Text className="ml-2 font-medium text-amber-800 dark:text-amber-200">
                  Notifications Disabled
                </Text>
              </View>
              <Text className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Enable notifications to receive important updates about your bookings and offers.
              </Text>
              <Button
                onPress={handleRequestPermissions}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Text className="text-white font-medium">Enable Notifications</Text>
              </Button>
            </View>
          )}
          
          <PreferenceItem
            title="Push Notifications"
            description="Receive notifications on your device"
            value={preferences.push_notifications_enabled}
            onValueChange={(value) => updatePreference('push_notifications_enabled', value)}
            disabled={!hasPermission}
          />
          
          <PreferenceItem
            title="Email Notifications"
            description="Receive notifications via email"
            value={preferences.email_notifications_enabled}
            onValueChange={(value) => updatePreference('email_notifications_enabled', value)}
          />
          
          <PreferenceItem
            title="Quiet Hours"
            description="Disable notifications during specified hours"
            value={preferences.quiet_hours_enabled}
            onValueChange={(value) => updatePreference('quiet_hours_enabled', value)}
          />
        </PreferenceSection>

        {/* Booking Notifications */}
        <PreferenceSection
          title="Bookings"
          icon={<Bell size={20} color="#10b981" />}
        >
          <PreferenceItem
            title="Booking Confirmations"
            description="When your booking is confirmed or declined"
            value={preferences.booking_confirmations}
            onValueChange={(value) => updatePreference('booking_confirmations', value)}
            disabled={!preferences.push_notifications_enabled}
          />
          
          <PreferenceItem
            title="Booking Reminders"
            description="Reminders before your reservation"
            value={preferences.booking_reminders}
            onValueChange={(value) => updatePreference('booking_reminders', value)}
            disabled={!preferences.push_notifications_enabled}
          />
          
          <PreferenceItem
            title="Booking Changes"
            description="When your booking is modified or cancelled"
            value={preferences.booking_cancellations}
            onValueChange={(value) => updatePreference('booking_cancellations', value)}
            disabled={!preferences.push_notifications_enabled}
          />
        </PreferenceSection>

        {/* Waitlist Notifications */}
        <PreferenceSection
          title="Waitlist"
          icon={<Clock size={20} color="#f59e0b" />}
        >
          <PreferenceItem
            title="Table Available"
            description="When a table becomes available"
            value={preferences.waitlist_available}
            onValueChange={(value) => updatePreference('waitlist_available', value)}
            disabled={!preferences.push_notifications_enabled}
          />
          
          <PreferenceItem
            title="Position Updates"
            description="Updates about your position in the waitlist"
            value={preferences.waitlist_position_updates}
            onValueChange={(value) => updatePreference('waitlist_position_updates', value)}
            disabled={!preferences.push_notifications_enabled}
          />
          
          <PreferenceItem
            title="Waitlist Expired"
            description="When your waitlist entry expires"
            value={preferences.waitlist_expired}
            onValueChange={(value) => updatePreference('waitlist_expired', value)}
            disabled={!preferences.push_notifications_enabled}
          />
        </PreferenceSection>

        {/* Offers & Loyalty */}
        <PreferenceSection
          title="Offers & Loyalty"
          icon={<Bell size={20} color="#e11d48" />}
        >
          <PreferenceItem
            title="Special Offers"
            description="Promotions and discounts from restaurants"
            value={preferences.special_offers}
            onValueChange={(value) => updatePreference('special_offers', value)}
            disabled={!preferences.push_notifications_enabled}
          />
          
          <PreferenceItem
            title="Loyalty Rewards"
            description="Points earned and rewards available"
            value={preferences.points_earned}
            onValueChange={(value) => updatePreference('points_earned', value)}
            disabled={!preferences.push_notifications_enabled}
          />
          
          <PreferenceItem
            title="Milestone Achievements"
            description="When you reach loyalty milestones"
            value={preferences.milestone_reached}
            onValueChange={(value) => updatePreference('milestone_reached', value)}
            disabled={!preferences.push_notifications_enabled}
          />
        </PreferenceSection>

        {/* Reviews */}
        <PreferenceSection
          title="Reviews"
          icon={<Bell size={20} color="#8b5cf6" />}
        >
          <PreferenceItem
            title="Review Reminders"
            description="Reminders to review restaurants you've visited"
            value={preferences.review_reminders}
            onValueChange={(value) => updatePreference('review_reminders', value)}
            disabled={!preferences.push_notifications_enabled}
          />
          
          <PreferenceItem
            title="Restaurant Responses"
            description="When restaurants respond to your reviews"
            value={preferences.review_responses}
            onValueChange={(value) => updatePreference('review_responses', value)}
            disabled={!preferences.push_notifications_enabled}
          />
        </PreferenceSection>

        {/* Reset Button */}
        <View className="p-4 mb-8">
          <Button
            variant="outline"
            onPress={handleResetToDefaults}
            disabled={saving}
          >
            <Text className="text-muted-foreground">Reset to Defaults</Text>
          </Button>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {saving && (
        <View className="absolute inset-0 bg-black/20 items-center justify-center">
          <View className="bg-card p-6 rounded-lg items-center">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-2 text-muted-foreground">Saving preferences...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
