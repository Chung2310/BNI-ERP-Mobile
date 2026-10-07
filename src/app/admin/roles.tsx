import { StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { roleService } from "@/services/roles";
import { colors, spacing } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

export default function AdminRolesScreen() {
  const { user } = useAuth(); const allowed = hasPermission(user, "access:read", "access:manage");
  const { data, error, isLoading, reload } = useAsyncData(() => allowed ? roleService.list() : Promise.reject(new Error("Bạn không có quyền xem cấu hình vai trò.")), String(allowed));
  return <Screen><BackHeader title="Vai trò & phân quyền" subtitle="Cấu hình hiện tại từ BNI-ERP" />{isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <EmptyState title="Chưa có vai trò" message="Chưa có cấu hình phân quyền riêng cho doanh nghiệp." /> : data.map((role) => <Card key={`${role.companyCode}-${role.role}`}><View style={styles.row}><Text style={styles.name}>{role.displayName || role.role}</Text><Badge>{role.permissions.length} quyền</Badge></View><Text style={styles.meta}>Cấp {role.level} · {role.companyCode}</Text><Text style={styles.permissions}>{role.permissions.join(" · ")}</Text></Card>)}</Screen>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "800" }, meta: { marginTop: spacing.sm, color: colors.muted, fontSize: 12 }, permissions: { marginTop: spacing.md, color: colors.primaryDark, fontSize: 11, lineHeight: 18 } });
