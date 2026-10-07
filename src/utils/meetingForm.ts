import type { MeetingRecurrence, SpeakingTimeSlot } from "@/services/meeting";

export const defaultSpeakingTimeSlots = (): SpeakingTimeSlot[] => [
  { startTime: "07:00", endTime: "08:00", seconds: 30 },
  { startTime: "08:00", endTime: "09:00", seconds: 20 },
];

export function parseVietnamDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value.replace(" ", "T") + ":00+07:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

export function twoHoursAfter(value: string) {
  const start = parseVietnamDateTime(value);
  if (!start) return "";
  return new Date(start.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
}

export function validateSpeakingTimeSlots(slots: SpeakingTimeSlot[]) {
  if (!slots.length || slots.length > 20) return "Cần cấu hình từ 1 đến 20 khung giờ phát biểu.";
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const slot of slots) {
    if (!time.test(slot.startTime) || !time.test(slot.endTime)) return "Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc cho từng khung.";
    if (slot.startTime >= slot.endTime) return "Giờ kết thúc của khung phát biểu phải sau giờ bắt đầu.";
    if (!Number.isInteger(slot.seconds) || slot.seconds < 1 || slot.seconds > 3600) return "Thời lượng phát biểu phải từ 1 đến 3600 giây.";
  }
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return sorted.some((slot, index) => index > 0 && slot.startTime < sorted[index - 1].endTime)
    ? "Các khung giờ phát biểu không được chồng nhau."
    : "";
}

export function recurringMeetingDates(rule: MeetingRecurrence) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.startDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time)) return [];
  const start = new Date(rule.startDate + "T00:00:00Z");
  if (Number.isNaN(start.getTime())) return [];
  const end = new Date(start);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + rule.months);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  const dates: Date[] = [];
  const dayMs = 86_400_000;
  for (let day = start.getTime() + ((rule.weekday - start.getUTCDay() + 7) % 7) * dayMs; day < end.getTime(); day += 7 * dayMs) {
    dates.push(new Date(new Date(day).toISOString().slice(0, 10) + "T" + rule.time + ":00+07:00"));
  }
  return dates;
}
