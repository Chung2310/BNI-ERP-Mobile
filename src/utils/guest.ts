import type { UserProfile } from "@/types";

export function isChapterGuest(user: UserProfile | null | undefined): boolean {
  return Boolean(user && user.role === "user" && !user.companyCode);
}
