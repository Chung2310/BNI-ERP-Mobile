import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Card } from "@/components/ui";
import { colors, spacing } from "@/theme/tokens";
import type { Meeting } from "@/services/meeting";

export function MeetingCard({ meeting, onPress, showDate = true }: { meeting: Meeting; onPress?: () => void; showDate?: boolean }) {
  const start = new Date(meeting.startsAt);
  const time = start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = start.toLocaleDateString("vi-VN");
  return (
    <Pressable onPress={onPress || (() => router.push({ pathname: "/meeting/[id]", params: { id: meeting._id } }))}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <View style={styles.grow}>
            <Text style={styles.title}>{meeting.title}</Text>
            <Text style={styles.meta}>{showDate ? `${time} · ${date}` : time}</Text>
          </View>
          <Badge tone={meeting.status === "live" ? "danger" : "primary"}>
            {meeting.status === "live" ? "LIVE" : "SẮP TỚI"}
          </Badge>
        </View>
        <Text style={styles.location}>{meeting.location || "Chưa cập nhật địa điểm"}</Text>
        {meeting.status === "live" ? <Text style={styles.liveMeta}>{meeting.speakers.length} người đã check-in</Text> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { marginTop: 4, color: colors.muted, fontSize: 12 },
  location: { color: colors.muted, fontSize: 13 },
  liveMeta: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
});
