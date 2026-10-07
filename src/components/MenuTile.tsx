import { router, type Href } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing, touchTarget } from "@/theme/tokens";

export function MenuTile({ icon: Icon, title, subtitle, href, square = false, compact = false }: { icon: LucideIcon; title: string; subtitle: string; href: Href; square?: boolean; compact?: boolean }) {
  return (
    <Pressable accessibilityRole='button' accessibilityLabel={title} style={({ pressed }) => [styles.tile, square && styles.square, compact && styles.compact, pressed && styles.pressed]} onPress={() => router.push(href)}>
      <View style={[styles.icon, compact && styles.compactIcon]}><Icon color={colors.primaryDark} size={compact ? 20 : 22} strokeWidth={2} /></View>
      <Text numberOfLines={2} style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
      {compact ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: { width: '23%', aspectRatio: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.xs },
  compactIcon: { width: 38, height: 38 },
  compactTitle: { marginTop: 6, fontSize: 11, lineHeight: 14, textAlign: 'center' },
  square: { aspectRatio: 1, minHeight: 0 },
  tile: { width: "48.5%", minHeight: 122, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.md, ...shadow },
  icon: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primarySoft },
  title: { marginTop: spacing.sm, color: colors.text, fontSize: 14, fontWeight: "800" },
  subtitle: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.76 },
});
