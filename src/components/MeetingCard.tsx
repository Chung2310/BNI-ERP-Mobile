import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Card } from "@/components/ui";
import { colors, spacing } from "@/theme/tokens";
import type { Meeting } from "@/services/meeting";

const status = {
  scheduled: { label: "Sắp tới", tone: "primary" },
  live: { label: "Live", tone: "danger" },
  paused: { label: "Tạm dừng", tone: "warning" },
  ended: { label: "Đã kết thúc", tone: "default" },
  cancelled: { label: "Đã hủy", tone: "default" },
} as const;

const listStatusColor = {
  scheduled: "#B7790A",
  live: "#16A34A",
  paused: colors.warning,
  ended: colors.muted,
  cancelled: colors.danger,
} as const;

export function MeetingCard({ meeting, onPress, showDate = true, variant = "card" }: { meeting: Meeting; onPress?: () => void; showDate?: boolean; variant?: "card" | "list" }) {
  const start = new Date(meeting.startsAt);
  const time = start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = start.toLocaleDateString("vi-VN");
  const open = onPress || (() => router.push({ pathname: "/meeting/[id]", params: { id: meeting._id } }));

  if (variant === "list") {
    return (
      <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.listRow, pressed && styles.listPressed]}>
        <View style={styles.listTop}>
          <Text numberOfLines={1} style={styles.listTitle}>{meeting.title}</Text>
          <Text style={[styles.listStatus, { color: listStatusColor[meeting.status] }]}>{status[meeting.status].label}</Text>
        </View>
        <Text numberOfLines={1} style={styles.listMeta}>{showDate ? `${time} · ${date}` : time} · {meeting.location || "Chưa cập nhật địa điểm"}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <View style={styles.grow}>
            <Text style={styles.title}>{meeting.title}</Text>
            <Text style={styles.meta}>{showDate ? `${time} · ${date}` : time}</Text>
          </View>
          <Badge tone={status[meeting.status].tone}>{status[meeting.status].label}</Badge>
        </View>
        <Text style={styles.location}>{meeting.location || "Chưa cập nhật địa điểm"}</Text>
        {meeting.status === "live" ? <Text style={styles.liveMeta}>{meeting.speakers.length} người đã check-in</Text> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listRow: { minHeight: 56, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  listPressed: { backgroundColor: colors.primarySoft },
  listTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  listTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800" },
  listStatus: { fontSize: 11, fontWeight: "700" },
  listMeta: { marginTop: spacing.xs, color: colors.muted, fontSize: 12 },
  card: { gap: spacing.sm },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { marginTop: 4, color: colors.muted, fontSize: 12 },
  location: { color: colors.muted, fontSize: 13 },
  liveMeta: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
});
