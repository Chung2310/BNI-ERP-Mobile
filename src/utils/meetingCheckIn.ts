import type { Meeting } from "@/services/meeting";

const CHECK_IN_LEAD_MS = 2 * 60 * 60 * 1000;

export function meetingCheckInAvailability(
  meeting: Pick<Meeting, "status" | "startsAt" | "endsAt">,
  now = Date.now(),
): "open" | "upcoming" | "closed" {
  if (!["scheduled", "live", "paused"].includes(meeting.status)) return "closed";
  if (meeting.status === "live" || meeting.status === "paused") return "open";

  const startsAt = Date.parse(meeting.startsAt);
  if (!Number.isFinite(startsAt)) return "closed";
  if (now < startsAt - CHECK_IN_LEAD_MS) return "upcoming";

  if (meeting.status === "scheduled") {
    const endsAt = meeting.endsAt ? Date.parse(meeting.endsAt) : startsAt + CHECK_IN_LEAD_MS;
    if (!Number.isFinite(endsAt) || now >= endsAt) return "closed";
  }

  return "open";
}

export function assertMeetingCheckInOpen(meeting: Pick<Meeting, "status" | "startsAt" | "endsAt">) {
  const availability = meetingCheckInAvailability(meeting);
  if (availability === "upcoming") throw new Error("Chưa đến giờ check-in. Vui lòng quay lại từ 2 giờ trước khi cuộc họp bắt đầu.");
  if (availability === "closed") throw new Error("Cuộc họp hiện không nhận check-in.");
}
