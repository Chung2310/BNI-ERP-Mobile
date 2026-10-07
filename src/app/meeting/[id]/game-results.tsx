import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Gift, RefreshCw, Trophy } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type LuckyDrawWinner } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

const titles = { wheel: "Vòng quay may mắn", bingo: "Lồng cầu bingo" } as const;
const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();

export default function MeetingGameResultsScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const [game, setGame] = useState<keyof typeof titles>(source === "bingo" ? "bingo" : "wheel");
  const winners = (meeting?.gameWinners || []).filter((winner) => winner.source === game).slice().reverse();

  return <Screen style={styles.screen}>
    <BackHeader title="Kết quả quay thưởng" subtitle={meeting?.title} compact />
    {isLoading && !meeting ? <LoadingState /> : error && !meeting ? <ErrorState message={error} onRetry={reload} /> : !meeting ? null : <>
      <View style={styles.tabs}>{(["wheel", "bingo"] as const).map((item) => {
        const count = (meeting.gameWinners || []).filter((entry) => entry.source === item).length;
        return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: game === item }} onPress={() => setGame(item)} style={[styles.tab, game === item && styles.tabActive]}>
          <Text style={[styles.tabText, game === item && styles.tabTextActive]} numberOfLines={1}>{titles[item]}</Text>
          <Text style={[styles.tabCount, game === item && styles.tabCountActive]}>{count}</Text>
        </Pressable>;
      })}</View>
      <View style={styles.headingRow}><Text style={styles.heading}>{winners.length} người trúng</Text><Button tone="secondary" icon={RefreshCw} textStyle={styles.refreshText} onPress={reload}>Làm mới</Button></View>
      {winners.length ? <Card style={styles.list}>{winners.map((winner) => <WinnerRow key={winner.id} winner={winner} />)}</Card>
        : <EmptyState title="Chưa có kết quả" message={`Kết quả ${titles[game].toLocaleLowerCase("vi")} sẽ xuất hiện tại đây.`} />}
    </>}
  </Screen>;
}

function WinnerRow({ winner }: { winner: LuckyDrawWinner }) {
  const name = winner.name || (winner.ticketNumber != null ? `Số ${winner.ticketNumber}` : "Người trúng giải");
  return <View style={styles.row}>
    {winner.photoURL ? <Avatar initials={initials(name)} url={winner.photoURL} size={36} /> : <View style={styles.icon}><Trophy color={colors.primaryDark} size={18} /></View>}
    <View style={styles.grow}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>{winner.prizeName || "Giải thưởng"}{winner.ticketNumber != null ? ` · Số ${winner.ticketNumber}` : ""}</Text>
      {winner.wonAt ? <Text style={styles.meta}>{new Date(winner.wonAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</Text> : null}
    </View>
    <Gift color={colors.muted} size={16} />
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.sm },
  tabs: { flexDirection: "row", gap: 3, padding: 3, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  tab: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.muted, fontSize: 11.5, fontWeight: "700", flexShrink: 1 },
  tabTextActive: { color: colors.primaryDark, fontWeight: "800" },
  tabCount: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  tabCountActive: { color: colors.primaryDark },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  heading: { color: colors.text, fontSize: 13, fontWeight: "800" },
  refreshText: { fontSize: 11 },
  list: { paddingVertical: 0 },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 12.5, fontWeight: "800" },
  meta: { marginTop: 2, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
});
