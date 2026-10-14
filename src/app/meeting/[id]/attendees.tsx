import { useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Info, Search, X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { HeaderRefreshAction } from "@/components/HeaderRefreshAction";
import { Avatar, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type SlideDeck, type Speaker } from "@/services/meeting";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";

const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();
const checkInTime = (value: string) => new Date(value).toLocaleString("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
});

export default function MeetingAttendeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Speaker | null>(null);
  const [details, setDetails] = useState<{ phone?: string; company?: string; industry?: string }>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const deckCache = useRef<SlideDeck | null>(null);
  const requestId = useRef(0);
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  const speakers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return (meeting?.speakers || []).filter((speaker) => !query ||
      [speaker.name, speaker.email, speaker.company].some((value) => value?.toLocaleLowerCase("vi").includes(query)));
  }, [meeting?.speakers, search]);

  const closeDetails = () => {
    requestId.current += 1;
    setSelected(null);
  };

  const showDetails = async (speaker: Speaker) => {
    const currentRequest = ++requestId.current;
    setSelected(speaker);
    setDetails({});
    setDetailsLoading(true);
    let phone: string | undefined;
    let company = speaker.company;
    let industry = speaker.industry;
    try {
      const deck = deckCache.current || await meetingService.slides(id);
      deckCache.current = deck;
      const slide = deck.slides.find((item) => item.id === speaker.id);
      phone = slide?.phone;
      company = slide?.company || company;
      industry = slide?.industry || industry;
    } catch {
      // Keep the check-in data available if slide profiles cannot be loaded.
    }
    if (speaker.userId && (!phone || !company || !industry)) {
      try {
        const member = await userService.get(speaker.userId);
        phone ||= member.phone || member.phoneNumber;
        company ||= member.companyName || (typeof member.company === "string" ? member.company : member.company?.name);
        industry ||= member.industry;
      } catch {
        // Keep the meeting data available if the member profile cannot be loaded.
      }
    }
    if (requestId.current === currentRequest) {
      setDetails({ phone, company, industry });
      setDetailsLoading(false);
    }
  };

  const fieldValue = (value?: string) => detailsLoading ? "Đang tải…" : value?.trim() || "Chưa cập nhật";

  return <Screen>
    <BackHeader title="Danh sách check-in" subtitle={meeting ? `${meeting.speakers.length} người đã điểm danh` : undefined} compact action={<HeaderRefreshAction label="Làm mới danh sách check-in" disabled={isLoading} onPress={() => { deckCache.current = null; void reload(); }} />} />
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
              <Pressable accessibilityRole="button" accessibilityLabel={`Xem thông tin ${speaker.name}`} onPress={() => void showDetails(speaker)} style={styles.infoButton}>
                <Info size={20} color={colors.primaryDark} />
              </Pressable>
            </View>)}
          </Card>
        )}
      </>
    )}
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeDetails}>
      <View style={styles.modalOverlay}>
        <Pressable accessibilityLabel="Đóng thông tin người check-in" onPress={closeDetails} style={StyleSheet.absoluteFill} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thông tin check-in</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={closeDetails} style={styles.closeButton}><X size={20} color={colors.text} /></Pressable>
          </View>
          <Text style={styles.personType}>{selected?.userId ? "Thành viên" : "Khách mời"}</Text>
          <DetailField label="Tên" value={selected?.name || ""} />
          <DetailField label="Số điện thoại" value={fieldValue(details.phone)} />
          <DetailField label="Công ty" value={fieldValue(details.company || selected?.company)} />
          <DetailField label="Lĩnh vực" value={fieldValue(details.industry || selected?.industry)} />
          <DetailField label="Thời gian check-in" value={selected ? checkInTime(selected.checkedInAt) : ""} />
        </View>
      </View>
    </Modal>
  </Screen>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailField}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, paddingVertical: 0 },
  searchInput: { flex: 1, color: colors.text, fontSize: 13 },
  list: { paddingVertical: 0 },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: "800" },
  meta: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
  infoButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.48)", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  personType: { color: colors.primaryDark, fontSize: 13, fontWeight: "700", marginBottom: spacing.sm },
  detailField: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  detailLabel: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  detailValue: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
