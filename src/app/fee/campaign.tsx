import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Bell, ChevronRight, Plus, Search, Trash2 } from "lucide-react-native";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { feeStatusLabel, feeStatusTone, formatDate, groupFeeCampaigns, money } from "@/fees-utils";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { feeService, type MemberFeeStatus } from "@/services/fees";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

type Filter = "all" | MemberFeeStatus;
export default function FeeCampaignScreen() {
  const { year: yearParam, key } = useLocalSearchParams<{ year: string; key: string }>();
  const { user } = useAuth();
  const year = Number(yearParam) || new Date().getFullYear();
  const { data, error, isLoading, reload } = useAsyncData(() => feeService.list(year), `${year}_${key}`);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const campaign = groupFeeCampaigns(data || []).find((item) => item.key === key);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState("");
  const rows = useMemo(() => (campaign?.items || []).filter((item) => (filter === "all" || item.status === filter) && `${item.memberName} ${item.memberEmail}`.toLocaleLowerCase("vi-VN").includes(query.trim().toLocaleLowerCase("vi-VN"))), [campaign, filter, query]);

  const notifyAll = () => {
    const targets = (campaign?.items || []).filter((item) => item.remaining > 0);
    if (!targets.length) return Alert.alert("Không có khoản cần nhắc", "Tất cả thành viên đã hoàn thành.");
    Alert.alert("Gửi nhắc phí?", `Gửi QR thanh toán đến ${targets.length} thành viên còn nợ phí.`, [{ text: "Hủy", style: "cancel" }, { text: "Gửi", onPress: async () => {
      setBusy("notify"); let success = 0;
      for (const item of targets) { try { await feeService.notify(item._id); success += 1; } catch {} }
      setBusy(""); await reload(); Alert.alert("Đã hoàn tất", `Đã gửi thành công ${success}/${targets.length} thông báo.`);
    } }]);
  };
  const deleteAvailable = () => {
    const targets = (campaign?.items || []).filter((item) => item.payments.length === 0);
    if (!targets.length) return Alert.alert("Không thể xóa", "Các khoản phí trong đợt đã có phiếu thu.");
    Alert.alert("Xóa các khoản chưa thu?", `${targets.length} khoản phí chưa có phiếu thu sẽ bị xóa. Dữ liệu đã thu được giữ nguyên.`, [{ text: "Hủy", style: "cancel" }, { text: "Xóa", style: "destructive", onPress: async () => {
      setBusy("delete"); let success = 0;
      for (const item of targets) { try { await feeService.delete(item._id); success += 1; } catch {} }
      setBusy(""); await reload(); Alert.alert("Đã hoàn tất", `Đã xóa ${success}/${targets.length} khoản phí.`);
    } }]);
  };

  if (user?.role !== "admin") return <Screen><BackHeader title="Chi tiết đợt thu" /><Card><Text style={styles.empty}>Bạn không có quyền quản lý phí.</Text></Card></Screen>;
  if (isLoading && !data) return <Screen><BackHeader title="Chi tiết đợt thu" /><LoadingState /></Screen>;
  if (error && !data) return <Screen><BackHeader title="Chi tiết đợt thu" /><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!campaign) return <Screen><BackHeader title="Chi tiết đợt thu" /><EmptyState title="Đợt thu không còn tồn tại" message="Dữ liệu có thể đã bị xóa hoặc thay đổi." /></Screen>;

  const progress = campaign.total ? Math.min(100, campaign.paid / campaign.total * 100) : 0;
  return <Screen>
    <BackHeader title={campaign.title} subtitle={`Năm ${campaign.year} · hạn ${formatDate(campaign.dueDate)}`} />
    <Card style={styles.hero}><Text style={styles.eyebrow}>TIẾN ĐỘ THU</Text><Text style={styles.amount}>{Math.round(progress)}%</Text><View style={styles.track}><View style={[styles.progress, { width: `${progress}%` }]} /></View><View style={styles.between}><Text style={styles.heroMeta}>Đã thu {money.format(campaign.paid)}</Text><Text style={styles.heroMeta}>Còn {money.format(campaign.remaining)}</Text></View></Card>
    <Card style={styles.info}><Info label="Mức phí / thành viên" value={money.format(campaign.amount)} /><Info label="Số thành viên" value={String(campaign.items.length)} /><Info label="Ghi chú" value={campaign.note || "Không có ghi chú"} /></Card>
    <View style={styles.actions}><View style={styles.action}><Button icon={Plus} fullWidth disabled={Boolean(busy)} onPress={() => router.push({ pathname: "/fee/create", params: { year: String(year), key: campaign.key } })}>Thêm thành viên</Button></View><View style={styles.action}><Button icon={Bell} tone="secondary" fullWidth disabled={Boolean(busy)} onPress={notifyAll}>{busy === "notify" ? "Đang gửi..." : "Nhắc tất cả"}</Button></View></View>
    <Button icon={Trash2} tone="danger" fullWidth disabled={Boolean(busy)} onPress={deleteAvailable}>{busy === "delete" ? "Đang xóa..." : "Xóa các khoản chưa thu"}</Button>
    <View style={styles.search}><Search color={colors.muted} size={18} /><TextInput value={query} onChangeText={setQuery} placeholder="Tìm thành viên" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{(["all", "unpaid", "partial", "overdue", "paid"] as Filter[]).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === "all" ? "Tất cả" : feeStatusLabel[item]}</Text></Pressable>)}</ScrollView>
    <Text style={styles.section}>Thành viên ({rows.length})</Text>
    {rows.length === 0 ? <EmptyState title="Không tìm thấy thành viên" message="Hãy thay đổi từ khóa hoặc bộ lọc." /> : rows.map((fee) => <Pressable key={fee._id} onPress={() => router.push({ pathname: "/fee/[id]", params: { id: fee._id } })}><Card style={styles.member}><View style={styles.grow}><Text style={styles.name}>{fee.memberName}</Text><Text style={styles.meta}>{fee.memberEmail}</Text><Text style={styles.balance}>Đã thu {money.format(fee.paid)} · Còn {money.format(fee.remaining)}</Text></View><View style={styles.trailing}><Badge tone={feeStatusTone(fee.status)}>{feeStatusLabel[fee.status]}</Badge><ChevronRight color={colors.muted} size={20} /></View></Card></Pressable>)}
  </Screen>;
}

function Info({ label, value }: { label: string; value: string }) { return <View><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
const styles = StyleSheet.create({
  hero: { gap: spacing.md, backgroundColor: colors.primary }, eyebrow: { color: "#DDFBFF", fontSize: 11, fontWeight: "900" }, amount: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" }, track: { height: 9, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: radius.pill, overflow: "hidden" }, progress: { height: "100%", backgroundColor: "#FFFFFF" }, between: { flexDirection: "row", justifyContent: "space-between" }, heroMeta: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  info: { gap: spacing.md }, infoLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, infoValue: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 3 }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 }, search: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, searchInput: { flex: 1, color: colors.text }, filters: { gap: spacing.sm }, filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primarySoft }, filterActive: { backgroundColor: colors.primaryDark }, filterText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" }, filterTextActive: { color: "#FFFFFF" },
  section: { color: colors.text, fontSize: 16, fontWeight: "900" }, member: { flexDirection: "row", alignItems: "center", gap: spacing.md }, grow: { flex: 1 }, name: { color: colors.text, fontSize: 14, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 11, marginTop: 3 }, balance: { color: colors.text, fontSize: 12, fontWeight: "700", marginTop: spacing.sm }, trailing: { alignItems: "flex-end", gap: spacing.md }, empty: { color: colors.muted, textAlign: "center" },
});
