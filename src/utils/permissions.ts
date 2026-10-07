import type { UserProfile } from "@/types";

export function hasPermission(user: UserProfile | null, ...permissions: string[]) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return permissions.some((permission) => user.permissions?.includes(permission));
}
