import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { apiConfig } from "@/services/api";
import { meetingService, type MeetingInteraction } from "@/services/meeting";

export function useLiveMeetingInteraction(meetingId: string, onUpdate: (next: MeetingInteraction) => void) {
  const { token } = useAuth();

  useFocusEffect(useCallback(() => {
    if (!meetingId) return;
    let active = true;
    let refreshing = false;
    let queued = false;

    const refresh = async () => {
      if (refreshing) { queued = true; return; }
      refreshing = true;
      do {
        queued = false;
        try {
          const next = await meetingService.interaction(meetingId);
          if (active) onUpdate(next);
        } catch {
          // Keep the last visible state; the next socket event or poll retries.
        }
      } while (active && queued);
      refreshing = false;
    };

    void refresh();
    const socket = token ? io(apiConfig.baseUrl, { auth: { token }, transports: ["websocket", "polling"], reconnection: true }) : null;
    socket?.on("connect", () => void refresh());
    socket?.on("meeting_interaction_updated", (event: { meetingId?: string }) => {
      if (event.meetingId === meetingId) void refresh();
    });
    const poll = setInterval(() => void refresh(), 5000);

    return () => {
      active = false;
      socket?.disconnect();
      clearInterval(poll);
    };
  }, [meetingId, onUpdate, token]));
}
