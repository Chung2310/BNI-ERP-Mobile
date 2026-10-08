import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useState } from "react";
import { Redirect } from "expo-router";
import { Check, ChevronRight, Plus, Search } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Alert } from "@/components/AppAlert";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PermissionDefinition, RolePermission, roleService } from "@/services/roles";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { canAccessSystem, canCreateMember } from "@/utils/permissions";

type Draft = { role: string; displayName: string; level: string; permissions: string[] };
const defaultLevels: Record<string, number> = { admin: 1, manager: 2, teacher: 3, user: 3 };
const toDraft = (role: RolePermission): Draft => ({
  role: role.role,
  displayName: role.displayName || "",
  level: String(role.level),
  permissions: role.permissions.filter((code) => code !== "*"),
});
const errorMessage = (error: unknown) => friendlyErrorMessage(error, "Có lỗi xảy ra. Vui lòng thử lại.");

export default function AdminRolesScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = canAccessSystem(user);
  const canManage = canCreateMember(user);
  const { data: roles, error, isLoading, reload } = useAsyncData(
    () => canRead ? roleService.list() : Promise.reject(new Error("Bạn không có quyền xem cấu hình vai trò.")),
    String(canRead),
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RolePermission | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>([]);
  const [busy, setBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = (roles || []).filter((role) =>
    `${role.displayName || ""} ${role.role}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi").trim()),
  );
  const callerLevel = (roles || []).find((role) => role.role === user?.role)?.level || defaultLevels[user?.role || ""] || 4;
  const protectedRole = (role: RolePermission) => role.role === "admin" || role.role === user?.role || (user?.role !== "admin" && role.level <= callerLevel);

  const openDetail = async (role: RolePermission) => {
    setDetailLoading(true);
    try {
      setSelected(await roleService.get(role.role));
    } catch (cause) {
      Alert.alert("Không thể mở vai trò", errorMessage(cause));
    } finally {
      setDetailLoading(false);
    }
  };

  const openEditor = async (role?: RolePermission) => {
    setBusy(true);
    try {
      const definitions = await roleService.permissions();
      setCatalog(definitions.filter((item) => item.code !== "*" && /:(read|manage)$/.test(item.code)));
      setDraft(role ? toDraft(role) : { role: "", displayName: "", level: String(callerLevel + 1), permissions: [] });
    } catch (cause) {
      Alert.alert("Không thể tải danh mục quyền", errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft || busy) return;
    const role = draft.role.trim();
    const level = Number(draft.level);
    if (!role || /\s/.test(role) || role === "admin") {
      Alert.alert("Vai trò không hợp lệ", "Nhập mã vai trò không có khoảng trắng và khác admin.");
      return;
    }
    if (!Number.isInteger(level) || level <= callerLevel) {
      Alert.alert("Cấp bậc không hợp lệ", `Cấp bậc phải là số nguyên lớn hơn cấp của bạn (${callerLevel}). Số nhỏ hơn là cấp cao hơn.`);
      return;
    }
    setBusy(true);
    try {
      await roleService.save({ role, level, displayName: draft.displayName.trim(), permissions: draft.permissions });
      const updated = await roleService.get(role);
      setSelected(updated);
      setDraft(null);
      await reload();
      Alert.alert("Đã lưu", `Phân quyền của ${updated.displayName || updated.role} đã được cập nhật.`);
    } catch (cause) {
      Alert.alert("Không thể lưu vai trò", errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = (role: RolePermission) => {
    Alert.alert(
      "Xóa cấu hình vai trò?",
      `Cấu hình phân quyền của ${role.displayName || role.role} sẽ bị xóa. Tài khoản đang mang vai trò này vẫn được giữ lại.`,
      [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa cấu hình", style: "destructive", onPress: () => {
          setBusy(true);
          void roleService.remove(role.role).then(async () => {
            setSelected(null);
            await reload();
            Alert.alert("Đã xóa", "Cấu hình phân quyền đã được xóa.");
          }).catch((cause: unknown) => Alert.alert("Không thể xóa vai trò", errorMessage(cause)))
            .finally(() => setBusy(false));
        } },
      ],
    );
  };

  const togglePermission = (code: string) => setDraft((current) => current ? ({
    ...current,
    permissions: current.permissions.includes(code)
      ? current.permissions.filter((item) => item !== code)
      : [...current.permissions, code],
  }) : current);

  const groups = catalog.reduce<Record<string, PermissionDefinition[]>>((result, item) => {
    const key = item.group || item.module;
    (result[key] ||= []).push(item);
    return result;
  }, {});

  if (isAuthLoading) return null;
  if (!canRead) return <Redirect href="/(tabs)" />;

  if (draft) return <Screen scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}>
    <BackHeader title={selected ? "Sửa vai trò" : "Thêm vai trò"} compact onBack={() => setDraft(null)} />
    <Text style={styles.hint}>Số cấp bậc càng nhỏ thì quyền hạn càng cao. Chỉ chọn các quyền mà vai trò cần dùng.</Text>
    <Text style={styles.label}>Mã vai trò</Text>
    <TextInput style={[styles.input, selected && styles.readOnly]} value={draft.role} editable={!selected} autoCapitalize="none" placeholder="Ví dụ: manager" onChangeText={(role) => setDraft({ ...draft, role })} />
    <Text style={styles.label}>Tên hiển thị</Text>
    <TextInput style={styles.input} value={draft.displayName} placeholder="Tên vai trò" onChangeText={(displayName) => setDraft({ ...draft, displayName })} />
    <Text style={styles.label}>Cấp bậc</Text>
    <TextInput style={styles.input} value={draft.level} keyboardType="number-pad" placeholder="3" onChangeText={(level) => setDraft({ ...draft, level })} />
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Quyền hạn</Text><Badge>{draft.permissions.length} đã chọn</Badge></View>
    {Object.entries(groups).map(([group, items]) => <Card key={group} style={styles.groupCard}>
      <Text style={styles.groupTitle}>{group}</Text>
      {items.map((item) => <Pressable key={item.code} accessibilityRole="checkbox" accessibilityState={{ checked: draft.permissions.includes(item.code) }} onPress={() => togglePermission(item.code)} style={styles.permissionRow}>
        <View style={[styles.checkbox, draft.permissions.includes(item.code) && styles.checkboxChecked]}>{draft.permissions.includes(item.code) ? <Check size={15} color="#FFFFFF" /> : null}</View>
        <View style={styles.flex}><Text style={styles.permissionName}>{item.name || item.code}</Text><Text style={styles.permissionCode}>{item.code}</Text></View>
      </Pressable>)}
    </Card>)}
    <Button fullWidth disabled={busy} onPress={() => void save()}>{busy ? "Đang lưu..." : "Lưu phân quyền"}</Button>
  </Screen>;

  if (selected) return <Screen>
    <BackHeader title={selected.displayName || selected.role} subtitle={`Vai trò ${selected.role}`} compact onBack={() => setSelected(null)} />
    <Card>
      <View style={styles.row}><Text style={styles.name}>Thông tin vai trò</Text><Badge>Cấp {selected.level}</Badge></View>
      <Text style={styles.meta}>Doanh nghiệp: {selected.companyCode}</Text>
      <Text style={styles.meta}>Mã vai trò: {selected.role}</Text>
    </Card>
    <Text style={styles.sectionTitle}>Quyền đã cấp ({selected.permissions.length})</Text>
    <Card>{selected.permissions.length ? selected.permissions.map((code) => <Text key={code} style={styles.detailPermission}>• {code}</Text>) : <Text style={styles.meta}>Vai trò chưa được cấp quyền.</Text>}</Card>
    {canManage && !protectedRole(selected) ? <View style={styles.actions}>
      <Button style={styles.flex} disabled={busy} onPress={() => void openEditor(selected)}>{busy ? "Đang tải..." : "Chỉnh sửa"}</Button>
      <Button style={styles.flex} tone="danger" disabled={busy} onPress={() => remove(selected)}>Xóa</Button>
    </View> : null}
    {protectedRole(selected) && canManage ? <Text style={styles.hint}>Bạn không thể thay đổi vai trò admin, vai trò của mình hoặc vai trò có cấp bậc cao hơn.</Text> : null}
  </Screen>;

  return <Screen>
    <BackHeader title="Vai trò & phân quyền" compact action={canManage ? <Pressable accessibilityRole="button" accessibilityLabel="Thêm vai trò" style={styles.addButton} disabled={busy} onPress={() => void openEditor()}><Plus color="#FFFFFF" size={22} /></Pressable> : null} />
    <Text style={styles.hint}>Quản lý quyền truy cập của các vai trò trong doanh nghiệp.</Text>
    {isLoading || detailLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : <>
      <View style={styles.search}><Search color={colors.muted} size={18} /><TextInput style={styles.searchInput} value={query} placeholder="Tìm vai trò" onChangeText={setQuery} /></View>
      {!filtered.length ? <EmptyState title={query ? "Không tìm thấy vai trò" : "Chưa có vai trò"} message={query ? "Thử tên hoặc mã vai trò khác." : "Chưa có cấu hình phân quyền riêng cho doanh nghiệp."} /> : filtered.map((role) => <Pressable key={`${role.companyCode}-${role.role}`} accessibilityRole="button" onPress={() => void openDetail(role)}>
        <Card style={styles.listCard}><View style={styles.row}><View style={styles.flex}><Text style={styles.name}>{role.displayName || role.role}</Text><Text style={styles.meta}>{role.role} · Cấp {role.level}</Text></View><Badge>{role.permissions.length} quyền</Badge><ChevronRight size={18} color={colors.muted} /></View></Card>
      </Pressable>)}
    </>}
    {busy ? <ActivityIndicator color={colors.primary} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { marginTop: spacing.xs, color: colors.muted, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
  addButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primary },
  search: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  listCard: { marginBottom: spacing.sm },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: spacing.xs },
  input: { minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, marginBottom: spacing.md },
  readOnly: { backgroundColor: colors.background, color: colors.muted },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginVertical: spacing.sm },
  groupCard: { marginBottom: spacing.sm },
  groupTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  permissionRow: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  permissionName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  permissionCode: { color: colors.muted, fontSize: 11 },
  detailPermission: { color: colors.primaryDark, fontSize: 13, lineHeight: 24 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
});
