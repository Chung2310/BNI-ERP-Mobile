import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { apiConfig } from "@/services/api";
import { meetingService, type Meeting, type MeetingDisplaySnapshot, type MeetingInteraction } from "@/services/meeting";
import { userService } from "@/services/users";
import type { UserProfile } from "@/types";

export type AudienceSnapshot = {
  display: MeetingDisplaySnapshot;
  meeting: Meeting;
  clockOffset: number;
  interaction?: MeetingInteraction;
  history?: Meeting[];
  members?: UserProfile[];
  detailError?: string;
};

export function useMeetingDisplay(id: string, enabled: boolean, onClosed: () => void) {
  const { token } = useAuth();
  const [data, setData] = useState<AudienceSnapshot | null>(null);
  const [error, setError] = useState("");
  const refreshRef = useRef<(() => void) | null>(null);
  const retry = useCallback(() => refreshRef.current?.(), []);

  useFocusEffect(useCallback(() => {
    if (!id || !enabled || !token) return;
    let active = true;
    let closed = false;
    let busy = false;
    let queued = false;
    let members: UserProfile[] | undefined;
    const controller = new AbortController();
    setData(null);
    setError("");
    const refresh = async () => {
      if (!active || closed || (AppState.currentState && AppState.currentState !== "active")) return;
      if (busy) { queued = true; return; }
      busy = true;
      do {
        queued = false;
        try {
          const display = await meetingService.presentationDisplay(id, controller.signal);
          if (!active) break;
          if (!display.isOpen) {
            closed = true;
            setData(null);
            onClosed();
            break;
          }
          const clockOffset = Date.parse(display.serverNow) - Date.now();
          const base = await meetingService.get(id);
          if (!active) break;
          const meeting: Meeting = {
            ...base, ...display.meeting,
            speakers: display.meeting.speakers.map((speaker) => ({
              ...base.speakers.find((item) => item.id === speaker.id), ...speaker,
            })),
          };
          const next: AudienceSnapshot = { display, meeting, clockOffset };
          try {
            if (meeting.presentation?.view === "audienceResponses") {
              next.interaction = await meetingService.interaction(id);
            } else if (meeting.presentation?.view === "activeMembers") {
              const [history, directory] = await Promise.all([
                meetingService.history(), members ? Promise.resolve(members) : userService.directory(),
              ]);
              members = directory;
              next.history = history.map((item) => item._id === id ? meeting : item);
              if (!next.history.some((item) => item._id === id)) next.history.push(meeting);
              next.members = directory;
            }
          } catch {
            next.detailError = "Chưa tải được nội dung trình chiếu. Đang thử kết nối lại…";
          }
          if (active) { setData(next); setError(""); }
        } catch (cause) {
          if (active) setError(friendlyErrorMessage(cause, "Không thể tải trình chiếu."));
        }
      } while (active && !closed && queued);
      busy = false;
    };
    refreshRef.current = () => void refresh();
    const socket = io(apiConfig.baseUrl, { auth: { token }, transports: ["websocket", "polling"], reconnection: true });
    socket.on("connect", () => void refresh());
    const onEvent = (event: { id?: string; meetingId?: string }) => {
      if ((event?.meetingId || event?.id) === id) void refresh();
    };
    ["meeting_updated", "meeting_interaction_updated", "lucky_draw_spun", "lucky_draw_redrawn"].forEach((name) => socket.on(name, onEvent));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const interval = setInterval(() => void refresh(), 5000);
    void refresh();
    return () => {
      active = false;
      refreshRef.current = null;
      controller.abort();
      socket.disconnect();
      subscription.remove();
      clearInterval(interval);
    };
  }, [id, enabled, token, onClosed]));
  return { data, error, retry };
}
