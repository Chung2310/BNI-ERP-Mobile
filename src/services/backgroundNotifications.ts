import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

const BACKGROUND_NOTIFICATION_TASK = "igen-background-notification";
const ANDROID_CHANNEL_ID = "default";

type BackgroundPayload = {
  data?: { dataString?: string };
  notification?: Record<string, unknown> | null;
};

function parseDataPayload(payload: BackgroundPayload): Record<string, unknown> | null {
  const dataString = payload.data?.dataString;
  if (!dataString) return null;

  try {
    const parsed: unknown = JSON.parse(dataString);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readText(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

if (Platform.OS !== "web") {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    BACKGROUND_NOTIFICATION_TASK,
    async ({ data, error }) => {
      if (error || "actionIdentifier" in data) {
        return Notifications.BackgroundNotificationTaskResult.Failed;
      }

      const payload = data as BackgroundPayload;

      // FCM already displays messages containing a notification payload. Only
      // create a local notification for headless/data-only messages.
      if (payload.notification) {
        return Notifications.BackgroundNotificationTaskResult.NoData;
      }

      const pushData = parseDataPayload(payload);
      if (!pushData) return Notifications.BackgroundNotificationTaskResult.NoData;

      const title = readText(pushData, ["title", "notificationTitle"]);
      const body = readText(pushData, ["body", "message", "notificationBody"]);
      if (!title && !body) return Notifications.BackgroundNotificationTaskResult.NoData;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: title ?? "iGen Connect",
          body: body ?? "Bạn có thông báo mới.",
          data: pushData,
          sound: "default",
        },
        trigger: Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null,
      });

      return Notifications.BackgroundNotificationTaskResult.NewData;
    },
  );

  void Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => undefined);
}
