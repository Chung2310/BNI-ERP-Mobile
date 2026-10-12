import { isRunningInExpoGo } from "expo";

// Remote push notifications are unavailable in Expo Go on Android (SDK 53+).
// Keep the background task enabled for development/release builds only.
if (!isRunningInExpoGo()) {
  require("./src/services/backgroundNotifications");
}

import "expo-router/entry";
