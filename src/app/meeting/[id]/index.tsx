import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  Presentation,
  Search,
  Settings,
  Settings2,
  Timer,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";
import { Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, meetingVersion, type Meeting } from "@/services/meeting";
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
  const insets = useSafeAreaInsets();
  const { data: meeting, setData, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) void reload();
    else hasFocused.current = true;
  }, [reload]));
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const searchOffsetRef = useRef(0);
  const searchFocusedRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "remove" | null>(null);
  const [actionError, setActionError] = useState("");
  const actionPending = useRef(false);
  const manage = hasPermission(user, "meetings:manage", "access:manage");

  const revealSearch = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, searchOffsetRef.current - spacing.lg), animated: true });
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      if (searchFocusedRef.current) requestAnimationFrame(revealSearch);
    });
    return () => subscription.remove();
  }, [revealSearch]);

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

  const closeSettings = () => {
    if (actionPending.current) return;
    setSettingsOpen(false);
    setConfirmAction(null);
    setActionError("");
  };

  const confirmChange = async () => {
    if (actionPending.current || !manage || !confirmAction) return;
    if (confirmAction === "cancel" && meeting.status !== "scheduled") {
      setActionError("Chỉ có thể hủy cuộc họp chưa diễn ra.");
      return;
    }
    actionPending.current = true;
    setBusy(true);
    setActionError("");
    try {
      if (confirmAction === "cancel") {
        setData(await meetingService.control(id, "cancel", meetingVersion(meeting)));
        closeSettingsAfterChange();
      } else {
        await meetingService.remove(id);
        closeSettingsAfterChange();
        router.replace("/meetings");
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Không thể cập nhật lịch họp. Vui lòng thử lại.");
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  };

  const closeSettingsAfterChange = () => {
    setSettingsOpen(false);
    setConfirmAction(null);
  };

  return (
    <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <Screen style={styles.detailScreen} scrollRef={scrollRef}>
      <BackHeader title="Chi tiết cuộc họp" compact action={manage ? <Pressable accessibilityRole="button" accessibilityLabel="Tùy chỉnh cuộc họp" onPress={() => setSettingsOpen(true)} style={styles.settingsButton}><Settings color={colors.primaryDark} size={22} /></Pressable> : undefined} />
      <Card style={[styles.summary, meeting.coverImage && styles.summaryWithCover]}>
        {meeting.coverImage ? <><Image source={{ uri: meeting.coverImage }} style={styles.summaryCover} resizeMode="cover" /><View style={styles.summaryShade} /></> : null}
        <View style={styles.summaryRow}>
          <View style={styles.grow}>
            <Badge tone={statusMeta[meeting.status].tone}>{statusMeta[meeting.status].label.toUpperCase()}</Badge>
            <Text style={[styles.title, meeting.coverImage && styles.titleOnCover]}>{meeting.title}</Text>
          </View>
        </View>
        <View style={styles.summaryMeta}><Clock3 color={meeting.coverImage ? "#FFFFFF" : colors.primaryDark} size={16} /><Text style={[styles.summaryMetaText, meeting.coverImage && styles.summaryMetaOnCover]}>{dateTime(meeting.startsAt)}</Text></View>
        <View style={styles.summaryMeta}><MapPin color={meeting.coverImage ? "#FFFFFF" : colors.primaryDark} size={16} /><Text style={[styles.summaryMetaText, meeting.coverImage && styles.summaryMetaOnCover]}>{meeting.location || "Chưa cập nhật địa điểm"}</Text></View>
      </Card>

      <View style={styles.metrics}>
        <Metric label="CHECK-IN" value={String(meeting.speakers.length)} />
        <Metric label="ĐÃ PHÁT BIỂU" value={`${meeting.speakers.filter((speaker) => (speaker.spokenSeconds || 0) > 0).length}/${meeting.speakers.length}`} />
        <Metric label="CÒN LẠI" value={String(meeting.speakers.filter((speaker) => !(speaker.spokenSeconds || 0)).length)} />
      </View>

      <SectionTitle>Quy trình cuộc họp</SectionTitle>
      <Card style={styles.processCard}>
        <ProcessRow icon={MapPin} label="Check-in" detail={`${meeting.speakers.length} người đã điểm danh`} onPress={() => router.push({ pathname: "/meeting/[id]/attendees", params: { id } })} />
        <ProcessRow icon={Gift} label="Quay thưởng" detail="Kết quả Vòng quay may mắn và Lồng cầu bingo" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id } })} />
        <ProcessRow icon={MessageCircle} label="Thu ý kiến" detail="Câu hỏi và phản hồi của người tham dự" onPress={() => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section: "interaction", readOnly: "1" } })} />
        <ProcessRow icon={Presentation} label="Thuyết trình" detail="Danh sách slide của người trình bày" onPress={() => router.push({ pathname: "/meeting/[id]/slides", params: { id } })} />
      </Card>

      {manage && meetingOpen ? <Button icon={Settings2} fullWidth onPress={() => router.push({ pathname: "/meeting/[id]/live", params: { id } })}>Mở bảng điều khiển trình chiếu</Button> : null}

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
              <Text style={styles.body}>{meetingOpen ? "Quét mã QR trên màn hình trình chiếu để check-in." : "Cuộc họp đã đóng điểm danh."}</Text>
            </>
          )}
        </Card>
      ) : null}

      <SectionTitle>Người đã check-in · thứ tự phát biểu</SectionTitle>
      {meeting.speakers.length ? (
        <View onLayout={(event) => { searchOffsetRef.current = event.nativeEvent.layout.y; }}>
        <Card style={styles.speakersCard}>
          <View style={styles.searchBox}><Search color={colors.muted} size={16} /><TextInput value={search} onChangeText={setSearch} onFocus={() => { searchFocusedRef.current = true; requestAnimationFrame(revealSearch); }} onBlur={() => { searchFocusedRef.current = false; }} placeholder="Tìm thành viên hoặc khách mời" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
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
        </View>
      ) : <EmptyState title="Chưa có người check-in" message="Danh sách sẽ cập nhật khi thành viên hoặc khách mời điểm danh." />}
      <Modal visible={settingsOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={closeSettings}>
        <View style={styles.sheetOverlay}>
          <Pressable accessibilityLabel="Đóng tùy chỉnh cuộc họp" style={styles.sheetBackdrop} onPress={closeSettings} />
          <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{confirmAction === "cancel" ? "Hủy lịch họp?" : confirmAction === "remove" ? "Xóa lịch họp?" : "Tùy chỉnh cuộc họp"}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" disabled={busy} onPress={closeSettings} style={styles.sheetClose}><X color={colors.muted} size={20} /></Pressable>
            </View>
            {confirmAction ? <View style={styles.confirmContent}>
              <Text style={styles.confirmText}>{confirmAction === "cancel" ? "Buổi họp sẽ được đánh dấu đã hủy. Các buổi khác trong chuỗi không thay đổi." : "Cuộc họp cùng danh sách check-in và dữ liệu quay thưởng sẽ bị xóa vĩnh viễn."}</Text>
              {actionError ? <Text style={styles.sheetError}>{actionError}</Text> : null}
              <Button tone="danger" fullWidth disabled={busy} onPress={() => void confirmChange()}>{busy ? "Đang xử lý…" : confirmAction === "cancel" ? "Xác nhận hủy lịch" : "Xóa vĩnh viễn"}</Button>
              <Button tone="secondary" fullWidth disabled={busy} onPress={() => { setConfirmAction(null); setActionError(""); }}>Quay lại</Button>
            </View> : <>
              <SheetAction icon={Pencil} label="Sửa thông tin lịch" detail={meetingOpen ? "Tên, địa điểm và thiết lập" : "Cuộc họp đã đóng, không thể sửa"} disabled={busy || !meetingOpen} onPress={() => { closeSettings(); router.push({ pathname: "/meeting/[id]/edit", params: { id } }); }} />
              <SheetAction icon={CalendarClock} label="Dời ngày giờ họp" detail={meeting.status === "scheduled" ? "Chọn thời gian mới cho buổi này" : "Chỉ dời buổi chưa diễn ra"} disabled={busy || meeting.status !== "scheduled"} onPress={() => { closeSettings(); router.push({ pathname: "/meeting/[id]/reschedule", params: { id } }); }} />
              <SheetAction icon={XCircle} label="Hủy lịch họp" detail={meeting.status === "scheduled" ? "Giữ lịch sử, chỉ hủy buổi này" : "Chỉ hủy buổi chưa diễn ra"} disabled={busy || meeting.status !== "scheduled"} onPress={() => setConfirmAction("cancel")} />
              <SheetAction icon={Trash2} label="Xóa lịch họp" detail="Xóa vĩnh viễn cả dữ liệu liên quan" disabled={busy} danger onPress={() => setConfirmAction("remove")} />
            </>}
          </View>
        </View>
      </Modal>
    </Screen>
    </KeyboardAvoidingView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></Card>;
}

function SheetAction({ icon: Icon, label, detail, disabled, danger = false, onPress }: { icon: LucideIcon; label: string; detail: string; disabled: boolean; danger?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.sheetAction, disabled && styles.sheetDisabled, pressed && styles.processPressed]}>
    <View style={[styles.sheetActionIcon, danger && styles.sheetActionIconDanger]}><Icon size={20} color={danger ? colors.danger : colors.primaryDark} /></View>
    <View style={styles.grow}><Text style={[styles.sheetActionLabel, danger && styles.sheetActionLabelDanger]}>{label}</Text><Text style={styles.sheetActionDetail}>{detail}</Text></View>
    <ChevronRight color={colors.muted} size={18} />
  </Pressable>;
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
  keyboardContainer: { flex: 1 },
  detailScreen: { gap: spacing.xs },
  settingsButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  sheetBackdrop: { ...StyleSheet.absoluteFill },
  sheetContent: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  sheetHandle: { width: 36, height: 4, alignSelf: "center", borderRadius: radius.pill, backgroundColor: colors.border, marginBottom: spacing.md },
  sheetHeader: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  sheetClose: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  sheetAction: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.sm },
  sheetDisabled: { opacity: 0.4 },
  sheetActionIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primarySoft },
  sheetActionIconDanger: { backgroundColor: "#FFF0F2" },
  sheetActionLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sheetActionLabelDanger: { color: colors.danger },
  sheetActionDetail: { marginTop: 2, color: colors.muted, fontSize: 12 },
  confirmContent: { gap: spacing.md, paddingTop: spacing.sm },
  confirmText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  sheetError: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  processCard: { paddingVertical: 0, paddingHorizontal: spacing.sm },
  processRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  processPressed: { opacity: 0.6 },
  processLabel: { color: colors.text, fontSize: 13, fontWeight: "800" },
  processDetail: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
  summary: { gap: spacing.sm, padding: spacing.md, paddingTop: spacing.sm },
  summaryWithCover: { minHeight: 150, justifyContent: "flex-end", overflow: "hidden" },
  summaryCover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  summaryShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(7, 22, 36, 0.60)" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { marginTop: spacing.xs, color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: "900" },
  titleOnCover: { color: "#FFFFFF" },
  summaryMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryMetaText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  summaryMetaOnCover: { color: "#FFFFFF" },
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
