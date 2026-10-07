import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Banknote, ChevronRight, Plus, RefreshCw, Search, Settings2 } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { feeStatusLabel, feeStatusTone, formatDate, groupFeeCampaigns, money } from "@/fees-utils";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { feeService, type MemberFeeStatus } from "@/services/fees";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 8 }, (_, index) => currentYear + 1 - index);
type Filter = "all" | MemberFeeStatus;

export default function FeesScreen() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const [year, setYear] = useState(currentYear);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error, isLoading, reload } = useAsyncData(() => feeService.list(year), String(year));
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const rows = useMemo(() => data || [], [data]);
  const totals = useMemo(() => ({ total: rows.reduce((n, x) => n + x.amount, 0), paid: rows.reduce((n, x) => n + x.paid, 0), remaining: rows.reduce((n, x) => n + x.remaining, 0) }), [rows]);
  const filtered = rows.filter((item) => (filter === "all" || item.status === filter) && `${item.title} ${item.memberName}`.toLocaleLowerCase("vi-VN").includes(query.trim().toLocaleLowerCase("vi-VN")));
  const campaigns = groupFeeCampaigns(filtered);

  return <Screen>
    <BackHeader title="Phí thường niên" subtitle={admin ? "Quản lý các đợt thu của tổ chức" : "Theo dõi và thanh toán phí thành viên"} action={<Pressable accessibilityLabel="Tải lại" onPress={reload} style={styles.iconButton}><RefreshCw color={colors.primaryDark} size={20} /></Pressable>} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{years.map((item) => <Pressable key={item} onPress={() => setYear(item)} style={[styles.chip, year === item && styles.chipActive]}><Text style={[styles.chipText, year === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    <Card style={styles.hero}><Text style={styles.heroEyebrow}>{admin ? "TỔNG GIÁ TRỊ ĐỢT THU" : "TỔNG CÒN PHẢI ĐÓNG"}</Text><Text style={styles.heroAmount}>{money.format(admin ? totals.total : totals.remaining)}</Text><View style={styles.summaryRow}><Summary label="Đã đóng" value={money.format(totals.paid)} /><Summary label="Còn lại" value={money.format(totals.remaining)} /></View></Card>
    {admin ? <View style={styles.actions}><View style={styles.action}><Button icon={Plus} fullWidth onPress={() => router.push({ pathname: "/fee/create", params: { year: String(year) } })}>Tạo đợt thu</Button></View><View style={styles.action}><Button icon={Settings2} tone="secondary" fullWidth onPress={() => router.push("/fee/sepay")}>Đối soát</Button></View></View> : null}
    <View style={styles.search}><Search color={colors.muted} size={18} /><TextInput value={query} onChangeText={setQuery} placeholder={admin ? "Tìm đợt thu hoặc thành viên" : "Tìm khoản phí"} placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{(["all", "unpaid", "partial", "overdue", "paid"] as Filter[]).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === "all" ? "Tất cả" : feeStatusLabel[item]}</Text></Pressable>)}</ScrollView>
    <SectionTitle>{admin ? `Các đợt thu (${campaigns.length})` : `Các khoản phí (${filtered.length})`}</SectionTitle>
    {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : filtered.length === 0 ? <EmptyState title="Không có khoản phí" message={`Không tìm thấy dữ liệu phí năm ${year}.`} /> : admin ? campaigns.map((campaign) => <Pressable key={campaign.key} onPress={() => router.push({ pathname: "/fee/campaign", params: { year: String(year), key: campaign.key } })}><Card style={styles.card}><View style={styles.between}><View style={styles.grow}><Text style={styles.title}>{campaign.title}</Text><Text style={styles.meta}>Hạn {formatDate(campaign.dueDate)} · {campaign.items.length} thành viên</Text></View><ChevronRight color={colors.muted} size={22} /></View><View style={styles.progressTrack}><View style={[styles.progress, { width: `${campaign.total ? Math.min(100, campaign.paid / campaign.total * 100) : 0}%` }]} /></View><View style={styles.between}><Text style={styles.meta}>Đã thu {money.format(campaign.paid)}</Text><Text style={styles.remaining}>Còn {money.format(campaign.remaining)}</Text></View></Card></Pressable>) : filtered.map((fee) => <Pressable key={fee._id} onPress={() => router.push({ pathname: "/fee/[id]", params: { id: fee._id } })}><Card style={styles.card}><View style={styles.between}><View style={styles.grow}><Text style={styles.title}>{fee.title}</Text><Text style={styles.meta}>Hạn đóng {formatDate(fee.dueDate)}</Text></View><Badge tone={feeStatusTone(fee.status)}>{feeStatusLabel[fee.status]}</Badge></View><View style={styles.between}><View style={styles.moneyLine}><Banknote color={colors.primaryDark} size={18} /><Text style={styles.remaining}>{money.format(fee.remaining)} còn lại</Text></View><ChevronRight color={colors.muted} size={22} /></View></Card></Pressable>)}
  </Screen>;
}

function Summary({ label, value }: { label: string; value: string }) { return <View style={styles.summary}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>; }
const styles = StyleSheet.create({
  iconButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }, chips: { gap: spacing.sm }, chip: { minWidth: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" }, chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.text, fontWeight: "700" }, chipTextActive: { color: "#FFFFFF" },
  hero: { gap: spacing.md, backgroundColor: colors.primary }, heroEyebrow: { color: "#DDFBFF", fontSize: 11, fontWeight: "900" }, heroAmount: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" }, summaryRow: { flexDirection: "row", gap: spacing.md }, summary: { flex: 1, gap: 3 }, summaryLabel: { color: "#DDFBFF", fontSize: 11 }, summaryValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 }, search: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, searchInput: { flex: 1, color: colors.text, fontSize: 14 }, filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primarySoft }, filterActive: { backgroundColor: colors.primaryDark }, filterText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" }, filterTextActive: { color: "#FFFFFF" },
  card: { gap: spacing.md }, between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, grow: { flex: 1 }, title: { color: colors.text, fontSize: 15, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 12, lineHeight: 18 }, remaining: { color: colors.text, fontSize: 13, fontWeight: "800" }, moneyLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft, overflow: "hidden" }, progress: { height: "100%", backgroundColor: colors.primary, borderRadius: radius.pill },
});
