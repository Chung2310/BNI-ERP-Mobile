import { router, type Href } from "expo-router";
import { io, type Socket } from "socket.io-client";
import { AppState, Platform } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { apiConfig, getApiAccessToken } from "@/services/api";
import { notificationService, type NotificationItem } from "@/services/notifications";
import { getPushNotificationsModule, registerCurrentDeviceForPush, updateAppBadge } from "@/services/pushNotifications";

type NotificationResponse = import("expo-notifications").NotificationResponse;

type NotificationState = {
  unreadCount: number;
  revision: number;
  isRealtimeConnected: boolean;
  pushError: string | null;
  refreshUnreadCount(): Promise<void>;
  markRead(item: NotificationItem): Promise<void>;
  markAllRead(): Promise<void>;
};

const NotificationContext = createContext<NotificationState | null>(null);

function notificationIdFromResponse(response: NotificationResponse) {
  const value = response.notification.request.content.data?.notificationId;
  return typeof value === "string" ? value : undefined;
}

function routeFromResponse(response: NotificationResponse) {
  const value = response.notification.request.content.data?.route;
  return typeof value === "string" && value.startsWith("/") ? value : undefined;
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const handledResponseId = useRef<string | null>(null);
  const visibleUnreadCount = token ? unreadCount : 0;

  useEffect(() => {
    void getPushNotificationsModule().then((Notifications) => {
      if (!Notifications) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }).catch(() => undefined);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    const result = await notificationService.list({ page: 1, limit: 1 });
    setUnreadCount(result.unreadCount);
  }, [token]);

  const markRead = useCallback(async (item: NotificationItem) => {
    if (item.read) return;
    await notificationService.markRead(item._id);
    setUnreadCount((current) => Math.max(0, current - 1));
    setRevision((current) => current + 1);
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead();
    setUnreadCount(0);
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    void updateAppBadge(visibleUnreadCount).catch(() => undefined);
  }, [visibleUnreadCount]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let active = true;
    let registering = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const registerPush = async () => {
      if (!active || registering || AppState.currentState !== "active") return;
      registering = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        const registeredToken = await registerCurrentDeviceForPush();
        if (!active) return;
        if (!registeredToken) {
          setPushError("Thiết bị chưa đăng ký được FCM. Hãy kiểm tra quyền thông báo và cài lại APK mới nhất.");
          return;
        }
        retryCount = 0;
        setPushError(null);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Không rõ nguyên nhân";
        setPushError(`Không đăng ký được thông báo nền: ${message}`);
        retryTimer = setTimeout(
          () => void registerPush(),
          Math.min(300_000, 30_000 * 2 ** Math.min(retryCount++, 4)),
        );
      } finally {
        registering = false;
      }
    };

    const initialTimer = setTimeout(() => {
      void refreshUnreadCount().catch(() => undefined);
      void registerPush();
    }, 0);

    const socket: Socket = io(apiConfig.baseUrl, {
      auth: { token: getApiAccessToken() || token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
    socket.on("connect", () => {
      setIsRealtimeConnected(true);
      void refreshUnreadCount().catch(() => undefined);
      void registerPush();
    });
    socket.on("disconnect", () => setIsRealtimeConnected(false));
    socket.on("connect_error", () => setIsRealtimeConnected(false));
    socket.io.on("reconnect_attempt", () => {
      socket.auth = { token: getApiAccessToken() || token };
    });
    socket.on("new_notification", () => {
      void refreshUnreadCount().catch(() => undefined);
      setRevision((current) => current + 1);
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (!socket.connected) socket.connect();
        void refreshUnreadCount().catch(() => undefined);
        void registerPush();
      } else if (retryTimer) {
        clearTimeout(retryTimer);
      }
    });

    return () => {
      active = false;
      clearTimeout(initialTimer);
      if (retryTimer) clearTimeout(retryTimer);
      appStateSubscription.remove();
      socket.disconnect();
      setIsRealtimeConnected(false);
    };
  }, [refreshUnreadCount, token]);

  const handleResponse = useCallback((response: NotificationResponse | null) => {
    if (!response || handledResponseId.current === response.notification.request.identifier) return;
    handledResponseId.current = response.notification.request.identifier;
    const route = routeFromResponse(response);
    const notificationId = notificationIdFromResponse(response);
    if (notificationId && !route?.startsWith("/chat/")) {
      void notificationService.markRead(notificationId)
        .then(() => {
          setUnreadCount((current) => Math.max(0, current - 1));
          setRevision((current) => current + 1);
        })
        .catch(() => undefined);
    }
    router.push((route || "/notifications") as Href);
  }, []);

  useEffect(() => {
    if (!token || Platform.OS === "web") return undefined;
    let active = true;
    let responseSubscription: { remove(): void } | undefined;
    let receivedSubscription: { remove(): void } | undefined;
    let tokenSubscription: { remove(): void } | undefined;
    void getPushNotificationsModule().then((Notifications) => {
      if (!active || !Notifications) return;
      responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      receivedSubscription = Notifications.addNotificationReceivedListener(() => {
        void refreshUnreadCount().catch(() => undefined);
        setRevision((current) => current + 1);
      });
      void Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => undefined);
      tokenSubscription = Notifications.addPushTokenListener((nativeToken) => {
        if (typeof nativeToken.data !== "string") return;
        // Do not call getDevicePushTokenAsync() inside this listener because
        // obtaining a token can trigger the listener again on Android.
        void registerCurrentDeviceForPush(nativeToken.data).catch(() => undefined);
      });
    }).catch(() => undefined);
    return () => {
      active = false;
      responseSubscription?.remove();
      receivedSubscription?.remove();
      tokenSubscription?.remove();
    };
  }, [handleResponse, refreshUnreadCount, token]);

  const value = useMemo(() => ({
    unreadCount: visibleUnreadCount,
    revision,
    isRealtimeConnected: Boolean(token && isRealtimeConnected),
    pushError,
    refreshUnreadCount,
    markRead,
    markAllRead,
  }), [isRealtimeConnected, markAllRead, markRead, pushError, refreshUnreadCount, revision, token, visibleUnreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
