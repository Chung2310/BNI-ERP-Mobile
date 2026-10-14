import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Linking, Platform } from "react-native";
import { Alert } from "@/components/AppAlert";
import { apiRequest } from "@/services/api";

const PUSH_TOKEN_KEY = "igen_native_push_token";
const LEGACY_EXPO_PUSH_TOKEN_KEY = "igen_expo_push_token";
const ANDROID_CHANNEL_ID = "default";
let registrationPromise: Promise<string | null> | null = null;

type PushPlatform = "android" | "ios";
type PushProvider = "fcm" | "expo";

function getPushRegistrationMetadata(): { platform: PushPlatform; provider: PushProvider } {
  return Platform.OS === "android"
    ? { platform: "android", provider: "fcm" }
    : { platform: "ios", provider: "expo" };
}

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

export async function getDevicePushPermission(): Promise<"enabled" | "notGranted" | "unavailable"> {
  if (Platform.OS === "web" || !Device.isDevice) return "unavailable";
  const Notifications = await getPushNotificationsModule();
  if (!Notifications) return "unavailable";
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted || (Platform.OS === "ios" && (permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL || permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL))
    ? "enabled" : "notGranted";
}

async function performDevicePushRegistration(providedToken?: string, interactive = false): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  const Notifications = await getPushNotificationsModule();
  if (!Notifications) return null;

  const currentPermission = await Notifications.getPermissionsAsync();
  const alreadyAllowed = currentPermission.granted || (Platform.OS === "ios" && (
    currentPermission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    currentPermission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  ));
  // Ask once on first use; respect an earlier refusal on automatic retries and token refreshes.
  if (!alreadyAllowed && currentPermission.status !== "undetermined" && !interactive) {
    await unregisterCurrentDeviceFromPush().catch(() => undefined);
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Thông báo iGen Connect",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#00AECA",
      sound: "default",
    });
  }

  const registration = getPushRegistrationMetadata();
  // iOS native tokens are APNs tokens and cannot be sent through Firebase
  // Admin. Use Expo's project-scoped token there; Android stays on native FCM.
  let token = alreadyAllowed && registration.provider === "fcm" ? providedToken : undefined;
  if (!token) {
    const hasCurrentPermission = currentPermission.granted || (
      Platform.OS === "ios" && (
        currentPermission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        currentPermission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
      )
    );
    if (!hasCurrentPermission && !currentPermission.canAskAgain) {
      if (interactive) showOpenNotificationSettingsPrompt();
      return null;
    }

    const permission = hasCurrentPermission
      ? currentPermission
      : await Notifications.requestPermissionsAsync();
    const hasPermission = permission.granted || (
      Platform.OS === "ios" && (
        permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
      )
    );
    if (!hasPermission) return null;

    if (registration.provider === "expo") {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
      if (!projectId) {
        throw new Error("Thiếu EAS project ID. Hãy cấu hình EXPO_PUBLIC_EAS_PROJECT_ID cho bản iOS.");
      }
      const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
      if (typeof expoToken.data !== "string") {
        throw new Error("Expo Push Service không trả về token hợp lệ.");
      }
      token = expoToken.data.trim();
    } else {
      const nativeToken = await Notifications.getDevicePushTokenAsync();
      if (nativeToken.type !== "android") {
        throw new Error("Firebase trả về sai loại token cho thiết bị Android.");
      }
      if (typeof nativeToken.data !== "string") {
        throw new Error("Dịch vụ push không trả về token hợp lệ.");
      }
      token = nativeToken.data.trim();
    }
  }
  if (!token) return null;
  token = token.trim();
  if (token.length < 20 || token.length > 4096 || /\s/.test(token)) {
    throw new Error("Push token trên thiết bị không hợp lệ.");
  }
  const previousToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  const legacyExpoToken = await SecureStore.getItemAsync(LEGACY_EXPO_PUSH_TOKEN_KEY);
  await apiRequest("/api/v1/push/mobile/subscribe", {
    method: "POST",
    body: JSON.stringify({
      token,
      platform: registration.platform,
      provider: registration.provider,
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

export function registerCurrentDeviceForPush(nativeToken?: string, interactive = false): Promise<string | null> {
  if (registrationPromise && interactive) return registrationPromise.catch(() => null).then(() => registerCurrentDeviceForPush(nativeToken, true));
  if (registrationPromise) return registrationPromise;
  registrationPromise = performDevicePushRegistration(nativeToken, interactive)
    .finally(() => { registrationPromise = null; });
  return registrationPromise;
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
