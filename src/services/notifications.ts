import { apiRequest } from "@/services/api";

export type NotificationItem = {
  _id: string;
  title: string;
  body: string;
  type: "kho" | "task" | "training" | "he-thong";
  read: boolean;
  createdAt: string;
  action?: { tab?: string; subTab?: string; feeId?: string };
};
export type NotificationList = { data: NotificationItem[]; total: number; unreadCount: number; page: number; limit: number };

export const notificationService = {
  list: (params: { read?: boolean; type?: NotificationItem["type"]; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams({ limit: String(params.limit || 50) });
    if (params.read !== undefined) query.set("read", String(params.read));
    if (params.type) query.set("type", params.type);
    if (params.page) query.set("page", String(params.page));
    return apiRequest<NotificationList>(`/api/v1/notifications?${query.toString()}`);
  },
  markRead: (id: string) => apiRequest<{ data: NotificationItem }>(`/api/v1/notifications/${id}/read`, { method: "PATCH" }).then((payload) => payload.data),
  markAllRead: () => apiRequest<{ status: string }>("/api/v1/notifications/read-all", { method: "PATCH" }),
};
