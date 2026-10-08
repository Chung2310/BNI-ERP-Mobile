import { apiRequest } from "@/services/api";
import type { UserProfile, UserRole } from "@/types";

type ApiUser = Omit<UserProfile, "uid"> & { _id?: string; uid?: string; isActive?: boolean };
const normalize = (user: ApiUser): UserProfile & { isActive?: boolean } => ({ ...user, uid: user.uid || user._id || "" });
export type UserDirectoryPage = {
  items: UserProfile[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

let fallbackDirectory: UserProfile[] | null = null;

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
  directoryPage: async (page = 1, limit = 20): Promise<UserDirectoryPage> => {
    try {
      const payload = await apiRequest<any>(`/api/v1/crud/users?page=${page}&limit=${limit}&sort=displayName`);
      const raw = Array.isArray(payload?.data) ? payload.data : [];
      const items = (raw as ApiUser[]).map(normalize);
      const total = Number(payload?.total) || items.length;
      return { items, total, page: Number(payload?.page) || page, limit: Number(payload?.limit) || limit, hasMore: page * limit < total };
    } catch {
      if (!fallbackDirectory) fallbackDirectory = await userService.colleagues();
      const start = (page - 1) * limit;
      const items = fallbackDirectory.slice(start, start + limit);
      return { items, total: fallbackDirectory.length, page, limit, hasMore: start + items.length < fallbackDirectory.length };
    }
  },
  get: async (id: string): Promise<UserProfile> => {
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
