import { apiRequest } from "@/services/api";
import type { UserProfile } from "@/types";

type ApiUser = Omit<UserProfile, "uid"> & { _id?: string; uid?: string; isActive?: boolean };
const normalize = (user: ApiUser): UserProfile & { isActive?: boolean } => ({ ...user, uid: user.uid || user._id || "" });

export const userService = {
  colleagues: () => apiRequest<{ data: ApiUser[] }>("/api/v1/auth/users/colleagues").then((payload) => (payload.data || []).map(normalize)),
  list: () => apiRequest<{ data: ApiUser[] }>("/api/v1/auth/users").then((payload) => (payload.data || []).map(normalize)),
  get: async (id: string) => {
    const users = await apiRequest<{ data: ApiUser[] }>("/api/v1/auth/users/colleagues").then((payload) => (payload.data || []).map(normalize));
    const user = users.find((item) => item.uid === id);
    if (!user) throw new Error("Không tìm thấy thành viên trong đơn vị của bạn.");
    return user;
  },
};
