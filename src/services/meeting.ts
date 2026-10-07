import { apiRequest } from "@/services/api";

export type Speaker = {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  photoURL?: string;
  company?: string;
  industry?: string;
  checkedInAt: string;
  seconds: number;
  spokenSeconds?: number;
};

export type Meeting = {
  _id: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
  status: "scheduled" | "live" | "paused" | "ended" | "cancelled";
  revision: number;
  currentIndex: number;
  elapsedSeconds?: number;
  speakerStartedAt?: string;
  speakers: Speaker[];
};

export type LuckyDrawPrize = { id: string; name: string; reward: string; quantity: number; winners: LuckyDrawWinner[] };
export type LuckyDrawWinner = { id: string; name: string; prizeName: string; wonAt: string; photoURL?: string };
export type LuckyDraw = { meetingId: string; attendeesCount: number; status: Meeting["status"]; luckyDraw: { enabled: boolean; prizes: LuckyDrawPrize[] } };
export type MeetingInteraction = { question?: string; status?: "draft" | "open" | "closed"; questions?: { id: string; text: string }[]; responses?: { _id?: string; answer: string; name?: string; status?: string }[] };

export type SpeakingTimeSlot = { startTime: string; endTime: string; seconds: number };
export type MeetingPoint = { latitude: number; longitude: number };
export type MeetingRecurrence = { startDate: string; months: number; weekday: number; time: string; durationMinutes: number };

type MeetingCreateCommon = {
  location: string;
  latitude?: number;
  longitude?: number;
  gpsRadiusMeters: number;
  coverImage: string;
  reminderDays: number;
  tiers: SpeakingTimeSlot[];
  fallbackSeconds: number;
};

export type SingleMeetingInput = MeetingCreateCommon & { title: string; startsAt: string; endsAt: string };
export type RecurringMeetingInput = MeetingCreateCommon & { recurrence: MeetingRecurrence };

const unwrap = <T>(payload: { data: T }) => payload.data;

export const meetingService = {
  list: (month?: string) => apiRequest<{ data: Meeting[] }>(`/api/v1/meetings${month ? `?month=${month}` : ""}`).then(unwrap),
  history: () => apiRequest<{ data: Meeting[] }>("/api/v1/meetings?history=all").then(unwrap),
  get: (id: string) => apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}`).then(unwrap),
  checkIn: (id: string, coordinates?: { latitude: number; longitude: number }) =>
    apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}/checkin`, { method: "POST", body: JSON.stringify(coordinates || {}) }).then(unwrap),
  control: (id: string, action: "start" | "pause" | "resume" | "next" | "previous" | "finish", version: number) =>
    apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}/control`, { method: "POST", body: JSON.stringify({ action, version }) }).then(unwrap),
  luckyDraw: (id: string) => apiRequest<{ data: LuckyDraw }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw`).then(unwrap),
  spin: (id: string, prizeId: string) => apiRequest<{ data: { winner: LuckyDrawWinner; prize: LuckyDrawPrize } }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw/spin`, { method: "POST", body: JSON.stringify({ prizeId }) }).then(unwrap),
  resolveQr: (token: string) => apiRequest<{ data: { id: string; title: string; startsAt: string; location?: string } }>(`/api/v1/meeting-checkin/${encodeURIComponent(token)}`).then(unwrap),
  interaction: (id: string) => apiRequest<{ data: MeetingInteraction }>(`/api/v1/meetings/${encodeURIComponent(id)}/interaction`).then(unwrap),
  create: (input: Pick<SingleMeetingInput, "title" | "location" | "startsAt" | "endsAt"> & Partial<MeetingCreateCommon>) =>
    apiRequest<{ data: Meeting }>("/api/v1/meetings", {
      method: "POST",
      body: JSON.stringify({
        gpsRadiusMeters: 200,
        coverImage: "",
        reminderDays: 1,
        tiers: [
          { startTime: "07:00", endTime: "08:00", seconds: 30 },
          { startTime: "08:00", endTime: "09:00", seconds: 20 },
        ],
        fallbackSeconds: 20,
        ...input,
      }),
    }).then(unwrap),
  createSeries: (input: RecurringMeetingInput) => apiRequest<{ data: Meeting[] }>("/api/v1/meetings/series", { method: "POST", body: JSON.stringify(input) }).then(unwrap),
  uploadCover: (base64: string) => apiRequest<{ url: string }>("/api/v1/media/upload", {
    method: "POST",
    body: JSON.stringify({ file: `data:image/jpeg;base64,${base64}`, folder: "igen_erp/meetings" }),
  }).then((payload) => payload.url),
};
