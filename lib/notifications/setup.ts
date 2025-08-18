import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/config/supabase";

let responseListenerSub: Notifications.Subscription | null = null;
let receivedListenerSub: Notifications.Subscription | null = null;
let cachedPushToken: string | null = null;

export type NotificationData = {
  category?: string;
  type?: string;
  deeplink?: string;
  [key: string]: any;
};

export async function ensurePushPermissionsAndToken(): Promise<string | null> {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    // iOS: set foreground presentation
    if (Platform.OS === "ios") {
      await Notifications.setNotificationCategoryAsync("default", []);
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse?.data ?? null;
    cachedPushToken = token;
    return token;
  } catch (e) {
    console.warn("Push permission/token error:", e);
    return null;
  }
}

export async function registerDeviceForPush(userId: string): Promise<void> {
  try {
    const token = cachedPushToken ?? (await ensurePushPermissionsAndToken());
    if (!token) return;

    const deviceId = token; // Use token as unique device id (simple)
    const platform = Platform.OS;
    const appVersion = Constants.expoConfig?.version ?? null;

    await supabase.from("user_devices").upsert(
      {
        user_id: userId,
        device_id: deviceId,
        expo_push_token: token,
        platform,
        app_version: appVersion,
        enabled: true,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" },
    );
  } catch (e) {
    console.warn("Failed to register device:", e);
  }
}

export function initializeNotificationHandlers(
  onOpenDeeplink?: (deeplink: string, data?: any) => void,
) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () =>
        ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true as any, // web compat
          shouldShowList: true as any, // web compat
        }) as any,
    });

    if (!receivedListenerSub) {
      receivedListenerSub = Notifications.addNotificationReceivedListener(
        () => {
          // Could increment in-app badge count here
        },
      );
    }

    if (!responseListenerSub) {
      responseListenerSub =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content
            .data as NotificationData;
          const deeplink = (data?.deeplink as string) || undefined;
          if (deeplink && onOpenDeeplink) {
            onOpenDeeplink(deeplink, data);
          }
        });
    }
  } catch (e) {
    console.warn("Failed to initialize notification handlers:", e);
  }
}

export function cleanupNotificationHandlers() {
  responseListenerSub?.remove();
  receivedListenerSub?.remove();
  responseListenerSub = null;
  receivedListenerSub = null;
}
