import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { AppHeader, Button, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { MeetingCard } from "@/components/MeetingCard";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type Meeting } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";
import { hasPermission } from "@/utils/permissions";

type Filter = "all" | Meeting["status"];
const filterLabels: [Filter, string][] = [["all", "Tất cả"], ["scheduled", "Sắp tới"], ["live", "Đang họp"], ["ended", "Đã kết thúc"]];

export default function MeetingsScreen() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>("all");
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const { data, error, isLoading, reload } = useAsyncData(() => meetingService.list(monthKey), monthKey);
  const meetings = useMemo(() => (data || []).filter((item) => filter === "all" || item.status === filter), [data, filter]);
  const changeMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  return (
    <Screen>
      <AppHeader title="Cuộc họp" subtitle="Lịch theo tháng" action={hasPermission(user, "meetings:manage") ? <Button icon={Plus} onPress={() => router.push("/meeting/create")}>Tạo</Button> : undefined} />
      <MonthCalendar date={month} eventDates={(data || []).map((item) => item.startsAt)} onPrevious={() => changeMonth(-1)} onNext={() => changeMonth(1)} />
      <View style={styles.filters}>{filterLabels.map(([value, label]) => <Text onPress={() => setFilter(value)} key={value} style={[styles.filter, filter === value && styles.filterActive, filter === value && styles.filterTextActive]}>{label}</Text>)}</View>
      <SectionTitle>{meetings.length} cuộc họp trong tháng</SectionTitle>
      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : meetings.length === 0 ? <EmptyState title="Chưa có cuộc họp" message="Không có cuộc họp phù hợp với bộ lọc trong tháng này." /> : meetings.map((meeting) => <MeetingCard key={meeting._id} meeting={meeting} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filter: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterTextActive: { color: "#FFFFFF" },
});
