import { useCallback, useRef, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Linking, StyleSheet, Text } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Alert } from "@/components/AppAlert";
import { Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { chatService } from "@/services/chat";
import { contentSafetyService } from "@/services/contentSafety";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { colors, spacing } from "@/theme/tokens";

type ModerationItem = {
  id: string; kind: "chat" | "content"; reason: string; details: string;
  createdAt: string; title: string; attachments: { url: string; name: string }[];
};
export default function ChatSafetyScreen() {
  const { user } = useAuth();
  const canModerate = user?.role === "admin" || user?.permissions?.some(permission => permission === "chat:manage" || permission === "*");
  const canReadChat = (!user?.enabledModules || user.enabledModules.includes("chat")) &&
    (user?.role === "admin" || user?.permissions?.some(permission => permission === "chat:read" || permission === "*"));
  const [blocks, setBlocks] = useState<Awaited<ReturnType<typeof chatService.blocks>>>([]);
  const [reports, setReports] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const mutating = useRef(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextBlocks, chatReports, contentReports] = await Promise.all([
        canReadChat ? chatService.blocks() : Promise.resolve([]), canModerate && canReadChat ? chatService.moderation() : Promise.resolve([]),
        canModerate ? contentSafetyService.moderation() : Promise.resolve([]),
      ]);
      setBlocks(nextBlocks);
      const items: ModerationItem[] = [
        ...chatReports.map(report => ({ id: report._id, kind: "chat" as const, reason: report.reason, details: report.details, createdAt: report.createdAt,
          title: (report.messageId?.senderName || "Tài khoản đã xóa") + ": " + (report.messageId?.content || "Tệp đính kèm"), attachments: report.messageId?.attachments || [] })),
        ...contentReports.map(report => ({ id: report._id, kind: "content" as const, reason: report.reason, details: report.details, createdAt: report.createdAt,
          title: (report.targetType === "profile" ? "Hồ sơ: " : "Tài nguyên: ") + report.title, attachments: report.attachments })),
      ];
      setReports(items.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)));
    } catch (cause) { setError(friendlyErrorMessage(cause, "Không tải được dữ liệu.")); }
    finally { setLoading(false); }
  }, [canModerate, canReadChat]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const mutate = async (action: () => Promise<unknown>) => {
    if (mutating.current) return;
    mutating.current = true; setBusy(true);
    try { await action(); await refresh(); }
    catch (cause) { Alert.alert("Không thể cập nhật", friendlyErrorMessage(cause, "Vui lòng thử lại.")); }
    finally { mutating.current = false; setBusy(false); }
  };
  const resolve = (report: ModerationItem, action: "approve" | "remove" | "suspend" | "dismiss") => {
    Alert.alert("Xác nhận xử lý", action === "suspend" ? "Gỡ nội dung và đình chỉ tài khoản thành viên này?" : "Áp dụng quyết định kiểm duyệt này?", [
      { text: "Hủy", style: "cancel" }, { text: "Xác nhận", onPress: () => void mutate(() => report.kind === "content"
        ? contentSafetyService.resolve(report.id, action) : chatService.resolveReport(report.id, action)) },
    ]);
  };
  return <Screen><BackHeader title="An toàn nội dung" />
    <Button tone="secondary" onPress={() => router.push("/community-rules")}>Quy tắc cộng đồng và liên hệ</Button>
    {loading ? <Text style={styles.body}>Đang tải...</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button onPress={() => void refresh()}>Thử lại</Button></> : null}
    <Card style={styles.card}>
      <Text style={styles.title}>Người đã chặn</Text>
      <Text style={styles.body}>Không nhận tin nhắn hoặc thông báo chat từ người đã chặn, kể cả trong nhóm chung.</Text>
      {!loading && !blocks.length ? <Text style={styles.body}>Chưa có người bị chặn.</Text> : null}
      {blocks.map(block => block.blockedUserId ? <Card style={styles.report} key={block._id}><Text style={styles.body}>{block.blockedUserId.displayName}</Text>
        <Button disabled={busy} tone="secondary" onPress={() => void mutate(() => chatService.blockUser(block.blockedUserId!._id, false))}>Bỏ chặn</Button></Card> : null)}
    </Card>
    {canModerate ? <Card style={styles.card}>
      <Text style={styles.title}>Hàng đợi kiểm duyệt</Text>
      <Text style={styles.body}>Kiểm tra báo cáo, ảnh hồ sơ, tài nguyên và tệp chat mới thường xuyên. Nội dung mới chỉ được chia sẻ sau khi duyệt.</Text>
      {!loading && !reports.length ? <Text style={styles.body}>Không có nội dung chờ xử lý.</Text> : null}
      {reports.map(report => <Card key={report.kind + report.id} style={styles.report}>
        <Text style={styles.title}>{report.reason === "media_review" ? "Nội dung mới chờ duyệt" : "Báo cáo: " + report.reason}</Text>
        <Text style={styles.body}>{report.title}</Text><Text style={styles.meta}>{new Date(report.createdAt).toLocaleString("vi-VN")}</Text>
        {report.details ? <Text style={styles.body}>{report.details}</Text> : null}
        {report.attachments.map((file, index) => <Button key={index} tone="secondary" onPress={() => { void Linking.openURL(file.url).catch(() => Alert.alert("Không mở được tệp", "Vui lòng thử lại.")); }}>{file.name}</Button>)}
        {report.reason === "media_review" ? <Button disabled={busy} onPress={() => resolve(report, "approve")}>Duyệt nội dung</Button>
          : <Button disabled={busy} tone="secondary" onPress={() => resolve(report, "dismiss")}>Đóng báo cáo không vi phạm</Button>}
        <Button disabled={busy} tone="danger" onPress={() => resolve(report, "remove")}>Gỡ nội dung</Button>
        <Button disabled={busy} tone="danger" onPress={() => resolve(report, "suspend")}>Gỡ và đình chỉ thành viên</Button>
      </Card>)}
    </Card> : null}
  </Screen>;
}
const styles = StyleSheet.create({
  card: { gap: spacing.md }, report: { gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 15, fontWeight: "700" },
  body: { color: colors.text, fontSize: 13, lineHeight: 21 }, meta: { color: colors.muted, fontSize: 12 }, error: { color: colors.danger },
});
