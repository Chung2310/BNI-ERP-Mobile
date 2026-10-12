import { apiRequest } from "@/services/api";
import { galleryImagesFrom } from "@/utils/media";
import type { UserProfile, UserRole } from "@/types";

type ApiUser = Omit<UserProfile, "uid"> & { _id?: string; uid?: string; isActive?: boolean };
const normalize = (user: ApiUser): UserProfile & { isActive?: boolean } => {
  const raw = user as Record<string, unknown>;
  const gallery = galleryImagesFrom(raw);
  return {
    ...user,
    uid: user.uid || user._id || "",
    ...(gallery.length > 0 ? { galleryImages: gallery } : {}),
  };
};
export type UserDirectoryPage = {
  items: UserProfile[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

let fallbackDirectory: UserProfile[] | null = null;

const matchesDirectorySearch = (user: UserProfile, search: string) => {
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const fields = [user.displayName, user.email, user.phone, user.phoneNumber, user.companyName, user.industry];
  return normalizeSearch(fields.filter(Boolean).join(" ")).includes(normalizeSearch(search.trim()));
};

const fallbackPage = (users: UserProfile[], page: number, limit: number, search: string): UserDirectoryPage => {
  const matching = search.trim() ? users.filter((user) => matchesDirectorySearch(user, search)) : users;
  const start = (page - 1) * limit;
  const items = matching.slice(start, start + limit);
  return { items, total: matching.length, page, limit, hasMore: start + items.length < matching.length };
};

export const userService = {
  colleagues: (): Promise<UserProfile[]> =>
    apiRequest<any>("/api/v1/auth/users/colleagues").then((payload) => {
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.users) ? payload.users : [];
      return (list as ApiUser[]).map(normalize);
    }),
  list: (): Promise<UserProfile[]> =>
    apiRequest<any>("/api/v1/auth/users").then((payload) => {
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.users) ? payload.users : [];
      return (list as ApiUser[]).map(normalize);
    }),
  directory: async (): Promise<UserProfile[]> => {
    try {
      return await userService.list();
    } catch {
      return userService.colleagues();
    }
  },
  directoryPage: async (page = 1, limit = 20, search = ""): Promise<UserDirectoryPage> => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sort: "displayName" });
      if (search.trim()) params.set("search", search.trim());
      const payload = await apiRequest<any>(`/api/v1/crud/users?${params.toString()}`);
      const raw = Array.isArray(payload?.data) ? payload.data : [];
      const items = (raw as ApiUser[]).map(normalize);
      const total = Number(payload?.total) || items.length;
      // Older servers search `name` instead of the stored `displayName` and return zero.
      if (search.trim() && total === 0) {
        try {
          fallbackDirectory = await userService.directory();
          return fallbackPage(fallbackDirectory, page, limit, search);
        } catch {
          // Keep the server result if the full directory is unavailable.
        }
      }
      return { items, total, page: Number(payload?.page) || page, limit: Number(payload?.limit) || limit, hasMore: page * limit < total };
    } catch {
      if (!fallbackDirectory || page === 1) fallbackDirectory = await userService.directory();
      return fallbackPage(fallbackDirectory, page, limit, search);
    }
  },
  get: async (id: string): Promise<UserProfile> => {
    try {
      const res = await apiRequest<any>(`/api/v1/crud/users/${encodeURIComponent(id)}`);
      const rawUser = res?.data || res;
      if (rawUser && (rawUser.uid || rawUser._id)) {
        return normalize(rawUser);
      }
    } catch {
      // Fall back to searching cached/live directory
    }
    const users = await userService.directory();
    const user = users.find((item: UserProfile) => item.uid === id);
    if (!user) throw new Error("Không tìm thấy thành viên trong đơn vị của bạn.");
    return user;
  },
  create: async (data: {
    displayName: string;
    email?: string;
    password?: string;
    role?: UserRole;
    phone?: string;
    companyName?: string;
    company?: string;
    industry?: string;
    photoURL?: string;
    coverUrl?: string;
    coverImage?: string;
    galleryImages?: string[];
    gender?: "male" | "female" | "other" | "";
    targetMarket?: string;
    address?: string;
    birthDate?: string;
  }): Promise<UserProfile> => {
    const res = await apiRequest<any>("/api/v1/crud/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
    fallbackDirectory = null;
    return normalize(res?.data || res);
  },
  update: async (
    id: string,
    data: {
      displayName?: string;
      email?: string;
      role?: UserRole;
      phone?: string;
      companyName?: string;
      company?: string;
      industry?: string;
      photoURL?: string;
      coverUrl?: string;
      coverImage?: string;
      galleryImages?: string[];
      gender?: "male" | "female" | "other" | "";
      targetMarket?: string;
      address?: string;
      birthDate?: string;
    }
  ): Promise<UserProfile> => {
    const res = await apiRequest<any>(`/api/v1/crud/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    fallbackDirectory = null;
    return normalize(res?.data || res);
  },
  delete: async (id: string): Promise<void> => {
    await apiRequest<any>(`/api/v1/crud/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    fallbackDirectory = null;
  },
};
