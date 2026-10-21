import { useCallback, useEffect, useMemo } from "react";
import { router, useFocusEffect, type Href } from "expo-router";
import { Bell, BriefcaseBusiness, CheckCheck, GraduationCap, Package, Settings } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { notificationService, type NotificationItem } from "@/services/notifications";
import { colors, spacing } from "@/theme/tokens";

const notificationIcons = { kho: Package, task: BriefcaseBusiness, training: GraduationCap, "he-thong": Settings } as const;

function isChapterRequestNotification(item: NotificationItem) {
  if (item.action?.kind === "chapter_approved") return true;
  if (item._id.startsWith("chapter-")) return true;
  const content = `${item.title} ${item.body}`;
  return /chapter/i.test(content) && /(đơn|gia nhập|rời|duyệt)/i.test(content);
}

export default function NotificationsScreen() {
  const { user, refreshProfile } = useAuth();
  const { data, setData, error, isLoading, reload } = useAsyncData(
    () => notificationService.list(),
    user?.uid || "",
  );
  const { unreadCount, chapterNotifications, markRead: markReadRealtime, markAllRead, markChapterRead, markAllChapterRead, refreshChapterNotifications, revision, isRealtimeConnected, pushError } = useNotifications();

  useFocusEffect(useCallback(() => {
    void refreshChapterNotifications().catch(() => undefined);
    void reload();
  }, [refreshChapterNotifications, reload]));

  useEffect(() => {
    if (revision > 0) void reload();
  }, [reload, revision]);

  const visibleItems = useMemo(() => [
    ...chapterNotifications,
    ...(data?.data || []),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [chapterNotifications, data?.data]);

  const markRead = async (item: NotificationItem) => {
    if (item.read) return;
    if (item._id.startsWith("chapter-")) {
      markChapterRead(item._id);
      return;
    }
    await markReadRealtime(item);
    setData(data ? { ...data, unreadCount: Math.max(0, data.unreadCount - 1), data: data.data.map((entry) => entry._id === item._id ? { ...entry, read: true } : entry) } : data);
  };
  const openNotification = async (item: NotificationItem) => {
    await markRead(item).catch(() => undefined);
    if (item.action?.meetingId) {
      const destination = item.action.kind === "draw_winner"
        ? `/meeting/${item.action.meetingId}/game-results`
        : `/meeting/${item.action.meetingId}`;
      router.push(destination as Href);
      return;
    }
    if (!isChapterRequestNotification(item)) return;
    const profile = await refreshProfile().catch(() => user);
    requestAnimationFrame(() => {
      router.push(profile?.companyCode ? "/chapter" : "/(tabs)/chapters");
    });
  };
  const markAll = async () => {
    markAllChapterRead();
    if ((data?.unreadCount || 0) > 0) { await markAllRead(); await reload(); }
  };
  return (
    <Screen>
      <BackHeader title="Thông báo" subtitle={`${unreadCount} mục chưa đọc`} compact />
      {pushError ? <Card style={styles.diagnostic}><Text style={styles.diagnosticTitle}>Thông báo nền chưa hoạt động</Text><Text style={styles.diagnosticText}>{pushError}</Text></Card> : null}
      {!isRealtimeConnected ? <Text style={styles.realtimeWarning}>Đang kết nối lại thông báo realtime…</Text> : null}
      {unreadCount > 0 ? <Button icon={CheckCheck} tone="secondary" onPress={markAll}>Đánh dấu tất cả đã đọc</Button> : null}
      {isLoading && !visibleItems.length ? <LoadingState /> : error && !visibleItems.length ? <ErrorState message={error} onRetry={reload} /> : !visibleItems.length ? <EmptyState title="Không có thông báo" message="Các cập nhật mới sẽ xuất hiện tại đây." /> : <Card style={styles.list}>{visibleItems.map((item) => { const Icon = item._id.startsWith("chapter-") ? Bell : notificationIcons[item.type] || Bell; return <Pressable key={item._id} onPress={() => void openNotification(item)} style={styles.item}><View style={styles.icon}><Icon color={colors.primaryDark} size={20} /></View><View style={styles.grow}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.body}</Text><Text style={styles.time}>{new Date(item.createdAt).toLocaleString("vi-VN")}</Text></View>{!item.read ? <View style={styles.unread} /> : null}</Pressable>; })}</Card>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  diagnostic: { gap: spacing.xs, borderColor: "#F2C66D", backgroundColor: "#FFF8E6", padding: spacing.md },
  diagnosticTitle: { color: "#8A5A00", fontSize: 13, fontWeight: "900" },
  diagnosticText: { color: "#76500A", fontSize: 11, lineHeight: 17 },
  realtimeWarning: { color: colors.muted, fontSize: 11, textAlign: "center" },
  list: { paddingVertical: 0 },
  item: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 13, fontWeight: "800" },
  meta: { marginTop: 3, color: colors.muted, fontSize: 11 },
  time: { marginTop: 3, color: colors.muted, fontSize: 9 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
