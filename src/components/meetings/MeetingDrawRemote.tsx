import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronRight, RotateCw, RefreshCw, List, UserMinus, Users, X } from "lucide-react-native";
import { Alert } from "@/components/AppAlert";
import { Avatar, Badge, Button, Card, LoadingState } from "@/components/ui";
import { drawParticipants, excludedDrawWinnerIds, matchesDrawFilter } from "@/components/meetings/drawParticipants";
import { meetingService, meetingVersion, type DrawFilter, type LuckyDrawWinner, type Meeting } from "@/services/meeting";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { UserProfile } from "@/types";
import { WHEEL_SELECTION_NAME } from "@/data/wheel-selection";

const filters: { value: DrawFilter; label: string }[] = [
  { value: "present_members", label: "Có mặt" },
  { value: "all", label: "Tất cả" },
  { value: "all_members", label: "Tất cả TV" },
  { value: "absent_members", label: "Vắng mặt" },
  { value: "guests", label: "Khách mời" },
];

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
  const insets = useSafeAreaInsets();
  const [unselected, setUnselected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<LuckyDrawWinner | null>(null);
  const [dismissedWinnerId, setDismissedWinnerId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
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
  const filter = meeting.presentation?.drawFilter || "all";
  const drawPanel = meeting.presentation?.drawPanel || "participants";
  const winnerCount = meeting.luckyDraw?.prizes.reduce((total, prize) => total + prize.winners.length, 0) || 0;
  const filtered = roster.filter((person) => matchesDrawFilter(person, filter));
  const excludedWinnerIds = excludedDrawWinnerIds(meeting);
  const eligible = filtered.filter((person) => !excludedWinnerIds.has(person.id));
  const projectedIds = meeting.presentation?.drawParticipantIds;
  const selected = eligible.filter((person) => sheetOpen
    ? !unselected.includes(person.id)
    : projectedIds == null || projectedIds.includes(person.id));
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

  const openSelection = () => {
    setUnselected(eligible.filter((person) => projectedIds != null && !projectedIds.includes(person.id)).map((person) => person.id));
    setSheetOpen(true);
  };

  const changeFilter = async (nextFilter: DrawFilter) => {
    if (!displayOpen || disabled || busy || activeWinner || nextFilter === filter) return;
    setBusy(true);
    setError("");
    try {
      await ensureDisplayOpen();
      const current = await meetingService.get(id);
      await meetingService.presentationState(
        id,
        { drawFilter: nextFilter, drawParticipantIds: null, drawPanel: "participants" },
        meetingVersion(current)
      );
      setUnselected([]);
      await onRefresh();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể đổi bộ lọc trên màn chiếu."));
      void onRefresh();
    } finally {
      setBusy(false);
    }
  };

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
      setError(friendlyErrorMessage(cause, "Không thể chuyển danh sách trên màn chiếu."));
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
        "Hãy chọn ít nhất một người trong bộ lọc trước khi quay."
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
      const result = await meetingService.presentationDraw(id, prize.id, meetingVersion(current), filter, selected.map((person) => person.id));
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

  const selectAll = () => {
    setUnselected((curr) => curr.filter((id) => !eligible.some((p) => p.id === id)));
  };

  const deselectAll = () => {
    setUnselected((curr) => [...new Set([...curr, ...eligible.map((p) => p.id)])]);
  };

  const togglePerson = (personId: string) => {
    setUnselected((curr) =>
      curr.includes(personId) ? curr.filter((id) => id !== personId) : [...curr, personId]
    );
  };

  const saveSelection = async () => {
    if (!displayOpen || disabled || busy || activeWinner) return;
    setBusy(true);
    setError("");
    try {
      await ensureDisplayOpen();
      const current = await meetingService.get(id);
      await meetingService.presentationState(
        id,
        { drawFilter: filter, drawParticipantIds: selected.map((person) => person.id), drawPanel: "participants" },
        meetingVersion(current)
      );
      await onRefresh();
      setSheetOpen(false);
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể đồng bộ người được chọn lên màn chiếu."));
    } finally {
      setBusy(false);
    }
  };

  const currentFilterLabel =
    filters.find((f) => f.value === filter)?.label || "Tất cả";

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
        <View style={styles.filters}>
          {filters.map(({ value, label }) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === value, disabled: !displayOpen || loadingUsers || !!usersError || disabled || busy || !!activeWinner }}
              disabled={!displayOpen || loadingUsers || !!usersError || disabled || busy || !!activeWinner}
              onPress={() => void changeFilter(value)}
              style={[styles.filterChip, filter === value && styles.filterChipActive]}
            >
              <Text numberOfLines={1} style={[styles.filterChipText, filter === value && styles.filterChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {!canProject && eligible.length > 0 ? <Text style={styles.meta}>Chọn ít nhất một người để quay.</Text> : null}

        {/* NÚT MỞ BOTTOM SHEET ĐỂ CHỌN NGƯỜI THAM GIA */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn người tham gia"
          disabled={!displayOpen || loadingUsers || !!usersError || busy || !!activeWinner}
          onPress={openSelection}
          style={styles.participantBar}
        >
          <View style={styles.participantIconWrap}>
            <Users color={colors.primaryDark} size={18} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.participantLabel}>Người tham gia quay</Text>
            <Text style={styles.participantValue}>
              {currentFilterLabel} · {selected.length} người
            </Text>
          </View>
          <View style={styles.changeAction}>
            <Text style={styles.changeText}>Tùy chỉnh</Text>
            <ChevronRight color={colors.primaryDark} size={16} />
          </View>
        </Pressable>


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
          icon={drawPanel === "winners" ? Users : List}
          iconSize={16}
          fullWidth
          disabled={!displayOpen || disabled || busy || !!activeWinner}
          onPress={() => void toggleWinnerList()}
          style={styles.controlButton}
          textStyle={styles.controlButtonText}
        >
          {drawPanel === "winners" ? "Hiện người tham gia" : `Mở danh sách được chọn (${winnerCount})`}
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

      {/* BOTTOM SHEET CHỌN NGƯỜI THAM GIA */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)} />
          <View
            style={[
              styles.sheetContent,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <Users color={colors.primaryDark} size={20} />
                <Text style={styles.sheetTitle}>Chọn người tham gia</Text>
              </View>
              <Pressable
                accessibilityLabel="Đóng"
                onPress={() => setSheetOpen(false)}
                style={styles.sheetClose}
              >
                <X color={colors.text} size={20} />
              </Pressable>
            </View>

            {/* Filter Chips trong Bottom Sheet: 4 thẻ trên cùng 1 hàng, cân đối 100% */}
            <View style={styles.filters}>
              {filters.map(({ value, label }) => {
                const count = roster.filter((person) => matchesDrawFilter(person, value)).length;
                const isActive = filter === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    disabled={!displayOpen || disabled || busy || !!activeWinner}
                    onPress={() => void changeFilter(value)}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Quick Actions (Chọn tất cả / Bỏ chọn) */}
            <View style={styles.sheetMetaRow}>
              <Text style={styles.sheetMetaText}>
                Đang chọn {selected.length}/{eligible.length} người
              </Text>
              <View style={styles.quickActions}>
                <Pressable onPress={selectAll}>
                  <Text style={styles.quickActionText}>Chọn tất cả</Text>
                </Pressable>
                <Text style={styles.quickActionDivider}>•</Text>
                <Pressable onPress={deselectAll}>
                  <Text style={styles.quickActionText}>Bỏ chọn</Text>
                </Pressable>
              </View>
            </View>

            {/* Danh sách người tham gia (chỉ hiển thị khi mở Bottom Sheet) */}
            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filtered.length === 0 ? (
                <Text style={styles.emptyText}>Không có thành viên nào trong nhóm này</Text>
              ) : (
                filtered.map((person) => {
                  const excluded = excludedWinnerIds.has(person.id);
                  const checked = !excluded && !unselected.includes(person.id);
                  return (
                    <Pressable
                      key={person.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked, disabled: excluded }}
                      disabled={excluded}
                      onPress={() => togglePerson(person.id)}
                      style={styles.personRow}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked ? <Check color="#FFFFFF" size={13} strokeWidth={3} /> : null}
                      </View>
                      <Avatar
                        initials={person.name
                          .split(" ")
                          .slice(-2)
                          .map((p) => p[0])
                          .join("")
                          .toUpperCase()}
                        url={person.photoURL}
                        size={32}
                      />
                      <Text numberOfLines={1} style={styles.personName}>
                        {person.name}
                      </Text>
                      <Badge
                        tone={
                          excluded
                            ? "default"
                            : person.kind === "member_present"
                            ? "success"
                            : person.kind === "guest"
                            ? "warning"
                            : "default"
                        }
                      >
                        {excluded
                          ? "Đã loại"
                          : person.kind === "member_present"
                          ? "Có mặt"
                          : person.kind === "guest"
                          ? "Khách mời"
                          : "Vắng mặt"}
                      </Badge>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {/* Nút xác nhận hoàn tất */}
            <Button fullWidth disabled={!displayOpen || busy || disabled} onPress={() => void saveSelection()} style={styles.confirmBtn}>
              Xác nhận ({selected.length} người)
            </Button>
          </View>
        </View>
      </Modal>
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
  rulesLinkText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.xs },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },

  // Thanh chọn người tham gia mở Bottom Sheet
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
  changeAction: { flexDirection: "row", alignItems: "center", gap: 2 },
  changeText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },

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

  // Bottom Sheet
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  sheetBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheetContent: {
    maxHeight: "85%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  sheetHeader: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  sheetClose: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },

  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    width: "100%",
  },
  filterChip: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterChipActive: {
    backgroundColor: colors.brandBlue,
    borderColor: colors.brandBlue,
  },
  filterChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  filterChipTextActive: { color: "#FFFFFF" },

  sheetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  sheetMetaText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  quickActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  quickActionText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  quickActionDivider: { color: colors.muted },

  sheetScroll: { maxHeight: 320, marginVertical: spacing.xs },
  personRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  personName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: spacing.lg },
  confirmBtn: { marginTop: spacing.xs },
});
