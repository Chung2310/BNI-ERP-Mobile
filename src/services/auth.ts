import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { apiRequest, getApiAccessToken, setApiAccessToken, setApiTokenPersister } from "@/services/api";
import { galleryImagesFrom } from "@/utils/media";
import { unregisterCurrentDeviceFromPush } from "@/services/pushNotifications";
import type { UserProfile } from "@/types";

const ACCESS_TOKEN_KEY = "igen_access_token";
const PROFILE_KEY = "igen_user_profile";
const DEVICE_KEY = "igen_device_id";
const BIOMETRIC_KEY = "igen_biometric_enabled";

async function hasUsableBiometrics() {
  if (!(await SecureStore.canUseBiometricAuthentication())) return false;
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

async function authenticateWithBiometrics(promptMessage: string) {
  if (!(await hasUsableBiometrics())) {
    throw new Error("Thiết bị chưa hỗ trợ hoặc chưa cài đặt Face ID/vân tay.");
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Hủy",
    fallbackLabel: "Dùng tài khoản",
    disableDeviceFallback: true,
    biometricsSecurityLevel: "strong",
  });
  if (!result.success) {
    throw new Error(result.error === "user_cancel"
      ? "Đã hủy xác thực sinh trắc học."
      : "Không xác thực được Face ID/vân tay. Vui lòng thử lại.");
  }
}

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
  const raw = user as Record<string, unknown>;
  const gallery = galleryImagesFrom(raw);
  return {
    ...user,
    uid: user.uid || user._id || "",
    ...(gallery.length > 0 ? { galleryImages: gallery } : {}),
  };
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
    galleryImages?: string[];
    galleryUploadTokens?: { index: number; uploadToken: string }[];
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
    return enabled === "true" && Boolean(token && profile) && await hasUsableBiometrics();
  },

  async loginWithBiometrics() {
    if (!(await this.canUseBiometricLogin())) throw new Error("Chưa thiết lập đăng nhập sinh trắc học.");
    await authenticateWithBiometrics("Đăng nhập iGen Connect");
    const session = await this.restore({ bypassBiometricGate: true });
    if (!session) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại bằng tài khoản.");
    try {
      const user = await this.getProfile();
      return { token: getApiAccessToken() || session.token, user };
    } catch (error) {
      await clearLocalSession();
      throw error;
    }
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
      await unregisterCurrentDeviceFromPush().catch(() => undefined);
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

  async changePassword(password: string) {
    await apiRequest("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  async isBiometricEnabled() {
    return (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === "true";
  },

  async setBiometricEnabled(enabled: boolean) {
    if (enabled) await authenticateWithBiometrics("Xác nhận bật đăng nhập bằng Face ID/vân tay");
    await SecureStore.setItemAsync(BIOMETRIC_KEY, String(enabled));
  },

  hasUsableBiometrics,
};
