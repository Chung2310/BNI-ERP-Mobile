import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { apiRequest, setApiAccessToken, setApiTokenPersister } from "@/services/api";
import type { UserProfile } from "@/types";

const ACCESS_TOKEN_KEY = "igen_access_token";
const PROFILE_KEY = "igen_user_profile";
const DEVICE_KEY = "igen_device_id";
const BIOMETRIC_KEY = "igen_biometric_enabled";

type LoginResponse = { accessToken: string; user: Omit<UserProfile, "uid"> & { _id?: string; uid?: string } };

setApiTokenPersister((token) => SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token));

async function deviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);
  if (existing) return existing;
  const next = `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(DEVICE_KEY, next);
  return next;
}

function normalizeUser(user: LoginResponse["user"]): UserProfile {
  return { ...user, uid: user.uid || user._id || "" };
}

async function clearLocalSession() {
  setApiAccessToken(null);
  await Promise.allSettled([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(PROFILE_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_KEY),
  ]);
}

export const authService = {
  async getProfile(): Promise<UserProfile> {
    const response = await apiRequest<{ user: LoginResponse["user"] }>("/api/v1/auth/me");
    const user = normalizeUser(response.user);
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(user));
    return user;
  },

  async updateProfile(data: {
    displayName: string; email: string; phone: string; companyName: string; industry: string;
    address: string; targetMarket: string; birthDate: string; gender: string;
    photoURL?: string; photoUploadToken?: string; coverImage?: string; coverUploadToken?: string;
  }): Promise<UserProfile> {
    const response = await apiRequest<{ user: LoginResponse["user"] }>("/api/v1/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const user = normalizeUser(response.user);
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(user));
    return user;
  },

  async restore(options: { bypassBiometricGate?: boolean } = {}) {
    const [token, rawProfile, biometricEnabled] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(PROFILE_KEY),
      SecureStore.getItemAsync(BIOMETRIC_KEY),
    ]);
    if (!token || !rawProfile) return null;
    if (biometricEnabled === "true" && !options.bypassBiometricGate) return null;
    setApiAccessToken(token);
    return { token, user: JSON.parse(rawProfile) as UserProfile };
  },

  async canUseBiometricLogin() {
    const [enabled, token, profile] = await Promise.all([
      SecureStore.getItemAsync(BIOMETRIC_KEY),
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(PROFILE_KEY),
    ]);
    return enabled === "true" && Boolean(token && profile);
  },

  async loginWithBiometrics() {
    if (!(await this.canUseBiometricLogin())) throw new Error("Chưa thiết lập đăng nhập sinh trắc học.");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Đăng nhập iGen Connect",
      cancelLabel: "Hủy",
      fallbackLabel: "Dùng tài khoản",
    });
    if (!result.success) throw new Error("Không xác thực được. Vui lòng thử lại hoặc dùng tài khoản.");
    const session = await this.restore({ bypassBiometricGate: true });
    if (!session) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại bằng tài khoản.");
    return session;
  },

  async login(identifier: string, password: string) {
    const response = await apiRequest<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      headers: { "x-device-id": await deviceId() },
      body: JSON.stringify({ identifier, password }),
    });
    const user = normalizeUser(response.user);
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, response.accessToken),
      SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(user)),
    ]);
    setApiAccessToken(response.accessToken);
    return { token: response.accessToken, user };
  },

  async logout() {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
    } finally {
      await clearLocalSession();
    }
  },

  async deleteOwnAccount(password: string) {
    await apiRequest("/api/v1/auth/me", {
      method: "DELETE",
      body: JSON.stringify({ password, confirmation: "XÓA TÀI KHOẢN" }),
    });
    await clearLocalSession();
  },

  async isBiometricEnabled() {
    return (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === "true";
  },

  async setBiometricEnabled(enabled: boolean) {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, String(enabled));
  },
};
