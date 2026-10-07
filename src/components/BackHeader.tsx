import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, touchTarget } from "@/theme/tokens";

export function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Quay lại" style={styles.back} onPress={() => router.back()}><ChevronLeft color={colors.primaryDark} size={28} strokeWidth={2.4} /></Pressable>
      <View style={styles.grow}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  back: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  subtitle: { marginTop: 2, color: colors.muted, fontSize: 12 },
});
