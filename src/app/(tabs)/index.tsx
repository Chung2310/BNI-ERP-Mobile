import { router } from "expo-router";
import { ArrowRight, Bell, Calendar, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DashboardQuickActions } from "@/components/DashboardQuickActions";
import { ActiveMemberRanking } from "@/components/ActiveMemberRanking";
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
  const insets = useSafeAreaInsets();
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [isDateSheetVisible, setIsDateSheetVisible] = useState(false);

  const { data: dashboardData } = useAsyncData(async () => {
    const history = await meetingService.history();
    const members = await userService.directory().catch(() => []);
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

  // Selected date meetings for the bottom sheet
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

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setIsDateSheetVisible(true);
  };

  return (
    <>
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
            {/* Live Meeting Compact Banner */}
            {liveMeeting ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Vào cuộc họp: ${liveMeeting.title}`}
                style={({ pressed }) => [styles.heroCompact, pressed && styles.pressed]}
                onPress={() =>
                  router.push({
                    pathname: "/meeting/[id]/live",
                    params: { id: liveMeeting._id },
                  })
                }
              >
                <View style={styles.heroLeft}>
                  <View style={styles.heroTagRow}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.heroTagText}>ĐANG DIỄN RA</Text>
                  </View>
                  <Text style={styles.heroTitleCompact} numberOfLines={1}>
                    {liveMeeting.title}
                  </Text>
                  <Text style={styles.heroMetaCompact} numberOfLines={1}>
                    {liveMeeting.speakers.length} check-in · {liveMeeting.location || "Trực tiếp"}
                  </Text>
                </View>

                <View style={styles.heroActionBtn}>
                  <Text style={styles.heroActionBtnText}>Vào họp</Text>
                  <ArrowRight color="#00AECA" size={14} strokeWidth={2.6} />
                </View>
              </Pressable>
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
              onSelectDate={handleSelectDate}
              onPrevious={() =>
                setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
              onNext={() =>
                setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
            />

            {/* Thao tác nhanh - Icons 3D */}
            <SectionTitle>Thao tác nhanh</SectionTitle>
            <DashboardQuickActions user={user} liveMeetingId={liveMeeting?._id} />

            <ActiveMemberRanking meetings={chartMeetings} members={dashboardData?.members || []} />

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

      {/* Bottom Sheet chi tiết lịch họp khi bấm vào ngày */}
      <Modal
        visible={isDateSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDateSheetVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            accessibilityLabel="Đóng lịch ngày"
            onPress={() => setIsDateSheetVisible(false)}
          />
          <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderInfo}>
                <Text style={styles.sheetTitle}>
                  Lịch ngày {selectedDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {selectedDateMeetings.length > 0
                    ? `${selectedDateMeetings.length} cuộc họp được tìm thấy`
                    : "Chưa có cuộc họp trong ngày này"}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Đóng"
                hitSlop={10}
                style={styles.sheetCloseBtn}
                onPress={() => setIsDateSheetVisible(false)}
              >
                <X color={colors.muted} size={20} strokeWidth={2.4} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContainer}
              showsVerticalScrollIndicator={false}
            >
              {selectedDateMeetings.length > 0 ? (
                selectedDateMeetings.map((meeting) => (
                  <MeetingCard key={meeting._id} meeting={meeting} />
                ))
              ) : (
                <View style={styles.sheetEmpty}>
                  <Calendar color={colors.primary} size={36} strokeWidth={1.8} />
                  <Text style={styles.sheetEmptyTitle}>Không có cuộc họp</Text>
                  <Text style={styles.sheetEmptyText}>
                    Ngày này chưa có lịch họp nào. Bạn có thể chọn ngày khác hoặc lên lịch cuộc họp mới.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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
  heroCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#00AECA", // Brand jade cyan
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: spacing.sm,
    ...shadow,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  heroLeft: {
    flex: 1,
    gap: 2,
  },
  heroTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  heroTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  heroTitleCompact: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  heroMetaCompact: {
    color: "#E0F7FA",
    fontSize: 11,
    fontWeight: "500",
  },
  heroActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  heroActionBtnText: {
    color: "#00AECA",
    fontSize: 12,
    fontWeight: "800",
  },
  link: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },

  /* Bottom sheet styles */
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "75%",
    ...shadow,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 12,
  },
  sheetHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sheetSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContainer: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  sheetEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  sheetEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  sheetEmptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
});
