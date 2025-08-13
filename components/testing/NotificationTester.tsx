// components/testing/NotificationTester.tsx
import React from 'react';
import { View, Alert } from 'react-native';
import { Bell, TestTube } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { H3, Muted } from '@/components/ui/typography';
import { NotificationHelpers } from '@/lib/NotificationHelpers';
import { useNotificationContext } from '@/context/notification-provider';

export function NotificationTester() {
  const { hasPermission, isInitialized } = useNotificationContext();

  const testBookingNotification = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await NotificationHelpers.createBookingNotification({
        bookingId: 'test-booking-123',
        restaurantId: 'test-restaurant-456',
        restaurantName: 'Test Restaurant',
        date: new Date().toLocaleDateString(),
        time: '7:00 PM',
        partySize: 4,
        action: 'confirmed',
        priority: 'high',
      });
      Alert.alert("✅ Success", "Booking confirmation notification sent!");
    } catch (error) {
      console.error('Error sending booking notification:', error);
      Alert.alert("❌ Error", "Failed to send booking notification");
    }
  };

  const testWaitlistNotification = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await NotificationHelpers.createWaitlistNotification({
        entryId: 'test-waitlist-123',
        restaurantId: 'test-restaurant-456',
        restaurantName: 'Test Restaurant',
        requestedDate: new Date().toLocaleDateString(),
        timeSlotStart: '7:00 PM',
        timeSlotEnd: '8:00 PM',
        partySize: 2,
        action: 'available',
        priority: 'high',
      });
      Alert.alert("✅ Success", "Waitlist available notification sent!");
    } catch (error) {
      console.error('Error sending waitlist notification:', error);
      Alert.alert("❌ Error", "Failed to send waitlist notification");
    }
  };

  const testOfferNotification = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await NotificationHelpers.createOfferNotification({
        offerId: 'test-offer-123',
        restaurantId: 'test-restaurant-456',
        restaurantName: 'Test Restaurant',
        offerTitle: '20% Off Dinner',
        offerDescription: 'Get 20% off your dinner this weekend',
        action: 'new_offer',
        discountPercentage: 20,
        priority: 'default',
      });
      Alert.alert("✅ Success", "Special offer notification sent!");
    } catch (error) {
      console.error('Error sending offer notification:', error);
      Alert.alert("❌ Error", "Failed to send offer notification");
    }
  };

  const testLoyaltyNotification = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await NotificationHelpers.createLoyaltyNotification({
        restaurantId: 'test-restaurant-456',
        restaurantName: 'Test Restaurant',
        points: 100,
        action: 'points_earned',
        priority: 'default',
      });
      Alert.alert("✅ Success", "Loyalty points notification sent!");
    } catch (error) {
      console.error('Error sending loyalty notification:', error);
      Alert.alert("❌ Error", "Failed to send loyalty notification");
    }
  };

  const testReviewNotification = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await NotificationHelpers.createReviewNotification({
        restaurantId: 'test-restaurant-456',
        restaurantName: 'Test Restaurant',
        visitDate: new Date().toLocaleDateString(),
        action: 'reminder',
        priority: 'default',
      });
      Alert.alert("✅ Success", "Review reminder notification sent!");
    } catch (error) {
      console.error('Error sending review notification:', error);
      Alert.alert("❌ Error", "Failed to send review notification");
    }
  };

  const testSystemNotification = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await NotificationHelpers.createSystemNotification({
        title: 'System Test',
        message: 'This is a test system notification to verify everything is working correctly.',
        category: 'app_update',
        priority: 'default',
      });
      Alert.alert("✅ Success", "System notification sent!");
    } catch (error) {
      console.error('Error sending system notification:', error);
      Alert.alert("❌ Error", "Failed to send system notification");
    }
  };

  if (!isInitialized) {
    return (
      <View className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
        <View className="flex-row items-center mb-2">
          <Bell size={16} color="#f59e0b" />
          <Text className="ml-2 font-medium text-amber-800 dark:text-amber-200">
            Notification System Not Initialized
          </Text>
        </View>
        <Muted className="text-amber-700 dark:text-amber-300">
          The notification system is not yet initialized. Please ensure you're logged in and have granted notification permissions.
        </Muted>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <View className="flex-row items-center mb-2">
          <Bell size={16} color="#ef4444" />
          <Text className="ml-2 font-medium text-red-800 dark:text-red-200">
            Notification Permissions Required
          </Text>
        </View>
        <Muted className="text-red-700 dark:text-red-300">
          Please enable notification permissions in your device settings to test notifications.
        </Muted>
      </View>
    );
  }

  return (
    <View className="p-4 bg-card rounded-lg border border-border">
      <View className="flex-row items-center mb-4">
        <TestTube size={20} color="#3b82f6" />
        <H3 className="ml-2">Notification Testing</H3>
      </View>
      
      <Muted className="mb-4">
        Test different types of notifications to verify your setup is working correctly. 
        Check both the system notification center and the app's notification screen.
      </Muted>

      <View className="space-y-3">
        <Button
          variant="outline"
          onPress={testBookingNotification}
          className="w-full"
        >
          <Text>📅 Test Booking Notification</Text>
        </Button>

        <Button
          variant="outline"
          onPress={testWaitlistNotification}
          className="w-full"
        >
          <Text>⏳ Test Waitlist Notification</Text>
        </Button>

        <Button
          variant="outline"
          onPress={testOfferNotification}
          className="w-full"
        >
          <Text>🎁 Test Offer Notification</Text>
        </Button>

        <Button
          variant="outline"
          onPress={testLoyaltyNotification}
          className="w-full"
        >
          <Text>🎯 Test Loyalty Notification</Text>
        </Button>

        <Button
          variant="outline"
          onPress={testReviewNotification}
          className="w-full"
        >
          <Text>⭐ Test Review Notification</Text>
        </Button>

        <Button
          variant="outline"
          onPress={testSystemNotification}
          className="w-full"
        >
          <Text>🔔 Test System Notification</Text>
        </Button>
      </View>

      <View className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Text className="text-sm text-blue-800 dark:text-blue-200 font-medium">
          💡 Testing Tips:
        </Text>
        <Muted className="text-blue-700 dark:text-blue-300 text-sm mt-1">
          • Notifications appear in both system notification center and app notification screen{'\n'}
          • Tap notifications to test navigation{'\n'}
          • Check notification preferences in settings{'\n'}
          • Use a physical device (simulators don't support notifications)
        </Muted>
      </View>
    </View>
  );
}
