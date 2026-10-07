import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Check, Search, Square, UsersRound } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { DateTimeField } from "@/components/DateTimeField";
import { Button, Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import { feeCampaignKey } from "@/fees-utils";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { feeService } from "@/services/fees";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => { const value = Math.random() * 16 | 0; return (char === "x" ? value : value & 3 | 8).toString(16); });
const defaultDue = () => `${new Date().getFullYear()}-12-31`;

export default function CreateFeeScreen() {
  const params = useLocalSearchParams<{ year?: string; key?: string }>();
  const { user } = useAuth();
  const year = Number(params.year) || new Date().getFullYear();
  const adding = Boolean(params.key);
  const { data, error, isLoading, reload } = useAsyncData(async () => ({ members: await feeService.members(), fees: await feeService.list(year) }), `${year}_${params.key || "new"}`);
  const existing = useMemo(() => data?.fees.filter((fee) => feeCampaignKey(fee) === params.key) || [], [data?.fees, params.key]);
  const campaign = existing[0];
  const [titleInput, setTitle] = useState<string | null>(null);
  const [amountInput, setAmount] = useState<string | null>(null);
  const [dueDateInput, setDueDate] = useState<string | null>(null);
  const [noteInput, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const title = titleInput ?? campaign?.title ?? "";
  const amount = amountInput ?? (campaign ? String(campaign.amount) : "");
  const dueDate = dueDateInput ?? campaign?.dueDate.slice(0, 10) ?? defaultDue();
  const note = noteInput ?? campaign?.note ?? "";
  const existingIds = useMemo(() => new Set(existing.map((fee) => fee.memberId)), [existing]);
  const available = (data?.members || []).filter((member) => !existingIds.has(member.id));
  const filtered = available.filter((member) => `${member.name} ${member.email}`.toLocaleLowerCase("vi-VN").includes(query.trim().toLocaleLowerCase("vi-VN")));
  const allFilteredSelected = filtered.length > 0 && filtered.every((member) => selected.includes(member.id));
  const toggleAll = () => setSelected(allFilteredSelected ? selected.filter((id) => !filtered.some((member) => member.id === id)) : [...new Set([...selected, ...filtered.map((member) => member.id)])]);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submit = async () => {
    const value = Number(amount.replace(/[^0-9]/g, ""));
    if (!title.trim()) return Alert.alert("Thiếu tên đợt thu", "Vui lòng nhập tên phí.");
    if (!Number.isFinite(value) || value <= 0) return Alert.alert("Số tiền không hợp lệ", "Số tiền phải lớn hơn 0.");
    if (!selected.length) return Alert.alert("Chưa chọn thành viên", "Chọn ít nhất một thành viên.");
    try {
      setBusy(true);
      const campaignId = adding ? campaign?.campaignId : uuid();
      const result = await feeService.create({ ...(campaignId ? { campaignId } : {}), year, title: title.trim(), amount: value, dueDate, note: note.trim(), memberIds: selected });
      Alert.alert("Hoàn tất", `Đã tạo ${result.created} khoản phí${result.skipped ? `, bỏ qua ${result.skipped} khoản đã tồn tại` : ""}.`, [{ text: "Xong", onPress: () => router.back() }]);
    } catch (cause) { Alert.alert("Không thể tạo khoản phí", cause instanceof Error ? cause.message : "Vui lòng thử lại."); } finally { setBusy(false); }
  };

  if (user?.role !== "admin") return <Screen><BackHeader title="Tạo đợt thu" /><Card><Text style={styles.empty}>Bạn không có quyền quản lý phí.</Text></Card></Screen>;
  if (isLoading && !data) return <Screen><BackHeader title={adding ? "Thêm thành viên" : "Tạo đợt thu"} /><LoadingState /></Screen>;
  if (error && !data) return <Screen><BackHeader title={adding ? "Thêm thành viên" : "Tạo đợt thu"} /><ErrorState message={error} onRetry={reload} /></Screen>;

  return <Screen scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}>
    <BackHeader title={adding ? "Thêm thành viên" : "Tạo đợt thu"} subtitle={`Năm ${year}`} />
    <Card style={styles.form}><Field label="Tên đợt thu *" value={title} onChangeText={setTitle} editable={!adding} placeholder="Ví dụ: Phí thường niên 2026" /><Field label="Số tiền mỗi thành viên *" value={amount} onChangeText={setAmount} editable={!adding} keyboardType="number-pad" placeholder="0" />{adding ? <Field label="Hạn đóng *" value={dueDate} editable={false} /> : <DateTimeField label="Hạn đóng *" mode="date" value={dueDate} onChange={setDueDate} minimumDate={new Date()} />}<Field label="Ghi chú" value={note} onChangeText={setNote} editable={!adding} multiline placeholder="Thông tin thêm cho thành viên" /></Card>
    <View style={styles.heading}><View><Text style={styles.headingTitle}>Chọn thành viên</Text><Text style={styles.meta}>{selected.length} đã chọn · {available.length} có thể thêm</Text></View><Button tone="secondary" onPress={toggleAll}>{allFilteredSelected ? "Bỏ chọn" : "Chọn tất cả"}</Button></View>
    <View style={styles.search}><Search color={colors.muted} size={18} /><TextInput value={query} onChangeText={setQuery} placeholder="Tìm tên hoặc email" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
    {filtered.length === 0 ? <Card><Text style={styles.empty}>{available.length ? "Không tìm thấy thành viên phù hợp." : "Tất cả thành viên đã có trong đợt thu."}</Text></Card> : filtered.map((member) => { const active = selected.includes(member.id); return <Pressable key={member.id} onPress={() => toggle(member.id)}><Card style={[styles.member, active && styles.memberActive]}><View style={styles.check}>{active ? <Check color="#FFFFFF" size={17} /> : <Square color={colors.muted} size={19} />}</View><View style={styles.grow}><Text style={styles.name}>{member.name}</Text><Text style={styles.meta}>{member.email}</Text></View></Card></Pressable>; })}
    <Button icon={UsersRound} fullWidth disabled={busy || selected.length === 0} onPress={submit}>{busy ? "Đang tạo..." : adding ? `Thêm ${selected.length} thành viên` : `Tạo phí cho ${selected.length} thành viên`}</Button>
  </Screen>;
}

function Field({ label, multiline, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) { return <View style={styles.field}><Text style={styles.label}>{label.toUpperCase()}</Text><TextInput {...props} multiline={multiline} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.textarea, props.editable === false && styles.disabled]} /></View>; }
const styles = StyleSheet.create({
  form: { gap: spacing.md }, field: { gap: spacing.xs }, label: { color: colors.muted, fontSize: 10, fontWeight: "800" }, input: { minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, paddingHorizontal: spacing.md, color: colors.text }, textarea: { minHeight: 82, paddingTop: spacing.md, textAlignVertical: "top" }, disabled: { opacity: 0.65 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }, headingTitle: { color: colors.text, fontSize: 16, fontWeight: "900" }, search: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, searchInput: { flex: 1, color: colors.text }, member: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }, memberActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, check: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }, grow: { flex: 1 }, name: { color: colors.text, fontWeight: "800" }, meta: { color: colors.muted, fontSize: 12, lineHeight: 18 }, empty: { color: colors.muted, textAlign: "center" },
});
