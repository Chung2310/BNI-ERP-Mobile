import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, Badge, Card } from "@/components/ui";
import { colors, spacing } from "@/theme/tokens";
import type { MemberSummary } from "@/types";

export function MemberCard({ member }: { member: MemberSummary }) {
  return (
    <Pressable style={styles.wrapper} onPress={() => router.push({ pathname: "/member/[id]", params: { id: member.id } })}>
      <Card style={styles.card}>
        <View style={styles.cover} />
        <Avatar initials={member.initials} size={56} />
        <Text numberOfLines={1} style={styles.name}>{member.name}</Text>
        <Text numberOfLines={1} style={styles.role}>{member.role}</Text>
        <Badge tone="primary">{member.industry}</Badge>
        <Text numberOfLines={1} style={styles.company}>{member.company}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "48.5%" },
  card: { minHeight: 190, alignItems: "center", paddingTop: 0, overflow: "hidden" },
  cover: { width: "140%", height: 48, marginBottom: -26, backgroundColor: colors.primarySoft },
  name: { marginTop: spacing.sm, color: colors.text, fontSize: 14, fontWeight: "800" },
  role: { marginTop: 2, color: colors.muted, fontSize: 11 },
  company: { marginTop: spacing.sm, color: colors.muted, fontSize: 11 },
});
