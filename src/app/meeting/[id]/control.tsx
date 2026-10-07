import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronRight,
  CircleStop,
  CornerDownRight,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Presentation,
  Trash2,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, meetingVersion, type Meeting, type Speaker } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

const statusLabel: Record<Meeting["status"], string> = {
  scheduled: "Sắp diễn ra",
  live: "Đang diễn ra",
  paused: "Tạm dừng",
  ended: "Đã kết thúc",
  cancelled: "Đã hủy",
};

const statusColor: Record<Meeting["status"], string> = {
  scheduled: "#B7790A",
  live: "#16A34A",
  paused: colors.warning,
  ended: colors.muted,
  cancelled: colors.danger,
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();
}

export default function MeetingControlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: meeting, setData, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const [busy, setBusy] = useState(false);
  const hasFocused = useRef(false);
  const canManage = hasPermission(user, "meetings:manage", "access:manage");

  useFocusEffect(useCallback(() => {
    if (hasFocused.current) void reload();
    else hasFocused.current = true;
  }, [reload]));

  if (isLoading) return <Screen><BackHeader title="Điều khiển cuộc họp" compact /><LoadingState /></Screen>;
  if (error || !meeting) return <Screen><BackHeader title="Điều khiển cuộc họp" compact /><ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={reload} /></Screen>;

  const meetingOpen = ["scheduled", "live", "paused"].includes(meeting.status);
  const version = meetingVersion(meeting);

  const run = async (task: () => Promise<Meeting>, failure: string) => {
    if (busy || !canManage) return;
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
          if (busy || !canManage) return;
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

  const openInteraction = (section: "interaction" | "luckyDraw") => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section } });

  return (
    <Screen style={styles.screen}>
      <BackHeader title={canManage ? "Điều khiển cuộc họp" : "Chức năng cuộc họp"} compact />
      <Card style={styles.summary}>
        <View style={styles.summaryTop}><Text style={styles.meetingTitle} numberOfLines={2}>{meeting.title}</Text><Text style={[styles.statusText, { color: statusColor[meeting.status] }]}>{statusLabel[meeting.status]}</Text></View>
        <Text style={styles.summaryMeta}>{meeting.speakers.length} người đã check-in</Text>
      </Card>

      {canManage && meetingOpen ? (
        <>
          <SectionTitle>Điều hành</SectionTitle>
          <Card style={styles.section}>
            {meeting.status === "scheduled" ? <Button icon={Play} fullWidth style={styles.actionButton} textStyle={styles.actionButtonText} disabled={busy} onPress={() => confirmControl("start", "Bắt đầu cuộc họp", "Thành viên và khách mời vẫn có thể tiếp tục check-in trong lúc họp.")}>Bắt đầu cuộc họp</Button> : null}
            {meeting.status === "live" || meeting.status === "paused" ? (
              <>
                <Button icon={meeting.status === "paused" ? Play : Pause} tone="secondary" fullWidth style={styles.actionButton} textStyle={styles.actionButtonText} disabled={busy} onPress={() => confirmControl(meeting.status === "paused" ? "resume" : "pause", meeting.status === "paused" ? "Tiếp tục cuộc họp" : "Tạm dừng cuộc họp", "Xác nhận thay đổi trạng thái cuộc họp.")}>{meeting.status === "paused" ? "Tiếp tục cuộc họp" : "Tạm dừng cuộc họp"}</Button>
                <Button icon={CircleStop} tone="danger" fullWidth style={styles.actionButton} textStyle={styles.actionButtonText} disabled={busy} onPress={() => confirmControl("finish", "Kết thúc cuộc họp", "Sau khi kết thúc, cuộc họp ngừng nhận check-in và điều hành phát biểu.")}>Kết thúc cuộc họp</Button>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionTitle>Công cụ</SectionTitle>
      <Card style={styles.tools}>
        {canManage && meetingOpen ? <ToolRow icon={Presentation} label="Điều hành & trình chiếu" onPress={() => router.push({ pathname: "/meeting/[id]/live", params: { id } })} /> : null}
        <ToolRow icon={MessageCircle} label="Tương tác" onPress={() => openInteraction("interaction")} />
        <ToolRow icon={Trophy} label="Thành viên tích cực" onPress={() => router.push("/rankings")} />
      </Card>

      {canManage && meetingOpen && meeting.speakers.length ? (
        <>
          <SectionTitle>Thứ tự phát biểu</SectionTitle>
          <Card style={styles.speakers}>
            {meeting.speakers.map((speaker, index) => {
              const lockedBefore = meeting.status === "scheduled" ? 0 : Math.max(0, meeting.currentIndex + (meeting.speakerStartedAt || (meeting.elapsedSeconds || 0) > 0 ? 1 : 0));
              const locked = index < lockedBefore;
              return <View key={speaker.id} style={styles.speakerRow}>
                <Text style={styles.order}>{index + 1}</Text>
                <Avatar initials={initials(speaker.name)} size={30} />
                <View style={styles.grow}><Text numberOfLines={1} style={styles.speakerName}>{speaker.name}</Text><Text style={styles.speakerMeta}>{speaker.seconds} giây</Text></View>
                <IconAction label={`Đưa ${speaker.name} lên`} icon={ArrowUp} disabled={busy || locked || index <= lockedBefore} onPress={() => moveSpeaker(speaker, -1)} />
                <IconAction label={`Đưa ${speaker.name} xuống`} icon={ArrowDown} disabled={busy || locked || index === meeting.speakers.length - 1} onPress={() => moveSpeaker(speaker, 1)} />
                <IconAction label={`Chuyển ${speaker.name} cuối lượt`} icon={CornerDownRight} disabled={busy || locked || index === meeting.speakers.length - 1} onPress={() => void run(() => meetingService.deferSpeaker(id, speaker.id, version), "Không thể chuyển lượt")} />
              </View>;
            })}
          </Card>
        </>
      ) : null}

      {meeting.tiers?.length ? (
        <>
          <SectionTitle>Thời lượng phát biểu</SectionTitle>
          <Card style={styles.section}>
            {meeting.tiers.map((slot, index) => <View key={index} style={styles.tierRow}><Text style={styles.tierTime}>{slot.startTime} – {slot.endTime}</Text><Text style={styles.tierSeconds}>{slot.seconds} giây/người</Text></View>)}
            <Text style={styles.summaryMeta}>Ngoài khung giờ: {meeting.fallbackSeconds || 20} giây/người</Text>
          </Card>
        </>
      ) : null}

      {canManage ? (
        <>
          <SectionTitle>Quản lý</SectionTitle>
          <Card style={styles.section}>
            {meetingOpen ? <Button icon={Pencil} tone="secondary" fullWidth style={styles.actionButton} textStyle={styles.actionButtonText} onPress={() => router.push({ pathname: "/meeting/[id]/edit", params: { id } })}>Sửa thông tin lịch</Button> : null}
            {meeting.status === "scheduled" ? <Button icon={CalendarClock} tone="secondary" fullWidth style={styles.actionButton} textStyle={styles.actionButtonText} onPress={() => router.push({ pathname: "/meeting/[id]/reschedule", params: { id } })}>Dời ngày giờ họp</Button> : null}
            {meeting.status === "scheduled" ? <Button icon={XCircle} tone="secondary" fullWidth style={styles.actionButton} textStyle={styles.actionButtonText} disabled={busy} onPress={() => confirmControl("cancel", "Hủy cuộc họp", "Cuộc họp sẽ được đánh dấu đã hủy; các buổi khác trong chuỗi không thay đổi.")}>Hủy buổi họp</Button> : null}
            <Button icon={Trash2} tone="danger" fullWidth style={styles.actionButton} textStyle={styles.actionButtonText} disabled={busy} onPress={remove}>Xóa cuộc họp</Button>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function ToolRow({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}><Icon color={colors.primaryDark} size={18} /><Text style={styles.toolLabel}>{label}</Text><ChevronRight color={colors.muted} size={16} /></Pressable>;
}

function IconAction({ label, icon: Icon, disabled, onPress }: { label: string; icon: LucideIcon; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={7} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.iconAction, disabled && styles.disabled, pressed && styles.pressed]}><Icon color={colors.primaryDark} size={16} /></Pressable>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xs },
  summary: { gap: 3, padding: spacing.sm },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meetingTitle: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  statusText: { fontSize: 11, fontWeight: "700" },
  summaryMeta: { color: colors.muted, fontSize: 11 },
  section: { gap: 6, padding: spacing.sm },
  actionButton: { minHeight: 44, borderRadius: radius.sm },
  actionButtonText: { fontSize: 12.5, fontWeight: "700" },
  tools: { padding: 0, overflow: "hidden" },
  toolRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  toolLabel: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: "600" },
  speakers: { padding: 0, overflow: "hidden" },
  speakerRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  order: { width: 20, color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  grow: { flex: 1, minWidth: 0, marginLeft: 4 },
  speakerName: { color: colors.text, fontSize: 12, fontWeight: "800" },
  speakerMeta: { color: colors.muted, fontSize: 10 },
  iconAction: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  tierRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.xs },
  tierTime: { color: colors.text, fontSize: 12, fontWeight: "700" },
  tierSeconds: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.65 },
});
