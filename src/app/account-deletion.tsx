import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, Screen } from "@/components/ui";
import { accountDeletion, type DeletionStatus } from "@/services/accountDeletion";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { colors, spacing } from "@/theme/tokens";

export default function AccountDeletionStatusScreen() {
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [receipt, setReceipt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true); setError("");
    try {
      const token = await accountDeletion.receipt();
      if (!token) throw new Error("Thiết bị này chưa lưu mã theo dõi yêu cầu xóa.");
      setReceipt(token);
      setStatus(await accountDeletion.status(token));
    } catch (cause) { setError(friendlyErrorMessage(cause, "Không thể tải trạng thái. Bạn có thể thử lại.")); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let active = true;
    accountDeletion.receipt().then(async (token) => {
      if (!token) throw new Error("Thiết bị này chưa lưu mã theo dõi yêu cầu xóa.");
      if (active) setReceipt(token);
      const value = await accountDeletion.status(token);
      if (active) setStatus(value);
    }).catch((cause) => { if (active) setError(friendlyErrorMessage(cause, "Không thể tải trạng thái. Bạn có thể thử lại.")); });
    return () => { active = false; };
  }, []);
  return <Screen>
    <BackHeader title="Tiến trình xóa tài khoản" onBack={() => router.replace("/login")} />
    <Card style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>{status?.state === "completed" ? "Đã xóa tài khoản và dữ liệu" : "Theo dõi yêu cầu xóa"}</Text>
      {status ? <Text style={styles.body}>{status.state === "completed" ? `Hoàn tất: ${new Date(status.completedAt || status.requestedAt).toLocaleString("vi-VN")}` : "Yêu cầu đã được tiếp nhận. Tài khoản đã ngừng sử dụng; dữ liệu đang được xử lý tự động."}</Text> : null}
      <Text style={styles.body}>Thông thường mất vài phút. Khi dịch vụ lưu trữ gặp lỗi, hệ thống sẽ tiếp tục thử lại. Nếu quá 24 giờ vẫn chưa hoàn tất, bạn có thể liên hệ igen.work99@gmail.com kèm mã theo dõi.</Text>
      {receipt ? <><Text style={styles.body}>Mã theo dõi (giữ riêng):</Text><Text selectable style={styles.receipt}>{receipt}</Text><Text style={styles.body}>Mã được lưu trên thiết bị và có hiệu lực đến 30 ngày sau khi hoàn tất. Có thể tra cứu trên bni.igentechnology.net/user-data-deletion.</Text></> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button tone="secondary" disabled={busy} onPress={() => void refresh()}>{busy ? "Đang tải..." : "Cập nhật trạng thái"}</Button>
      <Button onPress={() => router.replace("/login")}>Về đăng nhập</Button>
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({ card: { gap: spacing.md }, title: { color: colors.text, fontSize: 18, fontWeight: "800" }, body: { color: colors.text, fontSize: 14, lineHeight: 22 }, receipt: { color: colors.text, fontSize: 12, lineHeight: 20 }, error: { color: colors.danger } });
