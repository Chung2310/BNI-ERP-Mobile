import { apiRequest } from "@/services/api";

export type ResourceItem = { _id: string; type: "folder" | "file"; name: string; parentId: string | null; fileUrl?: string; mimeType?: string; size?: number; createdAt: string };

export const resourceService = {
  list: (parentId: string | null = null) => {
    const query = new URLSearchParams({ section: "local" });
    if (parentId) query.set("parentId", parentId);
    return apiRequest<{ items: ResourceItem[] }>(`/api/v1/resources?${query.toString()}`).then((payload) => payload.items || []);
  },
};
