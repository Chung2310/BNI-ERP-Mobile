import { Alert } from "@/components/AppAlert";
import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { io } from "socket.io-client";
import {  Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarCheck, CircleStop, Clock3, Gift, ListOrdered, MessageCircle,
  Monitor, Pause, Play, Presentation, QrCode, RefreshCw, RotateCcw, SkipBack,
  SkipForward, Sparkles, Settings2, Trophy, Users, X, type LucideIcon,
} from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { buildActiveMemberRankings } from "@/components/ActiveMemberRanking";
import { ProfileSlideCanvas } from "@/components/meetings/ProfileSlideCanvas";
import { MeetingWheelPreview } from "@/components/meetings/MeetingWheelPreview";
import { Avatar, Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, meetingVersion, type Meeting, type MeetingLiveSnapshot, type PresentationView } from "@/services/meeting";
import { apiConfig } from "@/services/api";
import { userService } from "@/services/users";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

const views: { value: PresentationView; label: string; icon: LucideIcon }[] = [
  { value: "checkin", label: "QR check-in", icon: QrCode },
  { value: "speaker", label: "Phát biểu", icon: Users },
  { value: "luckyDraw", label: "Quay thưởng", icon: Gift },
  { value: "activeMembers", label: "Xếp hạng", icon: Trophy },
  { value: "waiting", label: "Màn chờ", icon: Monitor },
];
const brandBlue = "#01BAF9";
const brandSoft = "#E7F9FF";
type Panel = "speaker" | "draw" | "tools";

export function MeetingRemoteControl({ id }: { id: string }) {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const canManage = hasPermission(user, "meetings:manage", "access:manage");
  const [snapshot, setSnapshot] = useState<MeetingLiveSnapshot | null>(null);
  const snapshotRef = useRef<MeetingLiveSnapshot | null>(null);
  const activeRef = useRef(false);
  const pollingRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const clockOffsetRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [now, setNow] = useState(0);
  const [panel, setPanel] = useState<Panel>("speaker");
  const [selectedPrize, setSelectedPrize] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const applySnapshot = useCallback((next: MeetingLiveSnapshot) => {
    if (!activeRef.current) return;
    if (next.meeting._id !== id) return;
    if (snapshotRef.current && meetingVersion(next.meeting) < meetingVersion(snapshotRef.current.meeting)) return;
    clockOffsetRef.current = next.serverNow - Date.now();
    snapshotRef.current = next;
    setSnapshot(next);
    setNow(next.serverNow);
    setSyncError("");
    setLoading(false);
  }, [id]);

  const refresh = useCallback(async (full = false) => {
    if (pollingRef.current) {
      if (full) queuedRefreshRef.current = true;
      return;
    }
    pollingRef.current = true;
    try {
      do {
        queuedRefreshRef.current = false;
        const current = snapshotRef.current;
        const state = !full && current ? await meetingService.liveState(id) : null;
        const next = !state || !current || meetingVersion(state.meeting) !== meetingVersion(current.meeting)
          ? await meetingService.live(id)
          : { ...current, meeting: state.meeting, serverNow: state.serverNow };
        applySnapshot(next);
        full = queuedRefreshRef.current;
      } while (full && activeRef.current);
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
    const socket = token ? io(apiConfig.baseUrl, { auth: { token }, transports: ["websocket", "polling"], reconnection: true }) : null;
    socket?.on("connect", () => void refresh(true));
    socket?.on("meeting_updated", (event: { id?: string; meetingId?: string; version?: number }) => {
      if (event.id !== id && event.meetingId !== id) return;
      if (event.version !== undefined && snapshotRef.current && event.version < meetingVersion(snapshotRef.current.meeting)) return;
      void refresh(true);
    });
    const poll = setInterval(() => { if (!busyRef.current) void refresh(); }, 5000);
    const tick = setInterval(() => setNow(Date.now() + clockOffsetRef.current), 1000);
    return () => {
      activeRef.current = false;
      queuedRefreshRef.current = false;
      socket?.disconnect();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [id, refresh, token]));

  const run = async (task: (meeting: Meeting) => Promise<unknown>) => {
    const current = snapshotRef.current?.meeting;
    if (!canManage || !current || busyRef.current || syncError) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      await task(current);
      try {
        applySnapshot(await meetingService.live(id));
      } catch {
        setSyncError("Lệnh đã gửi, nhưng chưa tải được trạng thái mới. Hãy đồng bộ lại.");
      }
      return true;
    } catch (cause) {
      Alert.alert("Không thể điều khiển", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
      void refresh(true);
      return false;
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
  const chosenPrize = meeting?.luckyDraw?.prizes.find((prize) => prize.id === selectedPrize) || meeting?.luckyDraw?.prizes.find((prize) => prize.winners.length < prize.quantity);
  const view = meeting?.presentation?.view || "checkin";
  const closed = meeting?.status === "ended" || meeting?.status === "cancelled";
  const disabled = !canManage || !meeting || Boolean(syncError) || busy || closed;

  if (!snapshot || !meeting) return <Screen scroll={false} style={styles.screen}>
    <View style={styles.header}><BackHeader title="Bảng điều khiển trình chiếu" compact /></View>
    {loading ? <LoadingState /> : <ErrorState message={syncError || "Không tải được cuộc họp."} onRetry={() => void refresh(true)} />}
  </Screen>;

  return <Screen scroll={false} style={styles.screen}>
    <View style={styles.header}><BackHeader title="Bảng điều khiển trình chiếu" compact action={<Pressable accessibilityRole="button" accessibilityLabel="Cài đặt tự chuyển lượt" onPress={() => setSettingsOpen(true)} style={styles.settingsButton}><Settings2 color={colors.text} size={21} /></Pressable>} /></View>
      <>
        <View style={styles.previewCard}>
          <StagePreview snapshot={snapshot} now={now} />
          <Pressable accessibilityRole="button" accessibilityLabel="Đồng bộ màn chiếu" onPress={() => void refresh(true)} style={styles.refreshButton}>
            <RefreshCw color={colors.primaryDark} size={18} />
          </Pressable>
          {syncError ? <Text style={styles.syncError}>{syncError} · Chạm nút làm mới để thử lại.</Text> : null}
        </View>
        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.inlineLabel}>Chuyển màn hình</Text>
          <View style={styles.modes}>{views.map(({ value, label, icon: Icon }) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: view === value, disabled }} disabled={disabled || view === value} onPress={() => setView(value)} style={[styles.mode, view === value && styles.modeActive, disabled && styles.disabled]}><Icon color={view === value ? colors.text : brandBlue} size={21} /></Pressable>)}</View>

          <View style={styles.panelTabs}>
            <PanelTab label="Phát biểu" active={panel === "speaker"} onPress={() => setPanel("speaker")} />
            <PanelTab label="Quay thưởng" active={panel === "draw"} onPress={() => setPanel("draw")} />
            <PanelTab label="Khác" active={panel === "tools"} onPress={() => setPanel("tools")} />
          </View>

          {panel === "speaker" ? <>
            <Card style={styles.section}>
              <View style={styles.summaryRow}><Text style={styles.sectionHeading}>Đang phát biểu</Text><Text style={styles.muted}>{meeting.status === "paused" ? "Tạm dừng" : currentSpeaker ? `Lượt ${meeting.currentIndex + 1}/${meeting.speakers.length}` : "Chưa bắt đầu"}</Text></View>
              <Text style={[styles.personName, currentSpeaker && (meeting.status === "live" || meeting.status === "paused") && styles.activeSpeakerName]}>{currentSpeaker?.name || "Chưa có người phát biểu"}</Text>
              {meeting.status === "scheduled" ? <View style={styles.compactGrid}><CompactAction icon={Play} label="Bắt đầu họp" accessibilityLabel="Bắt đầu cuộc họp" columns={2} primary disabled={disabled} onPress={() => control("start")} /></View> : null}
              {(meeting.status === "live" || meeting.status === "paused") && currentSpeaker ? <View style={styles.speakerActions}>
                {meeting.status === "paused" ? <SpeakerAction icon={Play} accessibilityLabel="Tiếp tục và chiếu" primary disabled={disabled} onPress={() => void run((current) => meetingService.presentation(id, current.speakers[current.currentIndex].id, meetingVersion(current)))} />
                  : <SpeakerAction icon={meeting.speakerStartedAt ? Pause : Play} accessibilityLabel={meeting.speakerStartedAt ? "Tạm dừng phát biểu" : "Bắt đầu đếm giờ"} disabled={disabled} onPress={() => control(meeting.speakerStartedAt ? "pause" : "start_speaker")} />}
                <SpeakerAction icon={SkipBack} accessibilityLabel="Người phát biểu trước" disabled={disabled || meeting.currentIndex <= 0} onPress={() => control("previous")} />
                <SpeakerAction icon={SkipForward} accessibilityLabel="Người phát biểu tiếp theo" primary disabled={disabled} onPress={() => control("next")} />
                <SpeakerAction icon={RotateCcw} accessibilityLabel="Đặt lại đồng hồ phát biểu" disabled={disabled} onPress={() => control("reset_speaker")} />
              </View> : null}
            </Card>

            <Card style={styles.section}>
              <View style={styles.summaryRow}><Text style={styles.sectionHeading}>Người thuyết trình</Text><Text style={styles.muted}>{meeting.speakers.length} người</Text></View>
              <Text style={styles.muted}>Chạm tên để trình chiếu · icon bên phải để đưa xuống cuối lượt</Text>
              {!meeting.speakers.length ? <Text style={styles.muted}>Chưa có người check-in.</Text> : <View style={styles.people}>
                {meeting.speakers.map((person, index) => {
                  const isCurrent = (meeting.status === "live" || meeting.status === "paused") && index === meeting.currentIndex;
                  const cannotDefer = disabled || index < Math.max(0, meeting.currentIndex) || index === meeting.speakers.length - 1;
                  return <View key={person.id} style={[styles.personRow, isCurrent && styles.personRowActive]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Chiếu slide của ${person.name}`} accessibilityState={{ disabled, selected: isCurrent }} disabled={disabled} onPress={() => void run((current) => meetingService.presentation(id, person.id, meetingVersion(current)))} style={styles.personMain}><Text style={styles.personIndex}>{index + 1}</Text><Text numberOfLines={1} style={[styles.personRowName, isCurrent && styles.activeSpeakerName]}>{person.name}</Text>{isCurrent ? <Text style={styles.currentLabel}>{meeting.status === "paused" ? "Tạm dừng" : "Đang phát biểu"}</Text> : <Play color={colors.muted} size={17} />}</Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Đưa ${person.name} xuống cuối lượt`} accessibilityState={{ disabled: cannotDefer }} disabled={cannotDefer} onPress={() => void run((current) => meetingService.deferSpeaker(id, person.id, meetingVersion(current)))} style={[styles.deferButton, cannotDefer && styles.disabled]}><ListOrdered color={colors.text} size={19} /></Pressable>
                  </View>;
                })}
              </View>}
            </Card>
          </> : null}

          {panel === "draw" ? <Card style={styles.section}>
            <Text style={styles.sectionHeading}>Chọn giải để quay trên laptop</Text>
            {!meeting.luckyDraw?.prizes.length ? <Text style={styles.muted}>Chưa có giải thưởng.</Text> : <View style={styles.prizes}>{meeting.luckyDraw.prizes.map((prize) => <Pressable key={prize.id} accessibilityRole="button" accessibilityLabel={`${prize.name}, ${prize.winners.length} trên ${prize.quantity} giải đã trao`} accessibilityState={{ selected: prize.id === chosenPrize?.id }} onPress={() => setSelectedPrize(prize.id)} style={[styles.prize, prize.id === chosenPrize?.id && styles.prizeActive]}><Text numberOfLines={1} style={styles.prizeName}>{prize.name}</Text><Text style={styles.muted}>{prize.winners.length}/{prize.quantity} đã trao</Text></Pressable>)}</View>}
            <View style={styles.compactGrid}>
              <CompactAction icon={Sparkles} label="Quay" accessibilityLabel="Bắt đầu quay thưởng trên laptop" primary disabled={disabled || meeting.status === "scheduled" || meeting.luckyDraw?.enabled === false || !chosenPrize || chosenPrize.winners.length >= chosenPrize.quantity || (meeting.presentation?.drawRevealsAt ? Date.parse(meeting.presentation.drawRevealsAt) > now : false)} onPress={() => void run((current) => meetingService.presentationDraw(id, chosenPrize!.id, meetingVersion(current)))} />
              <CompactAction icon={Gift} label="Vòng/Bingo" accessibilityLabel="Mở vòng quay hoặc Bingo trên điện thoại" disabled={!canManage || closed} onPress={() => router.push({ pathname: "/meeting/[id]/games", params: { id } })} />
              <CompactAction icon={ListOrdered} label="Giải thưởng" accessibilityLabel="Quản lý giải thưởng" onPress={() => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section: "luckyDraw" } })} />
            </View>
          </Card> : null}

          {panel === "tools" ? <Card style={styles.section}>
            <Text style={styles.sectionHeading}>Tra cứu và quản lý</Text>
            <View style={styles.compactGrid}>
              <CompactAction icon={CalendarCheck} label="Check-in" accessibilityLabel="Danh sách check-in" onPress={() => router.push({ pathname: "/meeting/[id]/attendees", params: { id } })} />
              <CompactAction icon={MessageCircle} label="Ý kiến" accessibilityLabel="Thu ý kiến" onPress={() => router.push({ pathname: "/meeting/[id]/interaction", params: { id, section: "interaction" } })} />
              <CompactAction icon={Trophy} label="KQ quay" accessibilityLabel="Kết quả vòng quay may mắn" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id, source: "wheel" } })} />
              <CompactAction icon={Trophy} label="KQ Bingo" accessibilityLabel="Kết quả lồng cầu Bingo" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id, source: "bingo" } })} />
              <CompactAction icon={ListOrdered} label="Quản lý" accessibilityLabel="Quản lý cuộc họp" onPress={() => router.push({ pathname: "/meeting/[id]/control", params: { id } })} />
            </View>
          </Card> : null}

        </ScrollView>
        {(meeting.status === "live" || meeting.status === "paused") ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kết thúc cuộc họp" accessibilityState={{ disabled }} disabled={disabled} onPress={confirmFinish} style={[styles.finishButton, disabled && styles.disabled]}>
            <CircleStop color={colors.danger} size={18} /><Text style={styles.finishText}>Kết thúc cuộc họp</Text>
          </Pressable>
        </View> : null}
      </>
    <Modal visible={settingsOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSettingsOpen(false)}>
      <View style={styles.sheetOverlay}>
        <Pressable accessibilityLabel="Đóng cài đặt trình chiếu" style={styles.sheetBackdrop} onPress={() => setSettingsOpen(false)} />
        <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Cài đặt trình chiếu</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setSettingsOpen(false)} style={styles.sheetClose}><X color={colors.text} size={20} /></Pressable></View>
          <View style={styles.switchRow}><View style={styles.grow}><Text style={styles.sectionHeading}>Tự chuyển lượt</Text><Text style={styles.muted}>Tiếp tục chạy khi khóa điện thoại</Text></View><AutoAdvanceToggle key={String(Boolean(meeting.presentation?.autoAdvance))} value={Boolean(meeting.presentation?.autoAdvance)} disabled={disabled} onChange={(autoAdvance) => run((current) => meetingService.presentationState(id, { autoAdvance }, meetingVersion(current)))} /></View>
          <Text style={styles.muted}>Chờ sau khi hết giờ phát biểu</Text>
          <View style={styles.delayRow}>{[0, 3, 5, 10].map((seconds) => <Pressable key={seconds} accessibilityRole="button" accessibilityLabel={`${seconds} giây`} accessibilityState={{ selected: (meeting.presentation?.autoAdvanceDelay ?? 3) === seconds, disabled }} disabled={disabled} onPress={() => void run((current) => meetingService.presentationState(id, { autoAdvanceDelay: seconds }, meetingVersion(current)))} style={[styles.delay, (meeting.presentation?.autoAdvanceDelay ?? 3) === seconds && styles.delayActive]}><Text style={styles.delayText}>{seconds}s</Text></Pressable>)}</View>
        </View>
      </View>
    </Modal>
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
  if (meeting.status === "ended" || meeting.status === "cancelled") return <View style={styles.stage}><Text style={styles.stageTitle}>{meeting.title}</Text><Text style={styles.stageMessage}>Cuộc họp đã {meeting.status === "ended" ? "kết thúc" : "hủy"}</Text></View>;
  if (view === "speaker") return slide ? <View style={styles.stageSlide}>
    <ProfileSlideCanvas key={slide.id} slide={slide} width={Math.min(screenWidth - 18, 560)} />
    {speaker ? <View style={styles.stageTimerOverlay}><Clock3 color={colors.primaryDark} size={13} /><Text style={styles.stageTime}>{time}</Text></View> : null}
  </View> : <View style={styles.stage}><Presentation color="#FFFFFF" size={32} /><Text style={styles.stageTitle}>Chờ slide thuyết trình</Text></View>;
  if (view === "checkin") return <View style={[styles.stage, styles.checkinStage]}><View style={styles.qrBox}><QrCode color={colors.primaryDark} size={56} /></View><View style={styles.grow}><Text style={styles.stageEyebrow}>QR CHECK-IN</Text><Text numberOfLines={2} style={styles.stageName}>{meeting.title}</Text><Text style={styles.stageCompany}>{meeting.speakers.length} người đã điểm danh</Text></View></View>;
  if (view === "luckyDraw") return <MeetingWheelPreview meeting={meeting} now={now} />;
  if (view === "activeMembers") return <StageRankingPreview meeting={meeting} />;
  return <View style={styles.stage}><Monitor color="#7DD3FC" size={34} /><Text style={styles.stageTitle}>{meeting.title}</Text><Text style={styles.stageSub}>Vui lòng chờ</Text></View>;
}

function StageRankingPreview({ meeting }: { meeting: Meeting }) {
  const { data, error, isLoading } = useAsyncData(async () => {
    const [history, members] = await Promise.all([
      meetingService.history(),
      userService.directory().catch(() => []),
    ]);
    return { history, members };
  }, meeting._id);
  const rankings = useMemo(() => data ? buildActiveMemberRankings(
    [...data.history.filter((item) => item._id !== meeting._id), meeting],
    data.members,
    meeting,
  ).rankings.filter((member) => member.attendedCount > 0).slice(0, 5) : [], [data, meeting]);

  return <View style={styles.rankingStage}>
    <View style={styles.rankingHeader}><Trophy color={colors.warning} size={17} /><Text numberOfLines={1} style={styles.rankingTitle}>Bảng xếp hạng thành viên tích cực</Text></View>
    {isLoading && !data ? <Text style={styles.rankingEmpty}>Đang tải bảng xếp hạng…</Text>
      : error ? <Text style={styles.rankingEmpty}>Không tải được bảng xếp hạng.</Text>
      : !rankings.length ? <Text style={styles.rankingEmpty}>Chưa có dữ liệu điểm danh.</Text>
      : <View style={styles.rankingList}>{rankings.map((member, index) => <View key={member.id} style={styles.rankingRow}>
        <Text style={styles.rankingPosition}>#{index + 1}</Text>
        <Avatar initials={member.name.split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase()} url={member.photoURL} size={22} />
        <Text numberOfLines={1} style={styles.rankingName}>{member.name}</Text>
        <Text style={styles.rankingCount}>{member.attendedCount} buổi · {member.attendanceRate}%</Text>
      </View>)}</View>}
  </View>;
}

function PanelTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.panelTab, active && styles.panelTabActive]}><Text style={[styles.panelTabText, active && styles.panelTabTextActive]}>{label}</Text></Pressable>;
}
function CompactAction({ icon: Icon, label, accessibilityLabel, onPress, disabled, primary = false, columns = 3 }: { icon: LucideIcon; label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean; primary?: boolean; columns?: 2 | 3 | 4 }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.compactAction, columns === 2 ? styles.compactHalf : columns === 4 ? styles.compactQuarter : styles.compactThird, primary && styles.compactPrimary, disabled && styles.disabled, pressed && styles.compactPressed]}><Icon color={primary ? colors.text : brandBlue} size={19} /><Text numberOfLines={1} style={[styles.compactActionText, primary && styles.compactPrimaryText]}>{label}</Text></Pressable>;
}
function SpeakerAction({ icon: Icon, accessibilityLabel, onPress, disabled, primary = false }: { icon: LucideIcon; accessibilityLabel: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.speakerAction, primary && styles.compactPrimary, disabled && styles.disabled, pressed && styles.compactPressed]}><Icon color={primary ? colors.text : brandBlue} size={19} /></Pressable>;
}
function AutoAdvanceToggle({ value, disabled, onChange }: { value: boolean; disabled: boolean; onChange: (next: boolean) => Promise<boolean> }) {
  const [checked, setChecked] = useState(value);
  const toggle = (next: boolean) => {
    setChecked(next);
    void onChange(next).then((saved) => { if (!saved) setChecked(value); });
  };
  return <Switch accessibilityLabel="Tự chuyển lượt" value={checked} disabled={disabled} trackColor={{ false: colors.border, true: brandSoft }} thumbColor={checked ? brandBlue : colors.surface} onValueChange={toggle} />;
}
const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingVertical: 0, paddingBottom: 0, gap: 0 },
  header: { paddingHorizontal: spacing.sm },
  settingsButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  previewCard: { width: "96%", maxWidth: 560, alignSelf: "center", marginBottom: spacing.xs, overflow: "hidden", borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  refreshButton: { position: "absolute", top: spacing.xs, right: spacing.xs, width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: "#FFFFFFE6" },
  syncError: { padding: spacing.sm, color: colors.danger, fontSize: 11 },
  stage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#102533", alignItems: "center", justifyContent: "center", gap: 5, padding: spacing.lg },
  rankingStage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  rankingHeader: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingRight: touchTarget },
  rankingTitle: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "800" },
  rankingEmpty: { flex: 1, color: colors.muted, fontSize: 11, textAlign: "center", textAlignVertical: "center" },
  rankingList: { flex: 1, justifyContent: "space-around" },
  rankingRow: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rankingPosition: { width: 24, color: colors.primaryDark, fontSize: 11, fontWeight: "800" },
  rankingName: { flex: 1, color: colors.text, fontSize: 10, fontWeight: "700" },
  rankingCount: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  stageSlide: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surface, overflow: "hidden" },
  checkinStage: { backgroundColor: colors.surface, flexDirection: "row", gap: spacing.lg },
  stageName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  stageCompany: { color: colors.muted, fontSize: 12 },
  stageTimerOverlay: { position: "absolute", right: spacing.sm, bottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.surface },
  stageTime: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  stageEyebrow: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" },
  stageTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", textAlign: "center" },
  stageMessage: { color: "#FFFFFF", fontSize: 13 },
  stageSub: { color: "#CBD5E1", fontSize: 12, textAlign: "center" },
  qrBox: { width: 84, height: 84, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  controls: { flex: 1 },
  controlsContent: { width: "100%", maxWidth: 640, alignSelf: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
  footer: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface, paddingTop: spacing.sm, paddingHorizontal: spacing.sm },
  finishButton: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: spacing.lg },
  finishText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  inlineLabel: { color: colors.muted, fontSize: 12, paddingHorizontal: spacing.xs },
  modes: { flexDirection: "row", gap: spacing.xs },
  mode: { flex: 1, minHeight: touchTarget, minWidth: touchTarget, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  modeActive: { backgroundColor: brandBlue, borderColor: brandBlue },
  disabled: { opacity: 0.65 },
  panelTabs: { flexDirection: "row", borderRadius: radius.md, padding: 2, backgroundColor: colors.primarySoft },
  panelTab: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  panelTabActive: { backgroundColor: brandSoft },
  panelTabText: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  panelTabTextActive: { color: colors.text, fontWeight: "600" },
  section: { gap: spacing.xs, padding: spacing.sm },
  sectionHeading: { color: colors.text, fontSize: 13, fontWeight: "600" },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  personName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  activeSpeakerName: { color: "#FF3B30" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  speakerActions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  speakerAction: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface },
  compactGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  compactAction: { minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: 2 },
  compactHalf: { width: "48%" },
  compactThird: { width: "31%" },
  compactQuarter: { width: "22.5%" },
  compactPrimary: { backgroundColor: brandBlue, borderColor: brandBlue },
  compactActionText: { color: colors.text, fontSize: 12, fontWeight: "500", textAlign: "center" },
  compactPrimaryText: { color: colors.text, fontWeight: "600" },
  compactPressed: { opacity: 0.78 },
  people: { gap: spacing.sm },
  personRow: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface },
  personRowActive: { backgroundColor: brandSoft, borderColor: brandBlue },
  personMain: { minHeight: touchTarget, flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.sm, paddingRight: spacing.xs },
  personIndex: { width: 22, color: colors.muted, fontSize: 12, textAlign: "center" },
  personRowName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "500" },
  currentLabel: { color: colors.text, fontSize: 12, fontWeight: "600" },
  deferButton: { width: touchTarget, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  switchRow: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  delayRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  delay: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  delayActive: { backgroundColor: brandSoft, borderColor: brandBlue },
  delayText: { color: colors.text, fontSize: 12, fontWeight: "500" },
  prizes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  prize: { width: "49%", minHeight: touchTarget, justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm },
  prizeActive: { borderColor: brandBlue, backgroundColor: brandSoft },
  prizeName: { color: colors.text, fontSize: 12, fontWeight: "500" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  sheetBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheetContent: { gap: spacing.md, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  sheetHeader: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  sheetClose: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
});
