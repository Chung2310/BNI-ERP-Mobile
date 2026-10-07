import { useState } from "react";
import { Gift } from "lucide-react-native";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type LuckyDrawWinner } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

export default function InteractionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { user } = useAuth(); const [winner, setWinner] = useStateSafe<LuckyDrawWinner | null>(null);
  const { data, error, isLoading, reload } = useAsyncData(() => Promise.all([meetingService.interaction(id), meetingService.luckyDraw(id)]), id);
  if (isLoading) return <Screen><BackHeader title="Tương tác & quay thưởng" /><LoadingState /></Screen>;
  if (error || !data) return <Screen><BackHeader title="Tương tác & quay thưởng" /><ErrorState message={error || "Không tải được dữ liệu."} onRetry={reload} /></Screen>;
  const [interaction, draw] = data; const canManage = hasPermission(user, "meetings:manage", "access:manage");
  const spin = async (prizeId: string) => { try { const result = await meetingService.spin(id, prizeId); setWinner(result.winner); await reload(); } catch (cause) { Alert.alert("Quay thưởng thất bại", cause instanceof Error ? cause.message : "Vui lòng thử lại."); } };
  return <Screen><BackHeader title="Tương tác & quay thưởng" subtitle="Trong chi tiết cuộc họp" /><Card style={styles.context}><Badge tone="primary">{interaction.status || "CHƯA THIẾT LẬP"}</Badge><Text style={styles.contextText}>{interaction.question || "Chưa có câu hỏi tương tác."}</Text></Card><Card><Text style={styles.heading}>Phản hồi trực tiếp</Text><Text style={styles.metric}>{interaction.responses?.length || 0}</Text><Text style={styles.meta}>phản hồi · {interaction.questions?.length || 0} câu hỏi</Text>{interaction.responses?.slice(0, 5).map((item, index) => <Text key={item._id || index} style={styles.answer}>“{item.answer}”</Text>)}</Card><Text style={styles.heading}>Quay thưởng · {draw.attendeesCount} người đủ điều kiện</Text>{winner ? <Card style={styles.winner}><Gift color={colors.primaryDark} size={30} /><Text style={styles.winnerLabel}>NGƯỜI TRÚNG GIẢI</Text><Text style={styles.winnerName}>{winner.name}</Text><Text style={styles.meta}>{winner.prizeName}</Text></Card> : null}{draw.luckyDraw.prizes.length === 0 ? <EmptyState title="Chưa có giải thưởng" message="Quản trị viên cần tạo giải thưởng trên iGen Connect web trước khi quay." /> : draw.luckyDraw.prizes.map((prize) => <Card key={prize.id} style={styles.prize}><View style={styles.grow}><Text style={styles.heading}>{prize.name}</Text><Text style={styles.meta}>{prize.reward} · {prize.winners.length}/{prize.quantity} đã trao</Text></View>{canManage ? <Button icon={Gift} onPress={() => spin(prize.id)}>Quay</Button> : null}</Card>)}</Screen>;
}
function useStateSafe<T>(initial: T) { return useState<T>(initial); }
const styles = StyleSheet.create({ context: { gap: spacing.sm, borderColor: "#B9E7EE", backgroundColor: colors.primarySoft }, contextText: { color: colors.primaryDark, fontSize: 12 }, heading: { color: colors.text, fontSize: 14, fontWeight: "800" }, metric: { marginTop: spacing.sm, color: colors.primaryDark, fontSize: 32, fontWeight: "900" }, meta: { marginTop: 3, color: colors.muted, fontSize: 11 }, answer: { marginTop: spacing.sm, color: colors.text, fontSize: 13 }, winner: { alignItems: "center", gap: spacing.sm, borderColor: colors.primary, backgroundColor: colors.primarySoft }, winnerLabel: { color: colors.primaryDark, fontSize: 10, fontWeight: "900" }, winnerName: { color: colors.text, fontSize: 22, fontWeight: "900" }, prize: { flexDirection: "row", alignItems: "center", gap: spacing.md }, grow: { flex: 1 } });
