import { apiRequest } from "@/services/api";

export type RolePermission = { _id?: string; companyCode: string; role: string; permissions: string[]; level: number; displayName?: string };
export const roleService = { list: () => apiRequest<{ data: RolePermission[] }>("/api/v1/role-permissions").then((payload) => payload.data || []) };
