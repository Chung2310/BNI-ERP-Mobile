import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  X,
} from "lucide-react-native";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, EmptyState } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  applyMeetingChange,
  meetingService,
  subscribeMeetingChanges,
  type Meeting,
} from "@/services/meeting";
import { radius, shadow } from "@/theme/tokens";
import { canCreateMeeting as canCreateMeetingForUser } from "@/utils/permissions";

type ViewMode = "month" | "week" | "day";

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_OF_WEEK_NAMES = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMeetingTime(startsAt: string, endsAt?: string): string {
  const start = new Date(startsAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endsAt) return start;
  const end = new Date(endsAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start} - ${end}`;
}

export default function MeetingsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const canCreateMeeting = canCreateMeetingForUser(user);

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [isDayDetailModalVisible, setIsDayDetailModalVisible] = useState(false);

  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  const {
    data,
    setData,
    reload,
  } = useAsyncData(async () => {
    const results = await Promise.allSettled([meetingService.list(), meetingService.history()]);
    const combined = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    return [...new Map(combined.map((meeting) => [meeting._id, meeting])).values()];
  });

  const { data: monthData, setData: setMonthData, reload: reloadMonth } = useAsyncData(
    () => meetingService.list(monthKey),
    monthKey,
  );

  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        void reload();
        void reloadMonth();
      } else {
        hasFocused.current = true;
      }
    }, [reload, reloadMonth]),
  );

  useEffect(() => {
    return subscribeMeetingChanges((change) => {
      setData((current) => applyMeetingChange(current, change));
      setMonthData((current) => applyMeetingChange(current, change));
    });
  }, [setData, setMonthData]);

  const meetings = useMemo(() => data || [], [data]);
  const calendarMeetings = useMemo(
    () => [...new Map([...meetings, ...(monthData || [])].map((m) => [m._id, m])).values()],
    [meetings, monthData],
  );

  // Map ngày -> danh sách cuộc họp
  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of calendarMeetings) {
      const key = toDateKey(new Date(m.startsAt));
      const list = map.get(key) || [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [calendarMeetings]);

  // Tính ma trận ngày tháng cho chế độ Xem Tháng (7 cột: T2 - CN)
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstDayIndex = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const cells: {
      date: Date;
      isCurrentMonth: boolean;
      dateKey: string;
      dayNumber: number;
    }[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      cells.push({
        date: d,
        isCurrentMonth: false,
        dateKey: toDateKey(d),
        dayNumber: d.getDate(),
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      cells.push({
        date: d,
        isCurrentMonth: true,
        dateKey: toDateKey(d),
        dayNumber: i,
      });
    }

    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        cells.push({
          date: d,
          isCurrentMonth: false,
          dateKey: toDateKey(d),
          dayNumber: i,
        });
      }
    }

    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return weeks;
  }, [currentDate]);

  // Tính toán tuần hiện tại cho chế độ Xem Tuần
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [currentDate]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const weekDays = useMemo(() => {
    const days: { date: Date; label: string; dateKey: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        label: DAY_LABELS[i],
        dateKey: toDateKey(d),
      });
    }
    return days;
  }, [weekStart]);

  // Dải 7 ngày xung quanh selectedDate cho chế độ Xem Ngày
  const dayStripDays = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const item = new Date(monday);
      item.setDate(item.getDate() + i);
      days.push(item);
    }
    return days;
  }, [selectedDate]);

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // Điều hướng trước / sau theo chế độ xem
  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (viewMode === "week") {
      setCurrentDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() - 7);
        return next;
      });
    } else {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() - 1);
        return next;
      });
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (viewMode === "week") {
      setCurrentDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + 7);
        return next;
      });
    } else {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + 1);
        return next;
      });
    }
  };

  const handleSelectDay = (date: Date) => {
    setSelectedDate(date);
    setIsDayDetailModalVisible(true);
  };

  // Khi chọn một ô trên lịch: Nếu ô trống thì chuyển sang tạo lịch đơn và fill sẵn ngày
  const handleCellPress = (cellDate: Date, hasEvents: boolean) => {
    if (!hasEvents) {
      if (canCreateMeeting) {
        router.push({
          pathname: "/meeting/create",
          params: { date: toDateKey(cellDate) },
        });
      } else {
        handleSelectDay(cellDate);
      }
      return;
    }
    handleSelectDay(cellDate);
  };

  const selectedDayMeetings = useMemo(() => {
    return meetingsByDay.get(toDateKey(selectedDate)) || [];
  }, [meetingsByDay, selectedDate]);

  const userInitials = useMemo(() => {
    const name = user?.displayName || "BNI";
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(-2)
      .join("")
      .toUpperCase();
  }, [user?.displayName]);

  // Tiêu đề thanh điều hướng linh hoạt theo chế độ xem
  const navDisplayTitle = useMemo(() => {
    if (viewMode === "month") {
      return `${String(currentDate.getMonth() + 1).padStart(2, "0")} / ${currentDate.getFullYear()}`;
    }
    if (viewMode === "week") {
      const startStr = `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")}`;
      const endStr = `${String(weekEnd.getDate()).padStart(2, "0")}/${String(weekEnd.getMonth() + 1).padStart(2, "0")}`;
      return `${startStr} - ${endStr} / ${weekStart.getFullYear()}`;
    }
    const dayName = DAY_OF_WEEK_NAMES[selectedDate.getDay()];
    return `${dayName}, ${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`;
  }, [viewMode, currentDate, weekStart, weekEnd, selectedDate]);

  return (
    <View style={styles.container}>
      {/* 1. Header Bar: Màu nền chuẩn của brand iGen Connect (#00AECA), Tiêu đề "Lịch trình" */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              hitSlop={8}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.navigate("/(tabs)");
                }
              }}
              style={({ pressed }) => [styles.headerBackBtn, pressed && styles.pressed]}
            >
              <ChevronLeft color="#FFFFFF" size={24} strokeWidth={2.4} />
            </Pressable>
            <Text style={styles.headerTitleText}>Lịch trình</Text>
          </View>

          <View style={styles.headerRightActions}>
            {canCreateMeeting && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tạo cuộc họp mới"
                hitSlop={8}
                onPress={() => router.push("/meeting/create")}
                style={({ pressed }) => [styles.headerAddBtn, pressed && styles.pressed]}
              >
                <Plus color="#FFFFFF" size={19} strokeWidth={2.4} />
              </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Xem hồ sơ cá nhân" hitSlop={8} onPress={() => router.push("/profile")}>
              <Avatar initials={userInitials} url={user?.photoURL} size={32} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* 2. Bộ chọn chế độ xem: Tháng | Tuần | Ngày */}
      <View style={styles.tabContainer}>
        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, viewMode === "month" && styles.segmentBtnActive]}
            onPress={() => setViewMode("month")}
          >
            <Text
              style={[
                styles.segmentBtnText,
                viewMode === "month" && styles.segmentBtnTextActive,
              ]}
            >
              Tháng
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, viewMode === "week" && styles.segmentBtnActive]}
            onPress={() => setViewMode("week")}
          >
            <Text
              style={[
                styles.segmentBtnText,
                viewMode === "week" && styles.segmentBtnTextActive,
              ]}
            >
              Tuần
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, viewMode === "day" && styles.segmentBtnActive]}
            onPress={() => setViewMode("day")}
          >
            <Text
              style={[
                styles.segmentBtnText,
                viewMode === "day" && styles.segmentBtnTextActive,
              ]}
            >
              Ngày
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 3. Thanh điều hướng: < Tiêu đề > linh hoạt theo Tháng, Tuần, Ngày */}
      <View style={styles.monthNavRow}>
        <Pressable
          accessibilityLabel="Trước"
          hitSlop={10}
          onPress={handlePrev}
          style={({ pressed }) => [styles.navArrowBtn, pressed && styles.pressed]}
        >
          <ChevronLeft color="#475569" size={20} strokeWidth={2.4} />
        </Pressable>

        <Text style={styles.monthTitleText}>{navDisplayTitle}</Text>

        <Pressable
          accessibilityLabel="Tiếp theo"
          hitSlop={10}
          onPress={handleNext}
          style={({ pressed }) => [styles.navArrowBtn, pressed && styles.pressed]}
        >
          <ChevronRight color="#475569" size={20} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* 4. Nội dung lịch tương ứng từng chế độ xem */}

      {/* CHẾ ĐỘ XEM THÁNG: Bấm ô trống -> Tạo lịch đơn, fill sẵn ngày */}
      {viewMode === "month" && (
        <ScrollView
          style={styles.calendarScroll}
          contentContainerStyle={styles.calendarScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hàng tiêu đề thứ: T2, T3, T4, T5, T6, T7, CN */}
          <View style={styles.dayLabelsRow}>
            {DAY_LABELS.map((label) => (
              <View key={label} style={styles.dayLabelCell}>
                <Text style={styles.dayLabelText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Lưới ma trận các ngày trong tháng */}
          <View style={styles.gridContainer}>
            {calendarGrid.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.gridRow}>
                {week.map((cell) => {
                  const isToday = cell.dateKey === todayKey;
                  const dayEvents = meetingsByDay.get(cell.dateKey) || [];
                  const displayedEvents = dayEvents.slice(0, 2);
                  const remainingCount = dayEvents.length - displayedEvents.length;

                  return (
                    <Pressable
                      key={cell.dateKey}
                      onPress={() => handleCellPress(cell.date, dayEvents.length > 0)}
                      style={[
                        styles.gridCell,
                        !cell.isCurrentMonth && styles.gridCellOtherMonth,
                      ]}
                    >
                      {/* Số ngày */}
                      <View style={styles.dayNumberWrap}>
                        <View style={[styles.dayNumberCircle, isToday && styles.todayCircle]}>
                          <Text
                            style={[
                              styles.dayNumberText,
                              !cell.isCurrentMonth && styles.dayNumberTextOtherMonth,
                              isToday && styles.todayNumberText,
                            ]}
                          >
                            {cell.dayNumber}
                          </Text>
                        </View>
                      </View>

                      {/* Các nhãn cuộc họp trong ô ngày */}
                      <View style={styles.eventsWrapper}>
                        {displayedEvents.map((meeting) => {
                          const isCancelled = meeting.status === "cancelled";

                          return (
                            <View
                              key={meeting._id}
                              style={[
                                styles.meetingChip,
                                isCancelled
                                  ? styles.meetingChipCancelled
                                  : styles.meetingChipBrand,
                              ]}
                            >
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.meetingChipText,
                                  isCancelled
                                    ? styles.meetingChipTextCancelled
                                    : styles.meetingChipTextBrand,
                                ]}
                              >
                                {meeting.title}
                              </Text>
                            </View>
                          );
                        })}

                        {remainingCount > 0 && (
                          <Text style={styles.remainingBadge}>+{remainingCount}</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* CHẾ ĐỘ XEM TUẦN: Thiết kế đơn sắc - Nền trắng, text đen như bình thường, viền màu brand */}
      {viewMode === "week" && (
        <ScrollView
          style={styles.calendarScroll}
          contentContainerStyle={styles.weekViewContainer}
          showsVerticalScrollIndicator={false}
        >
          {weekDays.map((item) => {
            const dayEvents = meetingsByDay.get(item.dateKey) || [];
            const isToday = item.dateKey === todayKey;

            return (
              <View key={item.dateKey} style={styles.weekDaySection}>
                {/* Header ngày trong tuần */}
                <View style={styles.weekDayHeader}>
                  <View style={styles.weekDayHeaderLeft}>
                    <Text style={[styles.weekDayTitle, isToday && styles.textBrand]}>
                      {item.label} · {String(item.date.getDate()).padStart(2, "0")}/
                      {String(item.date.getMonth() + 1).padStart(2, "0")}
                    </Text>
                    {isToday && (
                      <View style={styles.todaySmallPill}>
                        <Text style={styles.todaySmallPillText}>Hôm nay</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.weekDayEventCount}>
                    {dayEvents.length > 0 ? `${dayEvents.length} cuộc họp` : "Trống"}
                  </Text>
                </View>

                {/* Danh sách cuộc họp theo ngày */}
                {dayEvents.length > 0 ? (
                  <View style={styles.weekMeetingList}>
                    {dayEvents.map((meeting) => {
                      const isCancelled = meeting.status === "cancelled";
                      const timeRangeStr = formatMeetingTime(meeting.startsAt, meeting.endsAt);

                      return (
                        <Pressable
                          key={meeting._id}
                          onPress={() =>
                            router.push({ pathname: "/meeting/[id]", params: { id: meeting._id } })
                          }
                          style={[
                            styles.monoMeetingCard,
                            isCancelled
                              ? styles.monoMeetingCardCancelled
                              : styles.monoMeetingCardBrandBorder,
                          ]}
                        >
                          <View style={styles.monoMeetingHeader}>
                            <Text
                              numberOfLines={2}
                              style={[
                                styles.monoMeetingTitle,
                                isCancelled ? styles.textCancelled : styles.textDark,
                              ]}
                            >
                              {meeting.title}
                            </Text>
                            {isCancelled && (
                              <View style={styles.cancelledBadge}>
                                <Text style={styles.cancelledBadgeText}>ĐÃ HỦY</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.monoMeetingMetaRow}>
                            <Clock
                              size={13.5}
                              color={isCancelled ? "#DC2626" : "#64748B"}
                              strokeWidth={1.8}
                            />
                            <Text
                              style={[
                                styles.monoMeetingMetaText,
                                isCancelled ? styles.textCancelled : styles.textMuted,
                              ]}
                            >
                              {timeRangeStr}
                            </Text>

                            <MapPin
                              size={13.5}
                              color={isCancelled ? "#DC2626" : "#64748B"}
                              strokeWidth={1.8}
                            />
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.monoMeetingMetaText,
                                isCancelled ? styles.textCancelled : styles.textMuted,
                              ]}
                            >
                              {meeting.location?.trim() || "Chưa xác định"}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : canCreateMeeting ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/meeting/create",
                        params: { date: item.dateKey },
                      })
                    }
                    style={styles.weekEmptyRow}
                  >
                    <Plus size={14} color="#00AECA" strokeWidth={2.4} />
                    <Text style={styles.weekEmptyText}>Chưa có lịch · Chạm để tạo cuộc họp</Text>
                  </Pressable>
                ) : (
                  <View style={styles.weekEmptyRow}>
                    <Text style={styles.weekEmptyText}>Chưa có cuộc họp</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* CHẾ ĐỘ XEM NGÀY: Thiết kế đơn sắc - Dải chọn ngày tuần + Thẻ họp nền trắng, viền brand, text đen */}
      {viewMode === "day" && (
        <ScrollView
          style={styles.calendarScroll}
          contentContainerStyle={styles.dayViewContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Dải chọn ngày nhanh trong tuần */}
          <View style={styles.dayStripContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayStripContent}
            >
              {dayStripDays.map((d) => {
                const isSelected = toDateKey(d) === toDateKey(selectedDate);
                const isToday = toDateKey(d) === todayKey;
                const dayIndex = (d.getDay() + 6) % 7;
                const dayLabel = DAY_LABELS[dayIndex];

                return (
                  <Pressable
                    key={toDateKey(d)}
                    onPress={() => setSelectedDate(d)}
                    style={[
                      styles.dayStripPill,
                      isSelected && styles.dayStripPillSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayStripLabel,
                        isSelected ? styles.dayStripLabelSelected : isToday && styles.textBrand,
                      ]}
                    >
                      {dayLabel}
                    </Text>
                    <Text
                      style={[
                        styles.dayStripNumber,
                        isSelected ? styles.dayStripNumberSelected : isToday && styles.textBrand,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                    {isToday && !isSelected && <View style={styles.todaySmallDot} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Banner thông tin ngày đang chọn */}
          <View style={styles.dayViewDateBanner}>
            <Text style={styles.dayViewDateText}>
              Lịch ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1}/
              {selectedDate.getFullYear()}
            </Text>
            <Text style={styles.dayViewDateCount}>
              {selectedDayMeetings.length > 0
                ? `${selectedDayMeetings.length} cuộc họp`
                : "0 cuộc họp"}
            </Text>
          </View>

          {/* Danh sách cuộc họp trong ngày */}
          {selectedDayMeetings.length > 0 ? (
            <View style={styles.dayMeetingList}>
              {selectedDayMeetings.map((meeting) => {
                const isCancelled = meeting.status === "cancelled";
                const timeRangeStr = formatMeetingTime(meeting.startsAt, meeting.endsAt);

                return (
                  <Pressable
                    key={meeting._id}
                    style={[
                      styles.dayMeetingCard,
                      isCancelled
                        ? styles.monoMeetingCardCancelled
                        : styles.monoMeetingCardBrandBorder,
                    ]}
                    onPress={() =>
                      router.push({ pathname: "/meeting/[id]", params: { id: meeting._id } })
                    }
                  >
                    <View style={styles.monoMeetingHeader}>
                      <Text
                        style={[
                          styles.dayMeetingTitle,
                          isCancelled ? styles.textCancelled : styles.textDark,
                        ]}
                      >
                        {meeting.title}
                      </Text>
                      {isCancelled && (
                        <View style={styles.cancelledBadge}>
                          <Text style={styles.cancelledBadgeText}>ĐÃ HỦY</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.dayMeetingMetaRow}>
                      <Clock
                        size={14}
                        color={isCancelled ? "#DC2626" : "#64748B"}
                        strokeWidth={1.8}
                      />
                      <Text
                        style={[
                          styles.dayMeetingMetaText,
                          isCancelled ? styles.textCancelled : styles.textMuted,
                        ]}
                      >
                        {timeRangeStr}
                      </Text>

                      <MapPin
                        size={14}
                        color={isCancelled ? "#DC2626" : "#64748B"}
                        strokeWidth={1.8}
                      />
                      <Text
                        style={[
                          styles.dayMeetingMetaText,
                          isCancelled ? styles.textCancelled : styles.textMuted,
                        ]}
                      >
                        {meeting.location?.trim() || "Chưa xác định"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.dayEmptyContainer}>
              <EmptyState
                title="Không có cuộc họp"
                message={`Ngày ${selectedDate.getDate()}/${selectedDate.getMonth() + 1} chưa có lịch họp nào.`}
              />
              {canCreateMeeting ? <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/meeting/create",
                    params: { date: toDateKey(selectedDate) },
                  })
                }
                style={styles.createMeetingQuickBtn}
              >
                <Plus color="#FFFFFF" size={17} strokeWidth={2.4} />
                <Text style={styles.createMeetingQuickBtnText}>Tạo cuộc họp ngày này</Text>
              </Pressable> : null}
            </View>
          )}
        </ScrollView>
      )}

      {/* 5. Bottom Sheet xem chi tiết khi bấm vào một ô ngày ở chế độ Tháng */}
      <Modal
        visible={isDayDetailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDayDetailModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsDayDetailModalVisible(false)}
          />

          <View style={[styles.modalContent, { paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 48) : Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Lịch ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1}/
                  {selectedDate.getFullYear()}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedDayMeetings.length > 0
                    ? `${selectedDayMeetings.length} cuộc họp được tìm thấy`
                    : "Chưa có cuộc họp trong ngày này"}
                </Text>
              </View>

              <View style={styles.modalHeaderActions}>
                {canCreateMeeting ? <Pressable
                  accessibilityLabel="Tạo cuộc họp ngày này"
                  hitSlop={8}
                  onPress={() => {
                    setIsDayDetailModalVisible(false);
                    router.push({
                      pathname: "/meeting/create",
                      params: { date: toDateKey(selectedDate) },
                    });
                  }}
                  style={styles.modalAddMeetingBtn}
                >
                  <Plus color="#00AECA" size={19} strokeWidth={2.4} />
                </Pressable> : null}

                <Pressable
                  accessibilityLabel="Đóng"
                  hitSlop={10}
                  onPress={() => setIsDayDetailModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <X color="#64748B" size={20} strokeWidth={2.4} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedDayMeetings.length > 0 ? (
                selectedDayMeetings.map((meeting) => {
                  const isCancelled = meeting.status === "cancelled";
                  const timeRangeStr = formatMeetingTime(meeting.startsAt, meeting.endsAt);

                  return (
                    <Pressable
                      key={meeting._id}
                      style={[
                        styles.sheetMeetingCard,
                        isCancelled
                          ? styles.monoMeetingCardCancelled
                          : styles.monoMeetingCardBrandBorder,
                      ]}
                      onPress={() => {
                        setIsDayDetailModalVisible(false);
                        router.push({
                          pathname: "/meeting/[id]",
                          params: { id: meeting._id },
                        });
                      }}
                    >
                      <View style={styles.sheetMeetingHeader}>
                        <Text
                          style={[
                            styles.sheetMeetingTitle,
                            isCancelled ? styles.textCancelled : styles.textDark,
                          ]}
                        >
                          {meeting.title}
                        </Text>
                        {isCancelled && (
                          <View style={styles.cancelledBadge}>
                            <Text style={styles.cancelledBadgeText}>ĐÃ HỦY</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.sheetMetaRow}>
                        <Clock
                          size={13}
                          color={isCancelled ? "#DC2626" : "#64748B"}
                          strokeWidth={1.8}
                        />
                        <Text
                          style={[
                            styles.sheetMetaText,
                            isCancelled ? styles.textCancelled : styles.textMuted,
                          ]}
                        >
                          {timeRangeStr}
                        </Text>
                        <MapPin
                          size={13}
                          color={isCancelled ? "#DC2626" : "#64748B"}
                          strokeWidth={1.8}
                        />
                        <Text
                          style={[
                            styles.sheetMetaText,
                            isCancelled ? styles.textCancelled : styles.textMuted,
                          ]}
                        >
                          {meeting.location?.trim() || "Chưa xác định"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.sheetEmpty}>
                  <CalendarIcon color="#00AECA" size={36} strokeWidth={1.8} />
                  <Text style={styles.sheetEmptyTitle}>Không có lịch họp</Text>
                  <Text style={styles.sheetEmptyText}>
                    Ngày này chưa có cuộc họp nào được lên lịch.
                  </Text>
                  {canCreateMeeting ? <Pressable
                    onPress={() => {
                      setIsDayDetailModalVisible(false);
                      router.push({
                        pathname: "/meeting/create",
                        params: { date: toDateKey(selectedDate) },
                      });
                    }}
                    style={styles.sheetCreateBtn}
                  >
                    <Plus color="#FFFFFF" size={16} strokeWidth={2.4} />
                    <Text style={styles.sheetCreateBtnText}>Tạo cuộc họp ngày này</Text>
                  </Pressable> : null}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  /* 1. Header Bar: Màu nền chuẩn iGen Connect (#00AECA) */
  headerBar: {
    backgroundColor: "#00AECA",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerBackBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },
  headerTitleText: {
    color: "#FFFFFF",
    fontSize: 16.5,
    fontWeight: "800",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },

  /* 2. Segmented Control: Tháng | Tuần | Ngày */
  tabContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    ...shadow,
  },
  segmentBtnText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  segmentBtnTextActive: {
    color: "#0F172A",
    fontWeight: "800",
  },

  /* 3. Thanh điều hướng: < Tiêu đề > */
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  navArrowBtn: {
    padding: 4,
  },
  monthTitleText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  /* 4. Lưới lịch tháng */
  calendarScroll: {
    flex: 1,
  },
  calendarScrollContent: {
    paddingBottom: 32,
  },
  dayLabelsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FAFAFA",
  },
  dayLabelCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabelText: {
    color: "#64748B",
    fontSize: 11.5,
    fontWeight: "700",
  },
  gridContainer: {
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  gridRow: {
    flexDirection: "row",
    minHeight: 74,
  },
  gridCell: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
    paddingHorizontal: 2,
    paddingVertical: 4,
    justifyContent: "flex-start",
  },
  gridCellOtherMonth: {
    backgroundColor: "#FBFDFF",
  },
  dayNumberWrap: {
    alignItems: "center",
    marginBottom: 2,
  },
  dayNumberCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCircle: {
    backgroundColor: "#00AECA",
  },
  dayNumberText: {
    color: "#1E293B",
    fontSize: 12,
    fontWeight: "600",
  },
  dayNumberTextOtherMonth: {
    color: "#CBD5E1",
  },
  todayNumberText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  eventsWrapper: {
    gap: 2,
    width: "100%",
  },

  /* Nhãn cuộc họp xem tháng */
  meetingChip: {
    borderRadius: 3.5,
    paddingHorizontal: 3.5,
    paddingVertical: 1.5,
    marginHorizontal: 1,
  },
  meetingChipBrand: {
    backgroundColor: "#00AECA",
  },
  meetingChipTextBrand: {
    color: "#FFFFFF",
  },
  meetingChipCancelled: {
    backgroundColor: "#FEE2E2",
    borderWidth: 0.5,
    borderColor: "#FCA5A5",
  },
  meetingChipTextCancelled: {
    color: "#DC2626",
    fontWeight: "700",
  },
  meetingChipText: {
    fontSize: 9.5,
    fontWeight: "600",
    lineHeight: 12,
  },
  remainingBadge: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 1,
  },

  /* Thẻ đơn sắc */
  monoMeetingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    gap: 6,
    ...shadow,
  },
  monoMeetingCardBrandBorder: {
    borderWidth: 1.5,
    borderColor: "#00AECA",
  },
  monoMeetingCardCancelled: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#DC2626",
  },
  monoMeetingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  monoMeetingTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  monoMeetingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  monoMeetingMetaText: {
    fontSize: 12,
    fontWeight: "500",
    marginRight: 8,
  },
  cancelledBadge: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cancelledBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
  },

  /* Chế độ xem Tuần */
  weekViewContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 36,
  },
  weekDaySection: {
    gap: 8,
  },
  weekDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  weekDayHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weekDayTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  todaySmallPill: {
    backgroundColor: "#E4F8FB",
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
  },
  todaySmallPillText: {
    color: "#00AECA",
    fontSize: 11,
    fontWeight: "700",
  },
  weekDayEventCount: {
    color: "#94A3B8",
    fontSize: 12,
  },
  weekMeetingList: {
    gap: 8,
  },
  weekEmptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  weekEmptyText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
  },

  /* Chế độ xem Ngày */
  dayViewContainer: {
    padding: 16,
    gap: 14,
    paddingBottom: 36,
  },
  dayStripContainer: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  dayStripContent: {
    gap: 8,
  },
  dayStripPill: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 3,
  },
  dayStripPillSelected: {
    backgroundColor: "#00AECA",
    borderColor: "#00AECA",
  },
  dayStripLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
  },
  dayStripLabelSelected: {
    color: "#FFFFFF",
  },
  dayStripNumber: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },
  dayStripNumberSelected: {
    color: "#FFFFFF",
  },
  todaySmallDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#00AECA",
  },
  dayViewDateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
  },
  dayViewDateText: {
    color: "#0F172A",
    fontSize: 13.5,
    fontWeight: "700",
  },
  dayViewDateCount: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  dayMeetingList: {
    gap: 10,
  },
  dayMeetingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    ...shadow,
  },
  dayMeetingTitle: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  dayMeetingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  dayMeetingMetaText: {
    fontSize: 12.5,
    fontWeight: "500",
    marginRight: 10,
  },
  dayEmptyContainer: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
  },
  createMeetingQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00AECA",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.pill,
    ...shadow,
  },
  createMeetingQuickBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },

  /* Bottom sheet modal chi tiết ngày */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "75%",
    ...shadow,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: "#64748B",
    fontSize: 12,
  },
  modalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalAddMeetingBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E4F8FB",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    gap: 10,
    paddingBottom: 16,
  },
  sheetMeetingCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 10,
    gap: 6,
    ...shadow,
  },
  sheetMeetingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sheetMeetingTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    flex: 1,
  },
  sheetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  sheetMetaText: {
    fontSize: 11.5,
    marginRight: 8,
  },
  sheetEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  sheetEmptyTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },
  sheetEmptyText: {
    color: "#64748B",
    fontSize: 12.5,
  },
  sheetCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00AECA",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: 8,
  },
  sheetCreateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Text color & Brand helpers */
  textDark: {
    color: "#0F172A",
  },
  textMuted: {
    color: "#64748B",
  },
  textCancelled: {
    color: "#DC2626",
  },
  textBrand: {
    color: "#00AECA",
  },
});
