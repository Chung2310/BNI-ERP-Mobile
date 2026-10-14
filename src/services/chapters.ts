import { apiRequest } from "@/services/api";
import { userService } from "@/services/users";
import type { UserProfile } from "@/types";

export type ChapterOverview = {
  code: string;
  name: string;
  chapterRegion?: string;
  chapterAddress?: string;
  chairpersonName?: string;
  memberCount: number;
  completedMeetingCount?: number;
};

export type ChapterApplication = {
  _id: string;
  createdAt: string;
  decidedAt?: string;
  chapterCode?: string;
  status?: "pending" | "approved" | "rejected" | "withdrawn" | "superseded";
  profileSnapshot?: {
    displayName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    industry?: string;
    photoURL?: string;
    referral?: string;
    note?: string;
  };
};

export type OpenChapter = Pick<ChapterOverview, "code" | "name" | "chapterRegion" | "chapterAddress" | "chairpersonName">;

export type ChapterLeaveRequest = {
  _id: string;
  chapterCode: string;
  status: "pending" | "approved" | "withdrawn";
  createdAt: string;
  decidedAt?: string;
  userId?: string | { _id: string; displayName?: string; email?: string };
};

export const chapterService = {
  leaveRequests: (): Promise<ChapterLeaveRequest[]> =>
    apiRequest<{ data: ChapterLeaveRequest[] }>("/api/v1/chapters/me/leave-requests").then((response) => response.data),
  pendingLeaveRequests: (): Promise<ChapterLeaveRequest[]> =>
    apiRequest<{ data: ChapterLeaveRequest[] }>("/api/v1/chapters/admin/leave-requests").then((response) => response.data),
  requestLeave: (): Promise<ChapterLeaveRequest> =>
    apiRequest<{ data: ChapterLeaveRequest }>("/api/v1/chapters/me/leave-requests", {
      method: "POST",
      body: JSON.stringify({ reason: "" }),
    }).then((response) => response.data),
  openChapters: (): Promise<OpenChapter[]> =>
    apiRequest<{ data: OpenChapter[] }>("/api/v1/chapters/").then((response) => response.data),
  myApplications: (): Promise<ChapterApplication[]> =>
    apiRequest<{ data: ChapterApplication[] }>("/api/v1/chapters/me/applications").then((response) => response.data),
  apply: (chapterCode: string): Promise<ChapterApplication> =>
    apiRequest<{ data: ChapterApplication }>("/api/v1/chapters/me/applications", {
      method: "POST",
      body: JSON.stringify({ chapterCode }),
    }).then((response) => response.data),
  changeApplication: (id: string, chapterCode: string): Promise<ChapterApplication> =>
    apiRequest<{ data: ChapterApplication }>(`/api/v1/chapters/me/applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ chapterCode }),
    }).then((response) => response.data),
  cancelApplication: (id: string): Promise<ChapterApplication> =>
    apiRequest<{ data: ChapterApplication }>(`/api/v1/chapters/me/applications/${encodeURIComponent(id)}/withdraw`, {
      method: "POST",
    }).then((response) => response.data),
  overview: (code: string): Promise<ChapterOverview> =>
    apiRequest<{ data: ChapterOverview }>(`/api/v1/chapters/directory/${encodeURIComponent(code)}`)
      .then((response) => response.data),
  pendingApplications: (): Promise<ChapterApplication[]> =>
    apiRequest<{ data: ChapterApplication[] }>("/api/v1/chapters/admin/applications")
      .then((response) => response.data),
  decideApplication: (id: string, decision: "approved" | "rejected"): Promise<ChapterApplication> =>
    apiRequest<{ data: ChapterApplication }>(`/api/v1/chapters/admin/applications/${encodeURIComponent(id)}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }).then((response) => response.data),
  chairperson: async (name: string): Promise<UserProfile | null> => {
    const colleagues = await userService.colleagues();
    const matches = colleagues.filter((person) =>
      person.role === "admin" && person.displayName.trim().toLocaleLowerCase("vi") === name.trim().toLocaleLowerCase("vi"));
    if (matches.length !== 1) return null;
    return userService.get(matches[0].uid);
  },
};
