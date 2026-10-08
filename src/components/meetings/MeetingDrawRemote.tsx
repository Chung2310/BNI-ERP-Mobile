import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Gift, RefreshCw, UserMinus } from "lucide-react-native";
import { Alert } from "@/components/AppAlert";
import { Avatar, Button, Card, LoadingState } from "@/components/ui";
import { meetingService, meetingVersion, type LuckyDrawWinner, type Meeting } from "@/services/meeting";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";

type Game = "wheel" | "bingo";
type Filter = "all" | "all_members" | "present" | "guest";
type Participant = { id: string; name: string; photoURL?: string; kind: "member_present" | "member_absent" | "guest" };

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "all_members", label: "Tất cả TV" },
  { value: "present", label: "Có mặt" },
  { value: "guest", label: "Khách mời" },
];

function participants(meeting: Meeting, users: UserProfile[]): Participant[] {
  const matched = new Set<string>();
  const members: Participant[] = users.filter((user) => user.uid).map((user) => {
    const name = user.displayName?.trim() || user.email?.split("@")[0] || "Thành viên";
    const speaker = meeting.speakers.find((item) =>
      item.userId === user.uid || (user.email && item.email?.toLowerCase() === user.email.toLowerCase()) ||
      item.name.trim().toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi")
    );
    if (speaker) matched.add(speaker.id);
    return { id: speaker?.id || user.uid, name, photoURL: user.photoURL || speaker?.photoURL, kind: speaker ? "member_present" : "member_absent" };
  });
  const others: Participant[] = meeting.speakers.filter((speaker) => !matched.has(speaker.id)).map((speaker) => ({
    id: speaker.id, name: speaker.name, photoURL: speaker.photoURL,
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

export function MeetingDrawRemote({ id, meeting, disabled, onRefresh }: {
  id: string;
  meeting: Meeting;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const [game, setGame] = useState<Game>("wheel");
  const [selectedFilter, setSelectedFilter] = useState<Record<Game, Filter>>({ wheel: "present", bingo: "all" });
  const [unselected, setUnselected] = useState<Record<Game, string[]>>({ wheel: [], bingo: [] });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<LuckyDrawWinner | null>(null);
  const [error, setError] = useState("");

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
  useFocusEffect(useCallback(() => { void refreshUsers(); }, [refreshUsers]));

  const roster = useMemo(() => participants(meeting, users), [meeting, users]);
  const filter = selectedFilter[game];
  const filtered = roster.filter((person) => matchesFilter(person, filter));
  const selected = filtered.filter((person) => !unselected[game].includes(person.id));
  const previousWinners = new Set(meeting.luckyDraw?.allowRepeatWinners ? [] : meeting.luckyDraw?.prizes.flatMap((prize) => prize.winners.map((item) => item.winnerId)) || []);
  const backendCandidates = meeting.speakers.filter((speaker) => !previousWinners.has(speaker.id));
  const canProject = game === "wheel" && selected.length > 0 && selected.length === backendCandidates.length && backendCandidates.every((speaker) => selected.some((person) => person.id === speaker.id));
  const ready = !disabled && !busy && !winner && (meeting.status === "live" || meeting.status === "paused");

  const spin = async () => {
    if (!ready) return;
    if (!canProject) {
      Alert.alert("Chưa thể quay trên màn chiếu", game === "bingo"
        ? "Backend chưa có lệnh điều khiển cầu Bingo trên màn trình chiếu."
        : "API trình chiếu hiện chỉ quay danh sách người đã check-in. Bộ lọc hoặc người được tick chưa khớp danh sách này.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let current = await meetingService.get(id);
      const currentWinners = new Set(current.luckyDraw?.allowRepeatWinners ? [] : current.luckyDraw?.prizes.flatMap((prize) => prize.winners.map((item) => item.winnerId)) || []);
      const actualCandidates = current.speakers.filter((speaker) => !currentWinners.has(speaker.id));
      if (actualCandidates.length !== selected.length || actualCandidates.some((speaker) => !selected.some((person) => person.id === speaker.id))) {
        throw new Error("Danh sách trên màn chiếu vừa thay đổi. Hãy làm mới rồi quay lại.");
      }
      if (current.luckyDraw?.drawMode !== "attendees") {
        await meetingService.updateLuckyDrawConfig(id, { drawMode: "attendees" });
        current = await meetingService.get(id);
      }
      let prize = current.luckyDraw?.prizes.find((item) => item.name === "Giải thưởng" && item.winners.length < item.quantity);
      if (!prize) {
        const config = await meetingService.savePrize(id, { name: "Giải thưởng", quantity: Math.max(100, current.speakers.length) });
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
    if (winner) setUnselected((current) => ({ ...current, wheel: [...new Set([...current.wheel, winner.winnerId])] }));
    setWinner(null);
    onRefresh();
  };
  const keepWinner = async () => {
    if (!winner?.prizeId || busy) return;
    setBusy(true);
    try {
      // Removing the draw record makes this person eligible for the next projected spin.
      await meetingService.redrawWinner(id, winner.prizeId, winner.id);
      setWinner(null);
      onRefresh();
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể giữ người này trong vòng quay."));
    } finally {
      setBusy(false);
    }
  };

  return <View style={styles.container}>
    <View style={styles.tabs}>{(["wheel", "bingo"] as Game[]).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: game === value }} onPress={() => setGame(value)} disabled={busy || !!winner} style={[styles.tab, game === value && styles.tabActive]}><Text style={[styles.tabText, game === value && styles.tabTextActive]}>{value === "wheel" ? "VQMM" : "Cầu Bingo"}</Text></Pressable>)}</View>
    {loading ? <LoadingState /> : null}
    {error ? <Card><Text style={styles.error}>{error}</Text><Button tone="secondary" icon={RefreshCw} onPress={() => { void refreshUsers(); onRefresh(); }}>Làm mới</Button></Card> : null}
    <Card style={styles.card}>
      <Text style={styles.heading}>Chọn người tham gia</Text>
      <View style={styles.filters}>{filters.map(({ value, label }) => {
        const count = roster.filter((person) => matchesFilter(person, value)).length;
        return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} disabled={busy || !!winner} onPress={() => setSelectedFilter((current) => ({ ...current, [game]: value }))} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label} ({count})</Text></Pressable>;
      })}</View>
      <Text style={styles.meta}>Đang chọn {selected.length}/{filtered.length}</Text>
      {filtered.map((person) => {
        const checked = !unselected[game].includes(person.id);
        return <Pressable key={person.id} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy || !!winner }} disabled={busy || !!winner} onPress={() => setUnselected((current) => ({ ...current, [game]: checked ? [...current[game], person.id] : current[game].filter((item) => item !== person.id) }))} style={styles.person}>
          <View style={[styles.checkbox, checked && styles.checked]}>{checked ? <Check color="#FFFFFF" size={14} /> : null}</View>
          <Avatar initials={person.name.split(" ").slice(-2).map((part) => part[0]).join("").toUpperCase()} url={person.photoURL} size={32} />
          <Text numberOfLines={1} style={styles.personName}>{person.name}</Text>
        </Pressable>;
      })}
    </Card>
    <Card style={styles.card}>
      <Text style={styles.heading}>{game === "wheel" ? "Điều khiển VQMM" : "Điều khiển Cầu Bingo"}</Text>
      <Text style={styles.meta}>{canProject ? "Lệnh quay sẽ chạy trên màn hình trình chiếu web." : game === "bingo" ? "Backend chưa có lệnh quay cầu Bingo trên màn chiếu." : "API trình chiếu chỉ hỗ trợ đúng danh sách người đã check-in; lựa chọn hiện tại chưa thể quay trên màn chiếu."}</Text>
      <Button icon={Gift} fullWidth disabled={!ready} onPress={() => void spin()}>{busy ? "Đang gửi lệnh..." : "Quay trên màn chiếu"}</Button>
      {winner ? <View style={styles.result}>
        <Text style={styles.heading}>Người trúng: {winner.name}</Text>
        <Text style={styles.meta}>{winner.prizeName}</Text>
        <View style={styles.actions}>
          <Button tone="danger" icon={UserMinus} style={styles.action} disabled={busy} onPress={closeResult}>Loại khỏi vòng quay</Button>
          <Button tone="secondary" icon={Check} style={styles.action} disabled={busy} onPress={() => void keepWinner()}>Giữ lại & Đóng</Button>
        </View>
      </View> : null}
    </Card>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 46, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  tabText: { color: colors.text, fontWeight: "700" },
  tabTextActive: { color: "#FFFFFF" },
  card: { gap: spacing.sm },
  heading: { color: colors.text, fontSize: 16, fontWeight: "800" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filter: { minHeight: 38, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  filterText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#FFFFFF" },
  meta: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12 },
  person: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  personName: { flex: 1, color: colors.text, fontWeight: "600" },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checked: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  result: { gap: spacing.sm, paddingTop: spacing.sm },
  actions: { gap: spacing.sm },
  action: { alignSelf: "stretch" },
});
