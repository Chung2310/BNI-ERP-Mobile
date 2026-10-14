import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

// Remote notifications are unavailable in Expo Go; importing the module there
// throws before the app can render. Development builds still register early.
if (Platform.OS !== "web" && !isRunningInExpoGo()) {
  require("./src/services/backgroundNotifications");
}

require("expo-router/entry");
