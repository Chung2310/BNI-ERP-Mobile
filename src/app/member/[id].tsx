import { Linking, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Mail, Phone } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Badge, Button, Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { userService } from "@/services/users";
import { colors, spacing } from "@/theme/tokens";

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: member, error, isLoading, reload } = useAsyncData(() => userService.get(id), id);
  if (isLoading) return <Screen><BackHeader title="Hồ sơ thành viên" /><LoadingState /></Screen>;
  if (error || !member) return <Screen><BackHeader title="Hồ sơ thành viên" /><ErrorState message={error || "Không tìm thấy thành viên."} onRetry={reload} /></Screen>;
  const initials = member.displayName.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase();
  return <Screen><BackHeader title="Hồ sơ thành viên" /><Card style={styles.profile}><View style={styles.cover} /><Avatar initials={initials} size={88} /><Text style={styles.name}>{member.displayName}</Text><Text style={styles.role}>{member.role} · {member.branchName || member.companyName || member.companyCode}</Text><Badge tone="primary">{member.industry || "Chưa cập nhật lĩnh vực"}</Badge></Card><View style={styles.actions}>{member.phone ? <Button icon={Phone} tone="secondary" onPress={() => Linking.openURL(`tel:${member.phone}`)}>Gọi điện</Button> : null}<Button icon={Mail} tone="secondary" onPress={() => Linking.openURL(`mailto:${member.email}`)}>Gửi email</Button></View><Card style={styles.info}><Info label="CÔNG TY" value={member.companyName || member.companyCode || "Chưa cập nhật"} /><Info label="LĨNH VỰC" value={member.industry || "Chưa cập nhật"} /><Info label="SỐ ĐIỆN THOẠI" value={member.phone || "Chưa cập nhật"} /></Card></Screen>;
}
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
const styles = StyleSheet.create({ profile: { alignItems: "center", overflow: "hidden", paddingTop: 0 }, cover: { width: "130%", height: 86, marginBottom: -45, backgroundColor: colors.primarySoft }, name: { marginTop: spacing.md, color: colors.text, fontSize: 19, fontWeight: "900" }, role: { marginVertical: spacing.sm, color: colors.muted, fontSize: 12 }, actions: { flexDirection: "row", gap: spacing.sm }, info: { gap: spacing.md }, infoRow: { gap: 3, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, label: { color: colors.muted, fontSize: 10, fontWeight: "800" }, value: { color: colors.text, fontSize: 14, fontWeight: "700" } });
