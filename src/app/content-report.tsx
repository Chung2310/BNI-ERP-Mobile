import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, Screen } from "@/components/ui";
import { contentSafetyService, type ContentReportReason } from "@/services/contentSafety";
import { colors, radius, spacing } from "@/theme/tokens";
import { friendlyErrorMessage } from "@/utils/userFacingError";

const reasons: { id: ContentReportReason; label: string }[] = [
  { id: "harassment", label: "Quấy rối hoặc thù ghét" }, { id: "sexual", label: "Nội dung tình dục" },
  { id: "violence", label: "Bạo lực hoặc đe dọa" }, { id: "spam", label: "Spam hoặc lừa đảo" }, { id: "other", label: "Vi phạm khác" },
];
export default function ContentReportScreen() {
  const { targetType, targetId } = useLocalSearchParams<{ targetType: string; targetId: string }>();
  const validTarget = (targetType === "profile" || targetType === "resource") && /^[a-f0-9]{24}$/i.test(targetId || "");
  const [reason, setReason] = useState<ContentReportReason>("harassment");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (submitting.current || !validTarget) return;
    submitting.current = true; setBusy(true); setError("");
    try { await contentSafetyService.report(targetType as "profile" | "resource", targetId, reason, details.trim()); setSent(true); }
    catch (cause) { setError(friendlyErrorMessage(cause, "Chưa gửi được báo cáo. Vui lòng thử lại.")); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Screen><BackHeader title={targetType === "profile" ? "Báo cáo hồ sơ" : "Báo cáo tài nguyên"} />
    <Card style={styles.card}>
      {sent ? <><Text style={styles.body}>Báo cáo đã được chuyển đến quản trị viên Chapter để kiểm tra và xử lý.</Text><Button onPress={() => router.back()}>Hoàn tất</Button></> : <>
        <Text style={styles.body}>Chọn lý do báo cáo. Danh tính người báo cáo không được công khai cho người bị báo cáo.</Text>
        {reasons.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: item.id === reason, disabled: busy }} disabled={busy} onPress={() => setReason(item.id)} style={styles.reason}><Text style={styles.body}>{item.id === reason ? "●" : "○"} {item.label}</Text></Pressable>)}
        <TextInput accessibilityLabel="Mô tả báo cáo" placeholder="Thông tin thêm (tùy chọn)" editable={!busy} multiline maxLength={2000} value={details} onChangeText={setDetails} style={styles.input} />
        {!validTarget || error ? <Text accessibilityRole="alert" style={styles.error}>{error || "Không xác định được nội dung cần báo cáo. Hãy quay lại và thử lại."}</Text> : null}
        <Button disabled={busy || !validTarget} onPress={() => void submit()}>{busy ? "Đang gửi..." : "Gửi báo cáo"}</Button>
      </>}
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({
  card: { gap: spacing.md }, body: { color: colors.text, fontSize: 14, lineHeight: 22 },
  reason: { minHeight: 48, justifyContent: "center" },
  input: { minHeight: 112, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: spacing.md, textAlignVertical: "top" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
});
