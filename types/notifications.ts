// types/notifications.ts

export type NotificationType = 
  | 'booking' 
  | 'waitlist' 
  | 'offer' 
  | 'review' 
  | 'loyalty' 
  | 'system' 
  | 'info' 
  | 'success' 
  | 'warning' 
  | 'error';

export type NotificationPriority = 'default' | 'high' | 'max';

export interface BaseNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, any>;
  priority?: NotificationPriority;
  scheduledFor?: number;
}

// Booking-related notifications
export interface BookingNotificationData {
  bookingId: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
  action: 'confirmed' | 'cancelled' | 'reminder' | 'modified' | 'declined';
}

export interface BookingNotification extends BaseNotification {
  type: 'booking';
  data: BookingNotificationData;
}

// Waitlist-related notifications
export interface WaitlistNotificationData {
  entryId: string;
  restaurantId: string;
  restaurantName: string;
  requestedDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  partySize: number;
  position?: number;
  estimatedWaitTime?: number;
  action: 'available' | 'expired' | 'position_update' | 'joined' | 'removed';
}

export interface WaitlistNotification extends BaseNotification {
  type: 'waitlist';
  data: WaitlistNotificationData;
}

// Offer-related notifications
export interface OfferNotificationData {
  offerId: string;
  restaurantId: string;
  restaurantName: string;
  offerTitle: string;
  offerDescription: string;
  discountPercentage?: number;
  discountAmount?: number;
  expiryDate?: string;
  action: 'new_offer' | 'expiring_soon' | 'expired' | 'redeemed';
}

export interface OfferNotification extends BaseNotification {
  type: 'offer';
  data: OfferNotificationData;
}

// Review-related notifications
export interface ReviewNotificationData {
  restaurantId: string;
  restaurantName: string;
  bookingId?: string;
  visitDate: string;
  reviewId?: string;
  action: 'reminder' | 'response_received' | 'featured' | 'helpful_votes';
}

export interface ReviewNotification extends BaseNotification {
  type: 'review';
  data: ReviewNotificationData;
}

// Loyalty-related notifications
export interface LoyaltyNotificationData {
  restaurantId: string;
  restaurantName: string;
  points: number;
  totalPoints?: number;
  milestone?: string;
  rewardId?: string;
  rewardName?: string;
  action: 'points_earned' | 'points_redeemed' | 'milestone_reached' | 'reward_available' | 'reward_expiring';
}

export interface LoyaltyNotification extends BaseNotification {
  type: 'loyalty';
  data: LoyaltyNotificationData;
}

// System-related notifications
export interface SystemNotificationData {
  category: 'app_update' | 'maintenance' | 'feature' | 'security' | 'general';
  action?: string;
  url?: string;
  version?: string;
}

export interface SystemNotification extends BaseNotification {
  type: 'system';
  data: SystemNotificationData;
}

// Union type for all notification types
export type AppNotification = 
  | BookingNotification 
  | WaitlistNotification 
  | OfferNotification 
  | ReviewNotification 
  | LoyaltyNotification 
  | SystemNotification 
  | BaseNotification;

// Notification creation helpers
export interface CreateBookingNotificationParams {
  bookingId: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
  action: BookingNotificationData['action'];
  priority?: NotificationPriority;
  scheduledFor?: Date;
}

export interface CreateWaitlistNotificationParams {
  entryId: string;
  restaurantId: string;
  restaurantName: string;
  requestedDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  partySize: number;
  action: WaitlistNotificationData['action'];
  position?: number;
  estimatedWaitTime?: number;
  priority?: NotificationPriority;
}

export interface CreateOfferNotificationParams {
  offerId: string;
  restaurantId: string;
  restaurantName: string;
  offerTitle: string;
  offerDescription: string;
  action: OfferNotificationData['action'];
  discountPercentage?: number;
  discountAmount?: number;
  expiryDate?: string;
  priority?: NotificationPriority;
}

export interface CreateReviewNotificationParams {
  restaurantId: string;
  restaurantName: string;
  visitDate: string;
  action: ReviewNotificationData['action'];
  bookingId?: string;
  reviewId?: string;
  priority?: NotificationPriority;
  scheduledFor?: Date;
}

export interface CreateLoyaltyNotificationParams {
  restaurantId: string;
  restaurantName: string;
  points: number;
  action: LoyaltyNotificationData['action'];
  totalPoints?: number;
  milestone?: string;
  rewardId?: string;
  rewardName?: string;
  priority?: NotificationPriority;
}

export interface CreateSystemNotificationParams {
  title: string;
  message: string;
  category: SystemNotificationData['category'];
  action?: string;
  url?: string;
  version?: string;
  priority?: NotificationPriority;
}

// Notification templates
export const NotificationTemplates = {
  booking: {
    confirmed: (data: BookingNotificationData) => ({
      title: '✅ Booking Confirmed!',
      message: `Your table for ${data.partySize} at ${data.restaurantName} is confirmed for ${data.date} at ${data.time}.`,
    }),
    cancelled: (data: BookingNotificationData) => ({
      title: '❌ Booking Cancelled',
      message: `Your booking at ${data.restaurantName} for ${data.date} at ${data.time} has been cancelled.`,
    }),
    reminder: (data: BookingNotificationData) => ({
      title: '⏰ Booking Reminder',
      message: `Don't forget your reservation at ${data.restaurantName} today at ${data.time}!`,
    }),
    modified: (data: BookingNotificationData) => ({
      title: '📝 Booking Modified',
      message: `Your booking at ${data.restaurantName} has been updated to ${data.date} at ${data.time}.`,
    }),
    declined: (data: BookingNotificationData) => ({
      title: '😔 Booking Declined',
      message: `${data.restaurantName} couldn't accommodate your request. Try booking a different time.`,
    }),
  },
  waitlist: {
    available: (data: WaitlistNotificationData) => ({
      title: '🎉 Table Available!',
      message: `A table for ${data.partySize} at ${data.restaurantName} is now available for ${data.requestedDate}!`,
    }),
    expired: (data: WaitlistNotificationData) => ({
      title: '⏰ Waitlist Expired',
      message: `Your waiting list entry at ${data.restaurantName} has expired.`,
    }),
    position_update: (data: WaitlistNotificationData) => ({
      title: '📍 Waitlist Update',
      message: `You're now #${data.position} on the waitlist at ${data.restaurantName}${data.estimatedWaitTime ? ` (Est. ${data.estimatedWaitTime} min)` : ''}.`,
    }),
    joined: (data: WaitlistNotificationData) => ({
      title: '📝 Joined Waitlist',
      message: `You've been added to the waitlist at ${data.restaurantName} for ${data.requestedDate}.`,
    }),
    removed: (data: WaitlistNotificationData) => ({
      title: '📤 Removed from Waitlist',
      message: `You've been removed from the waitlist at ${data.restaurantName}.`,
    }),
  },
  offer: {
    new_offer: (data: OfferNotificationData) => ({
      title: `🎁 ${data.offerTitle}`,
      message: `${data.offerDescription} at ${data.restaurantName}${data.expiryDate ? ` - Expires ${data.expiryDate}` : ''}`,
    }),
    expiring_soon: (data: OfferNotificationData) => ({
      title: '⏰ Offer Expiring Soon',
      message: `Your offer "${data.offerTitle}" at ${data.restaurantName} expires ${data.expiryDate}!`,
    }),
    expired: (data: OfferNotificationData) => ({
      title: '⏰ Offer Expired',
      message: `Your offer "${data.offerTitle}" at ${data.restaurantName} has expired.`,
    }),
    redeemed: (data: OfferNotificationData) => ({
      title: '🎉 Offer Redeemed!',
      message: `You've successfully redeemed "${data.offerTitle}" at ${data.restaurantName}!`,
    }),
  },
  review: {
    reminder: (data: ReviewNotificationData) => ({
      title: '⭐ How was your experience?',
      message: `Please share your thoughts about your recent visit to ${data.restaurantName} on ${data.visitDate}.`,
    }),
    response_received: (data: ReviewNotificationData) => ({
      title: '💬 Restaurant Responded',
      message: `${data.restaurantName} has responded to your review!`,
    }),
    featured: (data: ReviewNotificationData) => ({
      title: '🌟 Review Featured!',
      message: `Your review of ${data.restaurantName} has been featured!`,
    }),
    helpful_votes: (data: ReviewNotificationData) => ({
      title: '👍 Review Helpful',
      message: `Other users found your review of ${data.restaurantName} helpful!`,
    }),
  },
  loyalty: {
    points_earned: (data: LoyaltyNotificationData) => ({
      title: '🎯 Points Earned!',
      message: `You earned ${data.points} points at ${data.restaurantName}!`,
    }),
    points_redeemed: (data: LoyaltyNotificationData) => ({
      title: '🎁 Points Redeemed!',
      message: `You redeemed ${data.points} points at ${data.restaurantName}!`,
    }),
    milestone_reached: (data: LoyaltyNotificationData) => ({
      title: '🏆 Milestone Reached!',
      message: `Congratulations! You've reached ${data.milestone} at ${data.restaurantName}!`,
    }),
    reward_available: (data: LoyaltyNotificationData) => ({
      title: '🎁 Reward Available!',
      message: `You've unlocked "${data.rewardName}" at ${data.restaurantName}!`,
    }),
    reward_expiring: (data: LoyaltyNotificationData) => ({
      title: '⏰ Reward Expiring',
      message: `Your reward "${data.rewardName}" at ${data.restaurantName} is expiring soon!`,
    }),
  },
};
