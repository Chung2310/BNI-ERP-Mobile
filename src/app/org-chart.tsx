import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { userService } from "@/services/users";
import { colors, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";

function Person({ user }: { user: UserProfile }) { const initials = user.displayName.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase(); return <Pressable onPress={() => router.push({ pathname: "/member/[id]", params: { id: user.uid } })}><Card style={styles.person}><Avatar initials={initials} size={40} /><Text numberOfLines={1} style={styles.name}>{user.displayName}</Text><Text numberOfLines={1} style={styles.role}>{user.role}</Text></Card></Pressable>; }

export default function OrgChartScreen() {
  const { data, error, isLoading, reload } = useAsyncData(userService.colleagues);
  if (isLoading) return <Screen><BackHeader title="Sơ đồ tổ chức" /><LoadingState /></Screen>;
  if (error) return <Screen><BackHeader title="Sơ đồ tổ chức" /><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!data?.length) return <Screen><BackHeader title="Sơ đồ tổ chức" /><EmptyState title="Chưa có thành viên" message="Sơ đồ sẽ được tạo từ cấu trúc báo cáo trong BNI-ERP." /></Screen>;
  const ids = new Set(data.map((item) => item.uid)); const roots = data.filter((item) => !item.parentId || !ids.has(item.parentId));
  return <Screen><BackHeader title="Sơ đồ tổ chức" subtitle="Vuốt ngang để xem toàn bộ cơ cấu" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.canvas}>{roots.map((root) => { const children = data.filter((item) => item.parentId === root.uid); return <View key={root.uid} style={styles.tree}><Person user={root} />{children.length ? <><View style={styles.line} /><View style={styles.branch}>{children.map((child) => <View key={child.uid}><Person user={child} />{data.some((item) => item.parentId === child.uid) ? <Text style={styles.childCount}>{data.filter((item) => item.parentId === child.uid).length} cấp dưới</Text> : null}</View>)}</View></> : null}</View>; })}</ScrollView></Screen>;
}
const styles = StyleSheet.create({ canvas: { minWidth: 680, alignItems: "flex-start", gap: spacing.xl, paddingVertical: spacing.lg }, tree: { alignItems: "center" }, branch: { flexDirection: "row", justifyContent: "center", gap: spacing.sm }, line: { width: 2, height: 28, backgroundColor: colors.border }, person: { width: 190, alignItems: "center", padding: spacing.md }, name: { width: "100%", marginTop: spacing.sm, color: colors.text, fontSize: 12, fontWeight: "800", textAlign: "center" }, role: { width: "100%", marginTop: 2, color: colors.muted, fontSize: 10, textAlign: "center" }, childCount: { marginTop: spacing.xs, color: colors.muted, fontSize: 9, textAlign: "center" } });
