import { useLocalSearchParams } from "expo-router";
import { Gift, RefreshCw, Trophy } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type LuckyDrawWinner } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";

const games = [
  { source: "wheel", title: "Vòng quay may mắn" },
  { source: "bingo", title: "Lồng cầu bingo" },
] as const;
const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();

export default function MeetingGameResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);

  return <Screen>
    <BackHeader title="Trò quay thưởng" subtitle={meeting?.title} />
    {isLoading && !meeting ? <LoadingState /> : error && !meeting ? <ErrorState message={error} onRetry={reload} /> : !meeting ? null : games.map((game) => {
      const winners = (meeting.gameWinners || []).filter((winner) => winner.source === game.source);
      return <View key={game.source}>
        <SectionTitle>{game.title} · {winners.length} kết quả</SectionTitle>
        {winners.length ? <Card style={styles.list}>{winners.map((winner) => <WinnerRow key={winner.id} winner={winner} />)}</Card>
          : <EmptyState title="Chưa có kết quả" message={`Kết quả ${game.title.toLocaleLowerCase("vi")} sẽ xuất hiện tại đây.`} />}
      </View>;
    })}
    {meeting ? <Button tone="secondary" icon={RefreshCw} onPress={reload}>Làm mới kết quả</Button> : null}
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
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: "800" },
  meta: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
});
