import { apiRequest } from "@/services/api";

export type ContentReportReason = "harassment" | "sexual" | "violence" | "spam" | "other";
export type ContentSafetyReport = {
  _id: string; targetType: "profile" | "resource"; targetId: string; reason: string;
  details: string; createdAt: string; title: string; attachments: { url: string; name: string }[];
};
export const contentSafetyService = {
  report: (targetType: "profile" | "resource", targetId: string, reason: ContentReportReason, details: string) =>
    apiRequest("/api/v1/content-safety/reports", { method: "POST", body: JSON.stringify({ targetType, targetId, reason, details }) }),
  moderation: () => apiRequest<{ data: ContentSafetyReport[] }>("/api/v1/content-safety/moderation").then(result => result.data),
  resolve: (id: string, action: "approve" | "remove" | "suspend" | "dismiss") =>
    apiRequest("/api/v1/content-safety/moderation/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ action }) }),
};
