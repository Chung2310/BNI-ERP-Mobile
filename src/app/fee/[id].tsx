import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AlertTriangle, Banknote, Bell, CreditCard, ExternalLink, ReceiptText, Trash2, Undo2 } from "lucide-react-native";
import { Alert, Image, Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { DateTimeField } from "@/components/DateTimeField";
import { Badge, Button, Card, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { feeStatusLabel, feeStatusTone, formatDate, money } from "@/fees-utils";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { feeService } from "@/services/fees";
import { colors, radius, spacing } from "@/theme/tokens";

const today = () => new Date().toISOString().slice(0, 10);
const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => { const value = Math.random() * 16 | 0; return (char === "x" ? value : value & 3 | 8).toString(16); });
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Vui lòng thử lại.";

export default function FeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const { data: fee, setData: setFee, error, isLoading, reload } = useAsyncData(() => feeService.get(id), id);
  const [showReceipt, setShowReceipt] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState<"cash" | "transfer">("transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [voidTarget, setVoidTarget] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => { const timer = setInterval(() => { void reload(); }, 10000); return () => clearInterval(timer); }, [reload]);

  const notify = async () => { try { setBusy("notify"); setFee(await feeService.notify(id)); Alert.alert("Đã gửi nhắc phí", "Thông báo và email thanh toán đã được gửi."); } catch (cause) { Alert.alert("Không thể gửi", errorMessage(cause)); } finally { setBusy(""); } };
  const receive = async () => {
    const value = Number(amount.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(value) || value <= 0) return Alert.alert("Số tiền không hợp lệ", "Nhập số tiền lớn hơn 0.");
    try {
      setBusy("receive");
      setFee(await feeService.receive(id, { id: uuid(), amount: value, paidOn, method, reference: reference.trim(), note: note.trim() }));
      setShowReceipt(false); setReference(""); setNote(""); Alert.alert("Đã ghi nhận", "Phiếu thu đã được lưu thành công.");
    } catch (cause) { Alert.alert("Không thể ghi nhận", errorMessage(cause)); } finally { setBusy(""); }
  };
  const voidPayment = async () => {
    if (voidReason.trim().length < 3) return Alert.alert("Lý do chưa hợp lệ", "Vui lòng nhập ít nhất 3 ký tự.");
    try { setBusy(voidTarget); setFee(await feeService.voidPayment(id, voidTarget, voidReason.trim())); setVoidTarget(""); setVoidReason(""); } catch (cause) { Alert.alert("Không thể hủy", errorMessage(cause)); } finally { setBusy(""); }
  };
  const remove = () => Alert.alert("Xóa khoản phí?", "Khoản phí chưa có phiếu thu sẽ bị xóa khỏi thành viên.", [{ text: "Hủy", style: "cancel" }, { text: "Xóa", style: "destructive", onPress: async () => { try { setBusy("delete"); await feeService.delete(id); router.back(); } catch (cause) { Alert.alert("Không thể xóa", errorMessage(cause)); setBusy(""); } } }]);

  if (isLoading && !fee) return <Screen><BackHeader title="Chi tiết khoản phí" /><LoadingState /></Screen>;
  if (error && !fee) return <Screen><BackHeader title="Chi tiết khoản phí" /><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!fee) return null;
  const activePayments = fee.payments.filter((item) => !item.voidedAt);

  return <Screen scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}>
    <BackHeader title={fee.title} subtitle={admin ? fee.memberName : `Phí năm ${fee.year}`} />
    <Card style={styles.hero}><View style={styles.between}><Text style={styles.eyebrow}>CÒN PHẢI ĐÓNG</Text><Badge tone={feeStatusTone(fee.status)}>{feeStatusLabel[fee.status]}</Badge></View><Text style={styles.amount}>{money.format(fee.remaining)}</Text><View style={styles.stats}><Stat label="Phải đóng" value={money.format(fee.amount)} /><Stat label="Đã đóng" value={money.format(fee.paid)} /></View></Card>
    {fee.overpaid ? <Card style={styles.warning}><AlertTriangle color={colors.warning} size={21} /><Text style={styles.warningText}>Đã thu thừa {money.format(fee.overpaid)}. Vui lòng liên hệ quản trị viên để đối soát.</Text></Card> : null}
    <Card style={styles.details}><Info label="Thành viên" value={fee.memberName} /><Info label="Email" value={fee.memberEmail} /><Info label="Hạn đóng" value={formatDate(fee.dueDate)} /><Info label="Nội dung" value={fee.note || "Không có ghi chú"} /></Card>
    {fee.remaining > 0 && fee.checkout ? <><SectionTitle>Thanh toán chuyển khoản</SectionTitle><Card style={styles.checkout}>{fee.checkout.qrUrl ? <Image source={{ uri: fee.checkout.qrUrl }} resizeMode="contain" style={styles.qr} /> : null}<Info label="Ngân hàng" value={fee.checkout.bank} /><Info label="Số tài khoản" value={fee.checkout.accountNumber} /><Info label="Chủ tài khoản" value={fee.checkout.accountName} /><Info label="Số tiền" value={money.format(fee.checkout.amount)} /><Info label="Nội dung chuyển khoản" value={fee.checkout.paymentCode} />{fee.checkout.qrUrl ? <Button icon={ExternalLink} tone="secondary" fullWidth onPress={() => Linking.openURL(fee.checkout!.qrUrl)}>Mở mã QR</Button> : null}<Text style={styles.help}>Hệ thống tự động đối soát giao dịch. Màn hình cập nhật mỗi 10 giây.</Text></Card></> : null}
    {admin ? <><SectionTitle>Quản trị khoản phí</SectionTitle><View style={styles.actions}><View style={styles.action}><Button icon={Bell} tone="secondary" fullWidth disabled={Boolean(busy)} onPress={notify}>{busy === "notify" ? "Đang gửi..." : "Gửi nhắc phí"}</Button></View><View style={styles.action}><Button icon={ReceiptText} fullWidth disabled={Boolean(busy) || fee.remaining <= 0} onPress={() => { if (!showReceipt && !amount) setAmount(String(fee.remaining || fee.amount)); setShowReceipt(!showReceipt); }}>Ghi nhận thu</Button></View></View>{fee.payments.length === 0 ? <Button icon={Trash2} tone="danger" fullWidth disabled={Boolean(busy)} onPress={remove}>Xóa khoản phí</Button> : null}</> : null}
    {admin && showReceipt ? <Card style={styles.form}><Text style={styles.formTitle}>Tạo phiếu thu</Text><Field label="Số tiền *" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="0" /><DateTimeField label="Ngày thu *" mode="date" value={paidOn} onChange={setPaidOn} /><Text style={styles.label}>HÌNH THỨC</Text><View style={styles.actions}><Choice active={method === "transfer"} label="Chuyển khoản" icon={CreditCard} onPress={() => setMethod("transfer")} /><Choice active={method === "cash"} label="Tiền mặt" icon={Banknote} onPress={() => setMethod("cash")} /></View><Field label="Mã tham chiếu" value={reference} onChangeText={setReference} placeholder="Mã giao dịch hoặc số chứng từ" /><Field label="Ghi chú" value={note} onChangeText={setNote} placeholder="Ghi chú phiếu thu" multiline /><Button fullWidth disabled={Boolean(busy)} onPress={receive}>{busy === "receive" ? "Đang lưu..." : "Lưu phiếu thu"}</Button></Card> : null}
    <SectionTitle>Lịch sử thu ({activePayments.length})</SectionTitle>
    {voidTarget ? <Card style={styles.form}><Text style={styles.formTitle}>Xác nhận hủy phiếu thu</Text><Text style={styles.meta}>Phiếu thu vẫn được giữ trong lịch sử và không còn tính vào số tiền đã đóng.</Text><Field autoFocus label="Lý do hủy *" value={voidReason} onChangeText={setVoidReason} placeholder="Ví dụ: Ghi nhận nhầm giao dịch" /><View style={styles.actions}><View style={styles.action}><Button tone="secondary" fullWidth disabled={Boolean(busy)} onPress={() => { setVoidTarget(""); setVoidReason(""); }}>Bỏ qua</Button></View><View style={styles.action}><Button tone="danger" fullWidth disabled={Boolean(busy)} onPress={voidPayment}>{busy ? "Đang hủy..." : "Xác nhận hủy"}</Button></View></View></Card> : null}
    {fee.payments.length === 0 ? <Card><Text style={styles.empty}>Chưa có phiếu thu nào.</Text></Card> : [...fee.payments].reverse().map((payment) => <Card key={payment.id} style={[styles.payment, payment.voidedAt && styles.voided]}><View style={styles.between}><View style={styles.grow}><Text style={styles.paymentAmount}>{money.format(payment.amount)}</Text><Text style={styles.meta}>{formatDate(payment.paidOn)} · {payment.method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</Text></View>{payment.voidedAt ? <Badge tone="danger">Đã hủy</Badge> : <Badge tone="primary">Đã thu</Badge>}</View>{payment.reference ? <Text style={styles.meta}>Tham chiếu: {payment.reference}</Text> : null}{payment.note ? <Text style={styles.meta}>{payment.note}</Text> : null}{payment.voidReason ? <Text style={styles.voidReason}>Lý do hủy: {payment.voidReason}</Text> : null}{admin && !payment.voidedAt ? <Button icon={Undo2} tone="secondary" disabled={Boolean(busy)} onPress={() => { setVoidTarget(payment.id); setVoidReason(""); }}>Hủy phiếu thu</Button> : null}</Card>)}
  </Screen>;
}

function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text selectable style={styles.infoValue}>{value}</Text></View>; }
function Field({ label, multiline, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) { return <View style={styles.field}><Text style={styles.label}>{label.toUpperCase()}</Text><TextInput {...props} multiline={multiline} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.textarea]} /></View>; }
function Choice({ active, label, icon: Icon, onPress }: { active: boolean; label: string; icon: typeof CreditCard; onPress: () => void }) { return <View style={styles.action}><Button icon={Icon} tone={active ? "primary" : "secondary"} fullWidth onPress={onPress}>{label}</Button></View>; }
const styles = StyleSheet.create({
  hero: { gap: spacing.md, backgroundColor: colors.primary }, between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }, eyebrow: { color: "#DDFBFF", fontSize: 11, fontWeight: "900" }, amount: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" }, stats: { flexDirection: "row", gap: spacing.md }, stat: { flex: 1 }, statLabel: { color: "#DDFBFF", fontSize: 11 }, statValue: { color: "#FFFFFF", fontWeight: "800", marginTop: 3 },
  details: { gap: spacing.md }, info: { gap: 3 }, infoLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, infoValue: { color: colors.text, fontSize: 14, fontWeight: "600" }, checkout: { gap: spacing.md }, qr: { width: 230, height: 230, alignSelf: "center", backgroundColor: "#FFFFFF" }, help: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" },
  warning: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "#FFF8E8" }, warningText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 }, form: { gap: spacing.md }, formTitle: { color: colors.text, fontSize: 16, fontWeight: "900" }, field: { gap: spacing.xs }, label: { color: colors.muted, fontSize: 10, fontWeight: "800" }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md }, textarea: { minHeight: 82, paddingTop: spacing.md, textAlignVertical: "top" },
  payment: { gap: spacing.sm }, grow: { flex: 1 }, paymentAmount: { color: colors.text, fontSize: 16, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 12, lineHeight: 18 }, voided: { opacity: 0.65 }, voidReason: { color: colors.danger, fontSize: 12 }, empty: { color: colors.muted, textAlign: "center" },
});
