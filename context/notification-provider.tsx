// context/notification-provider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/supabase-provider';
import NotificationService from '@/lib/NotificationService';
import { useAppStore } from '@/stores';

interface NotificationContextType {
  isInitialized: boolean;
  pushToken: string | null;
  hasPermission: boolean;
  unreadCount: number;
  requestPermissions: () => Promise<boolean>;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { profile, session, isGuest } = useAuth();
  const { notifications, markNotificationRead, clearNotifications } = useAppStore();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const notificationService = NotificationService.getInstance();

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Initialize notification service
  useEffect(() => {
    let mounted = true;

    const initializeNotifications = async () => {
      try {
        // Skip initialization for guest users
        if (isGuest) {
          console.log('Skipping notification initialization for guest user');
          return;
        }

        const userId = profile?.id || session?.user?.id;
        if (!userId) {
          console.log('No user ID available for notification initialization');
          return;
        }

        console.log('Initializing notifications for user:', userId);
        const success = await notificationService.initialize(userId);
        
        if (mounted) {
          setIsInitialized(success);
          if (success) {
            const token = notificationService.getPushToken();
            setPushToken(token);
            setHasPermission(true);
            console.log('Notifications initialized successfully');
          } else {
            console.warn('Failed to initialize notifications');
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

    // Only initialize if we have a user and it's not a guest
    if ((profile?.id || session?.user?.id) && !isGuest) {
      initializeNotifications();
    } else if (isGuest) {
      // Reset state for guest users
      setIsInitialized(false);
      setPushToken(null);
      setHasPermission(false);
    }

    return () => {
      mounted = false;
    };
  }, [profile?.id, session?.user?.id, isGuest]);

  // Cleanup on unmount or when user logs out
  useEffect(() => {
    return () => {
      if (isInitialized) {
        notificationService.cleanup();
      }
    };
  }, [isInitialized]);

  // Clean up when user becomes guest or logs out
  useEffect(() => {
    if (isGuest || (!profile?.id && !session?.user?.id)) {
      if (isInitialized) {
        notificationService.cleanup();
        setIsInitialized(false);
        setPushToken(null);
        setHasPermission(false);
      }
    }
  }, [isGuest, profile?.id, session?.user?.id, isInitialized]);

  const requestPermissions = async (): Promise<boolean> => {
    try {
      if (isGuest) {
        console.warn('Cannot request permissions for guest user');
        return false;
      }

      const granted = await notificationService.requestPermissions();
      setHasPermission(granted);
      
      if (granted) {
        // Re-initialize with permissions granted
        const userId = profile?.id || session?.user?.id;
        if (userId) {
          const success = await notificationService.initialize(userId);
          setIsInitialized(success);
          if (success) {
            const token = notificationService.getPushToken();
            setPushToken(token);
          }
        }
      }
      
      return granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const markAllAsRead = () => {
    notifications.forEach(notification => {
      if (!notification.read) {
        markNotificationRead(notification.id);
      }
    });
  };

  const clearAllNotifications = () => {
    clearNotifications();
  };

  const contextValue: NotificationContextType = {
    isInitialized,
    pushToken,
    hasPermission,
    unreadCount,
    requestPermissions,
    markAllAsRead,
    clearAllNotifications,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}

// Export both the hook and context for flexibility
export { NotificationContext };
