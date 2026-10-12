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
const BIOMETRIC_METHOD_KEY = "igen_biometric_method";

export type BiometricMethod = "fingerprint" | "face";

export type BiometricCapabilities = Record<BiometricMethod, boolean>;

const biometricLabel = (method: BiometricMethod) => method === "face" ? "Face ID" : "vân tay";

async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  if (!(await SecureStore.canUseBiometricAuthentication())) return { fingerprint: false, face: false };
  const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const isUsable = hasHardware && isEnrolled;
  return {
    fingerprint: isUsable && supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
    face: isUsable && supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
  };
}

async function hasUsableBiometrics(method?: BiometricMethod) {
  const capabilities = await getBiometricCapabilities();
  return method ? capabilities[method] : capabilities.fingerprint || capabilities.face;
}

async function getStoredBiometricMethod(): Promise<BiometricMethod | null> {
  const storedMethod = await SecureStore.getItemAsync(BIOMETRIC_METHOD_KEY);
  if (storedMethod === "fingerprint" || storedMethod === "face") return storedMethod;

  // Migrate the previous single biometric switch without making existing users configure it again.
  if ((await SecureStore.getItemAsync(BIOMETRIC_KEY)) !== "true") return null;
  const capabilities = await getBiometricCapabilities();
  const migratedMethod = capabilities.face && !capabilities.fingerprint ? "face" : "fingerprint";
  if (!capabilities[migratedMethod]) return null;
  await SecureStore.setItemAsync(BIOMETRIC_METHOD_KEY, migratedMethod);
  return migratedMethod;
}

async function authenticateWithBiometrics(promptMessage: string, method: BiometricMethod) {
  if (!(await hasUsableBiometrics(method))) {
    throw new Error(`Thiết bị chưa hỗ trợ hoặc chưa cài đặt ${biometricLabel(method)}.`);
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
      : `Không xác thực được ${biometricLabel(method)}. Vui lòng thử lại.`);
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
    SecureStore.deleteItemAsync(BIOMETRIC_METHOD_KEY),
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
    const [token, rawProfile, biometricMethod] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(PROFILE_KEY),
      getStoredBiometricMethod(),
    ]);
    if (!token || !rawProfile) return null;
    if (biometricMethod && !options.bypassBiometricGate) return null;
    setApiAccessToken(token);
    return { token, user: JSON.parse(rawProfile) as UserProfile };
  },

  async canUseBiometricLogin() {
    return Boolean(await this.getBiometricLoginMethod());
  },

  async getBiometricLoginMethod(): Promise<BiometricMethod | null> {
    const [method, token, profile] = await Promise.all([
      getStoredBiometricMethod(),
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(PROFILE_KEY),
    ]);
    if (!method || !token || !profile || !(await hasUsableBiometrics(method))) return null;
    return method;
  },

  async loginWithBiometrics() {
    const method = await this.getBiometricLoginMethod();
    if (!method) throw new Error("Chưa thiết lập đăng nhập sinh trắc học.");
    await authenticateWithBiometrics(`Đăng nhập iGen Connect bằng ${biometricLabel(method)}`, method);
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
    return Boolean(await getStoredBiometricMethod());
  },

  async getBiometricMethod() {
    return getStoredBiometricMethod();
  },

  async setBiometricMethod(method: BiometricMethod | null) {
    if (method) {
      await authenticateWithBiometrics(`Xác nhận bật đăng nhập/check-in bằng ${biometricLabel(method)}`, method);
      await SecureStore.setItemAsync(BIOMETRIC_METHOD_KEY, method);
      await SecureStore.setItemAsync(BIOMETRIC_KEY, "true");
      return;
    }
    await Promise.all([
      SecureStore.deleteItemAsync(BIOMETRIC_METHOD_KEY),
      SecureStore.setItemAsync(BIOMETRIC_KEY, "false"),
    ]);
  },

  async setBiometricEnabled(enabled: boolean) {
    if (!enabled) return this.setBiometricMethod(null);
    const capabilities = await getBiometricCapabilities();
    const method: BiometricMethod = capabilities.face && !capabilities.fingerprint ? "face" : "fingerprint";
    return this.setBiometricMethod(method);
  },

  async authenticateForCheckIn() {
    const method = await getStoredBiometricMethod();
    if (!method) return;
    await authenticateWithBiometrics(`Xác nhận check-in bằng ${biometricLabel(method)}`, method);
  },

  hasUsableBiometrics,
  getBiometricCapabilities,
};
