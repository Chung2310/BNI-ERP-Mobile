import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { CheckCircle2, Users } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { HeaderRefreshAction } from "@/components/HeaderRefreshAction";
import { MeetingCutoffTimePicker } from "@/components/MeetingCutoffTimePicker";
import { Avatar, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type LuckyDrawWinner, type Meeting } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";
import { DEFAULT_DRAW_CUTOFF_TIME, validDrawCutoffTime } from "@/utils/earlyCheckIn";
import { hasPermission } from "@/utils/permissions";
import { friendlyErrorMessage } from "@/utils/userFacingError";

const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();

function getWheelWinners(meeting?: Meeting | null): LuckyDrawWinner[] {
  const winners = new Map<string, LuckyDrawWinner>();

  for (const winner of meeting?.gameWinners || []) {
    if (winner.source === "wheel") winners.set(winner.id, winner);
  }

  for (const prize of meeting?.luckyDraw?.prizes || []) {
    for (const winner of prize.winners) {
      winners.set(winner.id, { ...winner, prizeName: winner.prizeName || prize.name });
    }
  }

  return [...winners.values()].sort((a, b) =>
    (Date.parse(b.wonAt) || 0) - (Date.parse(a.wonAt) || 0)
  );
}

export default function MeetingGameResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = hasPermission(user, "meetings:manage", "access:manage");
  const { data: meeting, setData: setMeeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const [cutoffDraft, setCutoffDraft] = useState<string | null>(null);
  const [savingCutoff, setSavingCutoff] = useState(false);
  const [cutoffError, setCutoffError] = useState("");
  const currentCutoff = meeting?.luckyDraw?.checkInCutoffTime || DEFAULT_DRAW_CUTOFF_TIME;
  const cutoffValue = cutoffDraft ?? currentCutoff;
  const cutoffLocked = savingCutoff || meeting?.status === "ended" || meeting?.status === "cancelled";
  const saveDisabled = cutoffLocked || !validDrawCutoffTime(cutoffValue) || cutoffValue === currentCutoff;
  const winners = getWheelWinners(meeting);

  const saveCutoff = async () => {
    if (!meeting || !canManage || savingCutoff || meeting.status === "ended" || meeting.status === "cancelled") return;
    if (!validDrawCutoffTime(cutoffValue)) {
      setCutoffError("Vui lòng chọn một giờ hợp lệ.");
      return;
    }
    setSavingCutoff(true);
    setCutoffError("");
    try {
      const luckyDraw = await meetingService.updateLuckyDrawConfig(id, { checkInCutoffTime: cutoffValue });
      setMeeting((current) => current ? { ...current, luckyDraw } : current);
      setCutoffDraft(null);
    } catch (cause) {
      setCutoffError(friendlyErrorMessage(cause, "Không lưu được giờ tham gia vòng quay."));
    } finally {
      setSavingCutoff(false);
    }
  };

  return <Screen style={styles.screen}>
    <BackHeader title="Vòng quay chọn người" subtitle={meeting?.title} compact action={<HeaderRefreshAction label="Làm mới vòng quay chọn người" disabled={isLoading} onPress={() => void reload()} />} />
    {isLoading && !meeting ? <LoadingState /> : error && !meeting ? <ErrorState message={error} onRetry={reload} /> : !meeting ? null : <>
      {canManage ? <Card style={styles.configCard}>
        <Text style={styles.heading}>Giờ giới hạn tham gia</Text>
        <Text style={styles.description}>Thành viên check-in đến hết giờ đã chọn được tham gia vòng quay. Mặc định 7 giờ sáng, theo giờ Việt Nam.</Text>
        <View style={styles.cutoffRow}>
          <MeetingCutoffTimePicker
            value={cutoffValue}
            onChange={(value) => { setCutoffDraft(value); setCutoffError(""); }}
            disabled={cutoffLocked}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lưu giờ tham gia vòng quay"
            accessibilityState={{ disabled: saveDisabled }}
            disabled={saveDisabled}
            hitSlop={4}
            onPress={() => void saveCutoff()}
            style={({ pressed }) => [styles.saveButton, saveDisabled && styles.saveButtonDisabled, pressed && styles.saveButtonPressed]}
          >{savingCutoff ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveButtonText}>Lưu</Text>}</Pressable>
        </View>
        {cutoffError ? <Text style={styles.errorText}>{cutoffError}</Text> : null}
      </Card> : <Text style={styles.description}>Thành viên check-in đến hết {currentCutoff} được tham gia vòng quay.</Text>}
      <Text style={styles.heading}>Kết quả · {winners.length} người được chọn</Text>
      {winners.length ? <Card style={styles.list}>{winners.map((winner) => <WinnerRow key={winner.id} winner={winner} />)}</Card>
        : <EmptyState title="Chưa có kết quả" message="Kết quả vòng quay may mắn sẽ xuất hiện tại đây." />}
    </>}
  </Screen>;
}

function WinnerRow({ winner }: { winner: LuckyDrawWinner }) {
  const name = winner.name || (winner.ticketNumber != null ? `Số ${winner.ticketNumber}` : "Người được chọn");
  return <View style={styles.row}>
    {winner.photoURL ? <Avatar initials={initials(name)} url={winner.photoURL} size={36} /> : <View style={styles.icon}><Users color={colors.primaryDark} size={18} /></View>}
    <View style={styles.grow}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>{winner.prizeName || "Lượt chọn"}{winner.ticketNumber != null ? ` · Số ${winner.ticketNumber}` : ""}</Text>
      {winner.wonAt ? <Text style={styles.meta}>{new Date(winner.wonAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</Text> : null}
    </View>
    <CheckCircle2 color={colors.muted} size={16} />
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  heading: { color: colors.text, fontSize: 13, fontWeight: "800" },
  configCard: { gap: spacing.sm },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  cutoffRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  saveButton: { minWidth: 64, height: 40, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.brandBlue },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonPressed: { opacity: 0.75 },
  errorText: { color: colors.danger, fontSize: 12 },
  list: { paddingVertical: 0 },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 12.5, fontWeight: "800" },
  meta: { marginTop: 2, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
});
