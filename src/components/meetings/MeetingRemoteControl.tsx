import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarCheck, ChevronRight, CircleStop, Clock3, Gift, ListOrdered, MessageCircle,
  Monitor, Pause, Play, Presentation, QrCode, RefreshCw, RotateCcw, SkipBack,
  SkipForward, Sparkles, Trophy, Users, type LucideIcon,
} from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { ProfileSlideCanvas } from "@/components/meetings/ProfileSlideCanvas";
import { Button, Card, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { meetingService, meetingVersion, type Meeting, type MeetingLiveSnapshot, type PresentationView } from "@/services/meeting";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

const views: { value: PresentationView; label: string; icon: LucideIcon }[] = [
  { value: "checkin", label: "QR check-in", icon: QrCode },
  { value: "speaker", label: "Phát biểu", icon: Users },
  { value: "luckyDraw", label: "Quay thưởng", icon: Gift },
  { value: "activeMembers", label: "Xếp hạng", icon: Trophy },
  { value: "waiting", label: "Màn chờ", icon: Monitor },
];
type Panel = "speaker" | "draw" | "tools";

export function MeetingRemoteControl({ id }: { id: string }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const canManage = hasPermission(user, "meetings:manage", "access:manage");
  const [snapshot, setSnapshot] = useState<MeetingLiveSnapshot | null>(null);
  const snapshotRef = useRef<MeetingLiveSnapshot | null>(null);
  const activeRef = useRef(false);
  const pollingRef = useRef(false);
  const clockOffsetRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [now, setNow] = useState(0);
  const [panel, setPanel] = useState<Panel>("speaker");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [selectedPrize, setSelectedPrize] = useState("");

  const applySnapshot = useCallback((next: MeetingLiveSnapshot) => {
    if (!activeRef.current) return;
    if (next.meeting._id !== id) return;
    if (snapshotRef.current && meetingVersion(next.meeting) < meetingVersion(snapshotRef.current.meeting)) return;
    clockOffsetRef.current = next.serverNow - Date.now();
    snapshotRef.current = next;
    setSnapshot(next);
    setSyncError("");
    setLoading(false);
  }, [id]);

  const refresh = useCallback(async (full = false) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const current = snapshotRef.current;
      const state = !full && current ? await meetingService.liveState(id) : null;
      const next = !state || !current || meetingVersion(state.meeting) !== meetingVersion(current.meeting)
        ? await meetingService.live(id)
        : { ...current, meeting: state.meeting, serverNow: state.serverNow };
      applySnapshot(next);
    } catch (cause) {
      if (activeRef.current) {
        setSyncError(cause instanceof Error ? cause.message : "Không thể đồng bộ màn trình chiếu.");
        setLoading(false);
      }
    } finally {
      pollingRef.current = false;
    }
  }, [applySnapshot, id]);

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    void refresh(true);
    const poll = setInterval(() => { if (!busyRef.current) void refresh(); }, 5000);
    const tick = setInterval(() => setNow(Date.now() + clockOffsetRef.current), 1000);
    return () => {
      activeRef.current = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]));

  const run = async (task: (meeting: Meeting) => Promise<unknown>) => {
    const current = snapshotRef.current?.meeting;
    if (!canManage || !current || busyRef.current || syncError) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task(current);
      try {
        applySnapshot(await meetingService.live(id));
      } catch {
        setSyncError("Lệnh đã gửi, nhưng chưa tải được trạng thái mới. Hãy đồng bộ lại.");
      }
    } catch (cause) {
      Alert.alert("Không thể điều khiển", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
      void refresh(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const control = (action: Parameters<typeof meetingService.control>[1]) =>
    void run((meeting) => meetingService.control(id, action, meetingVersion(meeting)));
  const setView = (view: PresentationView) =>
    void run((meeting) => meetingService.presentationState(id, { view }, meetingVersion(meeting)));
  const confirmFinish = () => Alert.alert("Kết thúc cuộc họp?", "Màn hình trình chiếu sẽ thông báo cuộc họp đã kết thúc.", [
    { text: "Quay lại", style: "cancel" },
    { text: "Kết thúc", style: "destructive", onPress: () => control("finish") },
  ]);

  const meeting = snapshot?.meeting;
  const currentSpeaker = meeting?.speakers[meeting.currentIndex];
  const chosenSpeaker = meeting?.speakers.find((person) => person.id === selectedSpeaker) || currentSpeaker || meeting?.speakers[0];
  const chosenPrize = meeting?.luckyDraw?.prizes.find((prize) => prize.id === selectedPrize) || meeting?.luckyDraw?.prizes.find((prize) => prize.winners.length < prize.quantity);
  const view = meeting?.presentation?.view || "checkin";
  const closed = meeting?.status === "ended" || meeting?.status === "cancelled";
  const disabled = !canManage || !meeting || Boolean(syncError) || busy || closed;

  if (!snapshot || !meeting) return <Screen scroll={false} style={styles.screen}>
    <View style={styles.header}><BackHeader title="Bảng điều khiển trình chiếu" compact /></View>
    {loading ? <LoadingState /> : <ErrorState message={syncError || "Không tải được cuộc họp."} onRetry={() => void refresh(true)} />}
  </Screen>;

  return <Screen scroll={false} style={styles.screen}>
    <View style={styles.header}><BackHeader title="Bảng điều khiển trình chiếu" compact /></View>
      <>
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <View style={styles.previewStatus}><View style={[styles.dot, syncError && styles.dotError]} /><Text style={styles.previewLabel}>XEM TRƯỚC MÀN LAPTOP · {views.find((item) => item.value === view)?.label}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Đồng bộ màn chiếu" onPress={() => void refresh(true)} style={styles.refreshButton}>
              <RefreshCw color={colors.primaryDark} size={19} />
            </Pressable>
          </View>
          <StagePreview snapshot={snapshot} now={now} />
          {syncError ? <Text style={styles.syncError}>{syncError} · Chạm nút làm mới để thử lại.</Text> : null}
        </View>
        <ScrollView style={styles.controls} contentContainerStyle={[styles.controlsContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} showsVerticalScrollIndicator={false}>
          <SectionTitle>Chuyển nội dung chiếu</SectionTitle>
          <View style={styles.modes}>{views.map(({ value, label, icon: Icon }) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: view === value, disabled }} disabled={disabled || view === value} onPress={() => setView(value)} style={[styles.mode, view === value && styles.modeActive, disabled && styles.disabled]}><Icon color={view === value ? "#FFFFFF" : colors.primaryDark} size={18} /><Text style={[styles.modeText, view === value && styles.modeTextActive]}>{label}</Text></Pressable>)}</View>

          <View style={styles.panelTabs}>
            <PanelTab label="Phát biểu" active={panel === "speaker"} onPress={() => setPanel("speaker")} />
            <PanelTab label="Quay thưởng" active={panel === "draw"} onPress={() => setPanel("draw")} />
            <PanelTab label="Khác" active={panel === "tools"} onPress={() => setPanel("tools")} />
          </View>

          {panel === "speaker" ? <>
            <Card style={styles.section}>
              <Text style={styles.sectionHeading}>Người đang phát biểu</Text>
              <Text style={styles.personName}>{currentSpeaker?.name || "Chưa có người phát biểu"}</Text>
              <Text style={styles.muted}>{meeting.status === "paused" ? "Cuộc họp đang tạm dừng" : currentSpeaker ? `Lượt ${meeting.currentIndex + 1}/${meeting.speakers.length}` : "Bắt đầu cuộc họp để điều hành"}</Text>
              {meeting.status === "scheduled" ? <Button icon={Play} fullWidth disabled={disabled} onPress={() => control("start")}>Bắt đầu cuộc họp</Button> : null}
              {(meeting.status === "live" || meeting.status === "paused") && currentSpeaker ? <View style={styles.buttonGrid}>
                {meeting.status === "paused" ? <Button icon={Play} fullWidth disabled={disabled} onPress={() => void run((current) => meetingService.presentation(id, current.speakers[current.currentIndex].id, meetingVersion(current)))}>Tiếp tục & chiếu</Button>
                  : <Button icon={meeting.speakerStartedAt ? Pause : Play} fullWidth tone="secondary" disabled={disabled} onPress={() => control(meeting.speakerStartedAt ? "pause" : "start_speaker")}>{meeting.speakerStartedAt ? "Tạm dừng" : "Bắt đầu đếm giờ"}</Button>}
                <View style={styles.actionRow}>
                  <View style={styles.grow}><Button icon={SkipBack} tone="secondary" fullWidth disabled={disabled || meeting.currentIndex <= 0} onPress={() => control("previous")}>Người trước</Button></View>
                  <View style={styles.grow}><Button icon={SkipForward} fullWidth disabled={disabled} onPress={() => control("next")}>Tiếp theo</Button></View>
                </View>
                <Button icon={RotateCcw} tone="secondary" fullWidth disabled={disabled} onPress={() => control("reset_speaker")}>Đặt lại đồng hồ</Button>
              </View> : null}
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionHeading}>Chọn người để trình chiếu</Text>
              {!meeting.speakers.length ? <Text style={styles.muted}>Chưa có người check-in.</Text> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
                {meeting.speakers.map((person, index) => <Pressable key={person.id} accessibilityRole="button" accessibilityState={{ selected: person.id === chosenSpeaker?.id }} onPress={() => setSelectedSpeaker(person.id)} style={[styles.personChip, person.id === chosenSpeaker?.id && styles.personChipActive]}><Text style={[styles.personChipText, person.id === chosenSpeaker?.id && styles.selectedText]}>{index + 1}. {person.name}</Text></Pressable>)}
              </ScrollView>}
              {chosenSpeaker ? <Text style={styles.muted}>Đã chọn: {chosenSpeaker.name}</Text> : null}
              <Button icon={Presentation} fullWidth disabled={disabled || !chosenSpeaker} onPress={() => void run((current) => meetingService.presentation(id, chosenSpeaker!.id, meetingVersion(current)))}>Bắt đầu & chiếu</Button>
              <Button icon={ListOrdered} tone="secondary" fullWidth disabled={disabled || !chosenSpeaker || meeting.speakers.findIndex((person) => person.id === chosenSpeaker.id) < Math.max(0, meeting.currentIndex) || meeting.speakers.at(-1)?.id === chosenSpeaker?.id} onPress={() => void run((current) => meetingService.deferSpeaker(id, chosenSpeaker!.id, meetingVersion(current)))}>Đưa cuối lượt</Button>
              <Button icon={ListOrdered} tone="secondary" fullWidth onPress={() => router.push({ pathname: "/meeting/[id]/slides", params: { id } })}>Xem danh sách slide</Button>
            </Card>

            <Card style={styles.section}>
              <View style={styles.switchRow}><View style={styles.grow}><Text style={styles.sectionHeading}>Tự chuyển lượt</Text><Text style={styles.muted}>Tiếp tục chạy trên máy chủ khi khóa điện thoại</Text></View><Switch value={Boolean(meeting.presentation?.autoAdvance)} disabled={disabled} onValueChange={(autoAdvance) => void run((current) => meetingService.presentationState(id, { autoAdvance }, meetingVersion(current)))} /></View>
              <Text style={styles.muted}>Chờ sau khi hết giờ</Text>
              <View style={styles.delayRow}>{[0, 3, 5, 10].map((seconds) => <Pressable key={seconds} accessibilityRole="button" accessibilityState={{ selected: (meeting.presentation?.autoAdvanceDelay ?? 3) === seconds, disabled }} disabled={disabled} onPress={() => void run((current) => meetingService.presentationState(id, { autoAdvanceDelay: seconds }, meetingVersion(current)))} style={[styles.delay, (meeting.presentation?.autoAdvanceDelay ?? 3) === seconds && styles.delayActive]}><Text style={styles.delayText}>{seconds}s</Text></Pressable>)}</View>
            </Card>
          </> : null}

          {panel === "draw" ? <Card style={styles.section}>
            <Text style={styles.sectionHeading}>Quay thưởng trên màn hình lớn</Text>
            <Text style={styles.muted}>Chọn giải và bắt đầu quay. Kết quả được đồng bộ lên laptop.</Text>
            {!meeting.luckyDraw?.prizes.length ? <Text style={styles.muted}>Chưa có giải thưởng.</Text> : meeting.luckyDraw.prizes.map((prize) => <Pressable key={prize.id} accessibilityRole="button" accessibilityState={{ selected: prize.id === chosenPrize?.id }} onPress={() => setSelectedPrize(prize.id)} style={[styles.prize, prize.id === chosenPrize?.id && styles.prizeActive]}><Gift color={colors.primaryDark} size={19} /><View style={styles.grow}><Text style={styles.prizeName}>{prize.name}</Text><Text style={styles.muted}>{prize.winners.length}/{prize.quantity} đã trao</Text></View>{prize.id === chosenPrize?.id ? <ChevronRight color={colors.primaryDark} size={17} /> : null}</Pressable>)}
            <Button icon={Sparkles} fullWidth disabled={disabled || meeting.status === "scheduled" || meeting.luckyDraw?.enabled === false || !chosenPrize || chosenPrize.winners.length >= chosenPrize.quantity || (meeting.presentation?.drawRevealsAt ? Date.parse(meeting.presentation.drawRevealsAt) > now : false)} onPress={() => void run((current) => meetingService.presentationDraw(id, chosenPrize!.id, meetingVersion(current)))}>Bắt đầu quay trên laptop</Button>
            <Button icon={Gift} tone="secondary" fullWidth disabled={!canManage || closed} onPress={() => router.push({ pathname: "/meeting/[id]/games", params: { id } })}>Vòng quay may mắn / Lồng cầu bingo</Button>
            <Button icon={Gift} tone="secondary" fullWidth onPress={() => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section: "luckyDraw" } })}>Quản lý giải thưởng</Button>
          </Card> : null}

          {panel === "tools" ? <Card style={styles.section}>
            <Text style={styles.sectionHeading}>Quy trình khác</Text>
            <ToolRow icon={CalendarCheck} label="Danh sách check-in" onPress={() => router.push({ pathname: "/meeting/[id]/attendees", params: { id } })} />
            <ToolRow icon={MessageCircle} label="Thu ý kiến" onPress={() => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section: "interaction" } })} />
            <ToolRow icon={Trophy} label="Kết quả Vòng quay may mắn" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id, source: "wheel" } })} />
            <ToolRow icon={Trophy} label="Kết quả Lồng cầu bingo" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id, source: "bingo" } })} />
            <ToolRow icon={ListOrdered} label="Quản lý cuộc họp" onPress={() => router.push({ pathname: "/meeting/[id]/control", params: { id } })} />
          </Card> : null}

          {(meeting.status === "live" || meeting.status === "paused") ? <Button icon={CircleStop} tone="danger" fullWidth disabled={disabled} onPress={confirmFinish}>Kết thúc cuộc họp</Button> : null}
        </ScrollView>
      </>
  </Screen>;
}

function StagePreview({ snapshot, now }: { snapshot: MeetingLiveSnapshot; now: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const meeting = snapshot.meeting;
  const view = meeting.presentation?.view || "checkin";
  const speaker = meeting.speakers[meeting.currentIndex];
  const slide = snapshot.slides.find((item) => item.id === speaker?.id);
  const elapsed = Math.max(0, meeting.elapsedSeconds || 0) + (meeting.status === "live" && meeting.speakerStartedAt ? Math.max(0, (now - Date.parse(meeting.speakerStartedAt)) / 1000) : 0);
  const remaining = speaker ? Math.max(0, Math.floor(speaker.seconds - elapsed)) : 0;
  const time = speaker && elapsed >= speaker.seconds ? "Hết giờ" : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const winner = meeting.luckyDraw?.prizes.flatMap((prize) => prize.winners).find((item) => item.id === meeting.presentation?.drawWinnerId);
  const drawing = meeting.presentation?.drawRevealsAt && Date.parse(meeting.presentation.drawRevealsAt) > now;
  if (meeting.status === "ended" || meeting.status === "cancelled") return <View style={styles.stage}><Text style={styles.stageTitle}>{meeting.title}</Text><Text style={styles.stageMessage}>Cuộc họp đã {meeting.status === "ended" ? "kết thúc" : "hủy"}</Text></View>;
  if (view === "speaker") return slide ? <View style={styles.stageSlide}>
    <ProfileSlideCanvas key={slide.id} slide={slide} width={screenWidth - 18} />
    {speaker ? <View style={styles.stageTimerOverlay}><Clock3 color={colors.primaryDark} size={13} /><Text style={styles.stageTime}>{time}</Text></View> : null}
  </View> : <View style={styles.stage}><Presentation color="#FFFFFF" size={32} /><Text style={styles.stageTitle}>Chờ slide thuyết trình</Text></View>;
  if (view === "checkin") return <View style={[styles.stage, styles.checkinStage]}><View style={styles.qrBox}><QrCode color={colors.primaryDark} size={56} /></View><View style={styles.grow}><Text style={styles.stageEyebrow}>QR CHECK-IN</Text><Text numberOfLines={2} style={styles.stageName}>{meeting.title}</Text><Text style={styles.stageCompany}>{meeting.speakers.length} người đã điểm danh</Text></View></View>;
  if (view === "luckyDraw") return <View style={styles.stage}><Gift color="#FBBF24" size={32} /><Text style={styles.stageEyebrow}>QUAY THƯỞNG</Text><Text numberOfLines={2} style={styles.stageTitle}>{drawing ? "Đang quay…" : winner?.name || "Chờ bắt đầu quay"}</Text><Text style={styles.stageSub}>{drawing ? "Kết quả sẽ hiện trên laptop" : winner?.prizeName || ""}</Text></View>;
  if (view === "activeMembers") return <View style={styles.stage}><Trophy color="#FBBF24" size={34} /><Text style={styles.stageTitle}>Xếp hạng thành viên tích cực</Text><Text style={styles.stageSub}>Đang chiếu trên laptop</Text></View>;
  return <View style={styles.stage}><Monitor color="#7DD3FC" size={34} /><Text style={styles.stageTitle}>{meeting.title}</Text><Text style={styles.stageSub}>Vui lòng chờ</Text></View>;
}

function PanelTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.panelTab, active && styles.panelTabActive]}><Text style={[styles.panelTabText, active && styles.panelTabTextActive]}>{label}</Text></Pressable>;
}
function ToolRow({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.toolRow}><Icon color={colors.primaryDark} size={20} /><Text style={styles.toolText}>{label}</Text><ChevronRight color={colors.muted} size={18} /></Pressable>;
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingVertical: 0, paddingBottom: 0, gap: 0 },
  header: { paddingHorizontal: spacing.sm },
  previewCard: { marginHorizontal: spacing.sm, marginBottom: spacing.sm, overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  previewHeader: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md },
  previewStatus: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  refreshButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  dotError: { backgroundColor: colors.warning },
  previewLabel: { color: colors.text, fontSize: 10, fontWeight: "900", flexShrink: 1 },
  syncError: { padding: spacing.sm, color: colors.danger, fontSize: 11 },
  stage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#102533", alignItems: "center", justifyContent: "center", gap: 5, padding: spacing.lg },
  stageSlide: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surface, overflow: "hidden" },
  checkinStage: { backgroundColor: colors.surface, flexDirection: "row", gap: spacing.lg },
  stageName: { color: colors.text, fontSize: 15, fontWeight: "900" },
  stageCompany: { color: colors.muted, fontSize: 11 },
  stageTimerOverlay: { position: "absolute", right: spacing.sm, bottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.surface },
  stageTime: { color: colors.primaryDark, fontSize: 13, fontWeight: "900" },
  stageEyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: "900" },
  stageTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", textAlign: "center" },
  stageMessage: { color: "#FFFFFF", fontSize: 13 },
  stageSub: { color: "#CBD5E1", fontSize: 11, textAlign: "center" },
  qrBox: { width: 84, height: 84, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  controls: { flex: 1 },
  controlsContent: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  modes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  mode: { minHeight: touchTarget, minWidth: "30%", flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  modeActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  modeText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  modeTextActive: { color: "#FFFFFF" },
  disabled: { opacity: 0.65 },
  panelTabs: { flexDirection: "row", borderRadius: radius.md, padding: 3, backgroundColor: colors.primarySoft },
  panelTab: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  panelTabActive: { backgroundColor: colors.surface },
  panelTabText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  panelTabTextActive: { color: colors.primaryDark },
  section: { gap: spacing.sm },
  sectionHeading: { color: colors.text, fontSize: 15, fontWeight: "900" },
  personName: { color: colors.text, fontSize: 17, fontWeight: "900" },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  buttonGrid: { gap: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  people: { gap: spacing.sm, paddingVertical: spacing.xs },
  personChip: { minHeight: touchTarget, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  personChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDark },
  personChipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  selectedText: { color: colors.primaryDark },
  switchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  delayRow: { flexDirection: "row", gap: spacing.sm },
  delay: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  delayActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDark },
  delayText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  prize: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  prizeActive: { borderColor: colors.primaryDark, backgroundColor: colors.primarySoft },
  prizeName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  toolRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  toolText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "800" },
});
