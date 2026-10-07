import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { Check, ChevronRight, Gift, RefreshCw, Trophy } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { meetingService, type GameWinnerInput, type LuckyDrawWinner, type Meeting } from "@/services/meeting";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";
import { hasPermission } from "@/utils/permissions";

type Game = "wheel" | "bingo";
type Category = "all" | "present" | "absent" | "guest";
type Player = { id: string; name: string; photoURL?: string; category: Exclude<Category, "all"> };

const gameNames: Record<Game, string> = { wheel: "Vòng quay may mắn", bingo: "Lồng cầu bingo" };
const categoryNames: Record<Category, string> = { all: "Tất cả", present: "Đã check-in", absent: "Chưa check-in", guest: "Khách mời" };
const wedgeColors = ["#00AFC8", "#087F9A", "#F5B841", "#D97867", "#439B80", "#596CB4"];
const initials = (name: string) => name.split(" ").filter(Boolean).map((word) => word[0]).slice(-2).join("").toUpperCase();

function roster(meeting: Meeting, users: UserProfile[]): Player[] {
  const matched = new Set<string>();
  const members = users.filter((user) => user.uid).map((user) => {
    const name = user.displayName?.trim() || user.email?.split("@")[0] || "Thành viên";
    const speaker = meeting.speakers.find((item) => item.userId === user.uid || (!item.userId && item.name.trim().toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi")));
    if (speaker) matched.add(speaker.id);
    return { id: user.uid, name, photoURL: user.photoURL || speaker?.photoURL, category: speaker ? "present" as const : "absent" as const };
  });
  const guests = meeting.speakers.filter((speaker) => !matched.has(speaker.id)).map((speaker) => ({
    id: `guest-speaker-${speaker.id}`, name: speaker.name.trim(), photoURL: speaker.photoURL, category: "guest" as const,
  }));
  return [...members, ...guests];
}

function point(angle: number, radius: number) {
  const radian = (angle - 90) * Math.PI / 180;
  return `${120 + Math.cos(radian) * radius} ${120 + Math.sin(radian) * radius}`;
}

function wheelPath(index: number, count: number) {
  if (count === 1) return "M 120 0 A 120 120 0 1 1 119.99 0 Z";
  const start = 360 * index / count;
  const end = 360 * (index + 1) / count;
  return `M 120 120 L ${point(start, 118)} A 118 118 0 ${end - start > 180 ? 1 : 0} 1 ${point(end, 118)} Z`;
}

export default function MeetingGamesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = hasPermission(user, "meetings:manage", "access:manage");
  const { width } = useWindowDimensions();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [game, setGame] = useState<Game>("wheel");
  const [category, setCategory] = useState<Category>("all");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [customGuests, setCustomGuests] = useState<Player[]>([]);
  const [guestName, setGuestName] = useState("");
  const [prizeName, setPrizeName] = useState("");
  const [duration, setDuration] = useState(5);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<LuckyDrawWinner | null>(null);
  const [rotation] = useState(() => new Animated.Value(0));
  const angleRef = useRef(0);
  const mounted = useRef(false);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [fresh, directory] = await Promise.all([meetingService.get(id), userService.directory().catch(() => [])]);
      if (!mounted.current) return;
      setMeeting(fresh);
      setUsers(directory);
      setPrizeName((current) => current || fresh.luckyDraw?.prizes[0]?.name || "Giải may mắn");
      setError("");
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Không tải được cuộc họp.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; rotation.stopAnimation(); };
  }, [refresh, rotation]));

  const players = useMemo(() => meeting ? [...roster(meeting, users), ...customGuests] : [], [meeting, users, customGuests]);
  const filtered = useMemo(() => players.filter((player) => category === "all" || player.category === category), [players, category]);
  const alreadyWon = useMemo(() => new Set((meeting?.gameWinners || []).map((entry) => entry.winnerId)), [meeting]);
  const eligible = useMemo(() => filtered.filter((player) => !excluded.includes(player.id) && (meeting?.luckyDraw?.allowRepeatWinners || !alreadyWon.has(player.id))), [filtered, excluded, alreadyWon, meeting]);
  const history = (meeting?.gameWinners || []).filter((entry) => entry.source === game).slice().reverse();
  const size = Math.min(300, width - 76);
  const spin = async () => {
    if (busyRef.current || !meeting || !canManage || !eligible.length || !prizeName.trim() || meeting.status === "ended" || meeting.status === "cancelled") return;
    busyRef.current = true;
    setBusy(true);
    setWinner(null);
    try {
      // Refresh immediately before choosing, so a result saved on another device is respected.
      const fresh = await meetingService.get(id);
      const previous = new Set((fresh.gameWinners || []).map((entry) => entry.winnerId));
      const candidates = eligible.filter((player) => fresh.luckyDraw?.allowRepeatWinners || !previous.has(player.id));
      if (!candidates.length) throw new Error("Mọi người trong danh sách đã trúng. Hãy chọn thêm người tham gia.");
      const selectedIndex = Math.floor(Math.random() * candidates.length);
      const selected = candidates[selectedIndex];
      const ticketNumber = game === "bingo" ? players.findIndex((player) => player.id === selected.id) + 1 : undefined;
      const input: GameWinnerInput = {
        id: `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        winnerId: selected.id, source: game, name: selected.name, prizeName: prizeName.trim(),
        ...(selected.photoURL?.startsWith("http") ? { photoURL: selected.photoURL } : {}),
        ...(ticketNumber ? { ticketNumber } : {}), wonAt: new Date().toISOString(),
      };
      const saved = await meetingService.recordGameWinner(id, input);
      if (!mounted.current) return;
      setMeeting({ ...fresh, gameWinners: [...(fresh.gameWinners || []), saved] });
      const targetIndex = eligible.findIndex((player) => player.id === selected.id);
      const step = 360 / eligible.length;
      const current = ((angleRef.current % 360) + 360) % 360;
      const desired = game === "wheel" ? (((360 - (targetIndex + 0.5) * step) % 360) + 360) % 360 : 0;
      const distance = ((desired - current + 360) % 360) + 360 * (duration === 5 ? 5 : duration === 8 ? 7 : 10);
      angleRef.current += distance;
      Animated.timing(rotation, { toValue: angleRef.current, duration: duration * 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (mounted.current && finished) setWinner(saved);
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      });
    } catch (cause) {
      busyRef.current = false;
      if (mounted.current) {
        setBusy(false);
        setError(cause instanceof Error ? cause.message : "Không lưu được kết quả. Hãy thử lại.");
      }
    }
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"], extrapolate: "extend" });

  return <Screen style={styles.screen} scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}>
    <BackHeader title="Trò quay thưởng" subtitle={meeting?.title} />
    {!canManage ? <ErrorState message="Bạn cần quyền quản lý cuộc họp để quay thưởng." onRetry={() => router.back()} /> : loading && !meeting ? <LoadingState /> : !meeting ? <ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={() => void refresh()} /> : <>
      <View style={styles.tabs}>{(["wheel", "bingo"] as const).map((option) => <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: game === option }} onPress={() => { if (!busy) { setGame(option); setWinner(null); rotation.setValue(0); angleRef.current = 0; } }} style={[styles.tab, game === option && styles.tabActive]}><Text style={[styles.tabText, game === option && styles.tabTextActive]}>{gameNames[option]}</Text></Pressable>)}</View>
      {error ? <Card style={styles.error}><Text style={styles.errorText}>{error}</Text><Button tone="secondary" icon={RefreshCw} onPress={() => { setError(""); void refresh(); }}>Làm mới</Button></Card> : null}
      <Card style={styles.stage}>
        <Text style={styles.stageTitle}>{gameNames[game]}</Text>
        <Text style={styles.muted}>{eligible.length} người đang tham gia · {duration} giây</Text>
        <View style={[styles.gameView, { width: size, height: size }]}>
          <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
            <Svg width={size} height={size} viewBox="0 0 240 240">
              {game === "wheel" ? eligible.map((player, index) => <Path key={player.id} d={wheelPath(index, eligible.length)} fill={wedgeColors[index % wedgeColors.length]} stroke="#FFFFFF" strokeWidth="1.6" />) : <>
                <Circle cx="120" cy="120" r="112" fill="#E8FAFD" stroke={colors.primaryDark} strokeWidth="9" />
                {eligible.slice(0, 18).map((player, index) => {
                  const radian = index * 2.39996;
                  const distance = 20 + 76 * Math.sqrt((index + 0.5) / Math.min(eligible.length, 18));
                  const x = 120 + Math.cos(radian) * distance;
                  const y = 120 + Math.sin(radian) * distance;
                  return <Svg key={player.id} x={x - 13} y={y - 13} width="26" height="26" viewBox="0 0 26 26"><Circle cx="13" cy="13" r="12" fill={wedgeColors[index % wedgeColors.length]} stroke="#FFFFFF" strokeWidth="2" /><SvgText x="13" y="17" fill="#FFFFFF" textAnchor="middle" fontSize="10" fontWeight="bold">{players.findIndex((item) => item.id === player.id) + 1}</SvgText></Svg>;
                })}
              </>}
              {game === "wheel" && eligible.length <= 16 ? eligible.map((player, index) => {
                const center = 360 * (index + 0.5) / eligible.length;
                const radian = (center - 90) * Math.PI / 180;
                return <SvgText key={player.id} x={120 + Math.cos(radian) * 80} y={124 + Math.sin(radian) * 80} fill="#FFFFFF" textAnchor="middle" fontSize={eligible.length > 10 ? 8 : 10} fontWeight="bold">{player.name.length > 11 ? `${player.name.slice(0, 10)}…` : player.name}</SvgText>;
              }) : null}
              <Circle cx="120" cy="120" r="26" fill="#FFFFFF" stroke={colors.primaryDark} strokeWidth="4" />
            </Svg>
          </Animated.View>
          {game === "wheel" ? <View style={styles.pointer} /> : <View style={styles.bingoLabel}><Text style={styles.bingoLabelText}>BINGO</Text></View>}
        </View>
        {winner ? <View style={styles.winner}><Trophy color="#C08313" size={24} /><Text style={styles.winnerTitle}>{winner.name}</Text><Text style={styles.muted}>{winner.prizeName}{winner.ticketNumber ? ` · Số ${winner.ticketNumber}` : ""}</Text></View> : <Text style={styles.muted}>{busy ? "Đang quay..." : "Chọn người tham gia và bắt đầu quay"}</Text>}
        {meeting.status === "ended" || meeting.status === "cancelled" ? <Text style={styles.errorText}>Cuộc họp đã đóng, không thể quay tiếp.</Text> : null}
        <Button icon={Gift} fullWidth disabled={busy || !eligible.length || !prizeName.trim() || meeting.status === "ended" || meeting.status === "cancelled"} onPress={() => void spin()}>{busy ? "Đang quay..." : game === "wheel" ? "Quay vòng may mắn" : "Quay lồng cầu bingo"}</Button>
      </Card>

      <SectionTitle>Thiết lập lượt quay</SectionTitle>
      <Card style={styles.options}>
        <Text style={styles.label}>Tên giải thưởng</Text>
        <TextInput value={prizeName} onChangeText={setPrizeName} editable={!busy} maxLength={200} placeholder="Nhập tên giải thưởng" style={styles.input} />
        <View style={styles.chips}>{[5, 8, 12].map((seconds) => <Pressable key={seconds} accessibilityRole="button" accessibilityState={{ selected: duration === seconds }} disabled={busy} onPress={() => setDuration(seconds)} style={[styles.chip, duration === seconds && styles.chipActive]}><Text style={styles.chipText}>{seconds} giây</Text></Pressable>)}</View>
        <Text style={styles.muted}>{meeting.luckyDraw?.allowRepeatWinners ? "Cho phép một người trúng nhiều lần." : "Người đã trúng sẽ tự rời danh sách quay."}</Text>
      </Card>

      <SectionTitle>Người tham gia · {eligible.length}/{players.length}</SectionTitle>
      <View style={styles.chips}>{(Object.keys(categoryNames) as Category[]).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: category === option }} disabled={busy} onPress={() => setCategory(option)} style={[styles.chip, category === option && styles.chipActive]}><Text style={styles.chipText}>{categoryNames[option]}</Text></Pressable>)}</View>
      <Card style={styles.options}>
        <Text style={styles.label}>Thêm khách mời vào lượt quay</Text>
        <View style={styles.addGuest}><TextInput value={guestName} onChangeText={setGuestName} editable={!busy} maxLength={150} placeholder="Tên khách mời" style={[styles.input, styles.flex]} /><Button tone="secondary" disabled={busy || !guestName.trim()} onPress={() => { const name = guestName.trim(); if (name) { setCustomGuests((old) => [...old, { id: `custom-${Date.now()}-${old.length}`, name, category: "guest" }]); setGuestName(""); } }}>Thêm</Button></View>
        <View style={styles.chips}><Button tone="secondary" disabled={busy || !filtered.length} onPress={() => setExcluded((old) => old.filter((item) => !filtered.some((player) => player.id === item)))}>Chọn tất cả</Button><Button tone="secondary" disabled={busy || !filtered.length} onPress={() => setExcluded((old) => [...new Set([...old, ...filtered.map((player) => player.id)])])}>Bỏ chọn</Button></View>
      </Card>
      <Card style={styles.players}>{filtered.length ? filtered.map((player, index) => {
        const won = !meeting.luckyDraw?.allowRepeatWinners && alreadyWon.has(player.id);
        const selected = !excluded.includes(player.id) && !won;
        return <Pressable key={player.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: busy || won }} disabled={busy || won} onPress={() => setExcluded((old) => selected ? [...old, player.id] : old.filter((item) => item !== player.id))} style={styles.player}>
          <View style={[styles.checkbox, selected && styles.checked]}>{selected ? <Check color="#FFFFFF" size={15} /> : null}</View>
          <Avatar initials={initials(player.name)} url={player.photoURL} size={34} />
          <View style={styles.flex}><Text style={styles.playerName} numberOfLines={1}>{player.name}</Text><Text style={styles.muted}>{won ? "Đã trúng" : categoryNames[player.category]}</Text></View>
          {game === "bingo" ? <Text style={styles.ticket}>#{players.findIndex((item) => item.id === player.id) + 1}</Text> : null}
        </Pressable>;
      }) : <Text style={styles.muted}>Chưa có người tham gia trong nhóm này.</Text>}</Card>

      <SectionTitle>Kết quả {gameNames[game].toLocaleLowerCase("vi")} · {history.length}</SectionTitle>
      <Card style={styles.players}>{history.length ? history.map((entry) => <View key={entry.id} style={styles.player}><Trophy color={colors.primaryDark} size={20} /><View style={styles.flex}><Text style={styles.playerName}>{entry.name}</Text><Text style={styles.muted}>{entry.prizeName}{entry.ticketNumber ? ` · Số ${entry.ticketNumber}` : ""}</Text></View></View>) : <Text style={styles.muted}>Chưa có kết quả.</Text>}</Card>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id } })} style={styles.resultsLink}><Text style={styles.linkText}>Xem tất cả kết quả</Text><ChevronRight color={colors.primaryDark} size={18} /></Pressable>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md, paddingBottom: spacing.xxl },
  flex: { flex: 1 }, muted: { color: colors.muted, fontSize: 12 },
  tabs: { flexDirection: "row", gap: spacing.sm }, tab: { flex: 1, minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 6 },
  tabActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark }, tabText: { color: colors.text, fontSize: 12, fontWeight: "700", textAlign: "center" }, tabTextActive: { color: "#FFFFFF" },
  stage: { alignItems: "center", gap: spacing.sm, padding: spacing.lg }, stageTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  gameView: { alignItems: "center", justifyContent: "center", marginVertical: spacing.sm }, pointer: { position: "absolute", top: -5, width: 0, height: 0, borderLeftWidth: 13, borderRightWidth: 13, borderTopWidth: 28, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#132835" },
  bingoLabel: { position: "absolute", backgroundColor: "#FFFFFF", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }, bingoLabelText: { color: colors.primaryDark, fontWeight: "900", fontSize: 11 },
  winner: { alignItems: "center", gap: 3, paddingVertical: spacing.sm }, winnerTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  options: { gap: spacing.sm }, label: { color: colors.text, fontSize: 13, fontWeight: "700" }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface },
  addGuest: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, chip: { minHeight: 40, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDark }, chipText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  players: { paddingVertical: 0 }, player: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm }, playerName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  checkbox: { width: 23, height: 23, borderWidth: 1.5, borderColor: colors.border, borderRadius: 6, alignItems: "center", justifyContent: "center" }, checked: { borderColor: colors.primaryDark, backgroundColor: colors.primaryDark }, ticket: { color: colors.primaryDark, fontWeight: "800" },
  resultsLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 48 }, linkText: { color: colors.primaryDark, fontWeight: "700" },
  error: { gap: spacing.sm }, errorText: { color: colors.danger, fontSize: 12 },
});
