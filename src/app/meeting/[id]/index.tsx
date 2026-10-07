import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CircleStop, Gift, Pause, Play, Presentation, QrCode } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Button, Card, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { user } = useAuth();
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  if (isLoading) return <Screen><BackHeader title="Chi tiết cuộc họp" /><LoadingState /></Screen>;
  if (error || !meeting) return <Screen><BackHeader title="Chi tiết cuộc họp" /><ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={reload} /></Screen>;
  const child = (path: "check-in" | "live" | "interaction") => router.push({ pathname: `/meeting/[id]/${path}`, params: { id } });
  const manage = hasPermission(user, "meetings:manage", "access:manage");
  const control = async (action: "pause" | "resume" | "finish") => { try { await meetingService.control(id, action, meeting.revision); await reload(); } catch (cause) { Alert.alert("Không thể điều khiển", cause instanceof Error ? cause.message : "Vui lòng thử lại."); } };
  return <Screen><BackHeader title="Chi tiết cuộc họp" /><Card style={styles.hero}><Badge tone={meeting.status === "live" ? "danger" : "primary"}>{meeting.status.toUpperCase()}</Badge><Text style={styles.title}>{meeting.title}</Text><Text style={styles.meta}>{new Date(meeting.startsAt).toLocaleString("vi-VN")} · {meeting.location || "Chưa cập nhật"}</Text></Card><View style={styles.metrics}><Card style={styles.metric}><Text style={styles.metricLabel}>CHECK-IN</Text><Text style={styles.metricValue}>{meeting.speakers.length}</Text></Card><Card style={styles.metric}><Text style={styles.metricLabel}>ĐÃ PHÁT BIỂU</Text><Text style={styles.metricValue}>{meeting.speakers.filter((speaker) => (speaker.spokenSeconds || 0) > 0).length}/{meeting.speakers.length}</Text></Card></View><SectionTitle>Chức năng cuộc họp</SectionTitle><Card style={styles.menu}><Button icon={QrCode} tone="secondary" fullWidth onPress={() => child("check-in")}>QR/GPS check-in</Button>{manage ? <Button icon={Presentation} tone="secondary" fullWidth onPress={() => child("live")}>Phòng điều hành</Button> : null}<Button icon={Gift} tone="secondary" fullWidth onPress={() => child("interaction")}>Tương tác & quay thưởng</Button></Card>{manage && (meeting.status === "live" || meeting.status === "paused") ? <View style={styles.actions}><Button icon={meeting.status === "paused" ? Play : Pause} tone="secondary" onPress={() => control(meeting.status === "paused" ? "resume" : "pause")}>{meeting.status === "paused" ? "Tiếp tục" : "Tạm dừng"}</Button><Button icon={CircleStop} tone="danger" onPress={() => control("finish")}>Kết thúc họp</Button></View> : null}</Screen>;
}
const styles = StyleSheet.create({ hero: { gap: spacing.md, backgroundColor: colors.primary }, title: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" }, meta: { color: "#DDFBFF", fontSize: 13 }, metrics: { flexDirection: "row", gap: spacing.sm }, metric: { flex: 1 }, metricLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" }, metricValue: { marginTop: spacing.xs, color: colors.text, fontSize: 23, fontWeight: "900" }, menu: { gap: spacing.sm }, actions: { flexDirection: "row", gap: spacing.sm } });
