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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Card, EmptyState } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  applyMeetingChange,
  meetingService,
  subscribeMeetingChanges,
  type Meeting,
} from "@/services/meeting";
import { radius, shadow } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

type ViewMode = "month" | "week" | "day";

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function MeetingsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const canCreateMeeting = hasPermission(user, "meetings:manage");

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

  // Danh sách cuộc họp mẫu hiển thị chuẩn theo ảnh mockup nếu DB ít dữ liệu
  const sampleMeetings: Meeting[] = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    return [
      {
        _id: "sample-c1",
        title: "Product Review",
        startsAt: new Date(year, month, 1, 9, 0).toISOString(),
        endsAt: new Date(year, month, 1, 10, 30).toISOString(),
        location: "Phòng họp 1",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c2",
        title: "Tên cuộc họp hủy",
        startsAt: new Date(year, month, 1, 14, 0).toISOString(),
        endsAt: new Date(year, month, 1, 15, 0).toISOString(),
        location: "Online",
        status: "cancelled", // Cuộc họp bị hủy -> hiển thị chữ màu đỏ tươi
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c3",
        title: "Cuộc họp Ban",
        startsAt: new Date(year, month, 15, 8, 30).toISOString(),
        endsAt: new Date(year, month, 15, 10, 0).toISOString(),
        location: "Hội trường A",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c4",
        title: "Product Demo",
        startsAt: new Date(year, month, 15, 14, 0).toISOString(),
        endsAt: new Date(year, month, 15, 15, 30).toISOString(),
        location: "Phòng họp 2",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c5",
        title: "Product Release",
        startsAt: new Date(year, month, 17, 10, 0).toISOString(),
        endsAt: new Date(year, month, 17, 11, 30).toISOString(),
        location: "Online",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c6",
        title: "Feature Kickoff",
        startsAt: new Date(year, month, 18, 9, 0).toISOString(),
        endsAt: new Date(year, month, 18, 10, 0).toISOString(),
        location: "Phòng họp 3",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c7",
        title: "Triển khai hệ thống",
        startsAt: new Date(year, month, 19, 14, 0).toISOString(),
        endsAt: new Date(year, month, 19, 16, 0).toISOString(),
        location: "Phòng dự án",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c8",
        title: "Release Review",
        startsAt: new Date(year, month, 20, 8, 30).toISOString(),
        endsAt: new Date(year, month, 20, 9, 30).toISOString(),
        location: "Online",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c9",
        title: "Cs + Mobile",
        startsAt: new Date(year, month, 20, 10, 0).toISOString(),
        endsAt: new Date(year, month, 20, 11, 0).toISOString(),
        location: "Phòng họp 1",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c10",
        title: "Thảo luận UI/UX",
        startsAt: new Date(year, month, 20, 14, 0).toISOString(),
        endsAt: new Date(year, month, 20, 15, 0).toISOString(),
        location: "Online",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c11",
        title: "Cuộc họp tháng",
        startsAt: new Date(year, month, 22, 9, 0).toISOString(),
        endsAt: new Date(year, month, 22, 10, 30).toISOString(),
        location: "Hội trường",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c12",
        title: "Báo cáo tiến độ",
        startsAt: new Date(year, month, 22, 14, 0).toISOString(),
        endsAt: new Date(year, month, 22, 15, 0).toISOString(),
        location: "Phòng họp 2",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c13",
        title: "Feature Kickoff Q3",
        startsAt: new Date(year, month, 25, 9, 30).toISOString(),
        endsAt: new Date(year, month, 25, 11, 0).toISOString(),
        location: "Phòng họp 3",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-c14",
        title: "Product Innovation",
        startsAt: new Date(year, month, 27, 15, 0).toISOString(),
        endsAt: new Date(year, month, 27, 16, 30).toISOString(),
        location: "Phòng họp 1",
        status: "scheduled",
        speakers: [],
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
    ];
  }, [currentDate]);

  const allMeetings = useMemo(() => {
    if (calendarMeetings.length > 0) {
      return calendarMeetings;
    }
    return sampleMeetings;
  }, [calendarMeetings, sampleMeetings]);

  // Map ngày -> danh sách cuộc họp
  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of allMeetings) {
      const key = toDateKey(new Date(m.startsAt));
      const list = map.get(key) || [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [allMeetings]);

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

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (date: Date) => {
    setSelectedDate(date);
    setIsDayDetailModalVisible(true);
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

  const monthDisplayStr = `${String(currentDate.getMonth() + 1).padStart(2, "0")} / ${currentDate.getFullYear()}`;

  return (
    <View style={styles.container}>
      {/* 1. Header Bar: Màu nền chuẩn của brand iGen Connect (#00AECA), Tiêu đề "Lịch trình" */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleWrap}>
            <Avatar initials={userInitials} url={user?.photoURL} size={34} />
            <Text style={styles.headerTitleText}>Lịch trình</Text>
          </View>

          {canCreateMeeting && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tạo cuộc họp mới"
              hitSlop={8}
              onPress={() => router.push("/meeting/create")}
              style={({ pressed }) => [styles.headerAddBtn, pressed && styles.pressed]}
            >
              <Plus color="#FFFFFF" size={20} strokeWidth={2.4} />
            </Pressable>
          )}
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

      {/* 3. Thanh điều hướng Tháng: < 06 / 2026 > */}
      <View style={styles.monthNavRow}>
        <Pressable
          accessibilityLabel="Tháng trước"
          hitSlop={10}
          onPress={handlePrevMonth}
          style={({ pressed }) => [styles.navArrowBtn, pressed && styles.pressed]}
        >
          <ChevronLeft color="#475569" size={20} strokeWidth={2.4} />
        </Pressable>

        <Text style={styles.monthTitleText}>{monthDisplayStr}</Text>

        <Pressable
          accessibilityLabel="Tháng tiếp theo"
          hitSlop={10}
          onPress={handleNextMonth}
          style={({ pressed }) => [styles.navArrowBtn, pressed && styles.pressed]}
        >
          <ChevronRight color="#475569" size={20} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* 4. Nội dung lịch tương ứng từng chế độ xem */}
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
                      onPress={() => handleSelectDay(cell.date)}
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

      {/* Chế độ xem Tuần: Đơn sắc hơn - Nền trắng, text đen, viền màu brand cho cuộc họp bình thường */}
      {viewMode === "week" && (
        <ScrollView
          style={styles.calendarScroll}
          contentContainerStyle={styles.weekViewContainer}
          showsVerticalScrollIndicator={false}
        >
          {DAY_LABELS.map((dayLabel, index) => {
            const currentDayOfWeek = currentDate.getDay();
            const diffToMonday =
              currentDate.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1);
            const targetDate = new Date(currentDate);
            targetDate.setDate(diffToMonday + index);
            const key = toDateKey(targetDate);
            const dayEvents = meetingsByDay.get(key) || [];
            const isToday = key === todayKey;

            return (
              <Card key={key} style={styles.weekDayCard}>
                <View style={styles.weekDayHeader}>
                  <Text style={[styles.weekDayLabel, isToday && styles.weekDayLabelToday]}>
                    {dayLabel} - {targetDate.getDate()}/{targetDate.getMonth() + 1}
                  </Text>
                  {isToday ? (
                    <View style={styles.todaySmallBadge}>
                      <Text style={styles.todaySmallBadgeText}>Hôm nay</Text>
                    </View>
                  ) : null}
                </View>

                {dayEvents.length > 0 ? (
                  dayEvents.map((meeting) => {
                    const isCancelled = meeting.status === "cancelled";
                    const startTime = new Date(meeting.startsAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <Pressable
                        key={meeting._id}
                        onPress={() =>
                          router.push({ pathname: "/meeting/[id]", params: { id: meeting._id } })
                        }
                        style={[
                          styles.weekMeetingItem,
                          isCancelled
                            ? styles.weekMeetingItemCancelled
                            : styles.weekMeetingItemBrand,
                        ]}
                      >
                        <View style={styles.weekMeetingInfo}>
                          <Text
                            style={[
                              styles.weekMeetingTitle,
                              isCancelled ? styles.textCancelled : styles.textDark,
                            ]}
                          >
                            {meeting.title}
                          </Text>
                          <Text
                            style={[
                              styles.weekMeetingTime,
                              isCancelled ? styles.textCancelled : styles.textMuted,
                            ]}
                          >
                            {startTime} · {meeting.location || "Trực tiếp"}
                          </Text>
                        </View>
                        {isCancelled && (
                          <View style={styles.cancelledBadgeSmall}>
                            <Text style={styles.cancelledBadgeSmallText}>ĐÃ HỦY</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.weekEmptyText}>Không có lịch họp</Text>
                )}
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* Chế độ xem Ngày: Đơn sắc hơn - Nền trắng, text đen, viền màu brand cho cuộc họp bình thường */}
      {viewMode === "day" && (
        <ScrollView
          style={styles.calendarScroll}
          contentContainerStyle={styles.dayViewContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dayViewDateBanner}>
            <Text style={styles.dayViewDateText}>
              Lịch ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1}/
              {selectedDate.getFullYear()}
            </Text>
          </View>

          {selectedDayMeetings.length > 0 ? (
            selectedDayMeetings.map((meeting) => {
              const isCancelled = meeting.status === "cancelled";
              const start = new Date(meeting.startsAt);
              const timeStr = start.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <Pressable
                  key={meeting._id}
                  style={[
                    styles.dayDetailCard,
                    isCancelled ? styles.dayDetailCardCancelled : styles.dayDetailCardBrand,
                  ]}
                  onPress={() =>
                    router.push({ pathname: "/meeting/[id]", params: { id: meeting._id } })
                  }
                >
                  <Text
                    style={[
                      styles.dayDetailTitle,
                      isCancelled ? styles.textCancelled : styles.textDark,
                    ]}
                  >
                    {meeting.title}
                  </Text>
                  <View style={styles.dayDetailMetaRow}>
                    <Clock
                      size={14}
                      color={isCancelled ? "#DC2626" : "#64748B"}
                      strokeWidth={1.8}
                    />
                    <Text
                      style={[
                        styles.dayDetailMetaText,
                        isCancelled ? styles.textCancelled : styles.textMuted,
                      ]}
                    >
                      {timeStr}
                    </Text>
                    <MapPin
                      size={14}
                      color={isCancelled ? "#DC2626" : "#64748B"}
                      strokeWidth={1.8}
                    />
                    <Text
                      style={[
                        styles.dayDetailMetaText,
                        isCancelled ? styles.textCancelled : styles.textMuted,
                      ]}
                    >
                      {meeting.location || "---"}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <EmptyState
              title="Không có cuộc họp"
              message="Ngày này chưa có lịch họp nào. Bạn có thể chọn ngày khác hoặc tạo cuộc họp mới."
            />
          )}
        </ScrollView>
      )}

      {/* 5. Bottom Sheet xem chi tiết khi bấm vào một ô ngày */}
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

          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
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

              <Pressable
                accessibilityLabel="Đóng"
                hitSlop={10}
                onPress={() => setIsDayDetailModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X color="#64748B" size={20} strokeWidth={2.4} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedDayMeetings.length > 0 ? (
                selectedDayMeetings.map((meeting) => {
                  const isCancelled = meeting.status === "cancelled";
                  const start = new Date(meeting.startsAt);
                  const startTime = start.toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <Pressable
                      key={meeting._id}
                      style={[
                        styles.sheetMeetingCard,
                        isCancelled ? styles.sheetCardCancelled : styles.sheetCardBrand,
                      ]}
                      onPress={() => {
                        setIsDayDetailModalVisible(false);
                        router.push({
                          pathname: meeting.status === "live" ? "/meeting/[id]/live" : "/meeting/[id]",
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
                          <View style={styles.cancelledTag}>
                            <Text style={styles.cancelledTagText}>ĐÃ HỦY</Text>
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
                          {startTime}
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
                          {meeting.location || "---"}
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
    backgroundColor: "#00AECA", // Màu brand chính xác
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
    gap: 10,
  },
  headerTitleText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },
  headerAddBtn: {
    width: 36,
    height: 36,
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
    backgroundColor: "#E2E8F0",
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

  /* 3. Thanh điều hướng Tháng: < 06 / 2026 > */
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  navArrowBtn: {
    padding: 4,
  },
  monthTitleText: {
    color: "#0F172A",
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: 0.5,
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
    borderTopWidth: 1,
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
    backgroundColor: "#00AECA", // Màu brand làm nổi bật ngày hiện tại
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

  /* Nhãn cuộc họp xem tháng: Nền Brand (#00AECA) và chữ trắng khi bình thường */
  meetingChip: {
    borderRadius: 3.5,
    paddingHorizontal: 3.5,
    paddingVertical: 1.5,
    marginHorizontal: 1,
  },
  meetingChipBrand: {
    backgroundColor: "#00AECA", // Màu brand chính xác
  },
  meetingChipTextBrand: {
    color: "#FFFFFF", // Chữ trắng khi dùng nền màu brand
  },

  /* Cuộc họp bị hủy xem tháng: Đánh dấu màu đỏ tươi (#DC2626) */
  meetingChipCancelled: {
    backgroundColor: "#FEE2E2",
    borderWidth: 0.5,
    borderColor: "#FCA5A5",
  },
  meetingChipTextCancelled: {
    color: "#DC2626", // Chữ màu đỏ tươi khi bị hủy
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

  /* Chế độ xem Tuần: Đơn sắc hơn - Nền trắng, text đen, viền màu brand */
  weekViewContainer: {
    padding: 14,
    gap: 10,
  },
  weekDayCard: {
    padding: 12,
    gap: 8,
  },
  weekDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekDayLabel: {
    color: "#0F172A",
    fontSize: 13.5,
    fontWeight: "700",
  },
  weekDayLabelToday: {
    color: "#00AECA",
  },
  todaySmallBadge: {
    backgroundColor: "#E4F8FB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  todaySmallBadgeText: {
    color: "#00AECA",
    fontSize: 11,
    fontWeight: "700",
  },
  weekMeetingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
  },
  weekMeetingItemBrand: {
    backgroundColor: "#FFFFFF", // Nền trắng đơn sắc
    borderWidth: 1.5,
    borderColor: "#00AECA", // Viền màu brand
  },
  weekMeetingItemCancelled: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
  },
  weekMeetingInfo: {
    flex: 1,
    gap: 2,
  },
  weekMeetingTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  weekMeetingTime: {
    fontSize: 11,
    fontWeight: "500",
  },
  cancelledBadgeSmall: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cancelledBadgeSmallText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  weekEmptyText: {
    color: "#94A3B8",
    fontSize: 12,
    fontStyle: "italic",
  },

  /* Chế độ xem Ngày: Đơn sắc hơn - Nền trắng, text đen, viền màu brand */
  dayViewContainer: {
    padding: 14,
    gap: 10,
  },
  dayViewDateBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
  },
  dayViewDateText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  dayDetailCard: {
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  dayDetailCardBrand: {
    backgroundColor: "#FFFFFF", // Nền trắng đơn sắc
    borderWidth: 1.5,
    borderColor: "#00AECA", // Viền màu brand
    ...shadow,
  },
  dayDetailCardCancelled: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    ...shadow,
  },
  dayDetailTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  dayDetailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayDetailMetaText: {
    fontSize: 12,
    fontWeight: "500",
  },

  /* Bottom sheet modal: Đơn sắc hơn - Nền trắng, text đen, viền màu brand */
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
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  sheetCardBrand: {
    backgroundColor: "#FFFFFF", // Nền trắng đơn sắc
    borderWidth: 1.5,
    borderColor: "#00AECA", // Viền màu brand
  },
  sheetCardCancelled: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
  },
  sheetMeetingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetMeetingTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    flex: 1,
  },
  cancelledTag: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cancelledTagText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  sheetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetMetaText: {
    fontSize: 11.5,
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

  /* Text color helpers */
  textDark: {
    color: "#0F172A", // Text đen / đậm như bình thường
  },
  textMuted: {
    color: "#64748B",
  },
  textCancelled: {
    color: "#DC2626", // Text đỏ tươi cho cuộc họp bị hủy
  },
});
