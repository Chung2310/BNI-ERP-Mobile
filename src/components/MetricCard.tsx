import { StyleSheet, Text } from "react-native";
import { Card } from "@/components/ui";
import { colors, spacing } from "@/theme/tokens";

export function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <Card style={styles.card}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text><Text style={styles.note}>{note}</Text></Card>;
}

const styles = StyleSheet.create({
  card: { width: "48.5%", gap: spacing.xs },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  value: { color: colors.text, fontSize: 24, fontWeight: "900" },
  note: { color: colors.muted, fontSize: 11 },
});
