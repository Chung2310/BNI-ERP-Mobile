import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { RefreshCw, Search } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();
const checkInTime = (value: string) => new Date(value).toLocaleString("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
});

export default function MeetingAttendeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const speakers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return (meeting?.speakers || []).filter((speaker) => !query ||
      [speaker.name, speaker.email, speaker.company].some((value) => value?.toLocaleLowerCase("vi").includes(query)));
  }, [meeting?.speakers, search]);

  return <Screen>
    <BackHeader title="Danh sách check-in" subtitle={meeting ? `${meeting.speakers.length} người đã điểm danh` : undefined} compact />
    {isLoading && !meeting ? <LoadingState /> : error && !meeting ? <ErrorState message={error} onRetry={reload} /> : !meeting ? null : (
      <>
        <Card style={styles.searchBox}>
          <Search color={colors.muted} size={18} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Tìm thành viên hoặc khách mời" placeholderTextColor={colors.muted} style={styles.searchInput} />
        </Card>
        {!meeting.speakers.length ? <EmptyState title="Chưa có người check-in" message="Danh sách sẽ cập nhật khi có người điểm danh." /> : !speakers.length ? <EmptyState title="Không tìm thấy người tham dự" message="Thử tìm bằng tên khác." /> : (
          <Card style={styles.list}>
            {speakers.map((speaker) => <View key={speaker.id} style={styles.row}>
              <Avatar initials={initials(speaker.name)} url={speaker.photoURL} size={42} />
              <View style={styles.grow}>
                <Text style={styles.name}>{speaker.name}</Text>
                <Text style={styles.meta}>{speaker.userId ? "Thành viên" : "Khách mời"} · Check-in {checkInTime(speaker.checkedInAt)}</Text>
                {speaker.company ? <Text style={styles.meta}>{speaker.company}</Text> : null}
              </View>
            </View>)}
          </Card>
        )}
        <Button tone="secondary" icon={RefreshCw} onPress={reload}>Làm mới danh sách</Button>
      </>
    )}
  </Screen>;
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, paddingVertical: 0 },
  searchInput: { flex: 1, color: colors.text, fontSize: 13 },
  list: { paddingVertical: 0 },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: "800" },
  meta: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
});
