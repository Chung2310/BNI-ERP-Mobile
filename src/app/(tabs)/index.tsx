import { router, useFocusEffect } from "expo-router";
import { ArrowRight, Bell, Trophy } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
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
import { applyMeetingChange, meetingService, subscribeMeetingChanges } from "@/services/meeting";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";

function capitalizeName(name?: string): string {
  if (!name) return "bạn";
  const trimmed = name.trim();
  const lastName = trimmed.split(" ").at(-1) || "bạn";
  return lastName.charAt(0).toUpperCase() + lastName.slice(1);
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const calendarMonth = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}`;
  const { data: monthData, setData: setMonthData, reload: reloadMonth, isLoading: monthLoading, error: monthError } = useAsyncData(() => meetingService.list(calendarMonth), calendarMonth);

  const { data: dashboardData } = useAsyncData(async () => {
    const history = await meetingService.history();
    const members = await userService.colleagues().catch(() => []);
    return { history, members };
  }, "dashboard-charts");

  const { data, setData, error, isLoading, reload } = useAsyncData(() => meetingService.list());
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) { void reload(); void reloadMonth(); }
    else hasFocused.current = true;
  }, [reload, reloadMonth]));
  useEffect(() => subscribeMeetingChanges((change) => {
    setData((current) => applyMeetingChange(current, change));
    setMonthData((current) => applyMeetingChange(current, change));
  }), [setData, setMonthData]);
  const meetings = useMemo(() => data || [], [data]);
  const calendarMeetings = useMemo(() => [...new Map([...meetings, ...(monthData || [])].map((meeting) => [meeting._id, meeting])).values()], [meetings, monthData]);
  const chartMeetings = dashboardData?.history || meetings;
  const memberCount =
    dashboardData?.members.length ||
    new Set(chartMeetings.flatMap((meeting) => meeting.speakers.map((speaker) => speaker.userId).filter(Boolean)))
      .size;

  const liveMeeting = useMemo(
    () => meetings.find((meeting) => meeting.status === "live" || meeting.status === "paused"),
    [meetings],
  );
  const upcoming = useMemo(
    () =>
      meetings
        .filter((meeting) => meeting.status === "scheduled")
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
        .slice(0, 3),
    [meetings],
  );

  const memberRankings = useMemo(() => {
    const totals = new Map<string, { name: string; appearances: number; seconds: number }>();
    chartMeetings.forEach((meeting) =>
      meeting.speakers.forEach((speaker) => {
        const key = speaker.userId || speaker.email || speaker.name;
        if (!key) return;
        const current = totals.get(key) || { name: speaker.name, appearances: 0, seconds: 0 };
        current.appearances += 1;
        current.seconds += speaker.spokenSeconds || 0;
        totals.set(key, current);
      }),
    );
    return [...totals.values()]
      .sort((a, b) => b.appearances * 1000 + b.seconds - (a.appearances * 1000 + a.seconds))
      .slice(0, 5);
  }, [chartMeetings]);

  const featuredMeeting = liveMeeting || upcoming[0] || null;
  const isFeaturedLive = Boolean(liveMeeting);

  const featuredMeta = (() => {
    if (!featuredMeeting) return "";
    if (isFeaturedLive) {
      return `${featuredMeeting.speakers.length} check-in · ${featuredMeeting.location || "Trực tiếp"}`;
    }
    const dateObj = new Date(featuredMeeting.startsAt);
    const timeStr = dateObj.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const dateStr = dateObj.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    return `${timeStr} · ${dateStr} · ${featuredMeeting.location || "Trực tiếp"}`;
  })();

  const { eventDates, liveDates, cancelledDates } = useMemo(() => {
    const map = new Map<
      string,
      { hasActive: boolean; hasLive: boolean; hasCancelled: boolean; sampleDate: string }
    >();

    for (const m of calendarMeetings) {
      const key = new Date(m.startsAt).toDateString();
      let entry = map.get(key);
      if (!entry) {
        entry = { hasActive: false, hasLive: false, hasCancelled: false, sampleDate: m.startsAt };
        map.set(key, entry);
      }
      if (m.status === "cancelled") {
        entry.hasCancelled = true;
      } else {
        entry.hasActive = true;
        if (m.status === "live" || m.status === "paused") {
          entry.hasLive = true;
        }
      }
    }

    const events: string[] = [];
    const lives: string[] = [];
    const cancelled: string[] = [];

    for (const entry of map.values()) {
      if (entry.hasActive) {
        events.push(entry.sampleDate);
        if (entry.hasLive) {
          lives.push(entry.sampleDate);
        }
      } else if (entry.hasCancelled) {
        cancelled.push(entry.sampleDate);
      }
    }

    return { eventDates: events, liveDates: lives, cancelledDates: cancelled };
  }, [calendarMeetings]);

  const selectedDateMeetings = useMemo(() => {
    if (!selectedDate) return [];
    const targetStr = selectedDate.toDateString();
    return calendarMeetings.filter((m) => new Date(m.startsAt).toDateString() === targetStr)
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [calendarMeetings, selectedDate]);

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

  const userInitials = useMemo(() => {
    const name = user?.displayName?.trim() || "BNI";
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(-2)
      .join("")
      .toUpperCase();
  }, [user?.displayName]);

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <>
      <Screen>
        <AppHeader
          avatar={
            <Pressable
              accessibilityLabel="Xem hồ sơ"
              onPress={() => router.push("/(tabs)/more")}
              style={({ pressed }) => [styles.avatarBtn, pressed && styles.pressed]}
            >
              <Avatar initials={userInitials} url={user?.photoURL} size={36} />
            </Pressable>
          }
          title={`Xin chào, ${displayName}`}
          subtitle={todayStr}
          action={
            <Pressable
              accessibilityLabel="Thông báo"
              style={styles.bell}
              onPress={() => router.push("/notifications")}
            >
              <Bell color={colors.text} size={20} strokeWidth={2} />
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
            {/* Top Meeting Banner: Ưu tiên Đang diễn ra > Sắp diễn ra gần nhất */}
            {featuredMeeting ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${isFeaturedLive ? "Vào cuộc họp" : "Xem cuộc họp"}: ${featuredMeeting.title}`}
                style={({ pressed }) => [styles.heroCompact, pressed && styles.pressed]}
                onPress={() =>
                  router.push({
                    pathname: isFeaturedLive ? "/meeting/[id]/live" : "/meeting/[id]",
                    params: { id: featuredMeeting._id },
                  })
                }
              >
                <View style={styles.heroLeft}>
                  <View style={styles.heroTagRow}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.heroTagText}>
                      {isFeaturedLive ? "Đang diễn ra" : "Sắp diễn ra"}
                    </Text>
                  </View>
                  <Text style={styles.heroTitleCompact} numberOfLines={1}>
                    {featuredMeeting.title}
                  </Text>
                  <Text style={styles.heroMetaCompact} numberOfLines={1}>
                    {featuredMeta}
                  </Text>
                </View>

                <View style={styles.heroActionBtn}>
                  <Text style={styles.heroActionBtnText}>
                    {isFeaturedLive ? "Vào họp" : "Chi tiết"}
                  </Text>
                  <ArrowRight color="#00AECA" size={14} strokeWidth={2.6} />
                </View>
              </Pressable>
            ) : null}

            {/* Tiện ích */}
            <SectionTitle>Tiện ích</SectionTitle>
            <DashboardQuickActions user={user} />

            {/* Lịch cuộc họp */}
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
              cancelledDates={cancelledDates}
              selectedDate={selectedDate ?? undefined}
              onSelectDate={handleSelectDate}
              onPrevious={() => { setSelectedDate(null); setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); }}
              onNext={() => { setSelectedDate(null); setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); }}
            />

            {selectedDate ? (
              <View style={styles.dayMeetings}>
                <Text style={styles.dayMeetingsTitle}>Cuộc họp ngày {selectedDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} ({selectedDateMeetings.length})</Text>
                {monthLoading ? <LoadingState /> : monthError ? <ErrorState message={monthError} onRetry={reloadMonth} /> : selectedDateMeetings.length ? (
                  <View style={styles.dayMeetingsList}>
                    {selectedDateMeetings.map((meeting) => <MeetingCard key={meeting._id} meeting={meeting} variant="list" showDate={false} />)}
                  </View>
                ) : <Text style={styles.dayMeetingsEmpty}>Không có cuộc họp trong ngày này.</Text>}
              </View>
            ) : null}

            {/* Biểu đồ tổng quan */}
            <SectionTitle>Biểu đồ tổng quan</SectionTitle>
            <DashboardCharts meetings={chartMeetings} memberCount={memberCount} />

            {/* BXH thành viên */}
            <SectionTitle
              action={
                <Pressable
                  accessibilityLabel="Xem tất cả bảng xếp hạng"
                  hitSlop={8}
                  onPress={() => router.push("/rankings")}
                >
                  <Text style={styles.link}>Xem tất cả</Text>
                </Pressable>
              }
            >
              BXH thành viên
            </SectionTitle>
            {memberRankings.length ? (
              <Card style={styles.rankingsCard}>
                {memberRankings.map((item, index) => {
                  const rank = index + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;
                  const badgeColor = isTop1 ? "#D99020" : isTop2 ? "#64748B" : isTop3 ? "#B45309" : colors.muted;
                  const badgeBg = isTop1 ? "#FEF9EC" : isTop2 ? "#F1F5F9" : isTop3 ? "#FEF3EB" : "#F8FAFC";

                  return (
                    <View
                      key={item.name + index}
                      style={[
                        styles.rankRow,
                        index !== memberRankings.length - 1 && styles.rankRowBorder,
                      ]}
                    >
                      <View style={[styles.rankBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.rankBadgeText, { color: badgeColor }]}>#{rank}</Text>
                      </View>
                      <Avatar
                        initials={item.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(-2)
                          .join("")
                          .toUpperCase()}
                        size={34}
                      />
                      <View style={styles.rankInfo}>
                        <Text numberOfLines={1} style={styles.rankName}>
                          {item.name}
                        </Text>
                        <Text style={styles.rankMeta}>
                          {item.appearances} buổi tham dự · {Math.round(item.seconds / 60)} phút phát biểu
                        </Text>
                      </View>
                      {isTop1 ? (
                        <View style={styles.trophyWrap}>
                          <Trophy color="#D99020" size={16} strokeWidth={2.4} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </Card>
            ) : (
              <EmptyState
                title="Chưa có dữ liệu xếp hạng"
                message="Bảng xếp hạng sẽ xuất hiện sau khi các cuộc họp diễn ra."
              />
            )}
          </>
        )}
      </Screen>


    </>
  );
}

const styles = StyleSheet.create({
  avatarBtn: {
    borderRadius: radius.pill,
  },
  bell: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 0,
  },
  dot: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  heroCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#00AECA", // Brand jade cyan
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: spacing.sm,
    borderWidth: 0,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  heroLeft: {
    flex: 1,
    gap: 3,
  },
  heroTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  heroTitleCompact: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
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
    paddingVertical: 7,
    paddingHorizontal: 11,
    gap: 4,
  },
  heroActionBtnText: {
    color: "#00AECA",
    fontSize: 12,
    fontWeight: "800",
  },
  link: {
    color: colors.primaryDark,
    fontSize: 11.5,
    fontWeight: "700",
  },

  dayMeetings: { gap: spacing.sm },
  dayMeetingsTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  dayMeetingsList: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.sm },
  dayMeetingsEmpty: { color: colors.muted, fontSize: 13, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg },
  rankingsCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  rankRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F4F6",
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  rankInfo: {
    flex: 1,
    gap: 2,
  },
  rankName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  rankMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  trophyWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FEF9EC",
    alignItems: "center",
    justifyContent: "center",
  },
});
