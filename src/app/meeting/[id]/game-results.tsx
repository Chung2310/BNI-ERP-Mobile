import { useLocalSearchParams } from "expo-router";
import { CheckCircle2, Users } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { HeaderRefreshAction } from "@/components/HeaderRefreshAction";
import { Avatar, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type LuckyDrawWinner, type Meeting } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";

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
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const winners = getWheelWinners(meeting);

  return <Screen style={styles.screen}>
    <BackHeader title="Kết quả quay chọn người" subtitle={meeting?.title} compact action={<HeaderRefreshAction label="Làm mới kết quả quay chọn người" disabled={isLoading} onPress={() => void reload()} />} />
    {isLoading && !meeting ? <LoadingState /> : error && !meeting ? <ErrorState message={error} onRetry={reload} /> : !meeting ? null : <>
      <Text style={styles.heading}>Vòng quay chọn người · {winners.length} người được chọn</Text>
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
  list: { paddingVertical: 0 },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 12.5, fontWeight: "800" },
  meta: { marginTop: 2, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
});
