const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let persistAccessToken: ((token: string) => Promise<void>) | null = null;

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
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
    throw new ApiError("Máy chủ trả về dữ liệu không hợp lệ.", response.status);
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
  } catch (cause) {
    if (controller.signal.aborted) throw new ApiError("Kết nối quá thời gian. Vui lòng kiểm tra mạng và thử lại.", 408);
    throw new ApiError(cause instanceof Error ? cause.message : "Không thể kết nối máy chủ.", 0);
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

export const apiConfig = { baseUrl: API_URL };
