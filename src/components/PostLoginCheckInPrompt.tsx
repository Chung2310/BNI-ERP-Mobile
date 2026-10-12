import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { Alert } from "@/components/AppAlert";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth";
import { meetingService, type Meeting } from "@/services/meeting";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { meetingCheckInAvailability } from "@/utils/meetingCheckIn";
import { hasPermission } from "@/utils/permissions";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function upcomingCheckInMeeting(meetings: Meeting[], userId: string, now = Date.now()) {
  return meetings
    .filter((meeting) => {
      const startsAt = Date.parse(meeting.startsAt);
      return Number.isFinite(startsAt)
        && startsAt >= now
        && startsAt - now <= TWO_HOURS_MS
        && meetingCheckInAvailability(meeting, now) === "open"
        && !meeting.speakers.some((speaker) => speaker.userId === userId);
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
}

function meetingTime(startsAt: string) {
  return new Date(startsAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostLoginCheckInPrompt() {
  const { token, user } = useAuth();
  const handledTokenRef = useRef<string | null>(null);
  const checkingInRef = useRef(false);

  useEffect(() => {
    if (!token) {
      handledTokenRef.current = null;
      checkingInRef.current = false;
      return;
    }
    if (
      !user?.uid
      || handledTokenRef.current === token
      || hasPermission(user, "meetings:manage", "access:manage")
    ) return;

    handledTokenRef.current = token;
    let active = true;

    const checkIn = async (meeting: Meeting) => {
      if (checkingInRef.current) return;
      checkingInRef.current = true;
      try {
        await authService.authenticateForCheckIn();
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error("Cần cho phép truy cập vị trí để check-in.");
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await meetingService.checkIn(meeting._id, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        Alert.alert(
          "Check-in thành công",
          `Bạn đã check-in cuộc họp “${meeting.title}”.`,
        );
      } catch (cause) {
        Alert.alert(
          "Chưa thể check-in",
          friendlyErrorMessage(cause, "Check-in thất bại. Vui lòng thử lại từ trang cuộc họp."),
        );
      } finally {
        checkingInRef.current = false;
      }
    };

    void meetingService.list()
      .then((meetings) => {
        if (!active) return;
        const meeting = upcomingCheckInMeeting(meetings, user.uid);
        if (!meeting) return;
        Alert.alert(
          "Cuộc họp sắp diễn ra",
          `“${meeting.title}” bắt đầu lúc ${meetingTime(meeting.startsAt)}. Bạn có muốn check-in ngay không?`,
          [
            { text: "Không", style: "cancel" },
            {
              text: "Có, check-in",
              onPress: () => {
                // Let the confirmation modal finish closing before presenting the native biometric prompt.
                setTimeout(() => { void checkIn(meeting); }, 300);
              },
            },
          ],
          { cancelable: false },
        );
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, [token, user]);

  return null;
}
