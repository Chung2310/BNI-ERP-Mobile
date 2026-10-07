import { router, type Href } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing, touchTarget } from "@/theme/tokens";

export function MenuTile({ icon: Icon, title, subtitle, href, square = false }: { icon: LucideIcon; title: string; subtitle: string; href: Href; square?: boolean }) {
  return (
    <Pressable accessibilityRole='button' accessibilityLabel={title} style={({ pressed }) => [styles.tile, square && styles.square, pressed && styles.pressed]} onPress={() => router.push(href)}>
      <View style={styles.icon}><Icon color={colors.primaryDark} size={22} strokeWidth={2} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  square: { aspectRatio: 1, minHeight: 0 },
  tile: { width: "48.5%", minHeight: 122, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.md, ...shadow },
  icon: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primarySoft },
  title: { marginTop: spacing.sm, color: colors.text, fontSize: 14, fontWeight: "800" },
  subtitle: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.76 },
});
