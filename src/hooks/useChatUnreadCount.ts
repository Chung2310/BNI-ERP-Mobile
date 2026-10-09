import { useEffect, useState } from "react";
import { usePathname } from "expo-router";
import { AppState } from "react-native";
import { chatService } from "@/services/chat";

export function useChatUnreadCount(token: string | null) {
  const [result, setResult] = useState<{ token: string; count: number } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!token) return;

    let active = true;
    let pending = false;
    let refreshAfterPending = false;
    const refresh = async () => {
      if (!active || (AppState.currentState && AppState.currentState !== "active")) return;
      if (pending) {
        refreshAfterPending = true;
        return;
      }
      pending = true;
      try {
        const rooms = await chatService.rooms();
        if (active) setResult({ token, count: rooms.reduce((total, room) => total + Math.max(0, room.unreadCount || 0), 0) });
      } catch {
        // Keep the last known count until the next refresh succeeds.
      } finally {
        pending = false;
        if (refreshAfterPending && active) {
          refreshAfterPending = false;
          void refresh();
        }
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 15_000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const unsubscribe = chatService.onUnreadChanged(() => void refresh());

    return () => {
      active = false;
      clearInterval(interval);
      appStateSubscription.remove();
      unsubscribe();
    };
  }, [pathname, token]);

  return result?.token === token ? result.count : 0;
}
