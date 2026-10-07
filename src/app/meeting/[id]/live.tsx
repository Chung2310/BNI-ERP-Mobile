import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CircleStop, Pause, Play, SkipForward } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, meetingVersion } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

export default function LiveMeetingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = hasPermission(user, "meetings:manage", "access:manage");
  const [busy, setBusy] = useState(false);
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  if (isLoading) return <Screen><BackHeader title="Điều hành cuộc họp" /><LoadingState /></Screen>;
  if (error || !meeting) return <Screen><BackHeader title="Điều hành cuộc họp" /><ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={reload} /></Screen>;
  const current = meeting.currentIndex >= 0 ? meeting.speakers[meeting.currentIndex] : undefined;
  const action = async (value: "start" | "pause" | "resume" | "next" | "previous" | "finish") => {
    if (!canManage || busy) return;
    setBusy(true);
    try {
      await meetingService.control(id, value, meetingVersion(meeting));
      await reload();
    } catch (cause) {
      Alert.alert("Thao tác thất bại", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Điều hành & trình chiếu" subtitle={`${meeting.speakers.length} người tham dự`} />
      {current ? (
        <Card style={styles.speaker}>
          <Avatar initials={current.name.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase()} size={64} />
          <Text style={styles.name}>{current.name}</Text>
          <Text style={styles.meta}>{current.company || "Chưa cập nhật công ty"} · {current.seconds} giây</Text>
        </Card>
      ) : <EmptyState title="Chưa có người phát biểu" message="Bắt đầu cuộc họp sau khi thành viên đã check-in." />}

      {canManage && ["scheduled", "live", "paused"].includes(meeting.status) ? (
        <View style={styles.actions}>
          {meeting.status === "scheduled" ? <Button icon={Play} fullWidth disabled={busy} onPress={() => action("start")}>Bắt đầu họp</Button> : (
            <>
              <Button icon={meeting.status === "paused" ? Play : Pause} tone="secondary" fullWidth disabled={busy} onPress={() => action(meeting.status === "paused" ? "resume" : "pause")}>{meeting.status === "paused" ? "Tiếp tục" : "Tạm dừng"}</Button>
              <Button icon={SkipForward} fullWidth disabled={busy} onPress={() => action("next")}>Người tiếp theo</Button>
            </>
          )}
        </View>
      ) : null}

      <SectionTitle>Thứ tự phát biểu</SectionTitle>
      <Card>
        {meeting.speakers.map((person, index) => <View key={person.id} style={styles.person}>
          <Text style={styles.number}>{index + 1}</Text>
          <Avatar initials={person.name.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase()} size={36} />
          <View style={styles.grow}><Text style={styles.personName}>{person.name}</Text><Text style={styles.meta}>{person.seconds} giây</Text></View>
        </View>)}
      </Card>
      {canManage && (meeting.status === "live" || meeting.status === "paused") ? <Button icon={CircleStop} tone="danger" fullWidth disabled={busy} onPress={() => action("finish")}>Kết thúc họp</Button> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  speaker: { alignItems: "center", gap: spacing.sm },
  name: { color: colors.text, fontSize: 17, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12 },
  actions: { gap: spacing.sm },
  person: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  number: { width: 24, color: colors.muted, fontSize: 12, fontWeight: "800" },
  grow: { flex: 1 },
  personName: { color: colors.text, fontSize: 13, fontWeight: "800" },
});
