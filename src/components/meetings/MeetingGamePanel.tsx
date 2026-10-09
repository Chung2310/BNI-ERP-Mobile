import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { Check, ChevronRight, Gift, RefreshCw, Trophy, UserMinus } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { meetingService, meetingVersion, type GameWinnerInput, type LuckyDrawWinner, type Meeting } from "@/services/meeting";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";
import { hasPermission } from "@/utils/permissions";

type Category = "all" | "all_members" | "present" | "guest";
type Player = { id: string; name: string; photoURL?: string; category: "present" | "absent" | "guest" };

const categoryNames: Record<Category, string> = { all: "Tất cả", all_members: "Tất cả TV", present: "Có mặt", guest: "Khách mời" };
const playerTypeNames: Record<Player["category"], string> = { present: "Có mặt", absent: "Vắng mặt", guest: "Khách mời" };
const wedgeColors = ["#00AFC8", "#087F9A", "#F5B841", "#D97867", "#439B80", "#596CB4"];
const initials = (name: string) => name.split(" ").filter(Boolean).map((word) => word[0]).slice(-2).join("").toUpperCase();

function roster(meeting: Meeting, users: UserProfile[]): Player[] {
  const matched = new Set<string>();
  const members = users.filter((user) => user.uid).map((user) => {
    const name = user.displayName?.trim() || user.email?.split("@")[0] || "Thành viên";
    const speaker = meeting.speakers.find((item) => item.userId === user.uid || (!item.userId && item.name.trim().toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi")));
    if (speaker) matched.add(speaker.id);
    return { id: speaker?.id || user.uid, name, photoURL: user.photoURL || speaker?.photoURL, category: speaker ? "present" as const : "absent" as const };
  });
  const guests = meeting.speakers.filter((speaker) => !matched.has(speaker.id)).map((speaker) => ({
    id: speaker.id, name: speaker.name.trim(), photoURL: speaker.photoURL, category: (speaker.userId ? "present" : "guest") as Player["category"],
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

export function MeetingGamePanel({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const { user } = useAuth();
  const canManage = hasPermission(user, "meetings:manage", "access:manage");
  const { width } = useWindowDimensions();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<Category>("present");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [customGuests, setCustomGuests] = useState<Player[]>([]);
  const [guestName, setGuestName] = useState("");
  const [prizeName, setPrizeName] = useState("");
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
      setPrizeName((current) => current || "Giải thưởng");
      setError("");
    } catch (cause) {
      if (mounted.current) setError(friendlyErrorMessage(cause, "Không tải được cuộc họp."));
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
  const filtered = useMemo(() => players.filter((player) => category === "all" || (category === "all_members" ? player.category !== "guest" : category === "present" ? player.category !== "absent" : player.category === "guest")), [players, category]);
  const eligible = useMemo(() => filtered.filter((player) => !excluded.includes(player.id)), [filtered, excluded]);
  const history = (meeting?.gameWinners || []).filter((entry) => entry.source === "wheel").slice().reverse();
  const size = Math.min(300, width - 76);
  const previousProjectedWinners = new Set(meeting?.luckyDraw?.allowRepeatWinners ? [] : meeting?.luckyDraw?.prizes.flatMap((prize) => prize.winners.map((item) => item.winnerId)) || []);
  const projectedCandidates = meeting?.speakers.filter((speaker) => !previousProjectedWinners.has(speaker.id)) || [];
  const canProjectWheel = category === "present" && !customGuests.length && !!meeting?.speakers.length && eligible.length === projectedCandidates.length && projectedCandidates.every((speaker) => eligible.some((player) => player.id === speaker.id));
  const spin = async () => {
    if (busyRef.current || winner || !meeting || !canManage || !eligible.length || !["live", "paused"].includes(meeting.status)) return;
    busyRef.current = true;
    setBusy(true);
    setWinner(null);
    try {
      // Refresh immediately before choosing, so a result saved on another device is respected.
      const fresh = await meetingService.get(id);
      const candidates = eligible;
      if (!candidates.length) throw new Error("Mọi người trong danh sách đã trúng. Hãy chọn thêm người tham gia.");
      let projectedWinner: LuckyDrawWinner | null = null;
      if (canProjectWheel) {
        let prize = fresh.luckyDraw?.prizes.find((item) => item.name === (prizeName.trim() || "Giải thưởng") && item.winners.length < item.quantity);
        if (fresh.luckyDraw?.drawMode !== "attendees") {
          await meetingService.updateLuckyDrawConfig(id, { drawMode: "attendees" });
        }
        if (!prize) {
          const config = await meetingService.savePrize(id, { name: prizeName.trim() || "Giải thưởng", quantity: Math.max(100, candidates.length) });
          prize = config.prizes.find((item) => item.name === (prizeName.trim() || "Giải thưởng") && item.winners.length < item.quantity);
        }
        if (!prize) throw new Error("Không tạo được giải thưởng để trình chiếu.");
        const latest = await meetingService.get(id);
        projectedWinner = (await meetingService.presentationDraw(id, prize.id, meetingVersion(latest))).winner;
      }
      const selectedIndex = projectedWinner ? candidates.findIndex((player) => player.id === projectedWinner.winnerId) : Math.floor(Math.random() * candidates.length);
      if (selectedIndex < 0) throw new Error("Kết quả quay không khớp danh sách tham gia. Hãy làm mới cuộc họp.");
      const selected = candidates[selectedIndex];
      const input: GameWinnerInput = {
        id: projectedWinner?.id || `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        winnerId: selected.id, source: "wheel", name: projectedWinner?.name || selected.name, prizeName: projectedWinner?.prizeName || prizeName.trim() || "Giải thưởng",
        ...(selected.photoURL?.startsWith("http") ? { photoURL: selected.photoURL } : {}),
        wonAt: projectedWinner?.wonAt || new Date().toISOString(),
      };
      const saved = projectedWinner
        ? await meetingService.recordGameWinner(id, input).catch(() => ({ ...projectedWinner, source: "wheel" as const }))
        : await meetingService.recordGameWinner(id, input);
      if (!mounted.current) return;
      setMeeting(projectedWinner
        ? await meetingService.get(id).catch(() => ({ ...fresh, gameWinners: [...(fresh.gameWinners || []), saved] }))
        : { ...fresh, gameWinners: [...(fresh.gameWinners || []), saved] });
      const targetIndex = eligible.findIndex((player) => player.id === selected.id);
      const step = 360 / eligible.length;
      const current = ((angleRef.current % 360) + 360) % 360;
      const desired = (((360 - (targetIndex + 0.5) * step) % 360) + 360) % 360;
      const distance = ((desired - current + 360) % 360) + 360 * 5;
      angleRef.current += distance;
      Animated.timing(rotation, { toValue: angleRef.current, duration: 5000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (mounted.current && finished) setWinner(saved);
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      });
    } catch (cause) {
      busyRef.current = false;
      if (mounted.current) {
        setBusy(false);
        setError(friendlyErrorMessage(cause, "Không lưu được kết quả. Hãy thử lại."));
      }
    }
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"], extrapolate: "extend" });

  const content = <>
    {!embedded ? <BackHeader title="Quay thưởng" subtitle={meeting?.title} /> : null}
    {loading && !meeting ? <LoadingState /> : !meeting ? <ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={() => void refresh()} /> : <>
      {error ? <Card style={styles.error}><Text style={styles.errorText}>{error}</Text><Button tone="secondary" icon={RefreshCw} onPress={() => { setError(""); void refresh(); }}>Làm mới</Button></Card> : null}
      {canManage ? <Card style={styles.options}>
        <Text style={styles.label}>Giải của lượt quay</Text>
        <TextInput accessibilityLabel="Tên giải thưởng" value={prizeName} onChangeText={setPrizeName} editable={!busy && !winner} maxLength={200} placeholder="Giải thưởng" style={styles.input} />
        {meeting.luckyDraw?.prizes.length ? <View style={styles.chips}>{meeting.luckyDraw.prizes.map((prize) => <Pressable key={prize.id} accessibilityRole="button" disabled={busy || !!winner} onPress={() => setPrizeName(prize.name)} style={[styles.chip, prizeName === prize.name && styles.chipActive]}><Text style={styles.chipText}>{prize.name}</Text></Pressable>)}</View> : null}
      </Card> : null}
      <Card style={styles.stage}>
        <Text style={styles.stageTitle}>Vòng quay may mắn</Text>
        <Text style={styles.muted}>{eligible.length} người đang tham gia · 5 giây</Text>
        {canManage ? <Text style={styles.muted}>{canProjectWheel ? "Quay đồng bộ với màn chiếu web" : "Bộ lọc này quay trên điện thoại và lưu kết quả; màn chiếu web chưa hỗ trợ đồng bộ."}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Chạm vòng quay để quay" disabled={!canManage || busy || !!winner || !eligible.length || !["live", "paused"].includes(meeting.status)} onPress={() => void spin()} style={[styles.gameView, { width: size, height: size }]}>
          <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
            <Svg width={size} height={size} viewBox="0 0 240 240">
              {eligible.map((player, index) => <Path key={player.id} d={wheelPath(index, eligible.length)} fill={wedgeColors[index % wedgeColors.length]} stroke="#FFFFFF" strokeWidth="1.6" />)}
              {eligible.length <= 16 ? eligible.map((player, index) => {
                const center = 360 * (index + 0.5) / eligible.length;
                const radian = (center - 90) * Math.PI / 180;
                return <SvgText key={player.id} x={120 + Math.cos(radian) * 80} y={124 + Math.sin(radian) * 80} fill="#FFFFFF" textAnchor="middle" fontSize={eligible.length > 10 ? 8 : 10} fontWeight="bold">{player.name.length > 11 ? `${player.name.slice(0, 10)}…` : player.name}</SvgText>;
              }) : null}
              <Circle cx="120" cy="120" r="26" fill="#FFFFFF" stroke={colors.primaryDark} strokeWidth="4" />
            </Svg>
          </Animated.View>
          <View style={styles.pointer} />
        </Pressable>
        <Text style={styles.muted}>{busy ? "Đang quay..." : canManage ? "Bấm quay để chọn người trúng" : "Người quản lý cuộc họp có thể bắt đầu quay"}</Text>
        {!["live", "paused"].includes(meeting.status) ? <Text style={styles.errorText}>{meeting.status === "scheduled" ? "Hãy bắt đầu cuộc họp trước khi quay." : "Cuộc họp đã đóng, không thể quay tiếp."}</Text> : null}
        {canManage ? <Button icon={Gift} fullWidth disabled={busy || !!winner || !eligible.length || !["live", "paused"].includes(meeting.status)} onPress={() => void spin()}>{busy ? "Đang quay..." : "Quay VQMM"}</Button> : null}
        {winner ? <View style={styles.winnerCard}>
          <Trophy color="#D69200" size={32} />
          <Text style={styles.modalEyebrow}>CHÚC MỪNG CHIẾN THẮNG</Text>
          <Avatar initials={initials(winner.name)} url={winner.photoURL} size={56} />
          <Text style={styles.modalName}>{winner.name}</Text>
          <Text style={styles.muted}>{winner.prizeName}{winner.ticketNumber ? ` · Số ${winner.ticketNumber}` : ""}</Text>
          <View style={styles.modalActions}>
            <Button tone="danger" icon={UserMinus} style={styles.modalAction} onPress={() => { setExcluded((old) => old.includes(winner.winnerId) ? old : [...old, winner.winnerId]); setWinner(null); }}>Loại khỏi vòng quay</Button>
            <Button tone="secondary" icon={Check} style={styles.modalAction} onPress={() => setWinner(null)}>Giữ lại & Đóng</Button>
          </View>
        </View> : null}
      </Card>

      {canManage ? <>
      <SectionTitle>Người tham gia · {eligible.length}/{players.length}</SectionTitle>
      <View style={styles.categoryRow}>{(Object.keys(categoryNames) as Category[]).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: category === option }} disabled={busy} onPress={() => setCategory(option)} style={[styles.categoryChip, category === option && styles.categoryChipActive]}><Text numberOfLines={1} style={[styles.categoryChipText, category === option && styles.categoryChipTextActive]}>{categoryNames[option]} ({players.filter((player) => option === "all" || (option === "all_members" ? player.category !== "guest" : option === "present" ? player.category !== "absent" : player.category === "guest")).length})</Text></Pressable>)}</View>
      <Card style={styles.options}>
        <Text style={styles.label}>Thêm khách mời vào lượt quay</Text>
        <View style={styles.addGuest}><TextInput value={guestName} onChangeText={setGuestName} editable={!busy} maxLength={150} placeholder="Tên khách mời" style={[styles.input, styles.flex]} /><Button tone="secondary" disabled={busy || !guestName.trim()} onPress={() => { const name = guestName.trim(); if (name) { setCustomGuests((old) => [...old, { id: `custom-${Date.now()}-${old.length}`, name, category: "guest" }]); setGuestName(""); } }}>Thêm</Button></View>
        <View style={styles.chips}><Button tone="secondary" disabled={busy || !filtered.length} onPress={() => setExcluded((old) => old.filter((item) => !filtered.some((player) => player.id === item)))}>Chọn tất cả</Button><Button tone="secondary" disabled={busy || !filtered.length} onPress={() => setExcluded((old) => [...new Set([...old, ...filtered.map((player) => player.id)])])}>Bỏ chọn</Button></View>
      </Card>
      <Card style={styles.players}>{filtered.length ? filtered.map((player) => {
        const selected = !excluded.includes(player.id);
        return <Pressable key={player.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: busy || !!winner }} disabled={busy || !!winner} onPress={() => setExcluded((old) => selected ? [...old, player.id] : old.filter((item) => item !== player.id))} style={styles.player}>
          <View style={[styles.checkbox, selected && styles.checked]}>{selected ? <Check color="#FFFFFF" size={15} /> : null}</View>
          <Avatar initials={initials(player.name)} url={player.photoURL} size={34} />
          <View style={styles.flex}><Text style={styles.playerName} numberOfLines={1}>{player.name}</Text><Text style={styles.muted}>{playerTypeNames[player.category]}</Text></View>
        </Pressable>;
      }) : <Text style={styles.muted}>Chưa có người tham gia trong nhóm này.</Text>}</Card>
      </> : null}
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/meeting/[id]/game-results", params: { id } })} style={styles.resultsLink}><Text style={styles.linkText}>Xem kết quả vòng quay may mắn ({history.length})</Text><ChevronRight color={colors.primaryDark} size={18} /></Pressable>
    </>}
  </>;
  return embedded ? <View style={styles.screen}>{content}</View> : <Screen style={styles.screen} scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}>{content}</Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md, paddingBottom: spacing.xxl },
  flex: { flex: 1 }, muted: { color: colors.muted, fontSize: 12 },
  stage: { alignItems: "center", gap: spacing.sm, padding: spacing.lg }, stageTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  gameView: { alignItems: "center", justifyContent: "center", marginVertical: spacing.sm }, pointer: { position: "absolute", top: -5, width: 0, height: 0, borderLeftWidth: 13, borderRightWidth: 13, borderTopWidth: 28, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#132835" },
  winner: { alignItems: "center", gap: 3, paddingVertical: spacing.sm }, winnerTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  options: { gap: spacing.sm }, label: { color: colors.text, fontSize: 13, fontWeight: "700" }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface },
  addGuest: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  categoryRow: { flexDirection: "row", gap: 6, width: "100%" },
  categoryChip: { flex: 1, minHeight: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: 2 },
  categoryChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  categoryChipText: { color: colors.text, fontSize: 11, fontWeight: "700", textAlign: "center" },
  categoryChipTextActive: { color: "#FFFFFF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, chip: { minHeight: 40, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDark }, chipText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  players: { paddingVertical: 0 }, player: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm }, playerName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  checkbox: { width: 23, height: 23, borderWidth: 1.5, borderColor: colors.border, borderRadius: 6, alignItems: "center", justifyContent: "center" }, checked: { borderColor: colors.primaryDark, backgroundColor: colors.primaryDark },
  resultsLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 48 }, linkText: { color: colors.primaryDark, fontWeight: "700" },
  error: { gap: spacing.sm }, errorText: { color: colors.danger, fontSize: 12 },
  winnerCard: { alignSelf: "stretch", alignItems: "center", gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  modalEyebrow: { color: colors.danger, fontSize: 12, fontWeight: "900", textAlign: "center" },
  modalName: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  modalActions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
  modalAction: { alignSelf: "stretch" },
});
