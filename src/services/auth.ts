import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { apiRequest, setApiAccessToken, setApiTokenPersister } from "@/services/api";
import type { UserProfile } from "@/types";

const ACCESS_TOKEN_KEY = "igen_access_token";
const PROFILE_KEY = "igen_user_profile";
const DEVICE_KEY = "igen_device_id";
const BIOMETRIC_KEY = "igen_biometric_enabled";
const BIOMETRIC_CHECKIN_KEY = "igen_biometric_checkin_enabled";

type LoginResponse = { accessToken: string; user: Omit<UserProfile, "uid"> & { _id?: string; uid?: string } };
type ProfileResponse = { user: Omit<UserProfile, "uid"> & { _id?: string; uid?: string } };

export type ProfileUpdateInput = Partial<Pick<UserProfile,
  "displayName" | "email" | "photoURL" | "coverImage" | "galleryImages" | "industry" | "phone" | "birthDate" | "address" | "targetMarket" | "companyName"
>> & {
  gender?: UserProfile["gender"] | "";
  photoUploadToken?: string;
  coverUploadToken?: string;
  galleryUploadTokens?: { index: number; uploadToken: string }[];
};

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

async function persistProfile(user: UserProfile) {
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(user));
  return user;
}

async function clearLocalSession() {
  setApiAccessToken(null);
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(PROFILE_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_CHECKIN_KEY),
  ]);
}

async function biometricAvailability() {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  return {
    available: hasHardware && isEnrolled,
    label: hasFace && hasFingerprint ? "Face ID hoặc vân tay" : hasFace ? "Face ID" : hasFingerprint ? "vân tay" : "sinh trắc học",
  };
}

async function authenticateBiometric(promptMessage: string) {
  const availability = await biometricAvailability();
  if (!availability.available) throw new Error("Thiết bị chưa hỗ trợ hoặc chưa cài đặt Face ID/vân tay.");
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Hủy",
    fallbackLabel: "",
    disableDeviceFallback: true,
    biometricsSecurityLevel: "strong",
  });
  if (!result.success) {
    if (result.error === "user_cancel" || result.error === "app_cancel" || result.error === "system_cancel") {
      throw new Error("Bạn đã hủy xác thực sinh trắc học.");
    }
    throw new Error("Không xác thực được Face ID/vân tay. Vui lòng thử lại.");
  }
}

export const authService = {
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
    const [enabled, token, profile, availability] = await Promise.all([
      SecureStore.getItemAsync(BIOMETRIC_KEY),
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(PROFILE_KEY),
      biometricAvailability(),
    ]);
    return enabled === "true" && Boolean(token && profile) && availability.available;
  },

  biometricAvailability,

  async loginWithBiometrics() {
    if (!(await this.canUseBiometricLogin())) throw new Error("Chưa thiết lập đăng nhập sinh trắc học.");
    await authenticateBiometric("Đăng nhập iGen Connect");
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

  async getMe() {
    const response = await apiRequest<ProfileResponse>("/api/v1/auth/me");
    return persistProfile(normalizeUser(response.user));
  },

  async updateProfile(input: ProfileUpdateInput) {
    const response = await apiRequest<ProfileResponse>("/api/v1/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return persistProfile(normalizeUser(response.user));
  },

  uploadProfileImage: (input: { base64: string; fileName: string; mimeType: string; size?: number; sourceType: "profile.avatar" | "profile.cover" | "profile.gallery" }) =>
    apiRequest<{ url: string; uploadToken: string }>("/api/v1/media/upload", {
      method: "POST",
      body: JSON.stringify({
        file: `data:${input.mimeType};base64,${input.base64}`,
        sourceType: input.sourceType,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
      }),
    }),

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
    if (enabled) await authenticateBiometric("Xác nhận bật đăng nhập sinh trắc học");
    await SecureStore.setItemAsync(BIOMETRIC_KEY, String(enabled));
  },

  async isBiometricCheckInEnabled() {
    return (await SecureStore.getItemAsync(BIOMETRIC_CHECKIN_KEY)) === "true";
  },

  async setBiometricCheckInEnabled(enabled: boolean) {
    if (enabled) await authenticateBiometric("Xác nhận bật check-in sinh trắc học");
    await SecureStore.setItemAsync(BIOMETRIC_CHECKIN_KEY, String(enabled));
  },

  async authenticateCheckInIfEnabled() {
    if (!(await this.isBiometricCheckInEnabled())) return false;
    await authenticateBiometric("Xác nhận check-in cuộc họp");
    return true;
  },
};
