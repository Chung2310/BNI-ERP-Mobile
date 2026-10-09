import { friendlyErrorMessage } from "@/utils/userFacingError";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let persistAccessToken: ((token: string) => Promise<void>) | null = null;

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(friendlyErrorMessage(message, status === 0 || status === 408
      ? "Không thể kết nối. Hãy kiểm tra mạng rồi thử lại."
      : status >= 500 ? "Hệ thống đang bận. Vui lòng thử lại sau."
      : "Không thể thực hiện yêu cầu. Vui lòng thử lại."));
    this.name = "ApiError";
  }
}

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function setApiTokenPersister(persister: (token: string) => Promise<void>) {
  persistAccessToken = persister;
}

async function parsePayload(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiError("Hệ thống đang bận. Vui lòng thử lại sau.", response.status);
  }
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(API_URL + "/api/v1/auth/refresh-token", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
  })
    .then(async (response) => {
      const payload = await parsePayload(response);
      const token = typeof payload.accessToken === "string" ? payload.accessToken : null;
      if (!response.ok || !token) return null;
      accessToken = token;
      await persistAccessToken?.(token);
      return token;
    })
    .catch(() => null)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestInit & { timeoutMs?: number } = {}, hasRetried = false): Promise<T> {
  const { timeoutMs = 15000, ...requestOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let response: Response;
  try {
    response = await fetch(API_URL + path, {
      ...requestOptions,
      signal: controller.signal,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    if (controller.signal.aborted) throw new ApiError("Kết nối quá thời gian. Vui lòng kiểm tra mạng và thử lại.", 408);
    throw new ApiError("Không thể kết nối. Hãy kiểm tra mạng rồi thử lại.", 0);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }

  if (response.status === 401 && !hasRetried && !path.includes("/auth/login") && !path.includes("/auth/refresh-token")) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) return apiRequest<T>(path, options, true);
  }

  const payload = await parsePayload(response);
  if (!response.ok) {
    throw new ApiError(
      typeof payload.message === "string" ? payload.message : "Không thể kết nối máy chủ.",
      response.status,
      typeof payload.code === "string" ? payload.code : undefined,
    );
  }
  return payload as T;
}

export async function apiPostWithUploadProgress<T>(path: string, body: string, onProgress: (fraction: number) => void, hasRetried = false): Promise<T> {
  const { status, payload } = await new Promise<{ status: number; payload: Record<string, unknown> }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL + path);
    xhr.withCredentials = true;
    xhr.timeout = 300000;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", "application/json");
    if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(1, event.loaded / event.total));
    };
    xhr.onerror = () => reject(new ApiError("Không thể kết nối. Hãy kiểm tra mạng rồi thử lại.", 0));
    xhr.onabort = () => reject(new ApiError("Đã dừng tải tệp. Vui lòng thử lại.", 0));
    xhr.ontimeout = () => reject(new ApiError("Kết nối quá thời gian. Vui lòng thử lại.", 408));
    xhr.onload = () => {
      try {
        const parsed: unknown = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        resolve({ status: xhr.status, payload: parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {} });
      } catch {
        if (xhr.status < 200 || xhr.status >= 300) {
          resolve({ status: xhr.status, payload: {} });
        } else {
          reject(new ApiError("Hệ thống đang bận. Vui lòng thử lại sau.", xhr.status));
        }
      }
    };
    xhr.send(body);
  });

  if (status === 401 && !hasRetried) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) return apiPostWithUploadProgress<T>(path, body, onProgress, true);
  }
  if (status < 200 || status >= 300) {
    throw new ApiError(typeof payload.message === "string" ? payload.message : "Không thể tải tệp lên. Vui lòng thử lại.", status);
  }
  return payload as T;
}

export const apiConfig = { baseUrl: API_URL };
