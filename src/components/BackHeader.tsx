import type { ReactNode } from "react";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, touchTarget } from "@/theme/tokens";

export function BackHeader({
  title,
  subtitle,
  compact = false,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  compact?: boolean;
  onBack?: () => void;
  action?: ReactNode;
}) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        style={[styles.back, compact && styles.compactBack]}
        onPress={handleBack}
        hitSlop={8}
      >
        <ChevronLeft color={colors.primaryDark} size={compact ? 22 : 28} strokeWidth={2.4} />
      </Pressable>
      <View style={styles.grow}>
        <Text style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginLeft: -4 },
  compactBack: { width: 32, height: 32, marginLeft: -4 },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  compactTitle: { fontSize: 16.5, fontWeight: "800" },
  subtitle: { marginTop: 2, color: colors.muted, fontSize: 12 },
});
