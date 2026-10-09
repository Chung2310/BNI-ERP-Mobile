import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronRight, Gift, RefreshCw, UserMinus, Users, X } from "lucide-react-native";
import { Alert } from "@/components/AppAlert";
import { Avatar, Badge, Button, Card, LoadingState } from "@/components/ui";
import { meetingService, meetingVersion, type LuckyDrawWinner, type Meeting } from "@/services/meeting";
import { userService } from "@/services/users";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { UserProfile } from "@/types";

type Filter = "all" | "all_members" | "present" | "guest";
type Participant = {
  id: string;
  name: string;
  photoURL?: string;
  kind: "member_present" | "member_absent" | "guest";
};

const filters: { value: Filter; label: string }[] = [
  { value: "present", label: "Có mặt" },
  { value: "all", label: "Tất cả" },
  { value: "all_members", label: "Tất cả TV" },
  { value: "guest", label: "Khách mời" },
];

function participants(meeting: Meeting, users: UserProfile[]): Participant[] {
  const matched = new Set<string>();
  const members: Participant[] = users
    .filter((user) => user.uid)
    .map((user) => {
      const name = user.displayName?.trim() || user.email?.split("@")[0] || "Thành viên";
      const speaker = meeting.speakers.find(
        (item) =>
          item.userId === user.uid ||
          (user.email && item.email?.toLowerCase() === user.email.toLowerCase()) ||
          item.name.trim().toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi")
      );
      if (speaker) matched.add(speaker.id);
      return {
        id: speaker?.id || user.uid,
        name,
        photoURL: user.photoURL || speaker?.photoURL,
        kind: speaker ? "member_present" : "member_absent",
      };
    });
  const others: Participant[] = meeting.speakers
    .filter((speaker) => !matched.has(speaker.id))
    .map((speaker) => ({
      id: speaker.id,
      name: speaker.name,
      photoURL: speaker.photoURL,
      kind: speaker.userId ? "member_present" : "guest",
    }));
  return [...members, ...others];
}

function matchesFilter(person: Participant, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "all_members") return person.kind !== "guest";
  if (filter === "present") return person.kind !== "member_absent";
  return person.kind === "guest";
}

export function MeetingDrawRemote({
  id,
  meeting,
  disabled,
  onRefresh,
}: {
  id: string;
  meeting: Meeting;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<Filter>("present");
  const [unselected, setUnselected] = useState<string[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<LuckyDrawWinner | null>(null);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const refreshUsers = useCallback(async () => {
    try {
      setUsers(await userService.directory());
      setError("");
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không tải được danh sách thành viên."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshUsers();
    }, [refreshUsers])
  );

  const roster = useMemo(() => participants(meeting, users), [meeting, users]);
  const filter = selectedFilter;
  const filtered = roster.filter((person) => matchesFilter(person, filter));
  const selected = filtered.filter((person) => !unselected.includes(person.id));

  const previousWinners = useMemo(
    () =>
      new Set(
        meeting.luckyDraw?.allowRepeatWinners
          ? []
          : meeting.luckyDraw?.prizes.flatMap((prize) => prize.winners.map((item) => item.winnerId)) ||
            []
      ),
    [meeting.luckyDraw]
  );

  const backendCandidates = meeting.speakers.filter(
    (speaker) => !previousWinners.has(speaker.id)
  );

  const canProject =
    selected.length > 0 &&
    selected.length === backendCandidates.length &&
    backendCandidates.every((speaker) => selected.some((person) => person.id === speaker.id));

  const ready =
    !disabled && !busy && !winner && (meeting.status === "live" || meeting.status === "paused");

  const spin = async () => {
    if (!ready) return;
    if (!canProject) {
      Alert.alert(
        "Chưa thể quay trên màn chiếu",
        "API trình chiếu hiện chỉ quay danh sách người đã check-in. Bộ lọc hoặc người được tick chưa khớp danh sách này."
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      let current = await meetingService.get(id);
      const currentWinners = new Set(
        current.luckyDraw?.allowRepeatWinners
          ? []
          : current.luckyDraw?.prizes.flatMap((prize) => prize.winners.map((item) => item.winnerId)) || []
      );
      const actualCandidates = current.speakers.filter((speaker) => !currentWinners.has(speaker.id));
      if (
        actualCandidates.length !== selected.length ||
        actualCandidates.some((speaker) => !selected.some((person) => person.id === speaker.id))
      ) {
        throw new Error("Danh sách trên màn chiếu vừa thay đổi. Hãy làm mới rồi quay lại.");
      }
      if (current.luckyDraw?.drawMode !== "attendees") {
        await meetingService.updateLuckyDrawConfig(id, { drawMode: "attendees" });
        current = await meetingService.get(id);
      }
      let prize = current.luckyDraw?.prizes.find(
        (item) => item.name === "Giải thưởng" && item.winners.length < item.quantity
      );
      if (!prize) {
        const config = await meetingService.savePrize(id, {
          name: "Giải thưởng",
          quantity: Math.max(100, current.speakers.length),
        });
        prize = config.prizes.find((item) => item.name === "Giải thưởng" && item.winners.length < item.quantity);
        current = await meetingService.get(id);
      }
      if (!prize) throw new Error("Không tạo được giải thưởng để quay.");
      const result = await meetingService.presentationDraw(id, prize.id, meetingVersion(current));
      setWinner(result.winner);
      onRefresh();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể quay trên màn chiếu."));
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const closeResult = () => {
    if (winner)
      setUnselected((current) => [...new Set([...current, winner.winnerId])]);
    setWinner(null);
    onRefresh();
  };

  const keepWinner = async () => {
    if (!winner?.prizeId || busy) return;
    setBusy(true);
    try {
      await meetingService.redrawWinner(id, winner.prizeId, winner.id);
      setWinner(null);
      onRefresh();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể giữ người này trong vòng quay."));
    } finally {
      setBusy(false);
    }
  };

  const selectAll = () => {
    setUnselected((curr) => curr.filter((id) => !filtered.some((p) => p.id === id)));
  };

  const deselectAll = () => {
    setUnselected((curr) => [...new Set([...curr, ...filtered.map((p) => p.id)])]);
  };

  const togglePerson = (personId: string) => {
    setUnselected((curr) =>
      curr.includes(personId) ? curr.filter((id) => id !== personId) : [...curr, personId]
    );
  };

  const currentFilterLabel =
    filters.find((f) => f.value === filter)?.label || "Có mặt";

  return (
    <View style={styles.container}>
      {loading ? <LoadingState /> : null}

      {error ? (
        <Card style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Button
            tone="secondary"
            icon={RefreshCw}
            onPress={() => {
              void refreshUsers();
              onRefresh();
            }}
          >
            Làm mới
          </Button>
        </Card>
      ) : null}

      {/* CARD ĐIỀU KHIỂN QUAY THƯỞNG CHÍNH (GỌN GÀNG, KHÔNG XỔ DANH SÁCH CHECKBOX) */}
      <Card style={styles.card}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Điều khiển Vòng quay may mắn</Text>
          <Badge tone={canProject ? "success" : "default"}>
            {canProject ? "SẴN SÀNG QUAY" : "CHƯA SẴN SÀNG"}
          </Badge>
        </View>

        {/* NÚT MỞ BOTTOM SHEET ĐỂ CHỌN NGƯỜI THAM GIA */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn người tham gia"
          disabled={busy || !!winner}
          onPress={() => setSheetOpen(true)}
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
          icon={Gift}
          fullWidth
          disabled={!ready || !canProject}
          onPress={() => void spin()}
          style={styles.spinButton}
        >
          {busy ? "Đang gửi lệnh quay..." : "Quay trên màn chiếu"}
        </Button>

        {/* KẾT QUẢ NGƯỜI TRÚNG THƯỞNG */}
        {winner ? (
          <View style={styles.result}>
            <Text style={styles.winnerHeading}>Người trúng: {winner.name}</Text>
            <Text style={styles.winnerPrize}>{winner.prizeName}</Text>
            <View style={styles.actions}>
              <Button
                tone="danger"
                icon={UserMinus}
                style={styles.actionBtn}
                disabled={busy}
                onPress={closeResult}
              >
                Loại khỏi vòng quay
              </Button>
              <Button
                tone="secondary"
                icon={Check}
                style={styles.actionBtn}
                disabled={busy}
                onPress={() => void keepWinner()}
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
                const count = roster.filter((person) => matchesFilter(person, value)).length;
                const isActive = filter === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() =>
                      setSelectedFilter(value)
                    }
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
                Đang chọn {selected.length}/{filtered.length} người
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
                  const checked = !unselected.includes(person.id);
                  return (
                    <Pressable
                      key={person.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
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
                          person.kind === "member_present"
                            ? "success"
                            : person.kind === "guest"
                            ? "warning"
                            : "default"
                        }
                      >
                        {person.kind === "member_present"
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
            <Button fullWidth onPress={() => setSheetOpen(false)} style={styles.confirmBtn}>
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

  spinButton: { marginTop: spacing.xs },

  // Winner result
  result: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  winnerHeading: { color: colors.text, fontSize: 16, fontWeight: "800" },
  winnerPrize: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1 },

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
    gap: 6,
    width: "100%",
  },
  filterChip: {
    flex: 1,
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
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
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
