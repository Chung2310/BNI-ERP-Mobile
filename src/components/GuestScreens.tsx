import { router } from "expo-router";
import { LockKeyhole, Search } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { Card, Screen } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { colors, radius, spacing } from "@/theme/tokens";

export function GuestLocked({ title }: { title: string }) {
  return <Screen style={styles.lockedScreen}>
    <BackHeader title={title} compact onBack={() => router.navigate("/(tabs)")} />
    <View style={styles.searchBar}><Search size={18} color={colors.muted} /><Text style={styles.searchText}>{title === "Trò chuyện" ? "Tìm cuộc trò chuyện..." : "Tìm kiếm thành viên..."}</Text><LockKeyhole size={16} color={colors.brandBlue} /></View>
    <Card style={styles.lockedCard}><LockKeyhole color={colors.brandBlue} size={26} /><Text style={styles.heading}>{title === "Trò chuyện" ? "Trò chuyện" : "Danh sách thành viên"}</Text><Text style={styles.body}>Tính năng sẽ mở khi bạn gia nhập Chapter.</Text></Card>
  </Screen>;
}

const styles = StyleSheet.create({
  lockedScreen: { paddingHorizontal: spacing.lg, gap: spacing.md },
  searchBar: { minHeight: 46, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  searchText: { flex: 1, color: colors.muted, fontSize: 14 },
  lockedCard: { marginTop: spacing.md, alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  heading: { color: colors.text, fontSize: 19, fontWeight: "800" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
