import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { isRunningInExpoGo } from "expo";
import { Camera } from "expo-camera";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import * as Location from "expo-location";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { colors } from "@/theme/tokens";

type PermissionState = {
  granted: boolean;
  canAskAgain: boolean;
};

type AppPermissions = {
  isLoading: boolean;
  isRequesting: boolean;
  camera: PermissionState;
  microphone: PermissionState;
  location: PermissionState;
  notifications: PermissionState;
  allGranted: boolean;
  refresh(): Promise<void>;
  requestAll(): Promise<void>;
};

const initialPermission: PermissionState = { granted: false, canAskAgain: true };
const AppPermissionsContext = createContext<AppPermissions | null>(null);
const useAndroidSystemNotificationPermission = Platform.OS === "android" && isRunningInExpoGo();

async function getNotificationPermission(): Promise<PermissionState> {
  if (Platform.OS === "web") return { granted: true, canAskAgain: true };

  if (useAndroidSystemNotificationPermission) {
    if (Number(Platform.Version) < 33) return { granted: true, canAskAgain: true };
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return { granted, canAskAgain: true };
  }

  const Notifications = await import("expo-notifications");
  const result = await Notifications.getPermissionsAsync();
  return { granted: result.granted, canAskAgain: result.canAskAgain };
}

async function requestNotificationPermission(): Promise<PermissionState> {
  if (Platform.OS === "web") return { granted: true, canAskAgain: true };

  if (useAndroidSystemNotificationPermission) {
    if (Number(Platform.Version) < 33) return { granted: true, canAskAgain: true };
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: "Cho phép thông báo",
        message: "iGen Connect cần quyền thông báo để gửi nhắc lịch họp và các cập nhật quan trọng.",
        buttonPositive: "Cho phép",
        buttonNegative: "Từ chối",
      },
    );
    return {
      granted: result === PermissionsAndroid.RESULTS.GRANTED,
      canAskAgain: result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    };
  }

  const Notifications = await import("expo-notifications");
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Thông báo chung",
      description: "Thông báo cuộc họp và hoạt động từ iGen Connect",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.primary,
    });
  }
  let result = await Notifications.getPermissionsAsync();
  if (!result.granted && result.canAskAgain) result = await Notifications.requestPermissionsAsync();
  return { granted: result.granted, canAskAgain: result.canAskAgain };
}

export function AppPermissionsProvider({ children }: PropsWithChildren) {
  const [camera, setCamera] = useState<PermissionState>(initialPermission);
  const [microphone, setMicrophone] = useState<PermissionState>(initialPermission);
  const [location, setLocation] = useState<PermissionState>(initialPermission);
  const [notifications, setNotifications] = useState<PermissionState>(initialPermission);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS === "web") {
      setCamera({ granted: true, canAskAgain: true });
      setMicrophone({ granted: true, canAskAgain: true });
      setLocation({ granted: true, canAskAgain: true });
      setNotifications({ granted: true, canAskAgain: true });
      setIsLoading(false);
      return;
    }
    try {
      const [cameraResult, microphoneResult, locationResult, notificationResult] = await Promise.all([
        Camera.getCameraPermissionsAsync(),
        getRecordingPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
        getNotificationPermission(),
      ]);
      setCamera({ granted: cameraResult.granted, canAskAgain: cameraResult.canAskAgain });
      setMicrophone({ granted: microphoneResult.granted, canAskAgain: microphoneResult.canAskAgain });
      setLocation({ granted: locationResult.granted, canAskAgain: locationResult.canAskAgain });
      setNotifications((current) => ({
        granted: notificationResult.granted,
        canAskAgain: notificationResult.granted ? true : current.canAskAgain && notificationResult.canAskAgain,
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestAll = useCallback(async () => {
    if (Platform.OS === "web") return refresh();
    setIsRequesting(true);
    try {
      let cameraResult = await Camera.getCameraPermissionsAsync();
      if (!cameraResult.granted && cameraResult.canAskAgain) cameraResult = await Camera.requestCameraPermissionsAsync();
      setCamera({ granted: cameraResult.granted, canAskAgain: cameraResult.canAskAgain });

      let microphoneResult = await getRecordingPermissionsAsync();
      if (!microphoneResult.granted && microphoneResult.canAskAgain) microphoneResult = await requestRecordingPermissionsAsync();
      setMicrophone({ granted: microphoneResult.granted, canAskAgain: microphoneResult.canAskAgain });

      let locationResult = await Location.getForegroundPermissionsAsync();
      if (!locationResult.granted && locationResult.canAskAgain) locationResult = await Location.requestForegroundPermissionsAsync();
      setLocation({ granted: locationResult.granted, canAskAgain: locationResult.canAskAgain });

      const notificationResult = await requestNotificationPermission();
      setNotifications(notificationResult);
    } finally {
      setIsRequesting(false);
      setIsLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [refresh]);

  const value = useMemo(() => ({
    isLoading,
    isRequesting,
    camera,
    microphone,
    location,
    notifications,
    allGranted: camera.granted && microphone.granted && location.granted && notifications.granted,
    refresh,
    requestAll,
  }), [camera, isLoading, isRequesting, location, microphone, notifications, refresh, requestAll]);

  return <AppPermissionsContext.Provider value={value}>{children}</AppPermissionsContext.Provider>;
}

export function useAppPermissions() {
  const context = useContext(AppPermissionsContext);
  if (!context) throw new Error("useAppPermissions must be used inside AppPermissionsProvider");
  return context;
}
