import { router } from "expo-router";
import { io, type Socket } from "socket.io-client";
import { Platform } from "react-native";
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
  refreshUnreadCount(): Promise<void>;
  markRead(item: NotificationItem): Promise<void>;
  markAllRead(): Promise<void>;
};

const NotificationContext = createContext<NotificationState | null>(null);

function notificationIdFromResponse(response: NotificationResponse) {
  const value = response.notification.request.content.data?.notificationId;
  return typeof value === "string" ? value : undefined;
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
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

    void notificationService.list({ page: 1, limit: 1 })
      .then((result) => setUnreadCount(result.unreadCount))
      .catch(() => undefined);
    void registerCurrentDeviceForPush().catch(() => undefined);

    const socket: Socket = io(apiConfig.baseUrl, {
      auth: { token: getApiAccessToken() || token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socket.on("connect", () => setIsRealtimeConnected(true));
    socket.on("disconnect", () => setIsRealtimeConnected(false));
    socket.io.on("reconnect_attempt", () => {
      socket.auth = { token: getApiAccessToken() || token };
    });
    socket.on("new_notification", (item: NotificationItem) => {
      if (!item.read) setUnreadCount((current) => current + 1);
      setRevision((current) => current + 1);
    });

    return () => {
      socket.disconnect();
      setIsRealtimeConnected(false);
    };
  }, [refreshUnreadCount, token]);

  const handleResponse = useCallback((response: NotificationResponse | null) => {
    if (!response || handledResponseId.current === response.notification.request.identifier) return;
    handledResponseId.current = response.notification.request.identifier;
    const notificationId = notificationIdFromResponse(response);
    if (notificationId) {
      void notificationService.markRead(notificationId)
        .then(() => {
          setUnreadCount((current) => Math.max(0, current - 1));
          setRevision((current) => current + 1);
        })
        .catch(() => undefined);
    }
    router.push("/notifications");
  }, []);

  useEffect(() => {
    if (!token || Platform.OS === "web") return undefined;
    let active = true;
    let responseSubscription: { remove(): void } | undefined;
    let tokenSubscription: { remove(): void } | undefined;
    void getPushNotificationsModule().then((Notifications) => {
      if (!active || !Notifications) return;
      responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      void Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => undefined);
      tokenSubscription = Notifications.addPushTokenListener(() => {
        void registerCurrentDeviceForPush().catch(() => undefined);
      });
    }).catch(() => undefined);
    return () => {
      active = false;
      responseSubscription?.remove();
      tokenSubscription?.remove();
    };
  }, [handleResponse, token]);

  const value = useMemo(() => ({
    unreadCount: visibleUnreadCount,
    revision,
    isRealtimeConnected: Boolean(token && isRealtimeConnected),
    refreshUnreadCount,
    markRead,
    markAllRead,
  }), [isRealtimeConnected, markAllRead, markRead, refreshUnreadCount, revision, token, visibleUnreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
