import { useMemo, useState } from "react";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarClock,
  CircleStop,
  Clock3,
  CornerDownRight,
  Gift,
  MapPin,
  MessageCircle,
  Navigation,
  Pause,
  Pencil,
  Play,
  Presentation,
  Search,
  Timer,
  Trash2,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";
import { Alert, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, meetingVersion, type Meeting, type Speaker } from "@/services/meeting";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
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
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const manage = hasPermission(user, "meetings:manage", "access:manage");

  const filteredSpeakers = useMemo(() => {
    if (!meeting) return [];
    const query = search.trim().toLocaleLowerCase("vi");
    return query ? meeting.speakers.filter((speaker) => [speaker.name, speaker.email, speaker.company].some((value) => value?.toLocaleLowerCase("vi").includes(query))) : meeting.speakers;
  }, [meeting, search]);

  if (isLoading) return <Screen><BackHeader title="Chi tiết cuộc họp" /><LoadingState /></Screen>;
  if (error || !meeting) return <Screen><BackHeader title="Chi tiết cuộc họp" /><ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={reload} /></Screen>;

  const version = meetingVersion(meeting);
  const attendance = meeting.speakers.find((speaker) => speaker.userId === user?.uid);
  const attendancePosition = attendance ? meeting.speakers.findIndex((speaker) => speaker.id === attendance.id) + 1 : 0;
  const meetingOpen = ["scheduled", "live", "paused"].includes(meeting.status);
  const currentSpeaker = meeting.currentIndex >= 0 ? meeting.speakers[meeting.currentIndex] : undefined;
  const openInteraction = (section: "interaction" | "luckyDraw") => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section } });

  const run = async (task: () => Promise<Meeting>, failure: string) => {
    if (busy) return;
    setBusy(true);
    try {
      setData(await task());
    } catch (cause) {
      Alert.alert(failure, cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const confirmControl = (action: "start" | "pause" | "resume" | "finish" | "cancel", title: string, message: string) => {
    Alert.alert(title, message, [
      { text: "Quay lại", style: "cancel" },
      { text: title, style: action === "finish" || action === "cancel" ? "destructive" : "default", onPress: () => void run(() => meetingService.control(id, action, version), "Không thể cập nhật cuộc họp") },
    ]);
  };

  const remove = () => Alert.alert(
    "Xóa cuộc họp?",
    "Toàn bộ danh sách check-in và dữ liệu quay thưởng của cuộc họp sẽ bị xóa hoàn toàn.",
    [
      { text: "Không xóa", style: "cancel" },
      {
        text: "Xóa vĩnh viễn",
        style: "destructive",
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          try {
            await meetingService.remove(id);
            router.replace("/meetings");
          } catch (cause) {
            Alert.alert("Không thể xóa", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
          } finally {
            setBusy(false);
          }
        },
      },
    ],
  );

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

  const moveSpeaker = (speaker: Speaker, direction: -1 | 1) => {
    const index = meeting.speakers.findIndex((item) => item.id === speaker.id);
    const next = index + direction;
    const lockedBefore = meeting.status === "scheduled" ? 0 : Math.max(0, meeting.currentIndex + (meeting.speakerStartedAt || (meeting.elapsedSeconds || 0) > 0 ? 1 : 0));
    if (index < lockedBefore || next < lockedBefore || next < 0 || next >= meeting.speakers.length) return;
    const order = [...meeting.speakers];
    const [person] = order.splice(index, 1);
    order.splice(next, 0, person);
    void run(() => meetingService.reorderSpeakers(id, order.map((item) => item.id), version), "Không thể đổi thứ tự");
  };

  return (
    <Screen>
      <BackHeader title="Chi tiết cuộc họp" />
      <ImageBackground source={meeting.coverImage ? { uri: meeting.coverImage } : undefined} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroOverlay}>
          <Badge tone={statusMeta[meeting.status].tone}>{statusMeta[meeting.status].label.toUpperCase()}</Badge>
          <Text style={styles.title}>{meeting.title}</Text>
          <View style={styles.heroMeta}><Clock3 color="#DDFBFF" size={16} /><Text style={styles.heroMetaText}>{dateTime(meeting.startsAt)}</Text></View>
          <View style={styles.heroMeta}><MapPin color="#DDFBFF" size={16} /><Text style={styles.heroMetaText}>{meeting.location || "Chưa cập nhật địa điểm"}</Text></View>
        </View>
      </ImageBackground>

      {meeting.status === "ended" || meeting.status === "cancelled" ? (
        <Card style={styles.notice}><Text style={styles.noticeText}>{meeting.status === "ended" ? "Cuộc họp đã kết thúc. Các chức năng điều hành và check-in đã đóng." : "Cuộc họp này đã bị hủy."}</Text></Card>
      ) : null}

      <View style={styles.metrics}>
        <Metric label="CHECK-IN" value={String(meeting.speakers.length)} />
        <Metric label="ĐÃ PHÁT BIỂU" value={`${meeting.speakers.filter((speaker) => (speaker.spokenSeconds || 0) > 0).length}/${meeting.speakers.length}`} />
        <Metric label="CÒN LẠI" value={String(meeting.speakers.filter((speaker) => !(speaker.spokenSeconds || 0)).length)} />
      </View>

      <SectionTitle>Thông tin cuộc họp</SectionTitle>
      <Card style={styles.infoCard}>
        <InfoRow icon={CalendarClock} label="Bắt đầu" value={dateTime(meeting.startsAt)} />
        <InfoRow icon={Clock3} label="Kết thúc" value={dateTime(meeting.endsAt)} />
        <InfoRow icon={Navigation} label="Phạm vi check-in" value={meeting.latitude != null && meeting.longitude != null ? `${meeting.gpsRadiusMeters || 200} m · ${meeting.latitude.toFixed(5)}, ${meeting.longitude.toFixed(5)}` : "Chưa cấu hình GPS"} />
        <InfoRow icon={Bell} label="Nhắc hẹn" value={`Trước ${meeting.reminderDays ?? 1} ngày`} />
        <InfoRow icon={Timer} label="Thời lượng ngoài khung" value={`${meeting.fallbackSeconds || 20} giây`} />
        {meeting.seriesId ? <InfoRow icon={CalendarClock} label="Loại lịch" value="Cuộc họp định kỳ" /> : null}
      </Card>
      <Card style={styles.description}>
        <Text style={styles.cardTitle}>Cấu hình thời lượng phát biểu</Text>
        {meeting.tiers?.length ? meeting.tiers.map((slot, index) => (
          <View key={index} style={styles.tierRow}>
            <Text style={styles.tierTime}>{slot.startTime} – {slot.endTime}</Text>
            <Text style={styles.tierSeconds}>{slot.seconds} giây/người</Text>
          </View>
        )) : <Text style={styles.body}>Chưa cấu hình khung giờ.</Text>}
        <Text style={styles.tierFallback}>Ngoài khung giờ: {meeting.fallbackSeconds || 20} giây/người</Text>
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

      <SectionTitle>Chức năng cuộc họp</SectionTitle>
      <Card style={styles.featureGrid}>
        {manage ? <FeatureTile icon={Presentation} label="Điều hành & trình chiếu" onPress={() => router.push({ pathname: "/meeting/[id]/live", params: { id } })} /> : null}
        <FeatureTile icon={MessageCircle} label="Tương tác" onPress={() => openInteraction("interaction")} />
        <FeatureTile icon={Gift} label="Quay thưởng" onPress={() => openInteraction("luckyDraw")} />
        <FeatureTile icon={Trophy} label="Thành viên tích cực" onPress={() => router.push("/rankings")} />
      </Card>

      {manage ? (
        <>
          <SectionTitle>Quản lý cuộc họp</SectionTitle>
          <Card style={styles.menu}>
            {meeting.status !== "ended" && meeting.status !== "cancelled" ? <Button icon={Pencil} tone="secondary" fullWidth onPress={() => router.push({ pathname: "/meeting/[id]/edit", params: { id } })}>Chỉnh sửa cuộc họp</Button> : null}
            {meeting.status === "scheduled" ? <Button icon={CalendarClock} tone="secondary" fullWidth onPress={() => router.push({ pathname: "/meeting/[id]/edit", params: { id } })}>Dời lịch</Button> : null}
            {meeting.status === "scheduled" ? <Button icon={Play} fullWidth disabled={busy} onPress={() => confirmControl("start", "Bắt đầu cuộc họp", "Thành viên và khách mời vẫn có thể tiếp tục check-in trong lúc họp.")}>Bắt đầu cuộc họp</Button> : null}
            {meeting.status === "live" || meeting.status === "paused" ? (
              <View style={styles.actionRow}>
                <Button icon={meeting.status === "paused" ? Play : Pause} tone="secondary" disabled={busy} onPress={() => confirmControl(meeting.status === "paused" ? "resume" : "pause", meeting.status === "paused" ? "Tiếp tục cuộc họp" : "Tạm dừng cuộc họp", "Xác nhận thay đổi trạng thái cuộc họp.")}>{meeting.status === "paused" ? "Tiếp tục" : "Tạm dừng"}</Button>
                <Button icon={CircleStop} tone="danger" disabled={busy} onPress={() => confirmControl("finish", "Kết thúc cuộc họp", "Sau khi kết thúc, cuộc họp ngừng nhận check-in và điều hành phát biểu.")}>Kết thúc</Button>
              </View>
            ) : null}
            {meeting.status === "scheduled" ? <Button icon={XCircle} tone="secondary" fullWidth disabled={busy} onPress={() => confirmControl("cancel", "Hủy cuộc họp", "Cuộc họp sẽ được đánh dấu đã hủy; các buổi khác trong chuỗi không thay đổi.")}>Hủy buổi họp</Button> : null}
            <Button icon={Trash2} tone="danger" fullWidth disabled={busy} onPress={remove}>Xóa cuộc họp</Button>
          </Card>
        </>
      ) : null}

      <SectionTitle>Người đã check-in · thứ tự phát biểu</SectionTitle>
      {meeting.speakers.length ? (
        <Card style={styles.speakersCard}>
          <View style={styles.searchBox}><Search color={colors.muted} size={18} /><TextInput value={search} onChangeText={setSearch} placeholder="Tìm thành viên hoặc khách mời" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
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
                  {isCurrent ? <Text style={styles.liveText}>ĐANG PHÁT BIỂU</Text> : speaker.deferred ? <Text style={styles.deferredText}>ĐÃ CHUYỂN CUỐI LƯỢT</Text> : (speaker.spokenSeconds || 0) > 0 ? <Text style={styles.doneText}>Đã phát biểu {speaker.spokenSeconds} giây</Text> : null}
                </View>
                {manage && meetingOpen ? (
                  <View style={styles.orderActions}>
                    <IconAction label="Đưa lên" icon={ArrowUp} disabled={index === 0 || busy} onPress={() => moveSpeaker(speaker, -1)} />
                    <IconAction label="Đưa xuống" icon={ArrowDown} disabled={index === meeting.speakers.length - 1 || busy} onPress={() => moveSpeaker(speaker, 1)} />
                    <IconAction label="Chuyển cuối lượt" icon={CornerDownRight} disabled={index === meeting.speakers.length - 1 || busy} onPress={() => void run(() => meetingService.deferSpeaker(id, speaker.id, version), "Không thể chuyển lượt")} />
                  </View>
                ) : null}
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

function IconAction({ label, icon: Icon, disabled, onPress }: { label: string; icon: typeof ArrowUp; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.iconAction, disabled && styles.disabled, pressed && styles.pressed]}><Icon color={colors.primaryDark} size={17} /></Pressable>;
}

function FeatureTile({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.featureTile, pressed && styles.pressed]}><View style={styles.featureIcon}><Icon color={colors.primaryDark} size={30} strokeWidth={1.8} /></View><Text style={styles.featureLabel}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  hero: { minHeight: 220, overflow: "hidden", borderRadius: radius.xl, backgroundColor: colors.primaryDark },
  heroImage: { borderRadius: radius.xl },
  heroOverlay: { flex: 1, justifyContent: "flex-end", gap: spacing.sm, borderRadius: radius.xl, backgroundColor: "rgba(0, 74, 89, 0.78)", padding: spacing.xl },
  title: { color: "#FFFFFF", fontSize: 23, lineHeight: 29, fontWeight: "900" },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroMetaText: { flex: 1, color: "#DDFBFF", fontSize: 13, lineHeight: 18 },
  notice: { borderColor: "#F2D29B", backgroundColor: "#FFF8E9" },
  noticeText: { color: "#80591C", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  metrics: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, minWidth: 0, padding: spacing.md },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  metricValue: { marginTop: spacing.xs, color: colors.text, fontSize: 20, fontWeight: "900" },
  infoCard: { gap: spacing.md },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: spacing.md },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  infoValue: { marginTop: 3, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  description: { gap: spacing.sm },
  tierRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  tierTime: { color: colors.text, fontSize: 13, fontWeight: "700" },
  tierSeconds: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  tierFallback: { color: colors.muted, fontSize: 12, fontStyle: "italic" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  attendance: { gap: spacing.md, borderColor: "#B9E7EE", backgroundColor: colors.primarySoft },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  currentNotice: { borderRadius: radius.md, backgroundColor: colors.surface, color: colors.primaryDark, padding: spacing.md, fontSize: 13, fontWeight: "800" },
  menu: { gap: spacing.sm },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.md },
  featureTile: { width: "47.5%", aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, borderWidth: 1, borderColor: "#B9E7EE", borderRadius: radius.lg, backgroundColor: colors.primarySoft, padding: spacing.md },
  featureIcon: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, backgroundColor: colors.surface },
  featureLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center" },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  speakersCard: { gap: 0, paddingVertical: spacing.sm },
  searchBox: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, margin: spacing.sm, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, color: colors.text },
  speakerRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  speakerCurrent: { backgroundColor: colors.primarySoft },
  order: { width: 22, color: colors.muted, fontSize: 12, fontWeight: "900", textAlign: "center" },
  grow: { flex: 1 },
  speakerName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  speakerMeta: { marginTop: 3, color: colors.muted, fontSize: 10, lineHeight: 15 },
  liveText: { marginTop: 3, color: colors.danger, fontSize: 9, fontWeight: "900" },
  deferredText: { marginTop: 3, color: colors.warning, fontSize: 9, fontWeight: "900" },
  doneText: { marginTop: 3, color: colors.success, fontSize: 9, fontWeight: "800" },
  orderActions: { flexDirection: "row", gap: 2 },
  iconAction: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.65 },
});
