import { router, type Href } from "expo-router";
import * as SecureStore from "expo-secure-store";
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
import { getChapterNotifications, type ChapterNotification } from "@/services/chapterNotifications";
import { getPushNotificationsModule, registerCurrentDeviceForPush, updateAppBadge } from "@/services/pushNotifications";
import { isChapterGuest } from "@/utils/guest";

type NotificationResponse = import("expo-notifications").NotificationResponse;

type NotificationState = {
  unreadCount: number;
  chapterNotifications: ChapterNotification[];
  revision: number;
  isRealtimeConnected: boolean;
  pushError: string | null;
  refreshUnreadCount(): Promise<void>;
  refreshChapterNotifications(): Promise<void>;
  markRead(item: NotificationItem): Promise<void>;
  markAllRead(): Promise<void>;
  markChapterRead(id: string): void;
  markAllChapterRead(): void;
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
  const { token: sessionToken, user } = useAuth();
  const userId = user?.uid;
  const token = isChapterGuest(user) ? null : sessionToken;
  const [unreadCount, setUnreadCount] = useState(0);
  const [chapterItems, setChapterItems] = useState<ChapterNotification[]>([]);
  const [chapterItemsOwner, setChapterItemsOwner] = useState<string | null>(null);
  const [chapterReadIds, setChapterReadIds] = useState<string[]>([]);
  const [chapterReadOwner, setChapterReadOwner] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const handledResponseId = useRef<string | null>(null);
  const chapterNotifications = useMemo(() => {
    if (!userId || chapterItemsOwner !== userId) return [];
    const readIds = new Set(chapterReadOwner === userId ? chapterReadIds : []);
    return chapterItems.map((item) => ({ ...item, read: readIds.has(item._id) }));
  }, [chapterItems, chapterItemsOwner, chapterReadIds, chapterReadOwner, userId]);
  const visibleUnreadCount = (token ? unreadCount : 0) + chapterNotifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!sessionToken || !user?.uid) return;
    const uid = user.uid;
    let active = true;
    void SecureStore.getItemAsync(`chapter-notice-read-${uid}`)
      .then((raw) => {
        if (!active) return;
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        setChapterReadIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
      })
      .catch(() => { if (active) setChapterReadIds([]); })
      .finally(() => { if (active) setChapterReadOwner(uid); });
    return () => { active = false; };
  }, [sessionToken, user?.uid]);

  useEffect(() => {
    if (!user?.uid || chapterReadOwner !== user.uid) return;
    void SecureStore.setItemAsync(`chapter-notice-read-${user.uid}`, JSON.stringify(chapterReadIds)).catch(() => undefined);
  }, [chapterReadIds, chapterReadOwner, user?.uid]);

  const refreshChapterNotifications = useCallback(async () => {
    if (!sessionToken || !user?.uid) {
      setChapterItems([]);
      setChapterItemsOwner(null);
      return;
    }
    const items = await getChapterNotifications(user);
    setChapterItems(items);
    setChapterItemsOwner(user.uid);
  }, [sessionToken, user]);

  useEffect(() => {
    const initialTimer = setTimeout(() => void refreshChapterNotifications().catch(() => undefined), 0);
    if (!sessionToken || !userId) return () => clearTimeout(initialTimer);
    const timer = setInterval(() => void refreshChapterNotifications().catch(() => undefined), 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshChapterNotifications().catch(() => undefined);
    });
    return () => { clearTimeout(initialTimer); clearInterval(timer); subscription.remove(); };
  }, [refreshChapterNotifications, sessionToken, userId]);

  const markChapterRead = useCallback((id: string) => {
    setChapterReadIds((current) => current.includes(id) ? current : [...current, id]);
  }, []);

  const markAllChapterRead = useCallback(() => {
    setChapterReadIds((current) => [...new Set([...current, ...chapterNotifications.map((item) => item._id)])]);
  }, [chapterNotifications]);

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
    chapterNotifications,
    revision,
    isRealtimeConnected: Boolean(token && isRealtimeConnected),
    pushError,
    refreshUnreadCount,
    refreshChapterNotifications,
    markRead,
    markAllRead,
    markChapterRead,
    markAllChapterRead,
  }), [chapterNotifications, isRealtimeConnected, markAllChapterRead, markAllRead, markChapterRead, markRead, pushError, refreshChapterNotifications, refreshUnreadCount, revision, token, visibleUnreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
