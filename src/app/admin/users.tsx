import { useMemo, useState } from "react";
import { Search, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { HeaderAddButton } from "@/components/HeaderAddButton";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { Avatar, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile, UserRole } from "@/types";
import { hasPermission } from "@/utils/permissions";

const roleLabels: Record<UserRole, string> = {
  user: "Thành viên",
  teacher: "Giảng viên",
  manager: "Quản lý",
  branch_owner: "Chủ chi nhánh",
  admin: "Quản trị viên",
};

function organization(user: UserProfile) {
  const company = typeof user.company === "string" ? user.company : user.company?.name;
  return [user.branchName, user.companyName || company || user.companyCode].filter(Boolean).join(" · ");
}

function initials(name: string) {
  return (name || "TV").split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const allowed = hasPermission(user, "access:read", "access:manage");
  const canManage = hasPermission(user, "access:manage");
  const { data, error, isLoading, reload } = useAsyncData(
    () => allowed ? userService.list() : Promise.reject(new Error("Bạn không có quyền xem danh sách người dùng.")),
    String(allowed),
  );
  const users = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return (data || []).filter((item) => !keyword || [item.displayName, item.email, item.phone, organization(item)]
      .some((value) => value?.toLocaleLowerCase("vi").includes(keyword)));
  }, [data, query]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <BackHeader
          title="Quản trị người dùng"
          compact
          action={canManage ? (
            <HeaderAddButton
              accessibilityLabel="Thêm tài khoản"
              onPress={() => setShowCreate(true)}
            />
          ) : undefined}
        />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search color={colors.muted} size={16} />
          <TextInput
            accessibilityLabel="Tìm kiếm người dùng"
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm tên, email hoặc đơn vị"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" hitSlop={8} onPress={() => setQuery("")}>
              <X color={colors.muted} size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : users.length === 0 ? (
        <EmptyState title="Không tìm thấy" message="Không có người dùng phù hợp." />
      ) : (
        <View style={styles.list}>
          <Text style={styles.count}>{query.trim() ? `${users.length} kết quả` : `${users.length} tài khoản`}</Text>
          {users.map((item) => (
            <View key={item.uid} style={styles.userRow}>
              <Avatar initials={initials(item.displayName)} url={item.photoURL} size={38} />
              <View style={styles.userInfo}>
                <Text numberOfLines={1} style={styles.name}>{item.displayName || "Chưa có tên"}</Text>
                <Text numberOfLines={1} style={styles.email}>{item.email || "Chưa có email"}</Text>
                {organization(item) ? <Text numberOfLines={1} style={styles.organization}>{organization(item)}</Text> : null}
              </View>
              <View style={styles.userState}>
                <Text style={[styles.status, item.isActive === false ? styles.inactive : styles.active]}>
                  {item.isActive === false ? "Tạm khóa" : "Hoạt động"}
                </Text>
                <Text numberOfLines={1} style={styles.role}>{roleLabels[item.role] || item.role}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <AddAccountSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          void reload();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: 0, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  pressed: { opacity: 0.75 },
  searchWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchBox: { height: 38, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.pill, backgroundColor: "#F3F6F8", paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: colors.text, fontSize: 12 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  count: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs, color: colors.muted, fontSize: 11 },
  userRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  userInfo: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 13, fontWeight: "700" },
  email: { marginTop: 2, color: colors.muted, fontSize: 11 },
  organization: { marginTop: 2, color: colors.muted, fontSize: 10.5 },
  userState: { maxWidth: 88, alignItems: "flex-end", gap: 3 },
  status: { fontSize: 10.5, fontWeight: "700" },
  active: { color: colors.success },
  inactive: { color: colors.warning },
  role: { color: colors.muted, fontSize: 10, textAlign: "right" },
});
