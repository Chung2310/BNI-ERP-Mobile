import type { UserProfile } from "@/types";

export function hasPermission(user: UserProfile | null, ...permissions: string[]) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return permissions.some((permission) => user.permissions?.includes(permission));
}

export function canCreateMeeting(user: UserProfile | null) {
  const organizerRole = user?.role === "admin" || user?.role === "manager" || user?.role === "branch_owner";
  return organizerRole && hasPermission(user, "meetings:manage", "access:manage");
}

export function canCreateMember(user: UserProfile | null) {
  const managerRole = user?.role === "admin" || user?.role === "manager" || user?.role === "branch_owner";
  return managerRole && hasPermission(user, "access:manage");
}

export function canAccessSystem(user: UserProfile | null) {
  const managerRole = user?.role === "admin" || user?.role === "manager" || user?.role === "branch_owner";
  return managerRole && hasPermission(user, "access:read", "access:manage");
}
