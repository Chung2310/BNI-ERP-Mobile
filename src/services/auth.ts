import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { ApiError, apiRequest, getApiAccessToken, setApiAccessToken, setApiTokenPersister } from "@/services/api";
import { galleryImagesFrom } from "@/utils/media";
import { unregisterCurrentDeviceFromPush } from "@/services/pushNotifications";
import type { UserProfile } from "@/types";

const ACCESS_TOKEN_KEY = "igen_access_token";
const PROFILE_KEY = "igen_user_profile";
export const MAX_SELF_PROFILE_IMAGE_BASE64_LENGTH = Math.ceil((5 * 1024 * 1024) / 3) * 4;
const DEVICE_KEY = "igen_device_id";
const BIOMETRIC_KEY = "igen_biometric_enabled";
const BIOMETRIC_METHOD_KEY = "igen_biometric_method";

export type BiometricMethod = "fingerprint" | "face";

export type BiometricCapabilities = Record<BiometricMethod, boolean>;

async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
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

async function getStoredBiometricEnabled() {
  const [enabled, legacyMethod] = await Promise.all([
    SecureStore.getItemAsync(BIOMETRIC_KEY),
    SecureStore.getItemAsync(BIOMETRIC_METHOD_KEY),
  ]);
  // A selected method from the previous version means biometrics were enabled.
  return enabled === "true" || legacyMethod === "fingerprint" || legacyMethod === "face";
}

async function authenticateWithBiometrics(promptMessage: string) {
  if (!(await hasUsableBiometrics())) {
    throw new Error("Thiết bị chưa hỗ trợ hoặc chưa cài đặt sinh trắc học.");
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Hủy",
    fallbackLabel: "Dùng tài khoản",
    disableDeviceFallback: true,
    // Android Class 2 enables camera-based face recognition while still allowing fingerprints.
    biometricsSecurityLevel: "weak",
  });
  if (!result.success) {
    throw new Error(result.error === "user_cancel"
      ? "Đã hủy xác thực sinh trắc học."
      : "Không xác thực được sinh trắc học. Vui lòng thử lại.");
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
  register(data: { displayName: string; email: string; phone: string; companyName: string; industry: string; password: string }) {
    return apiRequest("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async uploadRegistrationAvatar(asset: ImagePickerAsset): Promise<string> {
    const form = new FormData();
    const name = asset.fileName || "avatar.jpg";
    if (Platform.OS === "web" && asset.file) {
      form.append("avatar", asset.file, name);
    } else {
      form.append("avatar", { uri: asset.uri, name, type: asset.mimeType || "image/jpeg" } as unknown as Blob);
    }
    const response = await apiRequest<{ data: { photoURL: string } }>("/api/v1/auth/profile/avatar", {
      method: "POST",
      body: form,
      timeoutMs: 120000,
    });
    if (!response.data?.photoURL) throw new Error("Máy chủ chưa lưu ảnh đại diện. Vui lòng thử lại.");
    return response.data.photoURL;
  },
  async uploadSelfProfileImage(base64: string, kind: "avatar" | "cover", asset?: ImagePickerAsset): Promise<string> {
    if (!base64) throw new Error("Không đọc được dữ liệu ảnh. Vui lòng chọn lại.");
    if (base64.length > MAX_SELF_PROFILE_IMAGE_BASE64_LENGTH) throw new Error("Ảnh hồ sơ tối đa 5 MB. Vui lòng chọn ảnh nhỏ hơn.");
    let response: { data: { photoURL?: string; coverImage?: string } };
    try {
      response = await apiRequest("/api/v1/auth/profile/image", {
        method: "POST",
        body: JSON.stringify({ kind, file: `data:image/jpeg;base64,${base64}` }),
        timeoutMs: 120000,
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        if (kind === "avatar" && asset) return this.uploadRegistrationAvatar(asset);
        throw new Error("Máy chủ chưa cập nhật chức năng tải ảnh bìa. Vui lòng thử lại sau khi cập nhật máy chủ.");
      }
      throw cause;
    }
    const url = kind === "avatar" ? response.data?.photoURL : response.data?.coverImage;
    if (!url) throw new Error("Máy chủ chưa lưu ảnh hồ sơ. Vui lòng thử lại.");
    return url;
  },
  async cacheProfile(profile: UserProfile): Promise<void> {
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
  },
  async getProfile(): Promise<UserProfile> {
    const response = await apiRequest<{ user: LoginResponse["user"] }>("/api/v1/auth/me");
    const user = normalizeUser(response.user);
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(user));
    return user;
  },

  async updateProfile(data: Partial<{
    displayName: string; email: string; phone: string; companyName: string; industry: string;
    address: string; targetMarket: string; birthDate: string; gender: string;
    photoURL?: string; photoUploadToken?: string; coverImage?: string; coverUploadToken?: string;
    galleryImages?: string[];
    galleryUploadTokens?: { index: number; uploadToken: string }[];
  }>): Promise<UserProfile> {
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
      getStoredBiometricEnabled(),
    ]);
    if (!token || !rawProfile) return null;
    if (biometricEnabled && !options.bypassBiometricGate) return null;
    setApiAccessToken(token);
    return { token, user: JSON.parse(rawProfile) as UserProfile };
  },

  async canUseBiometricLogin() {
    const [enabled, token, profile] = await Promise.all([
      getStoredBiometricEnabled(),
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(PROFILE_KEY),
    ]);
    return enabled && Boolean(token && profile) && await hasUsableBiometrics();
  },

  async loginWithBiometrics() {
    if (!(await this.canUseBiometricLogin())) throw new Error("Chưa thiết lập đăng nhập sinh trắc học.");
    await authenticateWithBiometrics("Đăng nhập iGen Connect bằng sinh trắc học");
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
    return getStoredBiometricEnabled();
  },

  async setBiometricEnabled(enabled: boolean) {
    if (enabled) await authenticateWithBiometrics("Xác nhận bật đăng nhập/check-in bằng sinh trắc học");
    await Promise.all([
      SecureStore.setItemAsync(BIOMETRIC_KEY, String(enabled)),
      SecureStore.deleteItemAsync(BIOMETRIC_METHOD_KEY),
    ]);
  },

  async authenticateForCheckIn() {
    if (!(await getStoredBiometricEnabled())) return;
    await authenticateWithBiometrics("Xác nhận check-in bằng sinh trắc học");
  },

  hasUsableBiometrics,
  getBiometricCapabilities,
};
