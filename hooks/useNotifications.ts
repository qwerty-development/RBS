// hooks/useNotifications.ts
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/supabase-provider';
import NotificationService, { NotificationData } from '@/lib/NotificationService';
import { useAppStore } from '@/stores';

export interface UseNotificationsReturn {
  isInitialized: boolean;
  pushToken: string | null;
  hasPermission: boolean;
  requestPermissions: () => Promise<boolean>;
  scheduleNotification: (data: NotificationData) => Promise<string | null>;
  cancelNotification: (identifier: string) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  sendBookingConfirmation: (data: any) => Promise<void>;
  sendBookingReminder: (data: any) => Promise<string | null>;
  sendWaitlistUpdate: (data: any) => Promise<void>;
  sendOfferNotification: (data: any) => Promise<void>;
  sendReviewReminder: (data: any) => Promise<void>;
  sendLoyaltyUpdate: (data: any) => Promise<void>;
  sendSystemNotification: (data: any) => Promise<void>;
}

/**
 * Hook for managing notifications throughout the app
 */
export function useNotifications(): UseNotificationsReturn {
  const { profile, session } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const notificationService = NotificationService.getInstance();

  // Initialize notification service when user is authenticated
  useEffect(() => {
    let mounted = true;

    const initializeNotifications = async () => {
      try {
        const userId = profile?.id || session?.user?.id;
        const success = await notificationService.initialize(userId);
        
        if (mounted) {
          setIsInitialized(success);
          if (success) {
            const token = notificationService.getPushToken();
            setPushToken(token);
            setHasPermission(true);
          }
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
        if (mounted) {
          setIsInitialized(false);
          setHasPermission(false);
        }
      }
    };

    if (profile?.id || session?.user?.id) {
      initializeNotifications();
    }

    return () => {
      mounted = false;
    };
  }, [profile?.id, session?.user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInitialized) {
        notificationService.cleanup();
      }
    };
  }, [isInitialized]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await notificationService.requestPermissions();
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }, []);

  const scheduleNotification = useCallback(async (data: NotificationData): Promise<string | null> => {
    try {
      return await notificationService.scheduleNotification(data);
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }, []);

  const cancelNotification = useCallback(async (identifier: string): Promise<void> => {
    try {
      await notificationService.cancelNotification(identifier);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }, []);

  const cancelAllNotifications = useCallback(async (): Promise<void> => {
    try {
      await notificationService.cancelAllNotifications();
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }, []);

  const sendBookingConfirmation = useCallback(async (data: any): Promise<void> => {
    try {
      await notificationService.sendBookingConfirmation(data);
    } catch (error) {
      console.error('Error sending booking confirmation:', error);
    }
  }, []);

  const sendBookingReminder = useCallback(async (data: any): Promise<string | null> => {
    try {
      return await notificationService.sendBookingReminder(data);
    } catch (error) {
      console.error('Error sending booking reminder:', error);
      return null;
    }
  }, []);

  const sendWaitlistUpdate = useCallback(async (data: any): Promise<void> => {
    try {
      await notificationService.sendWaitlistUpdate(data);
    } catch (error) {
      console.error('Error sending waitlist update:', error);
    }
  }, []);

  const sendOfferNotification = useCallback(async (data: any): Promise<void> => {
    try {
      await notificationService.sendOfferNotification(data);
    } catch (error) {
      console.error('Error sending offer notification:', error);
    }
  }, []);

  const sendReviewReminder = useCallback(async (data: any): Promise<void> => {
    try {
      await notificationService.sendReviewReminder(data);
    } catch (error) {
      console.error('Error sending review reminder:', error);
    }
  }, []);

  const sendLoyaltyUpdate = useCallback(async (data: any): Promise<void> => {
    try {
      await notificationService.sendLoyaltyUpdate(data);
    } catch (error) {
      console.error('Error sending loyalty update:', error);
    }
  }, []);

  const sendSystemNotification = useCallback(async (data: any): Promise<void> => {
    try {
      await notificationService.sendSystemNotification(data);
    } catch (error) {
      console.error('Error sending system notification:', error);
    }
  }, []);

  return {
    isInitialized,
    pushToken,
    hasPermission,
    requestPermissions,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    sendBookingConfirmation,
    sendBookingReminder,
    sendWaitlistUpdate,
    sendOfferNotification,
    sendReviewReminder,
    sendLoyaltyUpdate,
    sendSystemNotification,
  };
}
