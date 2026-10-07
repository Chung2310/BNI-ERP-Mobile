import { router } from "expo-router";
import { ArrowRight, Bell } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DashboardQuickActions } from "@/components/DashboardQuickActions";
import { MeetingCard } from "@/components/MeetingCard";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { userService } from "@/services/users";
import { colors, radius, shadow, spacing } from "@/theme/tokens";

function capitalizeName(name?: string): string {
  if (!name) return "bạn";
  const trimmed = name.trim();
  const lastName = trimmed.split(" ").at(-1) || "bạn";
  return lastName.charAt(0).toUpperCase() + lastName.slice(1);
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const { data: dashboardData } = useAsyncData(async () => {
    const history = await meetingService.history();
    const members = await userService.colleagues().catch(() => []);
    return { history, members };
  }, "dashboard-charts");

  const { data, error, isLoading, reload } = useAsyncData(() => meetingService.list());
  const meetings = useMemo(() => data || [], [data]);
  const chartMeetings = dashboardData?.history || meetings;
  const memberCount =
    dashboardData?.members.length ||
    new Set(chartMeetings.flatMap((meeting) => meeting.speakers.map((speaker) => speaker.userId).filter(Boolean)))
      .size;

  const liveMeeting = meetings.find((meeting) => meeting.status === "live" || meeting.status === "paused");
  const upcoming = meetings
    .filter((meeting) => meeting.status === "scheduled")
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 3);

  const eventDates = useMemo(() => meetings.map((m) => m.startsAt), [meetings]);
  const liveDates = useMemo(() => (liveMeeting ? [liveMeeting.startsAt] : []), [liveMeeting]);

  // Selected date meetings
  const selectedDateMeetings = useMemo(() => {
    const targetStr = selectedDate.toDateString();
    return meetings.filter((m) => new Date(m.startsAt).toDateString() === targetStr);
  }, [meetings, selectedDate]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const formatted = now.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, []);

  const displayName = capitalizeName(user?.displayName);

  return (
    <Screen>
      <AppHeader
        title={`Xin chào, ${displayName}`}
        subtitle={todayStr}
        action={
          <Pressable
            accessibilityLabel="Thông báo"
            style={styles.bell}
            onPress={() => router.push("/notifications")}
          >
            <Bell color={colors.text} size={22} strokeWidth={2} />
            <View style={styles.dot} />
          </Pressable>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          {/* Live Meeting Hero */}
          {liveMeeting ? (
            <Card style={styles.hero}>
              <View style={styles.heroTopRow}>
                <Badge tone="danger">🔴 ĐANG DIỄN RA</Badge>
                <Text style={styles.heroLiveBadge}>Live Chapter</Text>
              </View>
              <Text style={styles.heroTitle}>{liveMeeting.title}</Text>
              <Text style={styles.heroMeta}>
                {liveMeeting.speakers.length} người check-in · {liveMeeting.location || "Chưa cập nhật địa điểm"}
              </Text>
              <Button
                icon={ArrowRight}
                tone="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/meeting/[id]/live",
                    params: { id: liveMeeting._id },
                  })
                }
              >
                Vào phòng họp ngay
              </Button>
            </Card>
          ) : null}

          {/* Lịch cuộc họp - Hiển thị ngay khi mở app */}
          <SectionTitle
            action={
              <Pressable
                accessibilityLabel="Xem tất cả cuộc họp"
                hitSlop={8}
                onPress={() => router.push("/(tabs)/meetings")}
              >
                <Text style={styles.link}>Xem tất cả ({meetings.length})</Text>
              </Pressable>
            }
          >
            Lịch cuộc họp
          </SectionTitle>

          <MonthCalendar
            date={calendarDate}
            eventDates={eventDates}
            liveDates={liveDates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevious={() =>
              setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
            onNext={() =>
              setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
          />

          {/* Nếu ngày được chọn có cuộc họp, hiển thị nhanh */}
          {selectedDateMeetings.length > 0 && (
            <View style={styles.selectedDateSection}>
              <Text style={styles.selectedDateTitle}>
                Cuộc họp ngày {selectedDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} (
                {selectedDateMeetings.length})
              </Text>
              {selectedDateMeetings.map((meeting) => (
                <MeetingCard key={meeting._id} meeting={meeting} />
              ))}
            </View>
          )}

          {/* Thao tác nhanh - Icons 3D */}
          <SectionTitle>Thao tác nhanh</SectionTitle>
          <DashboardQuickActions user={user} liveMeetingId={liveMeeting?._id} />

          {/* Biểu đồ tổng quan - Brand cyan theme */}
          <SectionTitle>Biểu đồ tổng quan</SectionTitle>
          <DashboardCharts meetings={chartMeetings} memberCount={memberCount} />

          {/* Cuộc họp sắp tới */}
          <SectionTitle
            action={
              <Pressable
                accessibilityLabel="Xem toàn bộ lịch"
                hitSlop={8}
                onPress={() => router.push("/(tabs)/meetings")}
              >
                <Text style={styles.link}>Xem tất cả</Text>
              </Pressable>
            }
          >
            Sắp diễn ra
          </SectionTitle>
          {upcoming.length ? (
            upcoming.map((meeting) => <MeetingCard key={meeting._id} meeting={meeting} />)
          ) : (
            <EmptyState
              title="Chưa có lịch họp sắp tới"
              message="Các cuộc họp mới sẽ tự động hiển thị tại đây khi được lên lịch."
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  hero: {
    gap: spacing.sm,
    backgroundColor: "#00AECA", // Brand jade cyan
    borderWidth: 0,
    ...shadow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLiveBadge: {
    color: "#E2F9FC",
    fontSize: 11,
    fontWeight: "700",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  heroMeta: {
    color: "#D6F6FA",
    fontSize: 12,
    fontWeight: "600",
  },
  link: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  selectedDateSection: {
    gap: spacing.xs,
  },
  selectedDateTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 2,
    marginBottom: 2,
  },
});
