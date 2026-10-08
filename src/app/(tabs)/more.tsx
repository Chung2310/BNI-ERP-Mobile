import { Redirect, router } from "expo-router";
import { ChevronRight, FolderOpen, Settings, ShieldCheck, UserCog } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, spacing } from "@/theme/tokens";
import { canAccessSystem, hasPermission } from "@/utils/permissions";

export default function MoreScreen() {
  const { user, isLoading } = useAuth();
  const canManageUsers = hasPermission(user, "access:read", "access:manage");
  const canManageRoles = hasPermission(user, "access:read", "access:manage");

  if (isLoading) return null;
  if (!canAccessSystem(user)) return <Redirect href="/(tabs)" />;

  return (
    <Screen style={styles.screen}>
      {/* Header Quản trị hệ thống có nút Back quay về */}
      <View style={styles.headerContainer}>
        <BackHeader
          title="Quản trị hệ thống"
          compact
          onBack={() => router.navigate("/(tabs)")}
        />
      </View>

      {/* Thẻ hồ sơ người dùng thu gọn, gọn gàng */}
      <View style={styles.profileContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem hồ sơ cá nhân"
          onPress={() => router.push("/profile")}
          style={({ pressed }) => [styles.profileCard, pressed && styles.profilePressed]}
        >
          <Avatar
            initials={(user?.displayName || "Admin")
              .split(" ")
              .filter(Boolean)
              .map((part) => part[0])
              .slice(-2)
              .join("")
              .toUpperCase()}
            size={40}
            url={user?.photoURL}
          />
          <View style={styles.profileInfo}>
            <Text numberOfLines={1} style={styles.profileName}>
              {user?.displayName || "Quản trị viên"}
            </Text>
            <Text numberOfLines={1} style={styles.profileMeta}>
              {user?.role || "Quản trị"} · {user?.companyCode || user?.branchName || "iGen Connect"}
            </Text>
          </View>
          <ChevronRight color={colors.muted} size={18} />
        </Pressable>
      </View>

      {/* Danh sách thẻ chức năng hệ thống - Giảm kích thước, gọn gàng và thân thiện */}
      <View style={styles.grid}>
        {canManageUsers ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quản trị user"
            onPress={() => router.push("/admin/users")}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          >
            <View style={styles.tileIconBox}>
              <UserCog color={colors.primaryDark} size={20} strokeWidth={2} />
            </View>
            <Text numberOfLines={1} style={styles.tileTitle}>Quản trị user</Text>
            <Text numberOfLines={1} style={styles.tileSubtitle}>Tài khoản & chi nhánh</Text>
          </Pressable>
        ) : null}

        {canManageRoles ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Phân quyền"
            onPress={() => router.push("/admin/roles")}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          >
            <View style={styles.tileIconBox}>
              <ShieldCheck color="#15966A" size={20} strokeWidth={2} />
            </View>
            <Text numberOfLines={1} style={styles.tileTitle}>Phân quyền</Text>
            <Text numberOfLines={1} style={styles.tileSubtitle}>Vai trò & quyền hạn</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tài nguyên"
          onPress={() => router.push("/resources")}
          style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
        >
          <View style={styles.tileIconBox}>
            <FolderOpen color="#D98A15" size={20} strokeWidth={2} />
          </View>
          <Text numberOfLines={1} style={styles.tileTitle}>Tài nguyên</Text>
          <Text numberOfLines={1} style={styles.tileSubtitle}>File & Google Drive</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cài đặt hệ thống"
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [
            styles.tile,
            styles.fullWidthTile,
            pressed && styles.tilePressed,
          ]}
        >
          <View style={styles.tileRowContent}>
            <View style={[styles.tileIconBox, styles.rowIconBox]}>
              <Settings color="#4B5E6B" size={20} strokeWidth={2} />
            </View>
            <View style={styles.tileRowText}>
              <Text numberOfLines={1} style={styles.tileTitle}>Cài đặt hệ thống</Text>
              <Text numberOfLines={1} style={styles.tileSubtitle}>Hồ sơ cá nhân & bảo mật sinh trắc học</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    backgroundColor: colors.surface,
  },
  headerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  profileContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#EAEFF3",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  profilePressed: {
    opacity: 0.75,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  profileMeta: {
    color: colors.muted,
    fontSize: 11.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  tile: {
    width: "48.5%",
    minHeight: 82,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#EAEFF3",
    borderRadius: radius.md,
    padding: spacing.sm,
    justifyContent: "center",
  },
  tilePressed: {
    opacity: 0.75,
    backgroundColor: "#F8FAFC",
  },
  tileIconBox: {
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 6,
  },
  rowIconBox: {
    marginBottom: 0,
    marginRight: 4,
  },
  tileTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  tileSubtitle: {
    color: colors.muted,
    fontSize: 10.5,
    marginTop: 1,
  },
  fullWidthTile: {
    width: "100%",
    minHeight: 52,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  tileRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tileRowText: {
    flex: 1,
  },
});
