import { useEffect, useState } from "react";
import { Bell, BriefcaseBusiness, CheckCheck, GraduationCap, Package, Settings } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useNotifications } from "@/context/NotificationContext";
import { notificationService, type NotificationItem } from "@/services/notifications";
import { colors, radius, spacing } from "@/theme/tokens";

const filters: [NotificationItem["type"] | undefined, string][] = [[undefined, "Tất cả"], ["task", "Công việc"], ["training", "Đào tạo"], ["he-thong", "Hệ thống"]];
const notificationIcons = { kho: Package, task: BriefcaseBusiness, training: GraduationCap, "he-thong": Settings } as const;

export default function NotificationsScreen() {
  const [type, setType] = useState<NotificationItem["type"] | undefined>();
  const { data, setData, error, isLoading, reload } = useAsyncData(() => notificationService.list({ type }), type || "all");
  const { markRead: markReadRealtime, markAllRead, revision } = useNotifications();

  useEffect(() => {
    if (revision > 0) void reload();
  }, [reload, revision]);

  const markRead = async (item: NotificationItem) => {
    if (item.read) return;
    await markReadRealtime(item);
    setData(data ? { ...data, unreadCount: Math.max(0, data.unreadCount - 1), data: data.data.map((entry) => entry._id === item._id ? { ...entry, read: true } : entry) } : data);
  };
  const markAll = async () => { await markAllRead(); await reload(); };
  return (
    <Screen>
      <BackHeader title="Thông báo" subtitle={`${data?.unreadCount || 0} mục chưa đọc`} compact />
      <View style={styles.filters}>{filters.map(([value, label]) => <Pressable key={label} onPress={() => setType(value)} style={[styles.filter, type === value && styles.active]}><Text numberOfLines={1} style={[styles.filterText, type === value && styles.activeText]}>{label}</Text></Pressable>)}</View>
      {(data?.unreadCount || 0) > 0 ? <Button icon={CheckCheck} tone="secondary" onPress={markAll}>Đánh dấu tất cả đã đọc</Button> : null}
      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.data.length ? <EmptyState title="Không có thông báo" message="Các cập nhật mới sẽ xuất hiện tại đây." /> : <Card style={styles.list}>{data.data.map((item) => { const Icon = notificationIcons[item.type] || Bell; return <Pressable key={item._id} onPress={() => markRead(item)} style={styles.item}><View style={styles.icon}><Icon color={colors.primaryDark} size={20} /></View><View style={styles.grow}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.body}</Text><Text style={styles.time}>{new Date(item.createdAt).toLocaleString("vi-VN")}</Text></View>{!item.read ? <View style={styles.unread} /> : null}</Pressable>; })}</Card>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: "#EDF3F5", padding: 4 },
  filter: { flex: 1, minWidth: 0, alignItems: "center", borderRadius: radius.sm, paddingVertical: spacing.sm },
  active: { backgroundColor: colors.brandBlue },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  activeText: { color: "#FFFFFF" },
  list: { paddingVertical: 0 },
  item: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 13, fontWeight: "800" },
  meta: { marginTop: 3, color: colors.muted, fontSize: 11 },
  time: { marginTop: 3, color: colors.muted, fontSize: 9 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
