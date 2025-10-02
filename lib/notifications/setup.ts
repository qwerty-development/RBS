import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/config/supabase";

let responseListenerSub: Notifications.Subscription | null = null;
let receivedListenerSub: Notifications.Subscription | null = null;
let cachedPushToken: string | null = null;

async function resolveExistingPushToken(): Promise<string | null> {
  if (cachedPushToken) {
    return cachedPushToken;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse?.data ?? null;
    cachedPushToken = token;
    return token;
  } catch (error) {
    console.warn("Failed to resolve existing push token:", error);
    return null;
  }
}

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
    console.log(
      "📱 [registerDeviceForPush] Starting registration for user:",
      userId,
    );

    const token = cachedPushToken ?? (await ensurePushPermissionsAndToken());
    console.log(
      "📱 [registerDeviceForPush] Token obtained:",
      token ? "YES" : "NO",
    );

    if (!token) {
      console.warn(
        "📱 [registerDeviceForPush] No token available - exiting early",
      );
      return;
    }

    const deviceId = token; // Use token as unique device id (simple)
    const platform = Platform.OS;
    const appVersion = Constants.expoConfig?.version ?? null;

    console.log("📱 [registerDeviceForPush] Device info:", {
      deviceId: deviceId.substring(0, 20) + "...",
      platform,
      appVersion,
    });

    // Disable this token for any other users to prevent cross-account notifications
    // Using RPC function with SECURITY DEFINER to bypass RLS
    try {
      console.log(
        "📱 [registerDeviceForPush] Disabling token for other users...",
      );
      const { error: rpcError } = await supabase.rpc(
        "disable_other_users_push_token",
        {
          p_expo_push_token: token,
          p_current_user_id: userId,
        },
      );
      if (rpcError) {
        console.warn("📱 [registerDeviceForPush] RPC error:", rpcError);
      } else {
        console.log(
          "📱 [registerDeviceForPush] Successfully disabled token for other users",
        );
      }
    } catch (error) {
      console.warn(
        "📱 [registerDeviceForPush] Failed to disable push token for other users:",
        error,
      );
    }

    const deviceData = {
      user_id: userId,
      device_id: deviceId,
      expo_push_token: token,
      platform,
      app_version: appVersion,
      enabled: true,
      last_seen: new Date().toISOString(),
    };

    console.log(
      "📱 [registerDeviceForPush] Upserting device with enabled=true...",
    );
    const { data, error: upsertError } = await supabase
      .from("user_devices")
      .upsert(deviceData, { onConflict: "user_id,device_id" });

    if (upsertError) {
      console.error("📱 [registerDeviceForPush] Upsert error:", upsertError);
      throw upsertError;
    }

    console.log(
      "✅ [registerDeviceForPush] Device registered successfully with enabled=true",
    );
  } catch (e) {
    console.error("❌ [registerDeviceForPush] Failed to register device:", e);
    throw e; // Re-throw to ensure caller knows about the error
  }
}

export async function unregisterDeviceForPush(userId: string): Promise<void> {
  try {
    const token = await resolveExistingPushToken();
    const baseQuery = supabase
      .from("user_devices")
      .update({ enabled: false, last_seen: new Date().toISOString() })
      .eq("user_id", userId);

    const query = token ? baseQuery.eq("device_id", token) : baseQuery;
    await query;
  } catch (error) {
    console.warn("Failed to unregister device:", error);
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
