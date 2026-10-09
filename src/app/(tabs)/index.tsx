import { router, useFocusEffect } from "expo-router";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Clock,
  Fingerprint,
  MapPin,
  Mic,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Avatar,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { DashboardQuickActions } from "@/components/DashboardQuickActions";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { applyMeetingChange, meetingService, subscribeMeetingChanges, type Meeting } from "@/services/meeting";
import { colors, radius, shadow, spacing } from "@/theme/tokens";
import { meetingCheckInAvailability } from "@/utils/meetingCheckIn";
import { hasPermission } from "@/utils/permissions";

function formatMeetingDetails(startsAt: string, endsAt?: string) {
  const start = new Date(startsAt);
  const monthNum = start.getMonth() + 1;
  const dayNum = String(start.getDate()).padStart(2, "0");
  const year = start.getFullYear();
  const dateStr = `${dayNum}/${String(monthNum).padStart(2, "0")}/${year}`;
  const startTime = start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  let endTime = "";
  let duration = "1h";

  if (endsAt) {
    const end = new Date(endsAt);
    endTime = end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0 && mins > 0) duration = `${hours}h${mins}p`;
    else if (hours > 0) duration = `${hours}h`;
    else if (mins > 0) duration = `${mins}p`;
  } else {
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    endTime = end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    duration = "1h";
  }

  return {
    dateStr,
    timeRange: `${startTime} - ${endTime}`,
    duration,
    monthNum,
    dayNum,
  };
}

function getMeetingStatusInfo(meeting: Meeting) {
  const now = new Date();
  const start = new Date(meeting.startsAt);
  const end = meeting.endsAt ? new Date(meeting.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);

  if (
    meeting.status === "live" ||
    meeting.status === "paused" ||
    (now >= start && now <= end && meeting.status !== "ended" && meeting.status !== "cancelled")
  ) {
    return {
      label: "Đang diễn ra",
      color: "#16A34A", // Xanh lá
      bg: "#DCFCE7",
      isLive: true,
    };
  }

  if (meeting.status === "ended" || now > end) {
    return {
      label: "Đã kết thúc",
      color: "#64748B",
      bg: "#F1F5F9",
      isEnded: true,
    };
  }

  return {
    label: "Sắp diễn ra",
    color: "#00ADFC", // Xanh dương
    bg: "rgba(0, 173, 252, 0.12)",
    isUpcoming: true,
  };
}

function ScheduleMeetingCard({
  meeting,
  themeColor = "blue",
  index = 0,
}: {
  meeting: Meeting;
  themeColor?: "blue" | "green";
  index?: number;
}) {
  const isBlue = themeColor === "blue";
  const statusInfo = getMeetingStatusInfo(meeting);
  const primaryColor = statusInfo.isLive ? "#16A34A" : statusInfo.isUpcoming ? "#00ADFC" : isBlue ? "#00ADFC" : "#10B981";
  const badgeBorder = statusInfo.isLive ? "#DCFCE7" : statusInfo.isUpcoming ? "rgba(0, 173, 252, 0.12)" : isBlue ? "rgba(0, 173, 252, 0.12)" : "#D1FAE5";

  const { dateStr, timeRange, duration, monthNum, dayNum } = formatMeetingDetails(
    meeting.startsAt,
    meeting.endsAt,
  );

  const handlePress = () => {
    router.push({
      pathname: "/meeting/[id]",
      params: { id: meeting._id },
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cuộc họp: ${meeting.title} (${statusInfo.label})`}
      onPress={handlePress}
      style={({ pressed }) => [styles.scheduleCard, pressed && styles.cardPressed]}
    >
      {/* Khung ngày tháng bên trái */}
      <View style={[styles.dateBadge, { borderColor: badgeBorder }]}>
        <View style={[styles.dateBadgeHeader, { backgroundColor: primaryColor }]}>
          <Text style={styles.dateBadgeHeaderText}>THG {monthNum}</Text>
        </View>
        <View style={styles.dateBadgeBody}>
          <Text style={[styles.dateBadgeDayText, { color: primaryColor }]}>{dayNum}</Text>
        </View>
      </View>

      {/* Thông tin chi tiết bên phải */}
      <View style={styles.cardDetails}>
        {/* Dòng 1: Chấm tròn, Tiêu đề và Trạng thái */}
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <View style={[styles.bulletDot, { backgroundColor: statusInfo.color }]} />
            <Text numberOfLines={1} style={styles.cardTitle}>
              {meeting.title}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Dòng 2: Thời gian với icon Đồng hồ */}
        <View style={styles.metaRow}>
          <Clock size={12.5} color="#64748B" strokeWidth={1.8} />
          <Text numberOfLines={1} style={styles.metaText}>
            {dateStr} · {timeRange} ({duration})
          </Text>
        </View>

        {/* Dòng 3: Địa điểm với icon MapPin */}
        <View style={styles.metaRow}>
          <MapPin size={12.5} color="#64748B" strokeWidth={1.8} />
          <Text numberOfLines={1} style={styles.metaText}>
            {meeting.location?.trim() || "Chưa xác định"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const waveHeights = [
  [0.45, 1, 0.65, 0.35, 0.45],
  [0.7, 0.45, 1, 0.55, 0.7],
  [1, 0.6, 0.35, 0.8, 1],
  [0.55, 0.9, 0.5, 1, 0.55],
  [0.4, 0.65, 1, 0.6, 0.4],
];

function LiveWaveform() {
  const [progress] = useState(() => new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      progress.setValue(0);
      const wave = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      wave.start();
      return () => wave.stop();
    }, [progress]),
  );

  return (
    <View accessible={false} style={styles.liveWave}>
      {waveHeights.map((heights, index) => (
        <Animated.View
          key={index}
          style={[
            styles.liveWaveBar,
            {
              transform: [{
                scaleY: progress.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: heights,
                }),
              }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Trạng thái thu gọn/mở rộng các mục lịch họp
  const [isUpcomingOpen, setIsUpcomingOpen] = useState(true);
  const [isThisWeekOpen, setIsThisWeekOpen] = useState(false);
  const [visibleUpcomingCount, setVisibleUpcomingCount] = useState(10);

  // Đồng hồ chạy thời gian thực từng giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = useMemo(() => {
    const hh = String(currentTime.getHours()).padStart(2, "0");
    const mm = String(currentTime.getMinutes()).padStart(2, "0");
    const ss = String(currentTime.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, [currentTime]);

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return "Chào buổi sáng";
    if (hour >= 12 && hour < 14) return "Chào buổi trưa";
    if (hour >= 14 && hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }, [currentTime]);

  const todayDateString = useMemo(() => {
    const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayName = dayNames[currentTime.getDay()];
    const d = currentTime.getDate();
    const m = currentTime.getMonth() + 1;
    const y = currentTime.getFullYear();
    return `${dayName}, ${d}/${m}/${y}`;
  }, [currentTime]);

  const weekRangeText = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDay = monday.getDate();
    const startMonth = monday.getMonth() + 1;
    const endDay = sunday.getDate();
    const endMonth = sunday.getMonth() + 1;

    return `${startDay} thg ${startMonth} - ${endDay} thg ${endMonth}`;
  }, []);

  const { data, setData, error, isLoading, reload } = useAsyncData(() => meetingService.list());
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        void reload();
      } else {
        hasFocused.current = true;
      }
    }, [reload]),
  );

  useEffect(() => {
    return subscribeMeetingChanges((change) => {
      setData((current) => applyMeetingChange(current, change));
    });
  }, [setData]);

  const meetings = useMemo(() => data || [], [data]);

  // Lọc bỏ hoàn toàn các cuộc họp đã hủy khỏi danh sách và thống kê trên trang chủ
  const activeMeetings = useMemo(
    () => meetings.filter((m) => m.status !== "cancelled"),
    [meetings]
  );

  const liveMeeting = useMemo(
    () => activeMeetings.find((meeting) => meeting.status === "live" || meeting.status === "paused"),
    [activeMeetings],
  );

  // Chỉ lấy lịch còn ở tương lai để chọn cuộc họp sắp diễn ra gần nhất.
  const { upcomingMeetings, thisWeekMeetings } = useMemo(() => {
    const now = currentTime;
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mondayDate = new Date(now);
    mondayDate.setDate(diffToMonday);
    mondayDate.setHours(0, 0, 0, 0);

    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);
    sundayDate.setHours(23, 59, 59, 999);

    const upcoming = activeMeetings
      .filter((m) => m.status === "scheduled" && new Date(m.startsAt) > now)
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    const thisWeek = activeMeetings
      .filter((m) => {
        const d = new Date(m.startsAt);
        return d >= mondayDate && d <= sundayDate;
      })
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

    return { upcomingMeetings: upcoming, thisWeekMeetings: thisWeek };
  }, [activeMeetings, currentTime]);

  const featuredMeeting = liveMeeting ?? upcomingMeetings[0];
  const isFeaturedLive = Boolean(liveMeeting);
  const featuredCanCheckIn = Boolean(
    featuredMeeting &&
    !hasPermission(user, "meetings:manage", "access:manage") &&
    meetingCheckInAvailability(featuredMeeting, currentTime.getTime()) === "open"
  );
  const featuredActionLabel = isFeaturedLive || featuredCanCheckIn ? "Vào ngay" : "Xem chi tiết";
  const featuredSchedule = featuredMeeting
    ? formatMeetingDetails(featuredMeeting.startsAt, featuredMeeting.endsAt)
    : null;

  const displayName = user?.displayName || "Nguyễn Văn Việt";
  const userInitials = useMemo(() => {
    return displayName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(-2)
      .join("")
      .toUpperCase();
  }, [displayName]);

  const userRoleTitle = useMemo(() => {
    if (user?.role === "admin") return "Quản trị viên";
    if (user?.role === "manager") return "Quản lý";
    if (user?.role === "branch_owner") return "Chủ chi nhánh";
    if (user?.role === "teacher") return "Giảng viên";
    return "Thành viên";
  }, [user?.role]);

  return (
    <Screen>
      {/* Header Card phong cách ảnh 1: Lời chào, Tên, Chức vụ, Avatar, Đồng hồ số lớn & Ngày */}
      <View style={styles.headerHeroCard}>
        <View style={styles.headerHeroTop}>
          <View style={styles.headerHeroInfo}>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text numberOfLines={1} style={styles.userNameText}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={styles.userRoleText}>
              {userRoleTitle}
            </Text>
          </View>

          <View style={styles.headerHeroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Thông báo${unreadCount ? `, ${unreadCount} mục chưa đọc` : ""}`}
              hitSlop={10}
              onPress={() => router.push("/notifications")}
              style={({ pressed }) => [styles.notificationButton, pressed && styles.cardPressed]}
            >
              <Bell color={colors.brandBlue} size={20} strokeWidth={2} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem hồ sơ cá nhân"
              onPress={() => router.push("/profile")}
              style={({ pressed }) => [styles.avatarPressable, pressed && styles.cardPressed]}
            >
              <Avatar initials={userInitials} url={user?.photoURL} size={54} />
            </Pressable>
          </View>
        </View>

        <View style={styles.headerHeroBottom}>
          <Text style={styles.digitalClockText}>{timeString}</Text>
          <Text style={styles.todayDateText}>{todayDateString}</Text>
        </View>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          {/* Ưu tiên cuộc họp live, nếu không có thì hiển thị lịch gần nhất. */}
          {featuredMeeting ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${featuredActionLabel} cuộc họp: ${featuredMeeting.title}`}
              style={styles.heroCompact}
              onPress={() =>
                router.push({
                  pathname: "/meeting/[id]",
                  params: { id: featuredMeeting._id },
                })
              }
            >
              <View style={styles.heroInnerCard}>
                <View style={styles.heroLeft}>
                  <View style={styles.heroTagRow}>
                    <View style={[styles.liveTagBadge, !isFeaturedLive && styles.upcomingTagBadge]}>
                      <View style={styles.liveDotWrapper}>
                        <View style={[styles.liveStatusDot, !isFeaturedLive && styles.upcomingStatusDot]} />
                      </View>
                      <Text style={[styles.heroTagText, !isFeaturedLive && styles.upcomingTagText]}>
                        {isFeaturedLive ? "Đang diễn ra" : "Sắp diễn ra"}
                      </Text>
                    </View>
                    {isFeaturedLive ? <LiveWaveform /> : null}
                  </View>

                  <View style={styles.titleWithMic}>
                    <View style={styles.heroIconSlot}>
                      <Mic color={colors.brandBlue} size={14} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.heroTitleCompact} numberOfLines={1}>
                      {featuredMeeting.title}
                    </Text>
                  </View>

                  {!isFeaturedLive && featuredSchedule ? (
                    <View style={styles.heroMetaRow}>
                      <View style={styles.heroIconSlot}>
                        <Clock color={colors.brandBlue} size={14} strokeWidth={2.2} />
                      </View>
                      <Text style={styles.heroMetaCompact} numberOfLines={1}>
                        {featuredSchedule.dateStr} · {featuredSchedule.timeRange}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.heroMetaRow}>
                    <View style={styles.heroIconSlot}>
                      <MapPin color={colors.brandBlue} size={14} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.heroMetaCompact} numberOfLines={1}>
                      {featuredMeeting.location?.trim() || "Chưa xác định"}
                    </Text>
                  </View>
                  {isFeaturedLive ? (
                    <View style={styles.heroMetaRow}>
                      <View style={styles.heroIconSlot}>
                        <Fingerprint color={colors.brandBlue} size={14} strokeWidth={2.2} />
                      </View>
                      <Text style={styles.heroMetaCompact} numberOfLines={1}>
                        {featuredMeeting.speakers.length} người đã check-in
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.heroActionBtn}>
                  <Text style={styles.heroActionBtnText}>{featuredActionLabel}</Text>
                  <ArrowRight color="#FFFFFF" size={13} strokeWidth={2.6} />
                </View>
              </View>
            </Pressable>
          ) : null}

          <SectionTitle>Tiện ích</SectionTitle>
          <DashboardQuickActions user={user} />

          {/* Phần Danh sách cuộc họp (Thay thế lịch cũ theo mẫu ảnh 1) */}
          <View style={styles.scheduleSectionHeader}>
            <Text style={styles.scheduleSectionTitle}>Danh sách cuộc họp</Text>
            <Pressable
              accessibilityLabel="Xem tất cả cuộc họp"
              hitSlop={8}
              onPress={() => router.push("/(tabs)/meetings")}
            >
              <Text style={styles.link}>Tất cả ({activeMeetings.length})</Text>
            </Pressable>
          </View>

          {/* Nhóm 1: Sắp diễn ra (Có nút thu gọn / mở rộng) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thu gọn hoặc mở rộng sắp diễn ra"
            style={({ pressed }) => [styles.accordionHeader, pressed && styles.cardPressed]}
            onPress={() => setIsUpcomingOpen((prev) => !prev)}
          >
            <View style={styles.accordionHeaderLeft}>
              {isUpcomingOpen ? (
                <ChevronDown color="#334155" size={17} strokeWidth={2.4} />
              ) : (
                <ChevronRight color="#334155" size={17} strokeWidth={2.4} />
              )}
              <Text style={styles.accordionTitle}>Sắp diễn ra</Text>
            </View>
            <View style={styles.accordionBadge}>
              <Text style={styles.accordionBadgeText}>{upcomingMeetings.length}</Text>
            </View>
          </Pressable>

          {isUpcomingOpen && (
            <View style={styles.accordionContent}>
              {upcomingMeetings.length === 0 ? <EmptyState title="Chưa có cuộc họp sắp diễn ra" message="Cuộc họp mới sẽ xuất hiện tại đây." /> : null}
              {upcomingMeetings.slice(0, visibleUpcomingCount).map((meeting, index) => (
                <ScheduleMeetingCard
                  key={meeting._id}
                  meeting={meeting}
                  themeColor={index % 2 === 0 ? "blue" : "green"}
                  index={index}
                />
              ))}

              {upcomingMeetings.length > visibleUpcomingCount && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xem thêm cuộc họp sắp diễn ra"
                  style={({ pressed }) => [styles.loadMoreBtn, pressed && styles.cardPressed]}
                  onPress={() => setVisibleUpcomingCount((prev) => prev + 10)}
                >
                  <Text style={styles.loadMoreText}>Xem thêm</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Nhóm 2: Tuần này (Có nút thu gọn / mở rộng) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thu gọn hoặc mở rộng tuần này"
            style={({ pressed }) => [styles.accordionHeader, pressed && styles.cardPressed]}
            onPress={() => setIsThisWeekOpen((prev) => !prev)}
          >
            <View style={styles.accordionHeaderLeft}>
              {isThisWeekOpen ? (
                <ChevronDown color="#334155" size={17} strokeWidth={2.4} />
              ) : (
                <ChevronRight color="#334155" size={17} strokeWidth={2.4} />
              )}
              <Text style={styles.accordionTitle}>Tuần này</Text>
              <Text style={styles.accordionSubtitle}>{weekRangeText}</Text>
            </View>
            <View style={styles.accordionBadge}>
              <Text style={styles.accordionBadgeText}>{thisWeekMeetings.length}</Text>
            </View>
          </Pressable>

          {isThisWeekOpen && (
            <View style={styles.accordionContent}>
              {thisWeekMeetings.length === 0 ? <EmptyState title="Tuần này chưa có cuộc họp" message="Cuộc họp trong tuần sẽ xuất hiện tại đây." /> : null}
              {thisWeekMeetings.map((meeting, index) => (
                <ScheduleMeetingCard
                  key={meeting._id}
                  meeting={meeting}
                  themeColor={index % 2 === 0 ? "blue" : "green"}
                  index={index}
                />
              ))}
            </View>
          )}

        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* Header Hero Card kiểu ảnh 1 */
  headerHeroCard: {
    backgroundColor: "#D9F3FE",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(0, 173, 252, 0.25)",
    gap: 12,
    marginTop: 2,
    marginBottom: 4,
    shadowColor: colors.brandBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  headerHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerHeroInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerHeroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  notificationButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: -3,
    right: -4,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.danger,
  },
  notificationBadgeText: {
    color: colors.surface,
    fontSize: 8,
    fontWeight: "900",
  },
  greetingText: {
    color: "#64748B",
    fontSize: 12.5,
    fontWeight: "500",
  },
  userNameText: {
    color: "#0F172A",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  userRoleText: {
    color: "#64748B",
    fontSize: 12.5,
    fontWeight: "500",
  },
  avatarPressable: {
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    ...shadow,
  },
  headerHeroBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0, 173, 252, 0.28)",
  },
  digitalClockText: {
    color: "#0F172A",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  todayDateText: {
    color: "#475569",
    fontSize: 12.5,
    fontWeight: "600",
    paddingBottom: 2,
  },

  /* Tiêu đề & Thu gọn danh sách cuộc họp */
  scheduleSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  scheduleSectionTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "700",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  accordionTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  accordionSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  accordionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  accordionBadgeText: {
    color: "#64748B",
    fontSize: 11.5,
    fontWeight: "700",
  },
  accordionContent: {
    gap: 2,
    marginTop: 2,
    marginBottom: 4,
  },
  loadMoreBtn: {
    alignSelf: "center",
    minHeight: 40,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.brandBlue,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 6,
  },
  loadMoreText: {
    color: colors.brandBlue,
    fontSize: 13,
    fontWeight: "700",
  },

  /* Card cuộc họp dạng lịch ảnh 1 */
  scheduleCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...shadow,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  dateBadge: {
    width: 52,
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginRight: 12,
    backgroundColor: "#FFFFFF",
  },
  dateBadgeHeader: {
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBadgeHeaderText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dateBadgeBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
  },
  dateBadgeDayText: {
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 22,
  },
  cardDetails: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 6,
    marginRight: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardTitle: {
    flex: 1,
    color: "#0F172A",
    fontSize: 13.5,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "center",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    flex: 1,
    color: "#64748B",
    fontSize: 11.5,
    fontWeight: "500",
  },

  /* Banner cuộc họp trực tiếp - Nền nhạt đồng bộ màu thương hiệu brandBlue #00ADFC */
  heroCompact: {
    backgroundColor: "#CEEEFD",
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1.5,
    borderColor: "rgba(0, 173, 252, 0.25)",
    shadowColor: colors.brandBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  heroInnerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E2F6FE",
    borderRadius: radius.lg - 3,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(0, 173, 252, 0.25)",
    gap: spacing.sm,
  },
  heroLeft: {
    flex: 1,
    gap: 4.5,
  },
  heroTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: radius.pill,
    gap: 4.5,
  },
  upcomingTagBadge: {
    backgroundColor: "rgba(0, 173, 252, 0.12)",
    borderColor: "rgba(0, 173, 252, 0.25)",
  },
  liveDotWrapper: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  liveStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  upcomingStatusDot: {
    backgroundColor: "#00ADFC",
  },
  heroTagText: {
    color: "#15803D",
    fontSize: 10,
    fontWeight: "800",
  },
  upcomingTagText: {
    color: "#00ADFC",
  },
  liveWave: {
    height: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  liveWaveBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: "#22C55E",
  },
  titleWithMic: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroIconSlot: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitleCompact: {
    color: "#0B2B33",
    fontSize: 14.5,
    fontWeight: "800",
    letterSpacing: -0.2,
    flex: 1,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetaCompact: {
    color: "#4A6E78",
    fontSize: 11.5,
    fontWeight: "500",
    flex: 1,
  },
  heroActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandBlue,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
    shadowColor: colors.brandBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  heroActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  link: {
    color: colors.primaryDark,
    fontSize: 11.5,
    fontWeight: "700",
  },

});
