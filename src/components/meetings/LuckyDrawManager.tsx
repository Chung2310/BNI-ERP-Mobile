import { useMemo, useState } from "react";
import { ChevronRight, Clock3, Gift, Pencil, Plus, RefreshCw, RotateCcw, Save, Settings2, Trash2, Trophy, X } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, EmptyState, Screen } from "@/components/ui";
import { meetingService, type LuckyDraw, type LuckyDrawConfig, type LuckyDrawPrize, type LuckyDrawWinner } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

type Props = { meetingId: string; initial: LuckyDraw; canManage: boolean; reload: () => Promise<void> };
const message = (error: unknown) => error instanceof Error ? error.message : "Vui lòng thử lại.";

export function LuckyDrawManager({ meetingId, initial, canManage, reload }: Props) {
  const [config, setConfig] = useState(initial.luckyDraw);
  const [selectedId, setSelectedId] = useState(initial.luckyDraw.prizes[0]?.id || "");
  const [winner, setWinner] = useState<LuckyDrawWinner | null>(null);
  const [busy, setBusy] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [editing, setEditing] = useState<LuckyDrawPrize | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [reward, setReward] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [order, setOrder] = useState("1");
  const [color, setColor] = useState("#f59e0b");
  const [numberMin, setNumberMin] = useState(String(initial.luckyDraw.numberMin || 1));
  const [numberMax, setNumberMax] = useState(String(initial.luckyDraw.numberMax || 100));
  const selected = config.prizes.find((item) => item.id === selectedId);
  const winners = useMemo(() => config.prizes.flatMap((prize) => prize.winners.map((item) => ({ prize, winner: item }))), [config.prizes]);
  const locked = !canManage || initial.status === "ended" || initial.status === "cancelled";

  const run = async (key: string, task: () => Promise<LuckyDrawConfig>) => {
    setBusy(key);
    try { setConfig(await task()); }
    catch (error) { Alert.alert("Không thể cập nhật", message(error)); }
    finally { setBusy(""); }
  };
  const updateConfig = (input: Partial<Omit<LuckyDrawConfig, "prizes">>) => void run("config", () => meetingService.updateLuckyDrawConfig(meetingId, input));
  const openForm = (prize: LuckyDrawPrize | null) => {
    setEditing(prize); setName(prize?.name || ""); setReward(prize?.reward || "");
    setQuantity(String(prize?.quantity || 1)); setOrder(String(prize?.order || config.prizes.length + 1)); setColor(prize?.color || "#f59e0b");
  };
  const savePrize = () => {
    const amount = Number(quantity); const position = Number(order);
    if (!name.trim()) { Alert.alert("Thiếu tên giải", "Vui lòng nhập tên giải thưởng."); return; }
    if (!Number.isInteger(amount) || amount < 1) { Alert.alert("Số lượng không hợp lệ", "Số lượng phải từ 1 trở lên."); return; }
    void run("prize", async () => {
      const next = await meetingService.savePrize(meetingId, { id: editing?.id, name: name.trim(), reward: reward.trim(), quantity: amount, order: Number.isFinite(position) ? position : 1, color });
      setEditing(undefined);
      if (!selectedId) setSelectedId(next.prizes[0]?.id || "");
      return next;
    });
  };
  const spin = async () => {
    if (!initial.meetingStarted) { Alert.alert("Cuộc họp chưa bắt đầu", "Chỉ có thể quay thưởng sau khi cuộc họp đã bắt đầu."); return; }
    if (!selected) { Alert.alert("Chưa chọn giải", "Vui lòng chọn giải thưởng cần quay."); return; }
    if (selected.winners.length >= selected.quantity) { Alert.alert("Giải đã trao đủ", `Giải ${selected.name} đã đủ ${selected.quantity} người trúng.`); return; }
    setBusy("spin");
    try {
      const result = await meetingService.spin(meetingId, selected.id);
      setConfig((current) => ({ ...current, prizes: current.prizes.map((item) => item.id === result.prize.id ? result.prize : item) }));
      setWinner(result.winner);
    } catch (error) { Alert.alert("Quay thưởng thất bại", message(error)); }
    finally { setBusy(""); }
  };
  const saveNumbers = () => {
    const min = Number(numberMin); const max = Number(numberMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) { Alert.alert("Khoảng số không hợp lệ", "Số bắt đầu phải nhỏ hơn số kết thúc."); return; }
    updateConfig({ numberMin: min, numberMax: max });
  };
  const removePrize = (prize: LuckyDrawPrize) => Alert.alert("Xóa giải thưởng?", `Bạn có chắc muốn xóa “${prize.name}”?`, [
    { text: "Hủy", style: "cancel" },
    { text: "Xóa", style: "destructive", onPress: () => void run("delete", async () => {
      const next = await meetingService.deletePrize(meetingId, prize.id);
      if (selectedId === prize.id) setSelectedId(next.prizes[0]?.id || "");
      return next;
    }) },
  ]);
  const redraw = (prize: LuckyDrawPrize, item: LuckyDrawWinner) => Alert.alert("Hủy kết quả?", `Hủy kết quả của “${item.name}” để quay lại giải này?`, [
    { text: "Giữ lại", style: "cancel" },
    { text: "Hủy kết quả", style: "destructive", onPress: () => void run("redraw", () => meetingService.redrawWinner(meetingId, prize.id, item.id)) },
  ]);

  return <Screen>
    <BackHeader title="Quay thưởng" subtitle={`${initial.attendeesCount} người tham dự đủ điều kiện`} />
    {!initial.meetingStarted ? <Card style={s.notice}><Clock3 color={colors.warning} size={22} /><Text style={s.noticeText}>Cuộc họp cần được bắt đầu trước khi quay thưởng.</Text></Card> : null}
    {winner ? <Card style={s.winner}><Trophy color={colors.warning} size={38} /><Text style={s.winnerLabel}>NGƯỜI TRÚNG GIẢI</Text><Text style={s.winnerName}>{winner.name || `Số ${winner.ticketNumber}`}</Text><Text style={s.meta}>{winner.prizeName}</Text></Card> : null}
    {canManage ? <Card>
      <Pressable onPress={() => setShowConfig(!showConfig)} style={s.between}><View style={s.row}><Settings2 color={colors.primaryDark} size={20} /><Text style={s.heading}>Cấu hình quay thưởng</Text></View><ChevronRight color={colors.muted} size={18} /></Pressable>
      {showConfig ? <View style={s.panel}>
        <Toggle label="Bật chức năng quay thưởng" value={config.enabled} onChange={(enabled) => updateConfig({ enabled })} disabled={locked || Boolean(busy)} />
        <Toggle label="Cho phép một người trúng nhiều giải" value={config.allowRepeatWinners} onChange={(allowRepeatWinners) => updateConfig({ allowRepeatWinners })} disabled={locked || Boolean(busy)} />
        <Text style={s.label}>Nguồn quay</Text>
        <View style={s.segment}><Segment active={config.drawMode === "attendees"} label="Người tham dự" onPress={() => updateConfig({ drawMode: "attendees" })} /><Segment active={config.drawMode === "numbers"} label="Số may mắn" onPress={() => updateConfig({ drawMode: "numbers" })} /></View>
        {config.drawMode === "numbers" ? <><View style={s.inputRow}><View style={s.grow}><Text style={s.fieldLabel}>Từ số</Text><TextInput value={numberMin} onChangeText={setNumberMin} keyboardType="number-pad" style={s.input} /></View><View style={s.grow}><Text style={s.fieldLabel}>Đến số</Text><TextInput value={numberMax} onChangeText={setNumberMax} keyboardType="number-pad" style={s.input} /></View></View><Button tone="secondary" icon={Save} onPress={saveNumbers}>Lưu khoảng số</Button></> : null}
      </View> : null}
    </Card> : null}
    <Card>
      <View style={s.between}><Text style={s.heading}>Giải thưởng</Text>{canManage && !locked ? <Button tone="secondary" icon={Plus} onPress={() => openForm(null)}>Thêm giải</Button> : null}</View>
      {!config.prizes.length ? <EmptyState title="Chưa có giải thưởng" message="Tạo giải thưởng đầu tiên để bắt đầu quay." /> : [...config.prizes].sort((a, b) => a.order - b.order).map((prize) => {
        const isSelected = prize.id === selectedId;
        return <Pressable key={prize.id} onPress={() => setSelectedId(prize.id)} style={[s.prize, isSelected && s.prizeSelected]}>
          <View style={[s.prizeColor, { backgroundColor: prize.color || colors.primary }]}><Gift color="#FFFFFF" size={20} /></View>
          <View style={s.grow}><Text style={s.prizeName}>{prize.name}</Text><Text style={s.meta}>{prize.reward || "Chưa nhập phần thưởng"} · {prize.winners.length}/{prize.quantity} đã trao</Text></View>
          {canManage && !locked ? <View style={s.row}><Pressable style={s.icon} onPress={() => openForm(prize)}><Pencil color={colors.primaryDark} size={17} /></Pressable><Pressable style={s.icon} onPress={() => removePrize(prize)}><Trash2 color={colors.danger} size={17} /></Pressable></View> : null}
        </Pressable>;
      })}
      {canManage ? <Button fullWidth icon={Gift} disabled={locked || !config.enabled || !selected || Boolean(busy)} onPress={spin}>{busy === "spin" ? "Đang quay..." : `Quay ${selected?.name || "giải thưởng"}`}</Button> : null}
    </Card>
    {editing !== undefined ? <Card>
      <View style={s.between}><Text style={s.heading}>{editing ? "Sửa giải thưởng" : "Thêm giải thưởng"}</Text><Pressable style={s.icon} onPress={() => setEditing(undefined)}><X color={colors.muted} size={18} /></Pressable></View>
      <Text style={s.fieldLabel}>Tên giải thưởng</Text><TextInput value={name} onChangeText={setName} maxLength={120} style={s.input} placeholder="Ví dụ: Giải Nhất" />
      <Text style={s.fieldLabel}>Phần thưởng</Text><TextInput value={reward} onChangeText={setReward} maxLength={240} style={s.input} placeholder="Ví dụ: Voucher 5.000.000đ" />
      <View style={s.inputRow}><View style={s.grow}><Text style={s.fieldLabel}>Số lượng</Text><TextInput value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={s.input} /></View><View style={s.grow}><Text style={s.fieldLabel}>Thứ tự</Text><TextInput value={order} onChangeText={setOrder} keyboardType="number-pad" style={s.input} /></View></View>
      <Text style={s.fieldLabel}>Màu đại diện</Text><View style={s.colors}>{["#e11d48", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981"].map((choice) => <Pressable key={choice} onPress={() => setColor(choice)} style={[s.color, { backgroundColor: choice }, color === choice && s.colorSelected]} />)}</View>
      <Button icon={Save} disabled={Boolean(busy)} onPress={savePrize}>{editing ? "Lưu thay đổi" : "Tạo giải thưởng"}</Button>
    </Card> : null}
    <Card>
      <View style={s.between}><Text style={s.heading}>Lịch sử trúng thưởng</Text>{canManage && winners.length > 0 && !locked ? <Button tone="secondary" icon={RotateCcw} onPress={() => Alert.alert("Đặt lại tất cả?", "Toàn bộ kết quả trúng thưởng sẽ bị xóa.", [{ text: "Hủy", style: "cancel" }, { text: "Đặt lại", style: "destructive", onPress: () => void run("reset", () => meetingService.resetWinners(meetingId)) }])}>Đặt lại</Button> : null}</View>
      {!winners.length ? <EmptyState title="Chưa có người trúng" message="Kết quả quay thưởng sẽ được lưu tại đây." /> : winners.map(({ prize, winner: item }) => <View key={item.id} style={s.result}><View style={s.grow}><Text style={s.resultName}>{item.name || `Số ${item.ticketNumber}`}</Text><Text style={s.meta}>{prize.name} · {new Date(item.wonAt).toLocaleString("vi-VN")}</Text></View>{canManage && !locked ? <Pressable style={s.icon} onPress={() => redraw(prize, item)}><RotateCcw color={colors.warning} size={18} /></Pressable> : null}</View>)}
    </Card>
    <Button tone="secondary" icon={RefreshCw} onPress={reload}>Làm mới dữ liệu</Button>
  </Screen>;
}

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <View style={s.toggle}><Text style={s.toggleLabel}>{label}</Text><Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: colors.border, true: "#83D9E5" }} thumbColor={value ? colors.primaryDark : "#FFFFFF"} /></View>;
}
function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.segmentItem, active && s.segmentActive]}><Text style={[s.segmentText, active && s.segmentTextActive]}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  grow: { flex: 1 }, row: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, heading: { color: colors.text, fontSize: 16, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 11, lineHeight: 16 }, label: { color: colors.text, fontSize: 12, fontWeight: "800" }, fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.xs },
  notice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#FFF8E8", borderColor: "#F2D699" }, noticeText: { flex: 1, color: "#805718", fontSize: 13, fontWeight: "700" }, winner: { alignItems: "center", gap: spacing.sm, borderColor: "#F2D699", backgroundColor: "#FFF8E8" }, winnerLabel: { color: "#996316", fontSize: 10, fontWeight: "900" }, winnerName: { color: colors.text, fontSize: 24, fontWeight: "900", textAlign: "center" },
  panel: { gap: spacing.sm, marginTop: spacing.md }, toggle: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md }, toggleLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" }, segment: { flexDirection: "row", borderRadius: radius.md, backgroundColor: colors.background, padding: 3 }, segmentItem: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm }, segmentActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }, segmentText: { color: colors.muted, fontSize: 12, fontWeight: "700" }, segmentTextActive: { color: colors.primaryDark },
  inputRow: { flexDirection: "row", gap: spacing.sm }, input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface, fontSize: 14 }, prize: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm }, prizeSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, prizeColor: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }, prizeName: { color: colors.text, fontSize: 13, fontWeight: "800" }, icon: { minWidth: 42, minHeight: 42, alignItems: "center", justifyContent: "center" },
  colors: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }, color: { width: 38, height: 38, borderRadius: 19 }, colorSelected: { borderWidth: 4, borderColor: colors.text }, result: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.md }, resultName: { color: colors.text, fontSize: 13, fontWeight: "900" },
});
