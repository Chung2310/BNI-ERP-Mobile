import { router, useFocusEffect } from "expo-router";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  Trophy,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
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
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { applyMeetingChange, meetingService, subscribeMeetingChanges, type Meeting } from "@/services/meeting";
import { userService } from "@/services/users";
import { colors, radius, shadow, spacing } from "@/theme/tokens";

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
  const primaryColor = isBlue ? "#2563EB" : "#10B981";
  const badgeBorder = isBlue ? "#DBEAFE" : "#D1FAE5";

  const { dateStr, timeRange, duration, monthNum, dayNum } = formatMeetingDetails(
    meeting.startsAt,
    meeting.endsAt,
  );

  const handlePress = () => {
    if (meeting._id.startsWith("sample-")) {
      router.push("/(tabs)/meetings");
      return;
    }
    router.push({
      pathname: meeting.status === "live" ? "/meeting/[id]/live" : "/meeting/[id]",
      params: { id: meeting._id },
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cuộc họp: ${meeting.title}`}
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
        {/* Dòng 1: Chấm tròn và Tiêu đề */}
        <View style={styles.titleRow}>
          <View style={[styles.bulletDot, { backgroundColor: primaryColor }]} />
          <Text numberOfLines={1} style={styles.cardTitle}>
            {meeting.title}
          </Text>
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
            {meeting.location || "---"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
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

  const { data: dashboardData } = useAsyncData(async () => {
    const history = await meetingService.history();
    const members = await userService.colleagues().catch(() => []);
    return { history, members };
  }, "dashboard-charts");

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
  const chartMeetings = dashboardData?.history || meetings;
  const memberCount =
    dashboardData?.members.length ||
    new Set(
      chartMeetings.flatMap((meeting) => meeting.speakers.map((speaker) => speaker.userId).filter(Boolean)),
    ).size;

  const liveMeeting = useMemo(
    () => meetings.find((meeting) => meeting.status === "live" || meeting.status === "paused"),
    [meetings],
  );

  // Mẫu dữ liệu demo hiển thị chuẩn như thiết kế khi DB chưa có lịch
  const sampleMeetings: Meeting[] = useMemo(
    () => [
      {
        _id: "sample-1",
        title: "Product Innovation Hour 20/6/2026",
        startsAt: "2026-06-20T15:00:00.000Z",
        endsAt: "2026-06-20T17:00:00.000Z",
        location: "---",
        status: "scheduled",
        speakers: [
          {
            id: "s1",
            name: user?.displayName || "Nguyễn Văn Việt",
            checkedInAt: "",
            seconds: 0,
            photoURL: user?.photoURL,
          },
        ],
        description: "Họp nhanh không cần máy chiếu",
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-2",
        title: "Demo app meeting",
        startsAt: "2026-06-20T12:00:00.000Z",
        endsAt: "2026-06-20T13:00:00.000Z",
        location: "---",
        status: "scheduled",
        speakers: [],
        description: "Họp giao ban hàng tháng",
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
      {
        _id: "sample-3",
        title: "Cs + Mobile trao đổi vấn đề về WF",
        startsAt: "2026-06-20T08:30:00.000Z",
        endsAt: "2026-06-20T09:30:00.000Z",
        location: "---",
        status: "scheduled",
        speakers: [],
        description: "Họp nhanh không cần máy chiếu",
        reminderDays: 1,
        __v: 0,
        currentIndex: 0,
        tiers: [],
        fallbackSeconds: 60,
      },
    ],
    [user],
  );

  // Tính các cuộc họp sắp diễn ra & tuần này
  const { upcomingMeetings, thisWeekMeetings } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mondayDate = new Date(now);
    mondayDate.setDate(diffToMonday);
    mondayDate.setHours(0, 0, 0, 0);

    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);
    sundayDate.setHours(23, 59, 59, 999);

    const scheduledOrLive = meetings.filter(
      (m) =>
        m.status === "scheduled" ||
        m.status === "live" ||
        m.status === "paused" ||
        new Date(m.startsAt) >= now,
    );

    const upcoming = scheduledOrLive.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    const thisWeek = meetings
      .filter((m) => {
        const d = new Date(m.startsAt);
        return d >= mondayDate && d <= sundayDate;
      })
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

    return { upcomingMeetings: upcoming, thisWeekMeetings: thisWeek };
  }, [meetings]);

  // Nếu DB chưa có cuộc họp, tự động fallback về danh sách mẫu hiển thị chuẩn như ảnh 1
  const displayUpcoming = upcomingMeetings.length > 0 ? upcomingMeetings : sampleMeetings;
  const displayThisWeek = thisWeekMeetings.length > 0 ? thisWeekMeetings : [sampleMeetings[0]];

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
    if (user?.role === "manager") return "Product Manager";
    if (user?.role === "branch_owner") return "Chủ tịch Chapter";
    if (user?.industry) return user.industry;
    if (user?.companyName) return user.companyName;
    return "Product Manager";
  }, [user]);

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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem hồ sơ cá nhân"
            onPress={() => router.push("/(tabs)/more")}
            style={({ pressed }) => [styles.avatarPressable, pressed && styles.cardPressed]}
          >
            <Avatar initials={userInitials} url={user?.photoURL} size={54} />
          </Pressable>
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
          {/* Banner cuộc họp đang diễn ra nếu có */}
          {liveMeeting ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Vào cuộc họp: ${liveMeeting.title}`}
              style={({ pressed }) => [styles.heroCompact, pressed && styles.cardPressed]}
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
                  <Text style={styles.heroTagText}>Đang diễn ra</Text>
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

          {/* Phần Danh sách cuộc họp (Thay thế lịch cũ theo mẫu ảnh 1) */}
          <View style={styles.scheduleSectionHeader}>
            <Text style={styles.scheduleSectionTitle}>Danh sách cuộc họp</Text>
            <Pressable
              accessibilityLabel="Xem tất cả cuộc họp"
              hitSlop={8}
              onPress={() => router.push("/(tabs)/meetings")}
            >
              <Text style={styles.link}>Tất cả ({meetings.length})</Text>
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
              <Text style={styles.accordionBadgeText}>{displayUpcoming.length}</Text>
            </View>
          </Pressable>

          {isUpcomingOpen && (
            <View style={styles.accordionContent}>
              {displayUpcoming.slice(0, visibleUpcomingCount).map((meeting, index) => (
                <ScheduleMeetingCard
                  key={meeting._id}
                  meeting={meeting}
                  themeColor={index % 2 === 0 ? "blue" : "green"}
                  index={index}
                />
              ))}

              {displayUpcoming.length > visibleUpcomingCount && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xem thêm cuộc họp sắp diễn ra"
                  style={({ pressed }) => [styles.loadMoreBtn, pressed && styles.cardPressed]}
                  onPress={() => setVisibleUpcomingCount((prev) => prev + 10)}
                >
                  <Text style={styles.loadMoreText}>
                    Xem thêm ({displayUpcoming.length - visibleUpcomingCount} cuộc họp còn lại)
                  </Text>
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
              <Text style={styles.accordionBadgeText}>{displayThisWeek.length}</Text>
            </View>
          </Pressable>

          {isThisWeekOpen && (
            <View style={styles.accordionContent}>
              {displayThisWeek.map((meeting, index) => (
                <ScheduleMeetingCard
                  key={meeting._id}
                  meeting={meeting}
                  themeColor={index % 2 === 0 ? "blue" : "green"}
                  index={index}
                />
              ))}
            </View>
          )}

          {/* Mục Tiện ích của app (Đặt dưới lịch theo đúng yêu cầu) */}
          <SectionTitle>Tiện ích</SectionTitle>
          <DashboardQuickActions user={user} />

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
                const badgeColor = isTop1
                  ? "#D99020"
                  : isTop2
                    ? "#64748B"
                    : isTop3
                      ? "#B45309"
                      : colors.muted;
                const badgeBg = isTop1
                  ? "#FEF9EC"
                  : isTop2
                    ? "#F1F5F9"
                    : isTop3
                      ? "#FEF3EB"
                      : "#F8FAFC";

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
  );
}

const styles = StyleSheet.create({
  /* Header Hero Card kiểu ảnh 1 */
  headerHeroCard: {
    backgroundColor: "#EDF6FA",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D9ECF3",
    gap: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  headerHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerHeroInfo: {
    flex: 1,
    gap: 2,
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
    borderTopColor: "rgba(203, 213, 225, 0.4)",
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
    color: "#0F172A",
    fontSize: 15.5,
    fontWeight: "800",
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
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  loadMoreText: {
    color: "#007F98",
    fontSize: 12.5,
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
    gap: 6,
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

  /* Banner cuộc họp trực tiếp */
  heroCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#00AECA",
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: spacing.sm,
    borderWidth: 0,
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

  /* Bảng xếp hạng */
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
