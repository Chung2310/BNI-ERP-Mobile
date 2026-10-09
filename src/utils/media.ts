import { apiConfig } from "@/services/api";
import type { UserProfile } from "@/types";

export function mediaUrl(value?: string | null): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:|data:|file:|blob:)/i.test(trimmed)) return trimmed;
  const base = apiConfig.baseUrl.replace(/\/+$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

export function galleryImagesFrom(
  profile?: UserProfile | null | Record<string, unknown>
): string[] {
  if (!profile) return [];
  const raw = profile as Record<string, unknown>;
  const candidates =
    raw.galleryImages ??
    raw.gallery_images ??
    raw.productImages ??
    raw.product_images ??
    raw.activityImages ??
    raw.products ??
    raw.images;

  if (!Array.isArray(candidates)) return [];
  const result: string[] = [];
  for (const item of candidates) {
    let resolved = "";
    if (typeof item === "string") {
      resolved = item;
    } else if (item && typeof item === "object") {
      const img = item as Record<string, unknown>;
      if (typeof img.url === "string") resolved = img.url;
      else if (typeof img.secureUrl === "string") resolved = img.secureUrl;
      else if (typeof img.fileUrl === "string") resolved = img.fileUrl;
      else if (typeof img.image === "string") resolved = img.image;
      else if (typeof img.src === "string") resolved = img.src;
    }
    const clean = mediaUrl(resolved);
    if (clean && !result.includes(clean)) {
      result.push(clean);
    }
  }
  return result;
}
