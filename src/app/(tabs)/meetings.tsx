import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "@/components/BackHeader";
import { HeaderAddButton } from "@/components/HeaderAddButton";
import { EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
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
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date());
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [filter, setFilter] = useState<MeetingFilter>("today");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [search, setSearch] = useState("");
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
    const query = search.trim().toLocaleLowerCase("vi");
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
        return Number.isFinite(time)
          && (filter === "all" || (time >= +start && time < +end))
          && (!query || [meeting.title, meeting.location].some((value) => value?.toLocaleLowerCase("vi").includes(query)));
      })
      .sort((left, right) => filter === "all"
        ? +new Date(right.startsAt) - +new Date(left.startsAt)
        : +new Date(left.startsAt) - +new Date(right.startsAt));
  }, [meetings, filter, referenceDate, search]);
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
    setFilterSheetVisible(false);
  };

  return (
    <Screen>
      <BackHeader
        title="Cuộc họp"
        compact
        subtitle="Theo dõi các cuộc họp"
        onBack={() => router.navigate("/(tabs)")}
        action={canCreateMeeting ? (
          <HeaderAddButton
            accessibilityLabel="Tạo cuộc họp"
            onPress={() => router.push("/meeting/create")}
          />
        ) : undefined}
      />
      <MonthCalendar
        date={month}
        eventDates={calendarEventDates}
        cancelledDates={calendarCancelledDates}
        onPrevious={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        onSelectDate={canCreateMeeting ? createOnDate : undefined}
      />
      <SectionTitle>Cuộc họp ({filteredMeetings.length})</SectionTitle>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Search color={colors.muted} size={16} />
          <TextInput
            accessibilityLabel="Tìm kiếm cuộc họp"
            value={search}
            onChangeText={(value) => { setSearch(value); setVisibleCount(pageSize); }}
            placeholder="Tìm kiếm cuộc họp"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lọc cuộc họp: ${filters.find((option) => option.key === filter)?.label}`}
          onPress={() => setFilterSheetVisible(true)}
          style={({ pressed }) => [styles.filterTrigger, pressed && styles.pressed]}
        >
          <Text style={styles.filterTriggerText}>{filters.find((option) => option.key === filter)?.label}</Text>
          <ChevronDown color={colors.primaryDark} size={16} />
        </Pressable>
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
            </Pressable>
          ) : null}
        </>
      ) : (
        <EmptyState title={search.trim() ? "Không tìm thấy cuộc họp" : "Chưa có cuộc họp"} message={search.trim() ? "Thử từ khóa khác hoặc đổi bộ lọc." : "Không có cuộc họp trong khoảng thời gian này."} />
      )}
      <Modal visible={filterSheetVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setFilterSheetVisible(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} accessibilityLabel="Đóng bộ lọc" onPress={() => setFilterSheetVisible(false)} />
          <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Lọc cuộc họp</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={10} onPress={() => setFilterSheetVisible(false)} style={styles.sheetClose}>
                <X color={colors.muted} size={20} />
              </Pressable>
            </View>
            {filters.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === option.key }}
                onPress={() => selectFilter(option.key)}
                style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}
              >
                <Text style={[styles.sheetOptionText, filter === option.key && styles.sheetOptionSelected]}>{option.label}</Text>
                {filter === option.key ? <Check color={colors.primaryDark} size={20} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchBox: { flex: 1, height: 38, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 12, paddingVertical: 0 },
  filterTrigger: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm },
  filterTriggerText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  list: { backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  dateHeading: { color: colors.muted, fontSize: 12, fontWeight: "400", textTransform: "capitalize", paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  loadMore: { minHeight: touchTarget, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: spacing.xs, paddingHorizontal: spacing.sm },
  loadMoreText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  sheetBackdrop: { ...StyleSheet.absoluteFill },
  sheetContent: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  sheetHandle: { width: 36, height: 4, alignSelf: "center", borderRadius: radius.pill, backgroundColor: colors.border, marginBottom: spacing.md },
  sheetHeader: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sheetClose: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  sheetOption: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: spacing.sm },
  sheetOptionText: { color: colors.text, fontSize: 14 },
  sheetOptionSelected: { color: colors.primaryDark, fontWeight: "700" },
});
