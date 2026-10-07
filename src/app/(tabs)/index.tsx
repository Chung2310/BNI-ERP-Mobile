import { router } from "expo-router";
import { ArrowRight, Bell } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { MeetingCard } from "@/components/MeetingCard";
import { MetricCard } from "@/components/MetricCard";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";

import { DashboardCharts } from '@/components/DashboardCharts';
import { DashboardQuickActions } from '@/components/DashboardQuickActions';
import { userService } from '@/services/users';

export default function HomeScreen() {
  const { user } = useAuth();
  const { data: dashboardData } = useAsyncData(async () => {
    const history = await meetingService.history();
    const members = await userService.colleagues().catch(() => []);
    return { history, members };
  }, 'dashboard-charts');
  const { data, error, isLoading, reload } = useAsyncData(() => meetingService.list());
  const meetings = data || [];
  const chartMeetings = dashboardData?.history || meetings;
  const memberCount = dashboardData?.members.length || new Set(chartMeetings.flatMap((meeting) => meeting.speakers.map((speaker) => speaker.userId).filter(Boolean))).size;
  const liveMeeting = meetings.find((meeting) => meeting.status === "live" || meeting.status === "paused");
  const upcoming = meetings.filter((meeting) => meeting.status === "scheduled").sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)).slice(0, 2);
  const today = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "long" });
  return (
    <Screen>
      <AppHeader title={`Xin chào, ${user?.displayName?.split(" ").at(-1) || "bạn"}`} subtitle={today} action={<Pressable accessibilityLabel="Thông báo" style={styles.bell} onPress={() => router.push("/notifications")}><Bell color={colors.text} size={23} strokeWidth={2} /><View style={styles.dot} /></Pressable>} />
      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : <>
        {liveMeeting ? <Card style={styles.hero}><Badge tone="danger">ĐANG DIỄN RA</Badge><Text style={styles.heroTitle}>{liveMeeting.title}</Text><Text style={styles.heroMeta}>{liveMeeting.speakers.length} người check-in · {liveMeeting.location || "Chưa cập nhật địa điểm"}</Text><Button icon={ArrowRight} tone="secondary" onPress={() => router.push({ pathname: "/meeting/[id]/live", params: { id: liveMeeting._id } })}>Vào phòng họp</Button></Card> : null}
        <View style={styles.grid}><MetricCard label="Cuộc họp" value={String(meetings.length)} note="Trong dữ liệu hiện tại" /><MetricCard label="Đang diễn ra" value={String(meetings.filter((item) => item.status === "live").length)} note="Cập nhật từ máy chủ" /><MetricCard label="Sắp tới" value={String(meetings.filter((item) => item.status === "scheduled").length)} note="Theo lịch Chapter" /><MetricCard label="Đã kết thúc" value={String(meetings.filter((item) => item.status === "ended").length)} note="Lịch sử cuộc họp" /></View>
        <SectionTitle action={<Text style={styles.link} onPress={() => router.push("/(tabs)/meetings")}>Xem tất cả</Text>}>Sắp tới</SectionTitle>
        {upcoming.length ? upcoming.map((meeting) => <MeetingCard key={meeting._id} meeting={meeting} />) : <EmptyState title="Chưa có lịch sắp tới" message="Lịch họp mới sẽ xuất hiện tại đây." />}
        <SectionTitle>Thao tác nhanh</SectionTitle>
        <DashboardQuickActions user={user} liveMeetingId={liveMeeting?._id} />
        <SectionTitle>Biểu đồ tổng quan</SectionTitle>
        <DashboardCharts meetings={chartMeetings} memberCount={memberCount} />
      </>}
    </Screen>
  );
}
const styles = StyleSheet.create({ bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, dot: { position: "absolute", right: 7, top: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger }, hero: { gap: spacing.md, backgroundColor: colors.primary }, heroTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" }, heroMeta: { color: "#DDFBFF", fontSize: 13 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, link: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
