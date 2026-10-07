import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Badge, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { userService } from "@/services/users";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const allowed = hasPermission(user, "access:read", "access:manage");
  const { data, error, isLoading, reload } = useAsyncData(() => allowed ? userService.list() : Promise.reject(new Error("Bạn không có quyền xem danh sách người dùng.")), String(allowed));
  const users = useMemo(() => (data || []).filter((item) => `${item.displayName} ${item.email}`.toLowerCase().includes(query.toLowerCase())), [data, query]);
  return <Screen><BackHeader title="Quản trị người dùng" subtitle="Tài khoản, trạng thái và chi nhánh" /><TextInput value={query} onChangeText={setQuery} style={styles.search} placeholder="Tìm tên hoặc email..." placeholderTextColor={colors.muted} />{isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : users.length === 0 ? <EmptyState title="Không tìm thấy" message="Không có người dùng phù hợp." /> : users.map((item) => <Card key={item.uid} style={styles.user}><Avatar initials={item.displayName.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase()} /><View style={styles.grow}><Text style={styles.name}>{item.displayName}</Text><Text style={styles.meta}>{item.email} · {item.branchName || item.companyName || item.companyCode}</Text></View><Badge tone={item.isActive === false ? "warning" : "primary"}>{item.isActive === false ? "Tạm khóa" : item.role}</Badge></Card>)}</Screen>;
}
const styles = StyleSheet.create({ search: { minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text }, user: { flexDirection: "row", alignItems: "center", gap: spacing.md }, grow: { flex: 1 }, name: { color: colors.text, fontSize: 14, fontWeight: "800" }, meta: { marginTop: 3, color: colors.muted, fontSize: 11 } });
