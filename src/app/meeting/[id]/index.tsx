import { useCallback, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Bell,
  CalendarClock,
  ChevronRight,
  Clock3,
  Gift,
  MapPin,
  MessageCircle,
  Navigation,
  Presentation,
  Search,
  Settings2,
  Timer,
} from "lucide-react-native";
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type Meeting } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

const statusMeta: Record<Meeting["status"], { label: string; tone: "primary" | "danger" | "warning" | "default" }> = {
  scheduled: { label: "Sắp diễn ra", tone: "primary" },
  live: { label: "Đang diễn ra", tone: "danger" },
  paused: { label: "Tạm dừng", tone: "warning" },
  ended: { label: "Đã kết thúc", tone: "default" },
  cancelled: { label: "Đã hủy", tone: "danger" },
};

const dateTime = (value?: string) => value
  ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
  : "Chưa cập nhật";
const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: meeting, setData, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) void reload();
    else hasFocused.current = true;
  }, [reload]));
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const manage = hasPermission(user, "meetings:manage", "access:manage");

  const filteredSpeakers = useMemo(() => {
    if (!meeting) return [];
    const query = search.trim().toLocaleLowerCase("vi");
    return query ? meeting.speakers.filter((speaker) => [speaker.name, speaker.email, speaker.company].some((value) => value?.toLocaleLowerCase("vi").includes(query))) : meeting.speakers;
  }, [meeting, search]);

  if (isLoading) return <Screen><BackHeader title="Chi tiết cuộc họp" compact /><LoadingState /></Screen>;
  if (error || !meeting) return <Screen><BackHeader title="Chi tiết cuộc họp" compact /><ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={reload} /></Screen>;

  const attendance = meeting.speakers.find((speaker) => speaker.userId === user?.uid);
  const attendancePosition = attendance ? meeting.speakers.findIndex((speaker) => speaker.id === attendance.id) + 1 : 0;
  const meetingOpen = ["scheduled", "live", "paused"].includes(meeting.status);
  const currentSpeaker = meeting.currentIndex >= 0 ? meeting.speakers[meeting.currentIndex] : undefined;

  const checkInAtLocation = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Bạn cần cấp quyền vị trí để điểm danh.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setData(await meetingService.checkIn(id, { latitude: position.coords.latitude, longitude: position.coords.longitude }));
      Alert.alert("Điểm danh thành công", "Bạn đã được ghi nhận tham dự cuộc họp.");
    } catch (cause) {
      Alert.alert("Không thể điểm danh", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.detailScreen}>
      <BackHeader title="Chi tiết cuộc họp" compact />
      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.grow}>
            <Badge tone={statusMeta[meeting.status].tone}>{statusMeta[meeting.status].label.toUpperCase()}</Badge>
            <Text style={styles.title}>{meeting.title}</Text>
          </View>
          {meeting.coverImage ? <Image source={{ uri: meeting.coverImage }} style={styles.cover} /> : null}
        </View>
        <View style={styles.summaryMeta}><Clock3 color={colors.primaryDark} size={16} /><Text style={styles.summaryMetaText}>{dateTime(meeting.startsAt)}</Text></View>
        <View style={styles.summaryMeta}><MapPin color={colors.primaryDark} size={16} /><Text style={styles.summaryMetaText}>{meeting.location || "Chưa cập nhật địa điểm"}</Text></View>
      </Card>

      <View style={styles.metrics}>
        <Metric label="CHECK-IN" value={String(meeting.speakers.length)} />
        <Metric label="ĐÃ PHÁT BIỂU" value={`${meeting.speakers.filter((speaker) => (speaker.spokenSeconds || 0) > 0).length}/${meeting.speakers.length}`} />
        <Metric label="CÒN LẠI" value={String(meeting.speakers.filter((speaker) => !(speaker.spokenSeconds || 0)).length)} />
      </View>

      <SectionTitle>Quy trình cuộc họp</SectionTitle>
      <Card style={styles.processCard}>
        <ProcessRow icon={MapPin} label="Check-in" detail={`${meeting.speakers.length} người đã điểm danh`} onPress={() => router.push({ pathname: "/meeting/[id]/attendees", params: { id } })} />
        <ProcessRow icon={Gift} label="Trò quay thưởng" detail="Vòng quay may mắn và Lồng cầu bingo" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id } })} />
        <ProcessRow icon={Gift} label="Bốc thăm giải thưởng" detail="Giải thưởng và lịch sử bốc thăm" onPress={() => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section: "luckyDraw" } })} />
        <ProcessRow icon={MessageCircle} label="Thu ý kiến" detail="Câu hỏi và phản hồi của người tham dự" onPress={() => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section: "interaction" } })} />
        <ProcessRow icon={Presentation} label="Thuyết trình" detail="Danh sách slide của người trình bày" onPress={() => router.push({ pathname: "/meeting/[id]/slides", params: { id } })} />
      </Card>

      <Button icon={Settings2} tone="secondary" fullWidth onPress={() => router.push({ pathname: "/meeting/[id]/control", params: { id } })}>
        {manage ? "Điều khiển cuộc họp" : "Chức năng cuộc họp"}
      </Button>

      <SectionTitle>Thông tin cuộc họp</SectionTitle>
      <Card style={styles.infoCard}>
        <InfoRow icon={Clock3} label="Kết thúc" value={dateTime(meeting.endsAt)} />
        <InfoRow icon={Navigation} label="Phạm vi check-in" value={meeting.latitude != null && meeting.longitude != null ? `${meeting.gpsRadiusMeters || 200} m · ${meeting.latitude.toFixed(5)}, ${meeting.longitude.toFixed(5)}` : "Chưa cấu hình GPS"} />
        <InfoRow icon={Bell} label="Nhắc hẹn" value={`Trước ${meeting.reminderDays ?? 1} ngày`} />
        <InfoRow icon={Timer} label="Thời lượng ngoài khung" value={`${meeting.fallbackSeconds || 20} giây`} />
        {meeting.seriesId ? <InfoRow icon={CalendarClock} label="Loại lịch" value="Cuộc họp định kỳ" /> : null}
      </Card>
      {meeting.description ? <Card style={styles.description}><Text style={styles.cardTitle}>Nội dung cuộc họp</Text><Text style={styles.body}>{meeting.description}</Text></Card> : null}

      {!manage ? (
        <Card style={styles.attendance}>
          <View style={styles.sectionRow}><Text style={styles.cardTitle}>Thông tin tham dự của bạn</Text>{attendance ? <Badge tone="primary">ĐÃ CHECK-IN</Badge> : <Badge>CHƯA CHECK-IN</Badge>}</View>
          {attendance ? (
            <>
              <Text style={styles.body}>Check-in lúc {dateTime(attendance.checkedInAt)}</Text>
              <View style={styles.metrics}>
                <Metric label="THỨ TỰ" value={String(attendancePosition)} />
                <Metric label="PHÁT BIỂU" value={`${attendance.seconds} giây`} />
              </View>
              {currentSpeaker?.id === attendance.id && meetingOpen ? <Text style={styles.currentNotice}>Đang đến lượt phát biểu của bạn.</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.body}>{meetingOpen ? `Điểm danh bằng GPS trong bán kính ${meeting.gpsRadiusMeters || 200} m quanh địa điểm họp.` : "Cuộc họp đã đóng điểm danh."}</Text>
              <Button icon={MapPin} fullWidth disabled={!meetingOpen || busy} onPress={checkInAtLocation}>{busy ? "Đang xác minh vị trí…" : "Điểm danh ngay"}</Button>
            </>
          )}
        </Card>
      ) : null}

      <SectionTitle>Người đã check-in · thứ tự phát biểu</SectionTitle>
      {meeting.speakers.length ? (
        <Card style={styles.speakersCard}>
          <View style={styles.searchBox}><Search color={colors.muted} size={16} /><TextInput value={search} onChangeText={setSearch} placeholder="Tìm thành viên hoặc khách mời" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
          {filteredSpeakers.map((speaker) => {
            const index = meeting.speakers.findIndex((item) => item.id === speaker.id);
            const isCurrent = currentSpeaker?.id === speaker.id && (meeting.status === "live" || meeting.status === "paused");
            return (
              <View key={speaker.id} style={[styles.speakerRow, isCurrent && styles.speakerCurrent]}>
                <Text style={styles.order}>{index + 1}</Text>
                <Avatar initials={initials(speaker.name)} />
                <View style={styles.grow}>
                  <Text style={styles.speakerName}>{speaker.name}</Text>
                  <Text style={styles.speakerMeta}>{speaker.userId ? "Thành viên" : "Khách mời"} · {speaker.seconds} giây · {dateTime(speaker.checkedInAt)}</Text>
                  {isCurrent ? <Text style={styles.liveText}>ĐANG PHÁT BIỂU</Text> : speaker.deferred ? <Text style={styles.deferredText}>ĐÃ CHUYỂN CUỐI LƯỢT</Text> : (speaker.spokenSeconds || 0) > 0 ? <Text style={styles.doneText}>Đã phát biểu {Math.round(speaker.spokenSeconds ?? 0)} giây</Text> : null}
                </View>
              </View>
            );
          })}
        </Card>
      ) : <EmptyState title="Chưa có người check-in" message="Danh sách sẽ cập nhật khi thành viên hoặc khách mời điểm danh." />}
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></Card>;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <View style={styles.infoRow}><Icon color={colors.primaryDark} size={20} /><View style={styles.grow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>;
}

function ProcessRow({ icon: Icon, label, detail, onPress }: { icon: typeof Clock3; label: string; detail: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.processRow, pressed && styles.processPressed]}>
    <Icon color={colors.primaryDark} size={21} />
    <View style={styles.grow}><Text style={styles.processLabel}>{label}</Text><Text style={styles.processDetail}>{detail}</Text></View>
    <ChevronRight color={colors.muted} size={19} />
  </Pressable>;
}

const styles = StyleSheet.create({
  detailScreen: { gap: spacing.xs },
  processCard: { paddingVertical: 0, paddingHorizontal: spacing.sm },
  processRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  processPressed: { opacity: 0.6 },
  processLabel: { color: colors.text, fontSize: 13, fontWeight: "800" },
  processDetail: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
  summary: { gap: spacing.sm, padding: spacing.md, paddingTop: spacing.sm },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { marginTop: spacing.xs, color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: "900" },
  cover: { width: 70, height: 70, borderRadius: radius.md, backgroundColor: colors.background },
  summaryMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryMetaText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  metrics: { flexDirection: "row", gap: spacing.xs },
  metric: { flex: 1, minWidth: 0, padding: spacing.sm },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  metricValue: { marginTop: 3, color: colors.text, fontSize: 18, fontWeight: "900" },
  infoCard: { gap: spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  infoValue: { marginTop: 3, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  description: { gap: spacing.sm },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  attendance: { gap: spacing.md, borderColor: "#B9E7EE", backgroundColor: colors.primarySoft },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  currentNotice: { borderRadius: radius.md, backgroundColor: colors.surface, color: colors.primaryDark, padding: spacing.md, fontSize: 13, fontWeight: "800" },
  speakersCard: { gap: 0, paddingVertical: spacing.sm },
  searchBox: { height: 38, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.background, margin: spacing.sm, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 12, paddingVertical: 0 },
  speakerRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  speakerCurrent: { backgroundColor: colors.primarySoft },
  order: { width: 22, color: colors.muted, fontSize: 12, fontWeight: "900", textAlign: "center" },
  grow: { flex: 1 },
  speakerName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  speakerMeta: { marginTop: 3, color: colors.muted, fontSize: 10, lineHeight: 15 },
  liveText: { marginTop: 3, color: colors.danger, fontSize: 9, fontWeight: "900" },
  deferredText: { marginTop: 3, color: colors.warning, fontSize: 9, fontWeight: "900" },
  doneText: { marginTop: 3, color: colors.success, fontSize: 9, fontWeight: "800" },
});
