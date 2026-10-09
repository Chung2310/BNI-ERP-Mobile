import { isRunningInExpoGo } from "expo";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Linking, Platform } from "react-native";
import { Alert } from "@/components/AppAlert";
import { apiRequest } from "@/services/api";

const PUSH_TOKEN_KEY = "igen_native_push_token";
const LEGACY_EXPO_PUSH_TOKEN_KEY = "igen_expo_push_token";
const ANDROID_CHANNEL_ID = "default";

export async function getPushNotificationsModule() {
  if (Platform.OS === "web" || isRunningInExpoGo()) return null;
  return import("expo-notifications");
}

function showOpenNotificationSettingsPrompt() {
  Alert.alert(
    "Bật quyền thông báo",
    "Quyền thông báo đang bị tắt. Hãy mở Cài đặt để nhận thông báo realtime và thông báo khi ứng dụng chạy nền.",
    [
      { text: "Để sau", style: "cancel" },
      {
        text: "Mở Cài đặt",
        onPress: () => {
          void Linking.openSettings().catch(() => undefined);
        },
      },
    ],
  );
}

export async function registerCurrentDeviceForPush(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  const Notifications = await getPushNotificationsModule();
  if (!Notifications) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Thông báo iGen Connect",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#00AECA",
      sound: "default",
    });
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  if (!currentPermission.granted && !currentPermission.canAskAgain) {
    showOpenNotificationSettingsPrompt();
    return null;
  }

  const permission = currentPermission.granted
    ? currentPermission
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  // This is the provider-native token: FCM on Android and APNs on iOS.
  // The backend sends directly to those providers; Expo Push Service is not used.
  const nativeToken = await Notifications.getDevicePushTokenAsync();
  const token = nativeToken.data;
  const previousToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  const legacyExpoToken = await SecureStore.getItemAsync(LEGACY_EXPO_PUSH_TOKEN_KEY);

  await apiRequest("/api/v1/push/mobile/subscribe", {
    method: "POST",
    body: JSON.stringify({
      token,
      platform: Platform.OS,
      provider: Platform.OS === "android" ? "fcm" : "apns",
      deviceName: Device.deviceName || Device.modelName || undefined,
    }),
  });

  const staleTokens = new Set([previousToken, legacyExpoToken]);
  staleTokens.delete(null);
  staleTokens.delete(token);
  await Promise.all(Array.from(staleTokens, (staleToken) =>
    apiRequest("/api/v1/push/mobile/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ token: staleToken }),
    }).catch(() => undefined),
  ));

  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  await SecureStore.deleteItemAsync(LEGACY_EXPO_PUSH_TOKEN_KEY);
  return token;
}

export async function unregisterCurrentDeviceFromPush(): Promise<void> {
  const storedTokens = await Promise.all([
    SecureStore.getItemAsync(PUSH_TOKEN_KEY),
    SecureStore.getItemAsync(LEGACY_EXPO_PUSH_TOKEN_KEY),
  ]);
  const tokens = Array.from(new Set(storedTokens.filter((token): token is string => Boolean(token))));
  try {
    await Promise.all(tokens.map((token) =>
      apiRequest("/api/v1/push/mobile/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    ));
  } finally {
    await Promise.all([
      SecureStore.deleteItemAsync(PUSH_TOKEN_KEY),
      SecureStore.deleteItemAsync(LEGACY_EXPO_PUSH_TOKEN_KEY),
    ]);
  }
}

export async function updateAppBadge(unreadCount: number): Promise<void> {
  const Notifications = await getPushNotificationsModule();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(Math.max(0, unreadCount));
}
