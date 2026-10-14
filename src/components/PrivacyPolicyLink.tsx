import { Link } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, touchTarget } from "@/theme/tokens";

export function PrivacyPolicyLink({ onPress }: { onPress?: () => void }) {
  return <Link href="/privacy-policy" onPress={onPress} asChild>
    <Pressable accessibilityRole="link" style={styles.link}>
      <Text style={styles.text}>Chính sách bảo mật</Text>
    </Pressable>
  </Link>;
}

const styles = StyleSheet.create({
  link: { minHeight: touchTarget, justifyContent: "center", alignItems: "center" },
  text: { color: colors.text, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
