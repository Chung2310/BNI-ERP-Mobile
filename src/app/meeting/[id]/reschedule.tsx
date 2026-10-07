import { Alert } from "@/components/AppAlert";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarClock } from "lucide-react-native";
import {  StyleSheet, Text } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { DateTimeField } from "@/components/DateTimeField";
import { Button, Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, meetingVersion, type Meeting } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";
import { parseVietnamDateTime } from "@/utils/meetingForm";

const vietnamInput = (value: string) => new Date(new Date(value).getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
const displayTime = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: "short" });

export default function RescheduleMeetingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);

  if (isLoading) return <Screen><BackHeader title="Dời lịch họp" compact /><LoadingState /></Screen>;
  if (error || !meeting) return <Screen><BackHeader title="Dời lịch họp" compact /><ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={reload} /></Screen>;
  if (meeting.status !== "scheduled") return <Screen><BackHeader title="Dời lịch họp" compact /><ErrorState message="Chỉ có thể dời lịch họp chưa diễn ra." onRetry={reload} /></Screen>;
  return <RescheduleForm key={meeting._id + meetingVersion(meeting)} meeting={meeting} />;
}

function RescheduleForm({ meeting }: { meeting: Meeting }) {
  const [startsAt, setStartsAt] = useState(vietnamInput(meeting.startsAt));
  const [endsAt, setEndsAt] = useState(vietnamInput(meeting.endsAt || new Date(new Date(meeting.startsAt).getTime() + 2 * 3_600_000).toISOString()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changeStart = (value: string) => {
    const oldStart = parseVietnamDateTime(startsAt);
    const oldEnd = parseVietnamDateTime(endsAt);
    const nextStart = parseVietnamDateTime(value);
    setStartsAt(value);
    if (oldStart && oldEnd && nextStart) {
      const nextEnd = new Date(nextStart.getTime() + oldEnd.getTime() - oldStart.getTime());
      setEndsAt(vietnamInput(nextEnd.toISOString()));
    }
  };

  const save = async () => {
    if (saving) return;
    const start = parseVietnamDateTime(startsAt);
    const end = parseVietnamDateTime(endsAt);
    if (!start || start <= new Date()) return setError("Vui lòng chọn giờ bắt đầu trong tương lai.");
    if (!end || end <= start) return setError("Giờ kết thúc phải sau giờ bắt đầu.");
    if (start.getTime() === new Date(meeting.startsAt).getTime() && end.getTime() === new Date(meeting.endsAt || 0).getTime()) return setError("Vui lòng chọn thời gian mới trước khi lưu.");
    setError("");
    setSaving(true);
    try {
      await meetingService.update(meeting._id, { version: meetingVersion(meeting), startsAt: start.toISOString(), endsAt: end.toISOString() });
      Alert.alert("Đã dời lịch họp", "Thời gian mới đã được lưu.", [{ text: "Xong", onPress: () => router.back() }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể dời lịch họp.");
    } finally {
      setSaving(false);
    }
  };

  return <Screen style={styles.screen}>
    <BackHeader title="Dời lịch họp" subtitle="Chọn ngày giờ mới cho buổi họp" compact />
    <Card style={styles.card}>
      <Text style={styles.title}>{meeting.title}</Text>
      <Text style={styles.label}>LỊCH HIỆN TẠI</Text>
      <Text style={styles.current}>{displayTime(meeting.startsAt)} – {displayTime(meeting.endsAt || meeting.startsAt)}</Text>
      {meeting.seriesId ? <Text style={styles.hint}>Chỉ dời buổi này; các buổi khác trong chuỗi không thay đổi.</Text> : null}
    </Card>
    <Card style={styles.card}>
      <DateTimeField label="Bắt đầu mới *" mode="datetime" value={startsAt} onChange={changeStart} minimumDate={new Date()} />
      <DateTimeField label="Kết thúc mới *" mode="datetime" value={endsAt} onChange={setEndsAt} />
      <Text style={styles.hint}>Khi đổi giờ bắt đầu, thời lượng họp được giữ nguyên. Bạn có thể chỉnh lại giờ kết thúc.</Text>
    </Card>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button icon={CalendarClock} fullWidth disabled={saving} onPress={() => void save()}>{saving ? "Đang lưu…" : "Lưu lịch mới"}</Button>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.sm },
  card: { gap: spacing.md },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  current: { color: colors.text, fontSize: 13, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
