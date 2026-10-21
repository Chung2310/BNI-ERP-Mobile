import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, List, RotateCw, RefreshCw, UserMinus, Users } from "lucide-react-native";
import { Alert } from "@/components/AppAlert";
import { Badge, Button, Card, LoadingState } from "@/components/ui";
import { drawParticipants, excludedDrawWinnerIds } from "@/components/meetings/drawParticipants";
import { meetingService, meetingVersion, type LuckyDrawWinner, type Meeting } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";
import { WHEEL_SELECTION_NAME } from "@/data/wheel-selection";

export function MeetingDrawRemote({
  id,
  meeting,
  users,
  loadingUsers,
  usersError,
  onRefreshUsers,
  disabled,
  onRefresh,
}: {
  id: string;
  meeting: Meeting;
  users: UserProfile[];
  loadingUsers: boolean;
  usersError: string;
  onRefreshUsers: () => Promise<void>;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<LuckyDrawWinner | null>(null);
  const [dismissedWinnerId, setDismissedWinnerId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [displayOpen, setDisplayOpen] = useState(false);

  const refreshDisplay = useCallback(async () => {
    try {
      const display = await meetingService.presentationDisplay(id);
      setDisplayOpen(display.isOpen);
    } catch {
      setDisplayOpen(false);
    }
  }, [id]);

  const ensureDisplayOpen = async () => {
    const display = await meetingService.presentationDisplay(id);
    setDisplayOpen(display.isOpen);
    if (!display.isOpen) throw new Error("Hãy mở chế độ màn hình trình chiếu trên web trước khi điều khiển vòng quay.");
  };

  useFocusEffect(
    useCallback(() => {
      void refreshDisplay();
      const interval = setInterval(() => void refreshDisplay(), 5000);
      return () => clearInterval(interval);
    }, [refreshDisplay])
  );

  const roster = useMemo(() => drawParticipants(meeting, users), [meeting, users]);
  const drawPanel = meeting.presentation?.drawPanel || "participants";
  const winnerCount = meeting.luckyDraw?.prizes.reduce((total, prize) => total + prize.winners.length, 0) || 0;
  const excludedWinnerIds = excludedDrawWinnerIds(meeting);
  const eligible = roster.filter((person) => !excludedWinnerIds.has(person.id));
  const selected = eligible;
  const presentedWinner = meeting.luckyDraw?.prizes
    .flatMap((prize) => prize.winners)
    .find((item) => item.id === meeting.presentation?.drawWinnerId);
  const localWinner = winner && (
    meeting.presentation?.drawResultVisible !== false ||
    meeting.presentation?.drawWinnerId !== winner.id
  ) ? winner : null;
  const activeWinner = localWinner || (
    meeting.presentation?.drawResultVisible !== false &&
    presentedWinner?.id !== dismissedWinnerId
      ? presentedWinner || null
      : null
  );

  const canProject = selected.length > 0;

  const ready =
    displayOpen && !loadingUsers && !usersError && !disabled && !busy && !activeWinner && (meeting.status === "live" || meeting.status === "paused");

  const toggleWinnerList = async () => {
    if (!displayOpen || disabled || busy || activeWinner) return;
    setBusy(true);
    setError("");
    try {
      await ensureDisplayOpen();
      const current = await meetingService.get(id);
      const nextPanel = current.presentation?.drawPanel === "winners" ? "participants" : "winners";
      await meetingService.presentationState(id, { drawPanel: nextPanel }, meetingVersion(current));
      await onRefresh();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể chuyển danh sách người trúng trên màn chiếu."));
      void onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const spin = async () => {
    if (!ready) return;
    if (!canProject) {
      Alert.alert(
        "Chưa thể quay trên màn chiếu",
        "Hãy chọn ít nhất một thành viên có mặt trước khi quay."
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await ensureDisplayOpen();
      let current = await meetingService.get(id);
      if (current.luckyDraw?.drawMode !== "attendees") {
        await meetingService.updateLuckyDrawConfig(id, { drawMode: "attendees" });
        current = await meetingService.get(id);
      }
      let prize = current.luckyDraw?.prizes.find(
        (item) => item.name === WHEEL_SELECTION_NAME && item.winners.length < item.quantity
      );
      if (!prize) {
        const config = await meetingService.savePrize(id, {
          name: WHEEL_SELECTION_NAME,
          quantity: Math.max(100, current.speakers.length),
        });
        prize = config.prizes.find((item) => item.name === WHEEL_SELECTION_NAME && item.winners.length < item.quantity);
        current = await meetingService.get(id);
      }
      if (!prize) throw new Error("Không tạo được lượt chọn để quay.");
      await ensureDisplayOpen();
      const result = await meetingService.presentationDraw(id, prize.id, meetingVersion(current), "present_members", selected.map((person) => person.id));
      setWinner(result.winner);
      void onRefresh();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể quay trên màn chiếu."));
      void onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const decideWinner = async (repeatEligible: boolean) => {
    if (!displayOpen || !activeWinner || busy) return;
    setBusy(true);
    setError("");
    try {
      await ensureDisplayOpen();
      const current = await meetingService.get(id);
      await meetingService.setDrawWinnerRepeatEligibility(
        id,
        activeWinner.id,
        repeatEligible,
        meetingVersion(current)
      );
      setDismissedWinnerId(activeWinner.id);
      setWinner(null);
      void onRefresh();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể cập nhật kết quả trên màn chiếu."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {loadingUsers ? <LoadingState /> : null}

      {error || usersError ? (
        <Card style={styles.card}>
          <Text style={styles.error}>{error || usersError}</Text>
          <Button
            tone="secondary"
            icon={RefreshCw}
            onPress={() => {
              void onRefreshUsers();
              void onRefresh();
            }}
          >
            Làm mới
          </Button>
        </Card>
      ) : null}

      {/* CARD ĐIỀU KHIỂN QUAY CHỌN NGƯỜI CHÍNH (GỌN GÀNG, KHÔNG XỔ DANH SÁCH CHECKBOX) */}
      <Card style={styles.card}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Điều khiển Vòng quay chọn người</Text>
          <Badge tone={displayOpen && canProject ? "success" : "default"}>
            {displayOpen && canProject ? "SẴN SÀNG QUAY" : "CHƯA SẴN SÀNG"}
          </Badge>
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.push("/wheel-rules")} style={styles.rulesLink}>
          <Text style={styles.rulesLinkText}>Xem hướng dẫn vòng quay</Text>
        </Pressable>
        {!displayOpen ? <Text style={styles.meta}>Mở chế độ màn hình trình chiếu trên web để điều khiển vòng quay.</Text> : null}
        <Text style={styles.meta}>Chỉ quay thành viên có mặt, check-in đến hết 07:00.</Text>
        <View style={styles.participantBar}>
          <View style={styles.participantIconWrap}>
            <Users color={colors.primaryDark} size={18} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.participantLabel}>Người tham gia quay</Text>
            <Text style={styles.participantValue}>
              Thành viên có mặt · {eligible.length} người
            </Text>
          </View>
        </View>


        <Button
          icon={RotateCw}
          iconSize={16}
          fullWidth
          disabled={!ready || !canProject}
          onPress={() => void spin()}
          style={styles.spinButton}
          textStyle={styles.controlButtonText}
        >
          {busy ? "Đang gửi lệnh quay..." : "Quay trên màn chiếu"}
        </Button>

        <Button
          tone="secondary"
          icon={drawPanel === "winners" ? RotateCw : List}
          iconSize={16}
          fullWidth
          disabled={!displayOpen || disabled || busy || !!activeWinner}
          onPress={() => void toggleWinnerList()}
          style={styles.controlButton}
          textStyle={styles.controlButtonText}
        >
          {drawPanel === "winners"
            ? "Hiện vòng quay trên màn chiếu"
            : `Hiện người trúng trên màn chiếu (${winnerCount})`}
        </Button>

        {/* KẾT QUẢ NGƯỜI TRÚNG THƯỞNG */}
        {activeWinner ? (
          <View style={styles.result}>
            <Text style={styles.winnerHeading}>Người được chọn: {activeWinner.name}</Text>
            <Text style={styles.winnerPrize}>{activeWinner.prizeName}</Text>
            <View style={styles.actions}>
              <Button
                tone="danger"
                icon={UserMinus}
                iconSize={15}
                style={styles.actionBtn}
                textStyle={styles.actionBtnText}
                disabled={!displayOpen || busy}
                onPress={() => void decideWinner(false)}
              >
                Loại khỏi vòng quay
              </Button>
              <Button
                tone="secondary"
                icon={Check}
                iconSize={15}
                style={styles.actionBtn}
                textStyle={styles.actionBtnText}
                disabled={!displayOpen || busy}
                onPress={() => void decideWinner(true)}
              >
                Giữ lại & Đóng
              </Button>
            </View>
          </View>
        ) : null}
      </Card>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  grow: { flex: 1 },

  card: { gap: spacing.sm, padding: spacing.md },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  heading: { color: colors.text, fontSize: 15, fontWeight: "800" },
  rulesLink: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center", paddingRight: spacing.md },
  rulesLinkText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.xs },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },

  participantBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  participantIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  participantLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  participantValue: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 1 },
  spinButton: { marginTop: spacing.xs, minHeight: 42, paddingHorizontal: spacing.sm },
  controlButton: { minHeight: 42, paddingHorizontal: spacing.sm },
  controlButtonText: { fontSize: 12, textAlign: "center", flexShrink: 1 },

  // Winner result
  result: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  winnerHeading: { color: colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" },
  winnerPrize: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  actions: { width: "100%", flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 6 },
  actionBtnText: { fontSize: 11.5, lineHeight: 15, textAlign: "center", flexShrink: 1 },

});
