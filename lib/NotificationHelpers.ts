// lib/NotificationHelpers.ts
import NotificationService from './NotificationService';
import { useAppStore } from '@/stores';
import {
  CreateBookingNotificationParams,
  CreateWaitlistNotificationParams,
  CreateOfferNotificationParams,
  CreateReviewNotificationParams,
  CreateLoyaltyNotificationParams,
  CreateSystemNotificationParams,
  NotificationTemplates,
  BookingNotification,
  WaitlistNotification,
  OfferNotification,
  ReviewNotification,
  LoyaltyNotification,
  SystemNotification,
} from '@/types/notifications';

export class NotificationHelpers {
  private static notificationService = NotificationService.getInstance();

  /**
   * Create and send a booking notification
   */
  static async createBookingNotification(params: CreateBookingNotificationParams): Promise<void> {
    const template = NotificationTemplates.booking[params.action](params);
    
    const notification: Omit<BookingNotification, 'id' | 'timestamp' | 'read'> = {
      type: 'booking',
      title: template.title,
      message: template.message,
      priority: params.priority || 'high',
      data: {
        bookingId: params.bookingId,
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        date: params.date,
        time: params.time,
        partySize: params.partySize,
        action: params.action,
      },
      scheduledFor: params.scheduledFor?.getTime(),
    };

    // Add to store
    const { addNotification } = useAppStore.getState();
    addNotification(notification);

    // Schedule push notification if needed
    if (params.scheduledFor) {
      await this.notificationService.scheduleNotification({
        type: 'booking',
        title: template.title,
        body: template.message,
        data: notification.data,
        scheduledFor: params.scheduledFor,
        priority: params.priority || 'high',
      });
    } else {
      await this.notificationService.scheduleNotification({
        type: 'booking',
        title: template.title,
        body: template.message,
        data: notification.data,
        priority: params.priority || 'high',
      });
    }
  }

  /**
   * Create and send a waitlist notification
   */
  static async createWaitlistNotification(params: CreateWaitlistNotificationParams): Promise<void> {
    const template = NotificationTemplates.waitlist[params.action](params);
    
    const notification: Omit<WaitlistNotification, 'id' | 'timestamp' | 'read'> = {
      type: 'waitlist',
      title: template.title,
      message: template.message,
      priority: params.priority || 'high',
      data: {
        entryId: params.entryId,
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        requestedDate: params.requestedDate,
        timeSlotStart: params.timeSlotStart,
        timeSlotEnd: params.timeSlotEnd,
        partySize: params.partySize,
        position: params.position,
        estimatedWaitTime: params.estimatedWaitTime,
        action: params.action,
      },
    };

    // Add to store
    const { addNotification } = useAppStore.getState();
    addNotification(notification);

    // Send push notification
    await this.notificationService.scheduleNotification({
      type: 'waitlist',
      title: template.title,
      body: template.message,
      data: notification.data,
      priority: params.priority || 'high',
    });
  }

  /**
   * Create and send an offer notification
   */
  static async createOfferNotification(params: CreateOfferNotificationParams): Promise<void> {
    const template = NotificationTemplates.offer[params.action](params);
    
    const notification: Omit<OfferNotification, 'id' | 'timestamp' | 'read'> = {
      type: 'offer',
      title: template.title,
      message: template.message,
      priority: params.priority || 'default',
      data: {
        offerId: params.offerId,
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        offerTitle: params.offerTitle,
        offerDescription: params.offerDescription,
        discountPercentage: params.discountPercentage,
        discountAmount: params.discountAmount,
        expiryDate: params.expiryDate,
        action: params.action,
      },
    };

    // Add to store
    const { addNotification } = useAppStore.getState();
    addNotification(notification);

    // Send push notification
    await this.notificationService.scheduleNotification({
      type: 'offer',
      title: template.title,
      body: template.message,
      data: notification.data,
      priority: params.priority || 'default',
    });
  }

  /**
   * Create and send a review notification
   */
  static async createReviewNotification(params: CreateReviewNotificationParams): Promise<void> {
    const template = NotificationTemplates.review[params.action](params);
    
    const notification: Omit<ReviewNotification, 'id' | 'timestamp' | 'read'> = {
      type: 'review',
      title: template.title,
      message: template.message,
      priority: params.priority || 'default',
      data: {
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        bookingId: params.bookingId,
        visitDate: params.visitDate,
        reviewId: params.reviewId,
        action: params.action,
      },
      scheduledFor: params.scheduledFor?.getTime(),
    };

    // Add to store
    const { addNotification } = useAppStore.getState();
    addNotification(notification);

    // Schedule push notification if needed
    if (params.scheduledFor) {
      await this.notificationService.scheduleNotification({
        type: 'review',
        title: template.title,
        body: template.message,
        data: notification.data,
        scheduledFor: params.scheduledFor,
        priority: params.priority || 'default',
      });
    } else {
      await this.notificationService.scheduleNotification({
        type: 'review',
        title: template.title,
        body: template.message,
        data: notification.data,
        priority: params.priority || 'default',
      });
    }
  }

  /**
   * Create and send a loyalty notification
   */
  static async createLoyaltyNotification(params: CreateLoyaltyNotificationParams): Promise<void> {
    const template = NotificationTemplates.loyalty[params.action](params);
    
    const notification: Omit<LoyaltyNotification, 'id' | 'timestamp' | 'read'> = {
      type: 'loyalty',
      title: template.title,
      message: template.message,
      priority: params.priority || 'default',
      data: {
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        points: params.points,
        totalPoints: params.totalPoints,
        milestone: params.milestone,
        rewardId: params.rewardId,
        rewardName: params.rewardName,
        action: params.action,
      },
    };

    // Add to store
    const { addNotification } = useAppStore.getState();
    addNotification(notification);

    // Send push notification
    await this.notificationService.scheduleNotification({
      type: 'loyalty',
      title: template.title,
      body: template.message,
      data: notification.data,
      priority: params.priority || 'default',
    });
  }

  /**
   * Create and send a system notification
   */
  static async createSystemNotification(params: CreateSystemNotificationParams): Promise<void> {
    const notification: Omit<SystemNotification, 'id' | 'timestamp' | 'read'> = {
      type: 'system',
      title: params.title,
      message: params.message,
      priority: params.priority || 'default',
      data: {
        category: params.category,
        action: params.action,
        url: params.url,
        version: params.version,
      },
    };

    // Add to store
    const { addNotification } = useAppStore.getState();
    addNotification(notification);

    // Send push notification
    await this.notificationService.scheduleNotification({
      type: 'system',
      title: params.title,
      body: params.message,
      data: notification.data,
      priority: params.priority || 'default',
    });
  }

  /**
   * Schedule a booking reminder
   */
  static async scheduleBookingReminder(
    bookingData: CreateBookingNotificationParams,
    reminderTime: Date
  ): Promise<string | null> {
    return await this.notificationService.sendBookingReminder({
      restaurantName: bookingData.restaurantName,
      date: bookingData.date,
      time: bookingData.time,
      bookingId: bookingData.bookingId,
      reminderTime,
    });
  }

  /**
   * Schedule a review reminder (typically 1-2 days after dining)
   */
  static async scheduleReviewReminder(
    reviewData: CreateReviewNotificationParams,
    reminderTime: Date
  ): Promise<void> {
    await this.createReviewNotification({
      ...reviewData,
      action: 'reminder',
      scheduledFor: reminderTime,
    });
  }

  /**
   * Cancel a scheduled notification
   */
  static async cancelScheduledNotification(identifier: string): Promise<void> {
    await this.notificationService.cancelNotification(identifier);
  }

  /**
   * Get notification icon based on type
   */
  static getNotificationIcon(type: string): string {
    switch (type) {
      case 'booking':
        return '📅';
      case 'waitlist':
        return '⏳';
      case 'offer':
        return '🎁';
      case 'review':
        return '⭐';
      case 'loyalty':
        return '🎯';
      case 'system':
        return '🔔';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Get notification color based on type
   */
  static getNotificationColor(type: string): string {
    switch (type) {
      case 'booking':
        return '#4CAF50';
      case 'waitlist':
        return '#FF9800';
      case 'offer':
        return '#E91E63';
      case 'review':
        return '#FFC107';
      case 'loyalty':
        return '#9C27B0';
      case 'system':
        return '#2196F3';
      case 'success':
        return '#4CAF50';
      case 'warning':
        return '#FF9800';
      case 'error':
        return '#F44336';
      default:
        return '#757575';
    }
  }
}
