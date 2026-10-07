import { apiRequest } from "@/services/api";

export type Speaker = {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  photoURL?: string;
  coverImage?: string;
  company?: string;
  industry?: string;
  checkedInAt: string;
  seconds: number;
  spokenSeconds?: number;
  deferred?: boolean;
};

export type Meeting = {
  companyCode?: string;
  _id: string;
  seriesId?: string;
  originalStartsAt?: string;
  title: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  gpsRadiusMeters?: number;
  coverImage?: string;
  startsAt: string;
  endsAt?: string;
  startedAt?: string;
  reminderDays: number;
  status: "scheduled" | "live" | "paused" | "ended" | "cancelled";
  revision?: number;
  __v: number;
  currentIndex: number;
  elapsedSeconds?: number;
  speakerStartedAt?: string;
  speechesCompletedAt?: string;
  tiers: SpeakingTimeSlot[];
  fallbackSeconds: number;
  speakers: Speaker[];
  luckyDraw?: LuckyDrawConfig;
  gameWinners?: LuckyDrawWinner[];
};

export type LuckyDrawWinner = {
  id: string;
  source?: "wheel" | "bingo" | "draw";
  prizeId: string;
  prizeName: string;
  winnerId: string;
  userId?: string;
  name: string;
  email?: string;
  photoURL?: string;
  coverImage?: string;
  ticketNumber?: number;
  wonAt: string;
  drawnBy?: string;
  verificationHash?: string;
  seed?: string;
};
export type LuckyDrawPrize = {
  id: string;
  name: string;
  reward: string;
  quantity: number;
  order: number;
  imageUrl?: string;
  color?: string;
  winners: LuckyDrawWinner[];
};
export type LuckyDrawConfig = {
  enabled: boolean;
  allowRepeatWinners: boolean;
  drawMode: "attendees" | "numbers";
  numberMin: number;
  numberMax: number;
  prizes: LuckyDrawPrize[];
};
export type LuckyDraw = {
  meetingId: string;
  attendeesCount: number;
  meetingStarted: boolean;
  status: Meeting["status"];
  speakers: Speaker[];
  luckyDraw: LuckyDrawConfig;
};

export type ProfileSlide = {
  id: string;
  kind: "member" | "guest";
  name: string;
  company: string;
  photoURL: string;
  coverImage: string;
  phone: string;
  email?: string;
  industry: string;
  bio: string;
  address?: string;
  targetMarket?: string;
  galleryImages?: string[];
};
export type SlideDeck = { slides: ProfileSlide[]; version: number };

export type MeetingInteractionStatus = "draft" | "open" | "closed";
export type MeetingInteractionResponseStatus = "pending" | "approved" | "hidden" | "rejected";
export type MeetingInteractionQuestion = { id: string; text: string; order: number; responseCount: number; approvedCount: number };
export type MeetingInteractionSession = {
  id: string;
  meetingId: string;
  question: string;
  activeQuestionId: string;
  questionNumber: number;
  totalQuestions: number;
  questions: MeetingInteractionQuestion[];
  durationSeconds: number;
  openedAt?: string;
  closesAt?: string;
  status: MeetingInteractionStatus;
  requireName: boolean;
  showNames: boolean;
  moderationEnabled: boolean;
  allowMultipleResponses: boolean;
  participationUrl: string;
  responseCount: number;
  approvedCount: number;
};
export type MeetingInteractionResponse = {
  id: string;
  questionId: string;
  participantId: string;
  name: string;
  answer: string;
  status: MeetingInteractionResponseStatus;
  createdAt: string;
};
export type MeetingInteraction = { session: MeetingInteractionSession | null; responses: MeetingInteractionResponse[]; allResponses?: MeetingInteractionResponse[] };
export type MeetingInteractionInput = Pick<MeetingInteractionSession, "question" | "durationSeconds" | "requireName" | "showNames" | "moderationEnabled" | "allowMultipleResponses">;

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
export type MeetingUpdateInput = Partial<Omit<MeetingCreateCommon, "latitude" | "longitude">> & {
  version: number;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  latitude?: number | null;
  longitude?: number | null;
};
export type MeetingSeriesChanges = {
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  gpsRadiusMeters?: number;
  startsTime?: string;
  durationMinutes?: number;
  coverImage?: string;
  tiers?: SpeakingTimeSlot[];
  fallbackSeconds?: number;
};

export const meetingVersion = (meeting: Pick<Meeting, "__v" | "revision">) => meeting.__v ?? meeting.revision ?? 0;

const unwrap = <T>(payload: { data: T }) => payload.data;

export const meetingService = {
  list: (month?: string) => apiRequest<{ data: Meeting[] }>(`/api/v1/meetings${month ? `?month=${month}` : ""}`).then(unwrap),
  history: () => apiRequest<{ data: Meeting[] }>("/api/v1/meetings?history=all").then(unwrap),
  get: (id: string) => apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}`).then(unwrap),
  slides: (id: string) => apiRequest<{ data: SlideDeck }>(`/api/v1/meetings/${encodeURIComponent(id)}/slides`).then(unwrap),
  checkIn: (id: string, payload?: { latitude?: number; longitude?: number; name?: string; email?: string }) =>
    apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}/checkin`, { method: "POST", body: JSON.stringify(payload || {}) }).then(unwrap),
  control: (id: string, action: "start" | "pause" | "resume" | "next" | "previous" | "finish" | "cancel" | "start_speaker" | "reset_speaker", version: number) =>
    apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}/control`, { method: "POST", body: JSON.stringify({ action, version }) }).then(unwrap),
  update: (id: string, input: MeetingUpdateInput) =>
    apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }).then(unwrap),
  remove: (id: string) =>
    apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}`, { method: "DELETE" }).then(unwrap),
  deferSpeaker: (id: string, speakerId: string, version: number) =>
    apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}/defer`, { method: "POST", body: JSON.stringify({ speakerId, version }) }).then(unwrap),
  reorderSpeakers: (id: string, speakerIds: string[], version: number) =>
    apiRequest<{ data: Meeting }>(`/api/v1/meetings/${encodeURIComponent(id)}/order`, { method: "PUT", body: JSON.stringify({ speakerIds, version }) }).then(unwrap),
  updateSeries: (id: string, meetingIds: string[], changes: MeetingSeriesChanges) =>
    apiRequest<{ data: Meeting[] }>(`/api/v1/meetings/${encodeURIComponent(id)}/series`, { method: "PUT", body: JSON.stringify({ meetingIds, changes }) }).then(unwrap),
  luckyDraw: (id: string) => apiRequest<{ data: LuckyDraw }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw`).then(unwrap),
  spin: (id: string, prizeId: string) => apiRequest<{ data: { winner: LuckyDrawWinner; prize: LuckyDrawPrize } }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw/spin`, { method: "POST", body: JSON.stringify({ prizeId }) }).then(unwrap),
  updateLuckyDrawConfig: (id: string, input: Partial<Omit<LuckyDrawConfig, "prizes">>) =>
    apiRequest<{ data: LuckyDrawConfig }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw/config`, { method: "PUT", body: JSON.stringify(input) }).then(unwrap),
  savePrize: (id: string, input: Partial<LuckyDrawPrize>) =>
    apiRequest<{ data: LuckyDrawConfig }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw/prizes`, { method: "POST", body: JSON.stringify(input) }).then(unwrap),
  deletePrize: (id: string, prizeId: string) =>
    apiRequest<{ data: LuckyDrawConfig }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw/prizes/${encodeURIComponent(prizeId)}`, { method: "DELETE" }).then(unwrap),
  redrawWinner: (id: string, prizeId: string, winnerRecordId: string) =>
    apiRequest<{ data: LuckyDrawConfig }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw/redraw`, { method: "POST", body: JSON.stringify({ prizeId, winnerRecordId }) }).then(unwrap),
  resetWinners: (id: string, prizeId?: string) =>
    apiRequest<{ data: LuckyDrawConfig }>(`/api/v1/meetings/${encodeURIComponent(id)}/lucky-draw/reset`, { method: "POST", body: JSON.stringify(prizeId ? { prizeId } : {}) }).then(unwrap),
  resolveQr: (token: string) => apiRequest<{ data: { id: string; title: string; startsAt: string; location?: string } }>(`/api/v1/meeting-checkin/${encodeURIComponent(token)}`).then(unwrap),
  interaction: (id: string) => apiRequest<{ data: MeetingInteraction }>(`/api/v1/meetings/${encodeURIComponent(id)}/interaction`).then(unwrap),
  saveInteraction: (id: string, input: MeetingInteractionInput) =>
    apiRequest<{ data: MeetingInteraction }>(`/api/v1/meetings/${encodeURIComponent(id)}/interaction`, { method: "PUT", body: JSON.stringify(input) }).then(unwrap),
  addInteractionQuestion: (id: string, question: string) =>
    apiRequest<{ data: MeetingInteraction }>(`/api/v1/meetings/${encodeURIComponent(id)}/interaction/questions`, { method: "POST", body: JSON.stringify({ question }) }).then(unwrap),
  selectInteractionQuestion: (id: string, questionId: string) =>
    apiRequest<{ data: MeetingInteraction }>(`/api/v1/meetings/${encodeURIComponent(id)}/interaction/questions/${encodeURIComponent(questionId)}/select`, { method: "POST", body: JSON.stringify({}) }).then(unwrap),
  deleteInteractionQuestion: (id: string, questionId: string) =>
    apiRequest<{ data: MeetingInteraction }>(`/api/v1/meetings/${encodeURIComponent(id)}/interaction/questions/${encodeURIComponent(questionId)}`, { method: "DELETE" }).then(unwrap),
  setInteractionStatus: (id: string, status: "open" | "closed") =>
    apiRequest<{ data: MeetingInteraction }>(`/api/v1/meetings/${encodeURIComponent(id)}/interaction/status`, { method: "POST", body: JSON.stringify({ status }) }).then(unwrap),
  moderateInteractionResponse: (id: string, responseId: string, status: Exclude<MeetingInteractionResponseStatus, "pending">) =>
    apiRequest<{ data: MeetingInteraction }>(`/api/v1/meetings/${encodeURIComponent(id)}/interaction/responses/${encodeURIComponent(responseId)}`, { method: "PATCH", body: JSON.stringify({ status }) }).then(unwrap),
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
