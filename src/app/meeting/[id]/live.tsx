import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CircleStop, Pause, Play, SkipForward } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";

export default function LiveMeetingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  if (isLoading) return <Screen><BackHeader title="Điều hành cuộc họp" /><LoadingState /></Screen>;
  if (error || !meeting) return <Screen><BackHeader title="Điều hành cuộc họp" /><ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={reload} /></Screen>;
  const current = meeting.speakers[Math.max(0, meeting.currentIndex)];
  const action = async (value: "start" | "pause" | "resume" | "next" | "previous" | "finish") => { try { await meetingService.control(id, value, meeting.revision); await reload(); } catch (cause) { Alert.alert("Thao tác thất bại", cause instanceof Error ? cause.message : "Vui lòng thử lại."); } };
  return <Screen><BackHeader title="Điều hành cuộc họp" subtitle={`${meeting.speakers.length} người tham dự`} />{current ? <Card style={styles.speaker}><Avatar initials={current.name.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase()} size={80} /><Text style={styles.name}>{current.name}</Text><Text style={styles.meta}>{current.company || "Chưa cập nhật công ty"} · {current.seconds} giây</Text></Card> : <EmptyState title="Chưa có người phát biểu" message="Bắt đầu cuộc họp sau khi thành viên đã check-in." />}<View style={styles.actions}>{meeting.status === "scheduled" ? <Button icon={Play} onPress={() => action("start")}>Bắt đầu họp</Button> : <><Button icon={meeting.status === "paused" ? Play : Pause} tone="secondary" onPress={() => action(meeting.status === "paused" ? "resume" : "pause")}>{meeting.status === "paused" ? "Tiếp tục" : "Tạm dừng"}</Button><Button icon={SkipForward} onPress={() => action("next")}>Người tiếp theo</Button></>}</View><Card><SectionTitle>Thứ tự phát biểu</SectionTitle>{meeting.speakers.map((person, index) => <View key={person.id} style={styles.person}><Text style={styles.number}>{index + 1}</Text><Avatar initials={person.name.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase()} /><View style={styles.grow}><Text style={styles.personName}>{person.name}</Text><Text style={styles.meta}>{person.seconds} giây</Text></View></View>)}</Card>{meeting.status !== "ended" ? <Button icon={CircleStop} tone="danger" fullWidth onPress={() => action("finish")}>Kết thúc họp</Button> : null}</Screen>;
}
const styles = StyleSheet.create({ speaker: { alignItems: "center", gap: spacing.sm }, name: { color: colors.text, fontSize: 17, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 12 }, actions: { flexDirection: "row", gap: spacing.sm }, person: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, number: { width: 24, color: colors.muted, fontSize: 12, fontWeight: "800" }, grow: { flex: 1 }, personName: { color: colors.text, fontSize: 14, fontWeight: "800" } });
