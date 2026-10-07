import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ChevronDown, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { MeetingCard } from "@/components/MeetingCard";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type MeetingFilter = "today" | "week" | "month" | "all";
const pageSize = 10;
const filters: { key: MeetingFilter; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "all", label: "Tất cả" },
];

export default function MeetingsScreen() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [filter, setFilter] = useState<MeetingFilter>("today");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const canCreateMeeting = hasPermission(user, "meetings:manage");
  const { data, error, isLoading, reload } = useAsyncData(async () => {
    const results = await Promise.allSettled([meetingService.list(), meetingService.history()]);
    if (results[0].status === "rejected" && results[1].status === "rejected") throw results[0].reason;
    const combined = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return [...new Map(combined.map((meeting) => [meeting._id, meeting])).values()];
  });
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    setReferenceDate(new Date());
    if (hasFocused.current) void reload();
    else hasFocused.current = true;
  }, [reload]));

  const meetings = useMemo(() => data || [], [data]);
  const { calendarEventDates, calendarCancelledDates } = useMemo(() => {
    const monthMeetings = meetings.filter((meeting) => {
      const date = new Date(meeting.startsAt);
      return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
    });

    const map = new Map<string, { hasActive: boolean; hasCancelled: boolean; sampleDate: string }>();
    for (const m of monthMeetings) {
      const key = new Date(m.startsAt).toDateString();
      let entry = map.get(key);
      if (!entry) {
        entry = { hasActive: false, hasCancelled: false, sampleDate: m.startsAt };
        map.set(key, entry);
      }
      if (m.status === "cancelled") {
        entry.hasCancelled = true;
      } else {
        entry.hasActive = true;
      }
    }

    const events: string[] = [];
    const cancelled: string[] = [];
    for (const entry of map.values()) {
      if (entry.hasActive) {
        events.push(entry.sampleDate);
      } else if (entry.hasCancelled) {
        cancelled.push(entry.sampleDate);
      }
    }

    return { calendarEventDates: events, calendarCancelledDates: cancelled };
  }, [meetings, month]);
  const filteredMeetings = useMemo(() => {
    const start = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (filter === "week") {
      start.setDate(start.getDate() - (start.getDay() + 6) % 7);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    } else if (filter === "month") {
      start.setDate(1);
      end.setTime(start.getTime());
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setDate(end.getDate() + 1);
    }
    return meetings
      .filter((meeting) => {
        const time = +new Date(meeting.startsAt);
        return Number.isFinite(time) && (filter === "all" || (time >= +start && time < +end));
      })
      .sort((left, right) => filter === "all"
        ? +new Date(right.startsAt) - +new Date(left.startsAt)
        : +new Date(left.startsAt) - +new Date(right.startsAt));
  }, [meetings, filter, referenceDate]);
  const visibleMeetings = filteredMeetings.slice(0, visibleCount);

  const changeMonth = (offset: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const createOnDate = (date: Date) => {
    router.push({ pathname: "/meeting/create", params: { date: dayKey(date) } });
  };

  const selectFilter = (next: MeetingFilter) => {
    setFilter(next);
    setVisibleCount(pageSize);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppHeader
          title="Cuộc họp"
          action={canCreateMeeting ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tạo cuộc họp"
              onPress={() => router.push("/meeting/create")}
              style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
            >
              <Plus color="#FFFFFF" size={24} strokeWidth={2.5} />
            </Pressable>
          ) : undefined}
        />
      </View>
      <MonthCalendar
        date={month}
        eventDates={calendarEventDates}
        cancelledDates={calendarCancelledDates}
        onPrevious={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        onSelectDate={canCreateMeeting ? createOnDate : undefined}
      />
      <SectionTitle>Cuộc họp ({filteredMeetings.length})</SectionTitle>
      <View style={styles.filters}>
        {filters.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === option.key }}
            onPress={() => selectFilter(option.key)}
            style={({ pressed }) => [styles.filter, filter === option.key && styles.filterActive, pressed && styles.pressed]}
          >
            <Text style={[styles.filterText, filter === option.key && styles.filterTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {isLoading ? <LoadingState label="Đang tải lịch cuộc họp…" /> : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filteredMeetings.length ? (
        <>
          <View style={styles.list}>
            {visibleMeetings.map((meeting, index) => {
              const meetingDate = new Date(meeting.startsAt);
              const previousDate = index > 0 ? new Date(visibleMeetings[index - 1].startsAt) : null;
              const startsGroup = !previousDate || dayKey(meetingDate) !== dayKey(previousDate);
              return <View key={meeting._id}>
                {startsGroup ? <Text style={styles.dateHeading}>{meetingDate.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</Text> : null}
                <MeetingCard meeting={meeting} variant="list" showDate={false} />
              </View>;
            })}
          </View>
          {visibleCount < filteredMeetings.length ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setVisibleCount((count) => count + pageSize)}
              style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}
            >
              <Text style={styles.loadMoreText}>Xem thêm</Text>
              <ChevronDown color={colors.primaryDark} size={16} />
            </Pressable>
          ) : null}
        </>
      ) : (
        <EmptyState title="Chưa có cuộc họp" message="Không có cuộc họp trong khoảng thời gian này." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingLeft: spacing.sm, paddingRight: spacing.sm },
  createButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filter: {
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#FFFFFF" },
  list: { backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  dateHeading: { color: colors.text, fontSize: 12, fontWeight: "800", textTransform: "capitalize", paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  loadMore: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", alignSelf: "center", gap: spacing.xs, borderWidth: 1, borderColor: "#B9E7EE", borderRadius: radius.pill, backgroundColor: colors.primarySoft, marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  loadMoreText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.75 },
});
