import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight, Gift, RefreshCw, Trophy } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type LuckyDrawWinner } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";

const titles = { wheel: "Vòng quay may mắn", bingo: "Lồng cầu bingo" } as const;
const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();

export default function MeetingGameResultsScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const game = source === "bingo" ? "bingo" : "wheel";
  const winners = (meeting?.gameWinners || []).filter((winner) => winner.source === game).slice().reverse();

  return <Screen>
    <BackHeader title={source ? `Kết quả ${titles[game]}` : "Kết quả quay thưởng"} subtitle={meeting?.title} />
    {isLoading && !meeting ? <LoadingState /> : error && !meeting ? <ErrorState message={error} onRetry={reload} /> : !meeting ? null : <>
      {source ? <>
        <SectionTitle>{titles[game]} · {winners.length} kết quả</SectionTitle>
        {winners.length ? <Card style={styles.list}>{winners.map((winner) => <WinnerRow key={winner.id} winner={winner} />)}</Card>
          : <EmptyState title="Chưa có kết quả" message={`Kết quả ${titles[game].toLocaleLowerCase("vi")} sẽ xuất hiện tại đây.`} />}
      </> : <>
        <SectionTitle>Chọn trò để xem kết quả</SectionTitle>
        {(["wheel", "bingo"] as const).map((item) => {
          const count = (meeting.gameWinners || []).filter((entry) => entry.source === item).length;
          return <Pressable key={item} accessibilityRole="button" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id, source: item } })} style={styles.gameRow}>
            <View style={styles.icon}><Trophy color={colors.primaryDark} size={21} /></View>
            <View style={styles.grow}><Text style={styles.name}>{titles[item]}</Text><Text style={styles.meta}>{count} kết quả đã lưu</Text></View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>;
        })}
      </>}
    </>}
    {meeting && source ? <Button tone="secondary" icon={RefreshCw} onPress={reload}>Làm mới kết quả</Button> : null}
  </Screen>;
}

function WinnerRow({ winner }: { winner: LuckyDrawWinner }) {
  const name = winner.name || (winner.ticketNumber != null ? `Số ${winner.ticketNumber}` : "Người trúng giải");
  return <View style={styles.row}>
    {winner.photoURL ? <Avatar initials={initials(name)} url={winner.photoURL} size={42} /> : <View style={styles.icon}><Trophy color={colors.primaryDark} size={21} /></View>}
    <View style={styles.grow}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>{winner.prizeName || "Giải thưởng"}{winner.ticketNumber != null ? ` · Số ${winner.ticketNumber}` : ""}</Text>
      {winner.wonAt ? <Text style={styles.meta}>{new Date(winner.wonAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</Text> : null}
    </View>
    <Gift color={colors.muted} size={18} />
  </View>;
}

const styles = StyleSheet.create({
  list: { paddingVertical: 0 },
  gameRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: "800" },
  meta: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
});
