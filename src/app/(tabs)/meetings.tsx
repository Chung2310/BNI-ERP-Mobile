import { useMemo, useState } from "react";
import { router } from "expo-router";
import { CalendarDays, CalendarX2, Plus, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Button, Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import { MeetingCard } from "@/components/MeetingCard";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { colors, radius, shadow, spacing, touchTarget } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

function dayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function MeetingsScreen() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const { data, error, isLoading, reload } = useAsyncData(() => meetingService.list(monthKey), monthKey);
  const meetings = useMemo(() => data || [], [data]);
  const selectedMeetings = useMemo(() => {
    if (!selectedDate) return [];
    const selectedKey = dayKey(selectedDate);
    return meetings
      .filter((meeting) => dayKey(meeting.startsAt) === selectedKey)
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  }, [meetings, selectedDate]);

  const changeMonth = (offset: number) => {
    setSelectedDate(null);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const openMeeting = (id: string) => {
    setSelectedDate(null);
    router.push({ pathname: "/meeting/[id]", params: { id } });
  };

  return (
    <Screen>
      <AppHeader
        title="Cuộc họp"
        subtitle="Chạm vào một ngày để xem lịch họp"
        action={hasPermission(user, "meetings:manage") ? <Button icon={Plus} onPress={() => router.push("/meeting/create")}>Tạo</Button> : undefined}
      />
      <MonthCalendar
        date={month}
        eventDates={meetings.map((item) => item.startsAt)}
        onPrevious={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        onSelectDate={setSelectedDate}
      />
      {isLoading ? <LoadingState label="Đang tải lịch cuộc họp…" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <View style={styles.hint}>
          <CalendarDays color={colors.primaryDark} size={20} />
          <Text style={styles.hintText}>
            {meetings.length ? "Ngày có dấu chấm là ngày có cuộc họp." : "Tháng này chưa có cuộc họp. Bạn vẫn có thể chạm vào từng ngày để kiểm tra."}
          </Text>
        </View>
      )}

      <Modal animationType="fade" onRequestClose={() => setSelectedDate(null)} presentationStyle="overFullScreen" transparent visible={selectedDate !== null}>
        <View style={styles.overlay}>
          <Pressable accessibilityLabel="Đóng danh sách cuộc họp" onPress={() => setSelectedDate(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.popup}>
            <View style={styles.popupHeader}>
              <View style={styles.headerText}>
                <Text style={styles.popupTitle}>{selectedDate?.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</Text>
                <Text style={styles.popupCount}>{selectedMeetings.length} cuộc họp</Text>
              </View>
              <Pressable accessibilityLabel="Đóng" onPress={() => setSelectedDate(null)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <X color={colors.text} size={22} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.meetingList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {selectedMeetings.length ? selectedMeetings.map((meeting) => (
                <MeetingCard key={meeting._id} meeting={meeting} onPress={() => openMeeting(meeting._id)} showDate={false} />
              )) : (
                <Card style={styles.empty}>
                  <CalendarX2 color={colors.primary} size={34} strokeWidth={1.8} />
                  <Text style={styles.emptyTitle}>Không có cuộc họp</Text>
                  <Text style={styles.emptyText}>Ngày này chưa có cuộc họp nào được lên lịch.</Text>
                </Card>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: "#B9E7EE", borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: spacing.md },
  hintText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  overlay: { flex: 1, justifyContent: "center", backgroundColor: colors.overlay, padding: spacing.lg },
  popup: { width: "100%", maxWidth: 560, maxHeight: "78%", alignSelf: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface, overflow: "hidden", ...shadow },
  popupHeader: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingLeft: spacing.lg, paddingRight: spacing.sm },
  headerText: { flex: 1, gap: spacing.xs },
  popupTitle: { color: colors.text, fontSize: 16, fontWeight: "900", textTransform: "capitalize" },
  popupCount: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  closeButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  meetingList: { gap: spacing.md, padding: spacing.lg },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  pressed: { opacity: 0.65 },
});
