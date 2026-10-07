import { RefreshCw, ServerCog, ShieldCheck, ShieldX } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { formatDate, money } from "@/fees-utils";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { feeService } from "@/services/fees";
import { colors, spacing, touchTarget } from "@/theme/tokens";

const status = { pending: "Đang chờ", review: "Cần kiểm tra", applied: "Đã đối soát", ignored: "Đã bỏ qua" } as const;
export default function SePayScreen() {
  const { user } = useAuth();
  const { data, error, isLoading, reload } = useAsyncData(async () => ({ config: await feeService.sepayConfig(), transactions: await feeService.transactions() }), "sepay");
  if (user?.role !== "admin") return <Screen><BackHeader title="Đối soát SePay" /><Card><Text style={styles.empty}>Bạn không có quyền xem đối soát.</Text></Card></Screen>;
  return <Screen>
    <BackHeader title="Đối soát SePay" subtitle="Cấu hình ngân hàng và 100 giao dịch gần nhất" action={<Pressable accessibilityLabel="Tải lại" onPress={reload} style={styles.refresh}><RefreshCw color={colors.primaryDark} size={20} /></Pressable>} />
    {isLoading && !data ? <LoadingState /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : data ? <>
      <Card style={styles.config}><View style={styles.row}>{data.config.enabled ? <ShieldCheck color={colors.success} size={25} /> : <ShieldX color={colors.danger} size={25} />}<View style={styles.grow}><Text style={styles.title}>{data.config.enabled ? "SePay đang hoạt động" : "SePay chưa sẵn sàng"}</Text><Text style={styles.meta}>{data.config.bank || "Chưa cấu hình ngân hàng"} · {data.config.accountNumber || "Chưa có số tài khoản"}</Text></View><Badge tone={data.config.enabled ? "primary" : "danger"}>{data.config.enabled ? "Đã bật" : "Đã tắt"}</Badge></View><Info label="Chủ tài khoản" value={data.config.accountName || "—"} /><Info label="Webhook" value={data.config.webhookPath || "—"} /><Info label="API key" value={data.config.hasApiKey ? "Đã cấu hình" : "Chưa cấu hình"} />{data.config.issues?.map((issue) => <Text key={issue} style={styles.issue}>• {issue}</Text>)}</Card>
      <SectionTitle>Giao dịch ngân hàng ({data.transactions.length})</SectionTitle>
      {!data.transactions.length ? <EmptyState title="Chưa có giao dịch" message="Giao dịch SePay sẽ xuất hiện tại đây khi webhook được nhận." /> : data.transactions.map((item) => <Card key={item._id} style={styles.transaction}><View style={styles.row}><ServerCog color={colors.primaryDark} size={21} /><View style={styles.grow}><Text style={styles.amount}>{money.format(item.payload.transferAmount || 0)}</Text><Text style={styles.meta}>{item.payload.gateway} · {item.payload.accountNumber}</Text></View><Badge tone={item.status === "applied" ? "primary" : item.status === "review" ? "danger" : "warning"}>{status[item.status]}</Badge></View><Info label="Nội dung" value={item.payload.content || "—"} /><Info label="Thời gian giao dịch" value={item.payload.transactionDate ? new Date(item.payload.transactionDate).toLocaleString("vi-VN") : formatDate(item.createdAt)} />{item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}</Card>)}
    </> : null}
  </Screen>;
}
function Info({ label, value }: { label: string; value: string }) { return <View><Text style={styles.infoLabel}>{label}</Text><Text selectable style={styles.infoValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ refresh: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }, config: { gap: spacing.md }, row: { flexDirection: "row", alignItems: "center", gap: spacing.md }, grow: { flex: 1 }, title: { color: colors.text, fontSize: 15, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 11, lineHeight: 17 }, infoLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, infoValue: { color: colors.text, fontSize: 13, fontWeight: "600", marginTop: 3 }, issue: { color: colors.danger, fontSize: 12 }, transaction: { gap: spacing.md }, amount: { color: colors.text, fontSize: 16, fontWeight: "900" }, reason: { color: colors.warning, fontSize: 12, lineHeight: 18 }, empty: { color: colors.muted, textAlign: "center" } });
