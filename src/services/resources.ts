import * as FileSystem from "expo-file-system/legacy";
import { apiRequest } from "@/services/api";
import { downloadAndOpenFile } from "@/services/fileDownload";

export type ResourceShare = { targetId: string; targetType: "user" | "room"; targetName: string };
export type ResourceItem = {
  _id: string; section: "local"; type: "folder" | "file"; name: string; parentId: string | null;
  fileUrl?: string; mimeType?: string; size?: number; createdAt?: string; deletedAt?: string;
  creatorUid?: string; creatorName?: string; isFixed?: boolean; isShared?: boolean; managedType?: "user" | "system";
};
const path = (id: string) => `/api/v1/resources/${encodeURIComponent(id)}`;
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const resourceService = {
  list: (parentId: string | null = null) => {
    const query = new URLSearchParams({ section: "local" });
    if (parentId) query.set("parentId", parentId);
    return apiRequest<{ items: ResourceItem[] }>(`/api/v1/resources?${query.toString()}`).then((payload) => payload.items || []);
  },
  get: (id: string) => apiRequest<{ item: ResourceItem }>(path(id)).then((payload) => payload.item),
  download: async (item: ResourceItem) => {
    const freshItem = await resourceService.get(item._id);
    if (!freshItem.fileUrl) throw new Error("Tài nguyên này chưa có đường dẫn tệp.");
    await downloadAndOpenFile({
      url: freshItem.fileUrl,
      name: freshItem.name || item.name,
      mimeType: freshItem.mimeType || item.mimeType,
    });
  },
  trash: () => apiRequest<{ items: ResourceItem[] }>("/api/v1/resources/trash").then((payload) => payload.items || []),
  breadcrumb: (id: string) => apiRequest<{ trail: Pick<ResourceItem, "_id" | "name">[] }>(`/api/v1/resources/breadcrumb/${encodeURIComponent(id)}`).then((payload) => payload.trail || []),
  createFolder: (name: string, parentId: string | null) => apiRequest<{ item: ResourceItem }>("/api/v1/resources/folder", json("POST", { name, parentId, section: "local" })),
  createFile: (name: string, fileUrl: string, parentId: string | null, mimeType?: string, size?: number) => apiRequest<{ item: ResourceItem }>("/api/v1/resources/file", json("POST", { name, fileUrl, parentId, mimeType, size })),
  uploadFile: async (asset: { uri: string; name: string; mimeType?: string; size?: number; base64?: string }) => {
    const mimeType = asset.mimeType || "application/octet-stream";
    let localUri = asset.uri;
    let temporaryUri: string | null = null;
    try {
      // The document provider may return a URI that FileSystem cannot read directly.
      // Work with an app-owned cache file before converting it for the JSON upload API.
      if (!asset.base64 && (!FileSystem.cacheDirectory || !localUri.startsWith(FileSystem.cacheDirectory))) {
        if (!FileSystem.cacheDirectory) throw new Error("Không thể truy cập bộ nhớ tạm để tải tệp lên.");
        temporaryUri = `${FileSystem.cacheDirectory}resource-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await FileSystem.copyAsync({ from: localUri, to: temporaryUri });
        localUri = temporaryUri;
      }
      let base64 = asset.base64;
      if (!base64) {
        base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      }
      return await apiRequest<{ url: string }>("/api/v1/media/upload", {
        ...json("POST", { file: `data:${mimeType};base64,${base64}`, fileName: asset.name, mimeType, size: asset.size }),
        timeoutMs: 300000,
      });
    } catch (cause) {
      if (cause instanceof Error && /(?:permission|EACCES|could not open|failed to read)/i.test(cause.message)) {
        throw new Error("Không đọc được tệp đã chọn. Hãy tải tệp về máy rồi chọn lại từ bộ nhớ thiết bị.");
      }
      throw cause;
    } finally {
      if (temporaryUri) await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    }
  },
  rename: (id: string, name: string) => apiRequest<{ item: ResourceItem }>(`${path(id)}/rename`, json("PATCH", { name })),
  move: (id: string, parentId: string | null) => apiRequest<{ item: ResourceItem }>(`${path(id)}/move`, json("PATCH", { parentId })),
  remove: (id: string) => apiRequest(path(id), { method: "DELETE" }),
  restore: (id: string) => apiRequest(`${path(id)}/restore`, { method: "POST" }),
  shares: (id: string) => apiRequest<{ shares: ResourceShare[] }>(`${path(id)}/shares`).then((payload) => payload.shares || []),
  updateShares: (id: string, shares: ResourceShare[]) => apiRequest<{ shares: ResourceShare[] }>(`${path(id)}/shares`, json("PUT", shares)),
};
