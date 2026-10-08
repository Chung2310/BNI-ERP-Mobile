import { apiRequest } from "@/services/api";

export type RolePermission = {
  _id?: string;
  companyCode: string;
  role: string;
  permissions: string[];
  level: number;
  displayName?: string;
};

export type PermissionDefinition = {
  code: string;
  name: string;
  module: string;
  group?: string;
  action?: "read" | "manage";
  description?: string;
};

type Page<T> = { data: T[]; total: number; page: number; limit: number };

async function listAll<T>(path: string): Promise<T[]> {
  const result: T[] = [];
  let page = 1;
  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await apiRequest<Page<T>>(`${path}${separator}page=${page}&limit=100`);
    result.push(...(response.data || []));
    if (!response.data?.length || result.length >= response.total) return result;
    page += 1;
  }
}

export const roleService = {
  list: () => listAll<RolePermission>("/api/v1/role-permissions"),
  get: (role: string) => apiRequest<{ data: RolePermission }>(`/api/v1/role-permissions/${encodeURIComponent(role)}`).then((response) => response.data),
  save: (role: Pick<RolePermission, "role" | "level" | "permissions" | "displayName">) =>
    apiRequest<{ data: { rolePermission: RolePermission; stored: string[]; effective: string[] } }>("/api/v1/role-permissions", {
      method: "POST",
      body: JSON.stringify(role),
    }),
  remove: (role: string) => apiRequest(`/api/v1/role-permissions/${encodeURIComponent(role)}`, { method: "DELETE" }),
  permissions: () => listAll<PermissionDefinition>("/api/v1/permissions"),
};
