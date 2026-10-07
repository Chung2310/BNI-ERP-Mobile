import { Linking, StyleSheet, Text, View } from "react-native";
import { QrCode } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { feeService, type MemberFee } from "@/services/fees";
import { colors, spacing } from "@/theme/tokens";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const statusLabel: Record<MemberFee["status"], string> = { unpaid: "Chưa trả", partial: "Một phần", overdue: "Quá hạn", paid: "Đã trả" };

export default function FeesScreen() {
  const year = new Date().getFullYear();
  const { data, error, isLoading, reload } = useAsyncData(() => feeService.list(year), String(year));
  const remaining = (data || []).reduce((sum, item) => sum + item.remaining, 0);
  const openCheckout = async (fee: MemberFee) => { const detail = await feeService.get(fee._id); if (detail.checkout?.qrUrl) await Linking.openURL(detail.checkout.qrUrl); };
  return (
    <Screen>
      <BackHeader title="Phí thường niên" subtitle={`Năm ${year}`} />
      <Card style={styles.hero}><Text style={styles.heroLabel}>TỔNG CẦN THANH TOÁN</Text><Text style={styles.amount}>{money.format(remaining)}</Text><Text style={styles.heroMeta}>{data?.filter((item) => item.remaining > 0).length || 0} khoản phí đang chờ xử lý</Text></Card>
      <SectionTitle>Các khoản phí</SectionTitle>
      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <EmptyState title="Không có khoản phí" message={`Chưa có khoản phí nào trong năm ${year}.`} /> : <Card style={styles.list}>{data.map((fee) => <View key={fee._id} style={styles.fee}><View style={styles.grow}><Text style={styles.title}>{fee.title}</Text><Text style={styles.meta}>Còn lại {money.format(fee.remaining)} · hạn {new Date(fee.dueDate).toLocaleDateString("vi-VN")}</Text>{fee.remaining > 0 ? <Button icon={QrCode} tone="secondary" onPress={() => openCheckout(fee)}>Xem QR thanh toán</Button> : null}</View><Badge tone={fee.status === "paid" ? "primary" : fee.status === "overdue" ? "danger" : "warning"}>{statusLabel[fee.status]}</Badge></View>)}</Card>}
    </Screen>
  );
}

const styles = StyleSheet.create({ hero: { gap: spacing.md, backgroundColor: colors.primary }, heroLabel: { color: "#DDFBFF", fontSize: 11, fontWeight: "800" }, amount: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" }, heroMeta: { color: "#DDFBFF", fontSize: 12 }, list: { paddingVertical: 0 }, fee: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, grow: { flex: 1, gap: spacing.sm }, title: { color: colors.text, fontSize: 14, fontWeight: "800" }, meta: { color: colors.muted, fontSize: 11, lineHeight: 17 } });
