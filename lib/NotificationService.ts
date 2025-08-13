// lib/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/config/supabase';
import { useAppStore } from '@/stores';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  type: 'booking' | 'waitlist' | 'offer' | 'review' | 'loyalty' | 'system';
  title: string;
  body: string;
  data?: Record<string, any>;
  scheduledFor?: Date;
  sound?: boolean;
  priority?: 'default' | 'high' | 'max';
}

export interface PushToken {
  token: string;
  type: 'expo' | 'apns' | 'fcm';
}

class NotificationService {
  private static instance: NotificationService;
  private pushToken: string | null = null;
  private isInitialized = false;
  private notificationListener: any = null;
  private responseListener: any = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize the notification service
   */
  async initialize(userId?: string): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return false;
      }

      // Get push token
      await this.registerForPushNotifications();

      // Set up notification listeners
      this.setupNotificationListeners();

      // Register token with backend if user is logged in
      if (userId && this.pushToken) {
        await this.registerTokenWithBackend(userId, this.pushToken);
      }

      this.isInitialized = true;
      console.log('NotificationService initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.warn('Notifications only work on physical devices');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Notification permission not granted');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Register for push notifications and get token
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: '9cb3f29d-a85c-439a-ac34-513843ed9279', // From app.json
      });

      this.pushToken = token.data;
      console.log('Push token obtained:', this.pushToken);
      return this.pushToken;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Register push token with backend
   */
  async registerTokenWithBackend(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform'
        });

      if (error) {
        console.error('Error registering push token:', error);
      } else {
        console.log('Push token registered successfully');
      }
    } catch (error) {
      console.error('Error registering push token with backend:', error);
    }
  }

  /**
   * Setup notification listeners
   */
  private setupNotificationListeners(): void {
    // Listen for notifications received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    // Listen for user tapping on notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );
  }

  /**
   * Handle notification received while app is in foreground
   */
  private handleNotificationReceived(notification: Notifications.Notification): void {
    console.log('Notification received in foreground:', notification);
    
    // Add to store
    const { addNotification } = useAppStore.getState();
    addNotification({
      type: notification.request.content.data?.type || 'system',
      title: notification.request.content.title || 'Notification',
      message: notification.request.content.body || '',
      data: notification.request.content.data,
    });
  }

  /**
   * Handle notification tap/response
   */
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    console.log('Notification response:', response);
    
    const data = response.notification.request.content.data;
    this.navigateBasedOnNotification(data);
  }

  /**
   * Navigate based on notification data
   */
  private navigateBasedOnNotification(data: any): void {
    if (!data) return;

    try {
      switch (data.type) {
        case 'booking':
          if (data.bookingId) {
            router.push(`/booking/${data.bookingId}`);
          } else {
            router.push('/bookings');
          }
          break;
        case 'waitlist':
          if (data.restaurantId) {
            router.push(`/restaurant/${data.restaurantId}`);
          } else {
            router.push('/my-waitlists');
          }
          break;
        case 'offer':
          if (data.restaurantId) {
            router.push(`/restaurant/${data.restaurantId}`);
          } else {
            router.push('/offers');
          }
          break;
        case 'review':
          if (data.restaurantId) {
            router.push(`/restaurant/${data.restaurantId}`);
          }
          break;
        case 'loyalty':
          router.push('/profile/loyalty');
          break;
        default:
          router.push('/profile/notifications');
          break;
      }
    } catch (error) {
      console.error('Error navigating from notification:', error);
    }
  }

  /**
   * Schedule a local notification
   */
  async scheduleNotification(notificationData: NotificationData): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data || {},
          sound: notificationData.sound !== false,
          priority: this.getPriority(notificationData.priority),
        },
        trigger: notificationData.scheduledFor 
          ? { date: notificationData.scheduledFor }
          : null, // null means show immediately
      });

      console.log('Notification scheduled:', identifier);
      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log('Notification cancelled:', identifier);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  /**
   * Get notification priority for Android
   */
  private getPriority(priority?: string): Notifications.AndroidNotificationPriority {
    switch (priority) {
      case 'high':
        return Notifications.AndroidNotificationPriority.HIGH;
      case 'max':
        return Notifications.AndroidNotificationPriority.MAX;
      default:
        return Notifications.AndroidNotificationPriority.DEFAULT;
    }
  }

  /**
   * Get current push token
   */
  getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }

    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }

    this.isInitialized = false;
    console.log('NotificationService cleaned up');
  }

  /**
   * Send booking confirmation notification
   */
  async sendBookingConfirmation(bookingData: {
    restaurantName: string;
    date: string;
    time: string;
    partySize: number;
    bookingId: string;
  }): Promise<void> {
    await this.scheduleNotification({
      type: 'booking',
      title: '✅ Booking Confirmed!',
      body: `Your table for ${bookingData.partySize} at ${bookingData.restaurantName} is confirmed for ${bookingData.date} at ${bookingData.time}.`,
      data: {
        type: 'booking',
        bookingId: bookingData.bookingId,
        action: 'view_booking',
      },
      priority: 'high',
    });
  }

  /**
   * Send booking reminder notification
   */
  async sendBookingReminder(bookingData: {
    restaurantName: string;
    date: string;
    time: string;
    bookingId: string;
    reminderTime: Date;
  }): Promise<string | null> {
    return await this.scheduleNotification({
      type: 'booking',
      title: '⏰ Booking Reminder',
      body: `Don't forget your reservation at ${bookingData.restaurantName} today at ${bookingData.time}!`,
      data: {
        type: 'booking',
        bookingId: bookingData.bookingId,
        action: 'view_booking',
      },
      scheduledFor: bookingData.reminderTime,
      priority: 'high',
    });
  }

  /**
   * Send waitlist notification
   */
  async sendWaitlistUpdate(waitlistData: {
    restaurantName: string;
    message: string;
    restaurantId: string;
    entryId: string;
    type: 'available' | 'expired' | 'position_update';
  }): Promise<void> {
    const title = waitlistData.type === 'available'
      ? '🎉 Table Available!'
      : waitlistData.type === 'expired'
      ? '⏰ Waitlist Expired'
      : '📍 Waitlist Update';

    await this.scheduleNotification({
      type: 'waitlist',
      title,
      body: waitlistData.message,
      data: {
        type: 'waitlist',
        restaurantId: waitlistData.restaurantId,
        entryId: waitlistData.entryId,
        action: 'view_waitlist',
      },
      priority: 'high',
    });
  }

  /**
   * Send offer notification
   */
  async sendOfferNotification(offerData: {
    title: string;
    description: string;
    restaurantName: string;
    restaurantId: string;
    offerId: string;
    expiryDate?: string;
  }): Promise<void> {
    await this.scheduleNotification({
      type: 'offer',
      title: `🎁 ${offerData.title}`,
      body: `${offerData.description} at ${offerData.restaurantName}${offerData.expiryDate ? ` - Expires ${offerData.expiryDate}` : ''}`,
      data: {
        type: 'offer',
        restaurantId: offerData.restaurantId,
        offerId: offerData.offerId,
        action: 'view_offer',
      },
      priority: 'default',
    });
  }

  /**
   * Send review reminder notification
   */
  async sendReviewReminder(reviewData: {
    restaurantName: string;
    restaurantId: string;
    bookingId: string;
    visitDate: string;
  }): Promise<void> {
    await this.scheduleNotification({
      type: 'review',
      title: '⭐ How was your experience?',
      body: `Please share your thoughts about your recent visit to ${reviewData.restaurantName} on ${reviewData.visitDate}.`,
      data: {
        type: 'review',
        restaurantId: reviewData.restaurantId,
        bookingId: reviewData.bookingId,
        action: 'write_review',
      },
      priority: 'default',
    });
  }

  /**
   * Send loyalty points notification
   */
  async sendLoyaltyUpdate(loyaltyData: {
    points: number;
    restaurantName: string;
    restaurantId: string;
    action: 'earned' | 'redeemed' | 'milestone';
    milestone?: string;
  }): Promise<void> {
    let title = '';
    let body = '';

    switch (loyaltyData.action) {
      case 'earned':
        title = '🎯 Points Earned!';
        body = `You earned ${loyaltyData.points} points at ${loyaltyData.restaurantName}!`;
        break;
      case 'redeemed':
        title = '🎁 Points Redeemed!';
        body = `You redeemed ${loyaltyData.points} points at ${loyaltyData.restaurantName}!`;
        break;
      case 'milestone':
        title = '🏆 Milestone Reached!';
        body = `Congratulations! You've reached ${loyaltyData.milestone} at ${loyaltyData.restaurantName}!`;
        break;
    }

    await this.scheduleNotification({
      type: 'loyalty',
      title,
      body,
      data: {
        type: 'loyalty',
        restaurantId: loyaltyData.restaurantId,
        points: loyaltyData.points,
        action: 'view_loyalty',
      },
      priority: 'default',
    });
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(systemData: {
    title: string;
    message: string;
    action?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    await this.scheduleNotification({
      type: 'system',
      title: systemData.title,
      body: systemData.message,
      data: {
        type: 'system',
        action: systemData.action || 'view_notifications',
        ...systemData.data,
      },
      priority: 'default',
    });
  }
}

export default NotificationService;
