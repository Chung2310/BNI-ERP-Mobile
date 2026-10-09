import { friendlyErrorMessage } from "@/utils/userFacingError";
import { Alert } from "@/components/AppAlert";
import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { io } from "socket.io-client";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronsUp,
  CircleStop,
  Clock3,
  CornerDownRight,
  Gift,
  MessageCircle,
  Monitor,
  Pause,
  Play,
  Presentation,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { buildActiveMemberRankings } from "@/components/ActiveMemberRanking";
import { ProfileSlideCanvas } from "@/components/meetings/ProfileSlideCanvas";
import { MeetingWheelPreview, MeetingWinnersList } from "@/components/meetings/MeetingWheelPreview";
import { MeetingDrawRemote } from "@/components/meetings/MeetingDrawRemote";
import { InteractionManager } from "@/components/meetings/InteractionManager";
import { ResponseWordCloud } from "@/components/meetings/ResponseWordCloud";
import { Avatar, Badge, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  meetingService,
  meetingVersion,
  type Meeting,
  type MeetingInteraction,
  type MeetingLiveSnapshot,
  type PresentationView,
  type Speaker,
} from "@/services/meeting";
import { userService } from "@/services/users";
import { apiConfig } from "@/services/api";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

const views: { value: PresentationView; label: string; icon: LucideIcon }[] = [
  { value: "checkin", label: "QR Check-in", icon: QrCode },
  { value: "speaker", label: "Phát biểu", icon: Users },
  { value: "luckyDraw", label: "Quay thưởng", icon: Gift },
  { value: "audienceResponses", label: "Câu trả lời", icon: MessageCircle },
  { value: "activeMembers", label: "Xếp hạng", icon: Trophy },
  { value: "waiting", label: "Màn chờ", icon: Monitor },
];

const brandBlue = "#00ADFC";
const brandSoft = "rgba(0, 173, 252, 0.12)";

type Panel = "speaker" | "draw" | "responses" | "tools";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "TV";
}

function formatCheckinTime(value?: string) {
  if (!value) return "";
  try {
    const d = new Date(value);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function MeetingRemoteControl({
  id,
  initialPanel,
}: {
  id: string;
  initialPanel?: Panel;
}) {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const canManage = hasPermission(user, "meetings:manage", "access:manage");
  const [snapshot, setSnapshot] = useState<MeetingLiveSnapshot | null>(null);
  const [interactionPreview, setInteractionPreview] = useState<MeetingInteraction | null>(null);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchCheckin, setSearchCheckin] = useState("");
  const [viewOverride, setViewOverride] = useState<PresentationView | null>(
    initialPanel === "responses" ? "audienceResponses" : null
  );

  const applySnapshot = useCallback(
    (next: MeetingLiveSnapshot) => {
      if (!activeRef.current) return;
      if (next.meeting._id !== id) return;
      if (
        snapshotRef.current &&
        meetingVersion(next.meeting) < meetingVersion(snapshotRef.current.meeting)
      )
        return;
      clockOffsetRef.current = next.serverNow - Date.now();
      snapshotRef.current = next;
      setSnapshot(next);
      setNow(next.serverNow);
      setSyncError("");
      setLoading(false);
      setViewOverride(null);
    },
    [id]
  );

  const refresh = useCallback(
    async (full = false) => {
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
          const next =
            !state || !current || meetingVersion(state.meeting) !== meetingVersion(current.meeting)
              ? await meetingService.live(id)
              : { ...current, meeting: state.meeting, serverNow: state.serverNow };
          applySnapshot(next);
          if (next.meeting.presentation?.view === "audienceResponses") {
            try {
              setInteractionPreview(await meetingService.interaction(id));
            } catch {
              setInteractionPreview(null);
            }
          }
          full = queuedRefreshRef.current;
        } while (full && activeRef.current);
      } catch (cause) {
        if (activeRef.current) {
          setSyncError(friendlyErrorMessage(cause, "Không thể đồng bộ màn trình chiếu."));
          setLoading(false);
        }
      } finally {
        pollingRef.current = false;
      }
    },
    [applySnapshot, id]
  );

  useFocusEffect(
    useCallback(() => {
      activeRef.current = true;
      void refresh(true);
      const socket = token
        ? io(apiConfig.baseUrl, {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnection: true,
          })
        : null;
      socket?.on("connect", () => void refresh(true));
      socket?.on("meeting_updated", (event: { id?: string; meetingId?: string; version?: number }) => {
        if (event.id !== id && event.meetingId !== id) return;
        if (
          event.version !== undefined &&
          snapshotRef.current &&
          event.version < meetingVersion(snapshotRef.current.meeting)
        )
          return;
        void refresh(true);
      });
      const poll = setInterval(() => {
        if (!busyRef.current) void refresh();
      }, 5000);
      const tick = setInterval(() => setNow(Date.now() + clockOffsetRef.current), 1000);
      return () => {
        activeRef.current = false;
        queuedRefreshRef.current = false;
        socket?.disconnect();
        clearInterval(poll);
        clearInterval(tick);
      };
    }, [id, refresh, token])
  );

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
      Alert.alert("Không thể điều khiển", friendlyErrorMessage(cause, "Vui lòng thử lại."));
      void refresh(true);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const control = (action: Parameters<typeof meetingService.control>[1]) =>
    void run((meeting) => meetingService.control(id, action, meetingVersion(meeting)));

  const setView = (nextView: PresentationView) => {
    setViewOverride(nextView);
    void run((meeting) =>
      meetingService.presentationState(id, { view: nextView }, meetingVersion(meeting))
    );
  };

  const confirmFinish = () =>
    Alert.alert(
      "Kết thúc cuộc họp?",
      "Màn hình trình chiếu sẽ thông báo cuộc họp đã kết thúc.",
      [
        { text: "Quay lại", style: "cancel" },
        { text: "Kết thúc", style: "destructive", onPress: () => control("finish") },
      ]
    );

  const meeting = snapshot?.meeting;
  const currentSpeaker = meeting?.speakers[meeting.currentIndex];
  const view: PresentationView =
    viewOverride || meeting?.presentation?.view || "checkin";
  const closed = meeting?.status === "ended" || meeting?.status === "cancelled";
  const disabled = !canManage || closed || busy || Boolean(syncError);

  // Bộ lọc khách đã check-in
  const filteredSpeakers = (() => {
    const query = searchCheckin.trim().toLocaleLowerCase("vi");
    return (meeting?.speakers || []).filter(
      (speaker) =>
        !query ||
        [speaker.name, speaker.email, speaker.company].some((val) =>
          val?.toLocaleLowerCase("vi").includes(query)
        )
    );
  })();

  // Đặt ưu tiên cho khách (Đưa lên đầu danh sách chờ phát biểu)
  const prioritizeSpeaker = (person: Speaker) => {
    if (!meeting) return;
    const index = meeting.speakers.findIndex((item) => item.id === person.id);
    const targetIndex =
      meeting.status === "scheduled"
        ? 0
        : Math.max(
            0,
            meeting.currentIndex +
              (meeting.speakerStartedAt || (meeting.elapsedSeconds || 0) > 0 ? 1 : 0)
          );
    if (index <= targetIndex) {
      Alert.alert("Đã ở vị trí ưu tiên", `${person.name} đã ở đầu danh sách phát biểu.`);
      return;
    }
    const order = [...meeting.speakers];
    const [moved] = order.splice(index, 1);
    order.splice(targetIndex, 0, moved);
    void run((current) =>
      meetingService.reorderSpeakers(
        id,
        order.map((item) => item.id),
        meetingVersion(current)
      )
    );
  };

  // Đẩy khách xuống cuối lượt (Skip)
  const deferSpeaker = (person: Speaker) => {
    if (!meeting) return;
    const index = meeting.speakers.findIndex((item) => item.id === person.id);
    if (index === meeting.speakers.length - 1) {
      Alert.alert("Đã ở cuối lượt", `${person.name} đã ở cuối danh sách phát biểu.`);
      return;
    }
    void run((current) =>
      meetingService.deferSpeaker(id, person.id, meetingVersion(current))
    );
  };

  if (!snapshot || !meeting)
    return (
      <Screen scroll={false} style={styles.screen}>
        <View style={styles.header}>
          <BackHeader title="Bảng điều khiển trình chiếu" compact />
        </View>
        {loading ? (
          <LoadingState />
        ) : (
          <ErrorState
            message={syncError || "Không tải được cuộc họp."}
            onRetry={() => void refresh(true)}
          />
        )}
      </Screen>
    );

  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.header}>
        <BackHeader
          title="Bảng điều khiển trình chiếu"
          compact
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cài đặt tự chuyển lượt"
              onPress={() => setSettingsOpen(true)}
              style={styles.settingsButton}
            >
              <Settings2 color={colors.text} size={21} />
            </Pressable>
          }
        />
      </View>

      <>
        {/* Khung Stage Preview màn hình chiếu */}
        <View style={styles.previewCard}>
          <StagePreview snapshot={snapshot} now={now} interaction={interactionPreview} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đồng bộ màn chiếu"
            onPress={() => void refresh(true)}
            style={styles.refreshButton}
          >
            <RefreshCw color={colors.primaryDark} size={18} />
          </Pressable>
          {syncError ? (
            <Text style={styles.syncError}>{syncError} · Chạm nút làm mới để thử lại.</Text>
          ) : null}
        </View>

        <ScrollView
          style={styles.controls}
          contentContainerStyle={styles.controlsContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* HÀNG 6 NÚT CHUYỂN MÀN HÌNH: 3 NÚT MỖI HÀNG (TỔNG 6 NÚT) */}
          <Text style={styles.inlineLabel}>Chế độ trình chiếu</Text>
          <View style={styles.modesGrid}>
            {views.map(({ value, label, icon: Icon }) => {
              const active = view === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active, disabled }}
                  disabled={disabled}
                  onPress={() => setView(value)}
                  style={[
                    styles.modeCard,
                    active && styles.modeCardActive,
                    disabled && styles.disabled,
                  ]}
                >
                  <View style={[styles.modeIconCircle, active && styles.modeIconCircleActive]}>
                    <Icon color={active ? "#FFFFFF" : brandBlue} size={18} />
                  </View>
                  <Text numberOfLines={1} style={[styles.modeLabel, active && styles.modeLabelActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {view === "luckyDraw" ? <MeetingWinnersList meeting={meeting} now={now} /> : null}

          {/* 1. MẶC ĐỊNH HOẶC KHI CHỌN QR CHECK-IN: HIỂN THỊ DS ĐÃ CHECK-IN */}
          {view === "checkin" ? (
            <Card style={styles.checkinCard}>
              <View style={styles.checkinHeaderRow}>
                <View style={styles.row}>
                  <QrCode color={colors.primaryDark} size={20} />
                  <Text style={styles.checkinTitle}>Danh sách đã check-in</Text>
                </View>
                <Badge tone="primary">{meeting.speakers.length} NGƯỜI</Badge>
              </View>

              {/* Ô tìm kiếm khách */}
              <View style={styles.searchBox}>
                <Search color={colors.muted} size={18} />
                <TextInput
                  value={searchCheckin}
                  onChangeText={setSearchCheckin}
                  placeholder="Tìm thành viên hoặc khách mời..."
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                />
                {searchCheckin ? (
                  <Pressable hitSlop={8} onPress={() => setSearchCheckin("")}>
                    <X color={colors.muted} size={16} />
                  </Pressable>
                ) : null}
              </View>

              {/* Danh sách người tham gia */}
              {!meeting.speakers.length ? (
                <EmptyState
                  title="Chưa có người check-in"
                  message="Quét mã QR trên màn hình chiếu để người tham dự điểm danh vào buổi họp."
                />
              ) : !filteredSpeakers.length ? (
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>Không tìm thấy kết quả phù hợp.</Text>
                </View>
              ) : (
                <View style={styles.checkinList}>
                  {filteredSpeakers.map((person) => {
                    const originalIndex = meeting.speakers.findIndex((s) => s.id === person.id);
                    const isNext = originalIndex === 0;
                    return (
                      <View
                        key={person.id}
                        style={[styles.checkinItem, isNext && styles.checkinItemNext]}
                      >
                        <View style={styles.orderPill}>
                          <Text style={styles.orderPillText}>#{originalIndex + 1}</Text>
                        </View>
                        <Avatar
                          initials={initials(person.name)}
                          url={person.photoURL}
                          size={38}
                        />
                        <View style={styles.checkinInfo}>
                          <Text numberOfLines={1} style={styles.checkinName}>
                            {person.name}
                          </Text>
                          <View style={styles.checkinMetaRow}>
                            <View
                              style={[
                                styles.userTypeTag,
                                !person.userId && styles.userTypeTagGuest,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.userTypeTagText,
                                  !person.userId && styles.userTypeTagTextGuest,
                                ]}
                              >
                                {person.userId ? "Thành viên" : "Khách mời"}
                              </Text>
                            </View>
                            {person.checkedInAt ? (
                              <Text style={styles.checkinTimeText}>
                                {formatCheckinTime(person.checkedInAt)}
                              </Text>
                            ) : null}
                            {person.company ? (
                              <Text numberOfLines={1} style={styles.checkinCompanyText}>
                                · {person.company}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        {/* Nút đặt ưu tiên & nút đẩy/skip xuống dưới */}
                        <View style={styles.checkinActions}>
                          <Pressable
                            accessibilityLabel={`Đặt ưu tiên cho ${person.name}`}
                            disabled={disabled || originalIndex === 0}
                            onPress={() => prioritizeSpeaker(person)}
                            style={[
                              styles.actionIconBtn,
                              styles.actionIconBtnPriority,
                              (disabled || originalIndex === 0) && styles.disabled,
                            ]}
                          >
                            <ChevronsUp color={colors.primaryDark} size={18} />
                          </Pressable>

                          <Pressable
                            accessibilityLabel={`Đẩy ${person.name} xuống cuối lượt`}
                            disabled={disabled || originalIndex === meeting.speakers.length - 1}
                            onPress={() => deferSpeaker(person)}
                            style={[
                              styles.actionIconBtn,
                              styles.actionIconBtnDefer,
                              (disabled || originalIndex === meeting.speakers.length - 1) &&
                                styles.disabled,
                            ]}
                          >
                            <CornerDownRight color={colors.text} size={17} />
                          </Pressable>

                          <Pressable
                            accessibilityLabel={`Chiếu slide của ${person.name}`}
                            disabled={disabled}
                            onPress={() =>
                              void run((current) =>
                                meetingService.presentation(
                                  id,
                                  person.id,
                                  meetingVersion(current)
                                )
                              )
                            }
                            style={[
                              styles.actionIconBtn,
                              styles.actionIconBtnPresent,
                              disabled && styles.disabled,
                            ]}
                          >
                            <Play color="#FFFFFF" size={15} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          ) : null}

          {/* 2. CHẾ ĐỘ PHÁT BIỂU */}
          {view === "speaker" ? (
            <>
              <Card style={styles.section}>
                <View style={styles.summaryRow}>
                  <Text style={styles.sectionHeading}>Đang phát biểu</Text>
                  <Text style={styles.muted}>
                    {meeting.status === "paused"
                      ? "Tạm dừng"
                      : currentSpeaker
                      ? `Lượt ${meeting.currentIndex + 1}/${meeting.speakers.length}`
                      : "Chưa bắt đầu"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.personName,
                    currentSpeaker &&
                      (meeting.status === "live" || meeting.status === "paused") &&
                      styles.activeSpeakerName,
                  ]}
                >
                  {currentSpeaker?.name || "Chưa có người phát biểu"}
                </Text>
                {meeting.status === "scheduled" ? (
                  <View style={styles.compactGrid}>
                    <CompactAction
                      icon={Play}
                      label="Bắt đầu họp"
                      accessibilityLabel="Bắt đầu cuộc họp"
                      columns={2}
                      primary
                      disabled={disabled}
                      onPress={() => control("start")}
                    />
                  </View>
                ) : null}
                {(meeting.status === "live" || meeting.status === "paused") && currentSpeaker ? (
                  <View style={styles.speakerActions}>
                    {meeting.status === "paused" ? (
                      <SpeakerAction
                        icon={Play}
                        accessibilityLabel="Tiếp tục và chiếu"
                        primary
                        disabled={disabled}
                        onPress={() =>
                          void run((current) =>
                            meetingService.presentation(
                              id,
                              current.speakers[current.currentIndex].id,
                              meetingVersion(current)
                            )
                          )
                        }
                      />
                    ) : (
                      <SpeakerAction
                        icon={meeting.speakerStartedAt ? Pause : Play}
                        accessibilityLabel={
                          meeting.speakerStartedAt ? "Tạm dừng phát biểu" : "Bắt đầu đếm giờ"
                        }
                        disabled={disabled}
                        onPress={() =>
                          control(meeting.speakerStartedAt ? "pause" : "start_speaker")
                        }
                      />
                    )}
                    <SpeakerAction
                      icon={SkipBack}
                      accessibilityLabel="Người phát biểu trước"
                      disabled={disabled || meeting.currentIndex <= 0}
                      onPress={() => control("previous")}
                    />
                    <SpeakerAction
                      icon={SkipForward}
                      accessibilityLabel="Người phát biểu tiếp theo"
                      primary
                      disabled={disabled}
                      onPress={() => control("next")}
                    />
                    <SpeakerAction
                      icon={RotateCcw}
                      accessibilityLabel="Đặt lại đồng hồ phát biểu"
                      disabled={disabled}
                      onPress={() => control("reset_speaker")}
                    />
                  </View>
                ) : null}
              </Card>

              <Card style={styles.section}>
                <View style={styles.summaryRow}>
                  <Text style={styles.sectionHeading}>Thứ tự thuyết trình</Text>
                  <Text style={styles.muted}>{meeting.speakers.length} người</Text>
                </View>
                <Text style={styles.muted}>
                  Chạm để chiếu · Icon bên phải để đưa xuống cuối lượt
                </Text>
                {!meeting.speakers.length ? (
                  <Text style={styles.muted}>Chưa có người check-in.</Text>
                ) : (
                  <View style={styles.people}>
                    {meeting.speakers.map((person, index) => {
                      const isCurrent =
                        (meeting.status === "live" || meeting.status === "paused") &&
                        index === meeting.currentIndex;
                      const cannotDefer =
                        disabled ||
                        index < Math.max(0, meeting.currentIndex) ||
                        index === meeting.speakers.length - 1;
                      return (
                        <View
                          key={person.id}
                          style={[styles.personRow, isCurrent && styles.personRowActive]}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Chiếu slide của ${person.name}`}
                            accessibilityState={{ disabled, selected: isCurrent }}
                            disabled={disabled}
                            onPress={() =>
                              void run((current) =>
                                meetingService.presentation(
                                  id,
                                  person.id,
                                  meetingVersion(current)
                                )
                              )
                            }
                            style={styles.personMain}
                          >
                            <Text style={styles.personIndex}>{index + 1}</Text>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.personRowName,
                                isCurrent && styles.activeSpeakerName,
                              ]}
                            >
                              {person.name}
                            </Text>
                            {isCurrent ? (
                              <Text style={styles.currentLabel}>
                                {meeting.status === "paused" ? "Tạm dừng" : "Đang phát biểu"}
                              </Text>
                            ) : (
                              <Play color={colors.muted} size={17} />
                            )}
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Đưa ${person.name} xuống cuối lượt`}
                            accessibilityState={{ disabled: cannotDefer }}
                            disabled={cannotDefer}
                            onPress={() =>
                              void run((current) =>
                                meetingService.deferSpeaker(
                                  id,
                                  person.id,
                                  meetingVersion(current)
                                )
                              )
                            }
                            style={[styles.deferButton, cannotDefer && styles.disabled]}
                          >
                            <CornerDownRight color={colors.text} size={18} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>
            </>
          ) : null}

          {/* 3. CHẾ ĐỘ QUAY THƯỞNG */}
          {view === "luckyDraw" ? (
            <MeetingDrawRemote id={id} meeting={meeting} disabled={disabled} onRefresh={() => void refresh(true)} />
          ) : null}

          {/* 4. CHẾ ĐỘ CÂU TRẢ LỜI / THU Ý KIẾN */}
          {view === "audienceResponses" ? (
            <RemoteInteractionPanel
              id={id}
              canManage={canManage && !closed}
              onUpdate={setInteractionPreview}
            />
          ) : null}

          {/* 5. CHẾ ĐỘ XẾP HẠNG THÀNH VIÊN */}
          {view === "activeMembers" ? (
            <Card style={styles.section}>
              <View style={styles.summaryRow}>
                <View style={styles.row}>
                  <Trophy color={colors.warning} size={18} />
                  <Text style={styles.sectionHeading}>Xếp hạng thành viên tích cực</Text>
                </View>
                <Badge tone="warning">ĐANG TRÌNH CHIẾU</Badge>
              </View>
              <Text style={styles.muted}>
                Màn hình chiếu đang hiển thị bảng xếp hạng thành viên tham dự và hoạt động sôi nổi.
              </Text>
              <View style={styles.compactGrid}>
                <CompactAction
                  icon={Trophy}
                  label="Xem BXH đầy đủ"
                  accessibilityLabel="Mở bảng xếp hạng đầy đủ"
                  columns={2}
                  primary
                  onPress={() => router.push("/rankings")}
                />
                <CompactAction
                  icon={QrCode}
                  label="Quay lại QR Check-in"
                  accessibilityLabel="Chuyển về QR check-in"
                  columns={2}
                  onPress={() => setView("checkin")}
                />
              </View>
            </Card>
          ) : null}

          {/* 6. CHẾ ĐỘ MÀN HÌNH CHỜ */}
          {view === "waiting" ? (
            <Card style={styles.section}>
              <View style={styles.summaryRow}>
                <View style={styles.row}>
                  <Monitor color={colors.primaryDark} size={18} />
                  <Text style={styles.sectionHeading}>Màn hình chờ cuộc họp</Text>
                </View>
                <Badge tone="default">MÀN HÌNH CHỜ</Badge>
              </View>
              <Text style={styles.muted}>
                Màn hình chiếu đang hiển thị thông điệp chờ cuộc họp bắt đầu.
              </Text>
              <View style={styles.compactGrid}>
                <CompactAction
                  icon={QrCode}
                  label="Mở QR Check-in"
                  accessibilityLabel="Mở QR check-in cho người tham dự"
                  columns={2}
                  primary
                  onPress={() => setView("checkin")}
                />
                <CompactAction
                  icon={Users}
                  label="Bắt đầu phát biểu"
                  accessibilityLabel="Bắt đầu phát biểu"
                  columns={2}
                  onPress={() => setView("speaker")}
                />
              </View>
            </Card>
          ) : null}
        </ScrollView>

        {(meeting.status === "live" || meeting.status === "paused") ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, spacing.sm) },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kết thúc cuộc họp"
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={confirmFinish}
              style={[styles.finishButton, disabled && styles.disabled]}
            >
              <CircleStop color={colors.danger} size={18} />
              <Text style={styles.finishText}>Kết thúc cuộc họp</Text>
            </Pressable>
          </View>
        ) : null}
      </>

      {/* Modal Cài đặt trình chiếu */}
      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            accessibilityLabel="Đóng cài đặt trình chiếu"
            style={styles.sheetBackdrop}
            onPress={() => setSettingsOpen(false)}
          />
          <View
            style={[
              styles.sheetContent,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Cài đặt trình chiếu</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                onPress={() => setSettingsOpen(false)}
                style={styles.sheetClose}
              >
                <X color={colors.text} size={20} />
              </Pressable>
            </View>
            <View style={styles.switchRow}>
              <View style={styles.grow}>
                <Text style={styles.sectionHeading}>Tự chuyển lượt</Text>
                <Text style={styles.muted}>Tiếp tục chạy khi khóa điện thoại</Text>
              </View>
              <AutoAdvanceToggle
                key={String(Boolean(meeting.presentation?.autoAdvance))}
                value={Boolean(meeting.presentation?.autoAdvance)}
                disabled={disabled}
                onChange={(autoAdvance) =>
                  run((current) =>
                    meetingService.presentationState(
                      id,
                      { autoAdvance },
                      meetingVersion(current)
                    )
                  )
                }
              />
            </View>
            <Text style={styles.muted}>Chờ sau khi hết giờ phát biểu</Text>
            <View style={styles.delayRow}>
              {[0, 3, 5, 10].map((seconds) => (
                <Pressable
                  key={seconds}
                  accessibilityRole="button"
                  accessibilityLabel={`${seconds} giây`}
                  accessibilityState={{
                    selected: (meeting.presentation?.autoAdvanceDelay ?? 3) === seconds,
                    disabled,
                  }}
                  disabled={disabled}
                  onPress={() =>
                    void run((current) =>
                      meetingService.presentationState(
                        id,
                        { autoAdvanceDelay: seconds },
                        meetingVersion(current)
                      )
                    )
                  }
                  style={[
                    styles.delay,
                    (meeting.presentation?.autoAdvanceDelay ?? 3) === seconds &&
                      styles.delayActive,
                  ]}
                >
                  <Text style={styles.delayText}>{seconds}s</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function RemoteInteractionPanel({
  id,
  canManage,
  onUpdate,
}: {
  id: string;
  canManage: boolean;
  onUpdate: (next: MeetingInteraction) => void;
}) {
  const { data, error, isLoading, reload } = useAsyncData(
    () => meetingService.interaction(id),
    id
  );
  if (isLoading && !data)
    return (
      <Card style={styles.section}>
        <LoadingState />
      </Card>
    );
  if (error && !data)
    return (
      <Card style={styles.section}>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  if (!data) return null;
  return (
    <InteractionManager
      key={data.session?.id || id}
      meetingId={id}
      initial={data}
      canManage={canManage}
      embedded
      onStateChange={onUpdate}
    />
  );
}

function StagePreview({
  snapshot,
  now,
  interaction,
}: {
  snapshot: MeetingLiveSnapshot;
  now: number;
  interaction: MeetingInteraction | null;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const meeting = snapshot.meeting;
  const view = meeting.presentation?.view || "checkin";
  const speaker = meeting.speakers[meeting.currentIndex];
  const slide = snapshot.slides.find((item) => item.id === speaker?.id);
  const elapsed =
    Math.max(0, meeting.elapsedSeconds || 0) +
    (meeting.status === "live" && meeting.speakerStartedAt
      ? Math.max(0, (now - Date.parse(meeting.speakerStartedAt)) / 1000)
      : 0);
  const remaining = speaker ? Math.max(0, Math.floor(speaker.seconds - elapsed)) : 0;
  const time =
    speaker && elapsed >= speaker.seconds
      ? "Hết giờ"
      : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(
          remaining % 60
        ).padStart(2, "0")}`;

  if (meeting.status === "ended" || meeting.status === "cancelled")
    return (
      <View style={styles.stage}>
        <Text style={styles.stageTitle}>{meeting.title}</Text>
        <Text style={styles.stageMessage}>
          Cuộc họp đã {meeting.status === "ended" ? "kết thúc" : "hủy"}
        </Text>
      </View>
    );

  if (view === "speaker")
    return slide ? (
      <View style={styles.stageSlide}>
        <ProfileSlideCanvas
          key={slide.id}
          slide={slide}
          width={Math.min(screenWidth - 18, 560)}
        />
        {speaker ? (
          <View style={styles.stageTimerOverlay}>
            <Clock3 color={colors.primaryDark} size={13} />
            <Text style={styles.stageTime}>{time}</Text>
          </View>
        ) : null}
      </View>
    ) : (
      <View style={styles.stage}>
        <Presentation color="#FFFFFF" size={32} />
        <Text style={styles.stageTitle}>Chờ slide thuyết trình</Text>
      </View>
    );

  if (view === "checkin")
    return (
      <View style={[styles.stage, styles.checkinStage]}>
        <View style={styles.qrBox}>
          <QrCode color={colors.primaryDark} size={56} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.stageEyebrow}>QR CHECK-IN</Text>
          <Text numberOfLines={2} style={styles.stageName}>
            {meeting.title}
          </Text>
          <Text style={styles.stageCompany}>
            {meeting.speakers.length} người đã điểm danh
          </Text>
        </View>
      </View>
    );

  if (view === "audienceResponses") {
    const session = interaction?.session;
    const question =
      session?.questions.find((item) => item.id === session.activeQuestionId) ||
      session?.questions[0];
    return (
      <View style={styles.responseStage}>
        {question ? (
          <ResponseWordCloud
            questions={[question]}
            responses={interaction?.allResponses || interaction?.responses || []}
            compact
          />
        ) : (
          <Text style={styles.stageCompany}>Tạo câu hỏi trong bảng điều khiển bên dưới</Text>
        )}
      </View>
    );
  }

  if (view === "luckyDraw") return <MeetingWheelPreview meeting={meeting} now={now} fullscreen />;
  if (view === "activeMembers") return <StageRankingPreview meeting={meeting} />;

  return (
    <View style={styles.stage}>
      <Monitor color="#00ADFC" size={34} />
      <Text style={styles.stageTitle}>{meeting.title}</Text>
      <Text style={styles.stageSub}>Vui lòng chờ</Text>
    </View>
  );
}

function StageRankingPreview({ meeting }: { meeting: Meeting }) {
  const { data, error, isLoading } = useAsyncData(async () => {
    const [history, members] = await Promise.all([
      meetingService.history(),
      userService.directory().catch(() => []),
    ]);
    return { history, members };
  }, meeting._id);

  const rankings = useMemo(
    () =>
      data
        ? buildActiveMemberRankings(
            [...data.history.filter((item) => item._id !== meeting._id), meeting],
            data.members,
            meeting
          )
            .rankings.filter((member) => member.attendedCount > 0)
            .slice(0, 5)
        : [],
    [data, meeting]
  );

  return (
    <View style={styles.rankingStage}>
      <View style={styles.rankingHeader}>
        <Trophy color={colors.warning} size={17} />
        <Text numberOfLines={1} style={styles.rankingTitle}>
          Bảng xếp hạng thành viên tích cực
        </Text>
      </View>
      {isLoading && !data ? (
        <Text style={styles.rankingEmpty}>Đang tải bảng xếp hạng…</Text>
      ) : error ? (
        <Text style={styles.rankingEmpty}>Không tải được bảng xếp hạng.</Text>
      ) : !rankings.length ? (
        <Text style={styles.rankingEmpty}>Chưa có dữ liệu điểm danh.</Text>
      ) : (
        <View style={styles.rankingList}>
          {rankings.map((member, index) => (
            <View key={member.id} style={styles.rankingRow}>
              <Text style={styles.rankingPosition}>#{index + 1}</Text>
              <Avatar
                initials={member.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(-2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()}
                url={member.photoURL}
                size={22}
              />
              <Text numberOfLines={1} style={styles.rankingName}>
                {member.name}
              </Text>
              <Text style={styles.rankingCount}>
                {member.attendedCount} buổi · {member.attendanceRate}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function CompactAction({
  icon: Icon,
  label,
  accessibilityLabel,
  onPress,
  disabled,
  primary = false,
  columns = 2,
}: {
  icon: LucideIcon;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  columns?: 2 | 3 | 4;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactAction,
        columns === 2 ? styles.compactHalf : styles.compactThird,
        primary && styles.compactPrimary,
        disabled && styles.disabled,
        pressed && styles.compactPressed,
      ]}
    >
      <Icon color={primary ? "#FFFFFF" : brandBlue} size={18} />
      <Text
        numberOfLines={1}
        style={[styles.compactActionText, primary && styles.compactPrimaryText]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SpeakerAction({
  icon: Icon,
  accessibilityLabel,
  onPress,
  disabled,
  primary = false,
}: {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.speakerAction,
        primary && styles.speakerActionPrimary,
        disabled && styles.disabled,
        pressed && styles.compactPressed,
      ]}
    >
      <Icon color={primary ? "#FFFFFF" : brandBlue} size={20} />
    </Pressable>
  );
}

function AutoAdvanceToggle({
  value,
  disabled,
  onChange,
}: {
  value: boolean;
  disabled: boolean;
  onChange: (next: boolean) => Promise<boolean>;
}) {
  const [checked, setChecked] = useState(value);
  const toggle = (next: boolean) => {
    setChecked(next);
    void onChange(next).then((saved) => {
      if (!saved) setChecked(value);
    });
  };
  return (
    <Switch
      accessibilityLabel="Tự chuyển lượt"
      value={checked}
      disabled={disabled}
      trackColor={{ false: colors.border, true: brandSoft }}
      thumbColor={checked ? brandBlue : colors.surface}
      onValueChange={toggle}
    />
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingVertical: 0, paddingBottom: 0, gap: 0 },
  header: { paddingHorizontal: spacing.sm },
  settingsButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  previewCard: {
    width: "96%",
    maxWidth: 560,
    alignSelf: "center",
    marginBottom: spacing.xs,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "#FFFFFFE6",
  },
  syncError: { padding: spacing.sm, color: colors.danger, fontSize: 11 },
  stage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#102533",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: spacing.lg,
  },
  rankingStage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  rankingHeader: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingRight: touchTarget,
  },
  rankingTitle: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "800" },
  rankingEmpty: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    textAlignVertical: "center",
  },
  rankingList: { flex: 1, justifyContent: "space-around" },
  rankingRow: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rankingPosition: { width: 24, color: colors.primaryDark, fontSize: 11, fontWeight: "800" },
  rankingName: { flex: 1, color: colors.text, fontSize: 10, fontWeight: "700" },
  rankingCount: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  stageSlide: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  checkinStage: { backgroundColor: colors.surface, flexDirection: "row", gap: spacing.lg },
  responseStage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface,
    justifyContent: "center",
    overflow: "hidden",
    padding: spacing.xs,
  },
  stageName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  stageCompany: { color: colors.muted, fontSize: 12 },
  stageTimerOverlay: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  stageTime: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  stageEyebrow: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  stageTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", textAlign: "center" },
  stageMessage: { color: "#FFFFFF", fontSize: 13 },
  stageSub: { color: "#CBD5E1", fontSize: 12, textAlign: "center" },
  qrBox: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  grow: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  controls: { flex: 1 },
  controlsContent: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  footer: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  finishButton: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
  },
  finishText: { color: colors.danger, fontSize: 13, fontWeight: "700" },
  inlineLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },

  // 6 nút chọn chế độ (3 nút mỗi hàng)
  modesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  modeCard: {
    width: "31.8%",
    minHeight: 56,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
  },
  modeCardActive: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primarySoft,
  },
  modeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconCircleActive: {
    backgroundColor: colors.brandBlue,
  },
  modeLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  modeLabelActive: {
    color: colors.primaryDark,
    fontWeight: "800",
  },

  disabled: { opacity: 0.65 },

  // Card check-in & danh sách người check-in
  checkinCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  checkinHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkinTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  emptySearch: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  emptySearchText: {
    color: colors.muted,
    fontSize: 13,
  },
  checkinList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  checkinItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  checkinItemNext: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primarySoft,
  },
  orderPill: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  orderPillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  checkinInfo: {
    flex: 1,
    minWidth: 0,
  },
  checkinName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  checkinMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    flexWrap: "wrap",
  },
  userTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(0, 173, 252, 0.12)",
  },
  userTypeTagGuest: {
    backgroundColor: "#FEF3C7",
  },
  userTypeTagText: {
    color: "#00ADFC",
    fontSize: 10,
    fontWeight: "700",
  },
  userTypeTagTextGuest: {
    color: "#B45309",
    fontSize: 10,
    fontWeight: "700",
  },
  checkinTimeText: {
    color: colors.muted,
    fontSize: 11,
  },
  checkinCompanyText: {
    color: colors.muted,
    fontSize: 11,
  },
  checkinActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  actionIconBtnPriority: {
    borderColor: "rgba(0, 173, 252, 0.25)",
    backgroundColor: colors.primarySoft,
  },
  actionIconBtnDefer: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  actionIconBtnPresent: {
    borderColor: colors.brandBlue,
    backgroundColor: colors.brandBlue,
  },

  // Sections chung
  section: { gap: spacing.sm, padding: spacing.md },
  sectionHeading: { color: colors.text, fontSize: 14, fontWeight: "800" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  personName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  activeSpeakerName: { color: "#E11D48" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },

  speakerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  speakerAction: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  speakerActionPrimary: {
    backgroundColor: colors.brandBlue,
    borderColor: colors.brandBlue,
  },

  compactGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  compactAction: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  compactHalf: { width: "48%" },
  compactThird: { width: "31%" },
  compactPrimary: { backgroundColor: colors.brandBlue, borderColor: colors.brandBlue },
  compactActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  compactPrimaryText: { color: "#FFFFFF", fontWeight: "800" },
  compactPressed: { opacity: 0.78 },

  people: { gap: spacing.xs },
  personRow: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  personRowActive: { backgroundColor: brandSoft, borderColor: brandBlue },
  personMain: {
    minHeight: touchTarget,
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
  },
  personIndex: { width: 22, color: colors.muted, fontSize: 12, textAlign: "center" },
  personRowName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  currentLabel: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  deferButton: {
    width: touchTarget,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },

  switchRow: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  delayRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  delay: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  delayActive: { backgroundColor: brandSoft, borderColor: brandBlue },
  delayText: { color: colors.text, fontSize: 12, fontWeight: "600" },

  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  sheetBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheetContent: {
    gap: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sheetHeader: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  sheetClose: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
