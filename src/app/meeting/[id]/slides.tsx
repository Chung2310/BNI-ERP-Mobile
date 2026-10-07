import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Expand, RefreshCw, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { ProfileSlideCanvas } from "@/components/meetings/ProfileSlideCanvas";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();

export default function MeetingSlidesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: deck, error, isLoading, reload } = useAsyncData(() => meetingService.slides(id), id);
  const { width: screenWidth } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const selected = deck?.slides.find((slide) => slide.id === selectedId) || deck?.slides[0];
  const previewWidth = Math.min(screenWidth - 42, 760);

  return <Screen style={styles.screen}>
    <BackHeader title="Slide thuyết trình" subtitle={deck ? `${deck.slides.length} người trình bày` : undefined} compact />
    {isLoading && !deck ? <LoadingState /> : error && !deck ? <ErrorState message={error} onRetry={reload} /> : !deck ? null : !deck.slides.length ? (
      <EmptyState title="Chưa có slide" message="Slide sẽ xuất hiện khi có người tham gia check-in." />
    ) : <>
      <Card style={styles.previewCard}>
        <View style={styles.previewHeading}><Text style={styles.heading}>Nội dung slide</Text><Text style={styles.counter}>{deck.slides.findIndex((slide) => slide.id === selected?.id) + 1}/{deck.slides.length}</Text></View>
        {selected ? <Pressable accessibilityRole="button" accessibilityLabel={`Phóng to slide của ${selected.name}`} onPress={() => setExpanded(true)} style={styles.previewTap}>
          <ProfileSlideCanvas key={selected.id} slide={selected} width={previewWidth} />
          <View style={styles.expandHint}><Expand size={14} color={colors.primaryDark} /><Text style={styles.expandText}>Chạm để phóng to</Text></View>
        </Pressable> : null}
      </Card>
      <Text style={styles.listTitle}>Danh sách slide</Text>
      {deck.slides.map((slide, index) => <Pressable key={slide.id} accessibilityRole="button" accessibilityState={{ selected: slide.id === selected?.id }} onPress={() => setSelectedId(slide.id)} style={[styles.slideRow, slide.id === selected?.id && styles.selectedRow]}>
        <Badge tone="primary">{index + 1}</Badge>
        <Avatar initials={initials(slide.name)} url={slide.photoURL} size={40} />
        <View style={styles.grow}><Text style={styles.name} numberOfLines={1}>{slide.name}</Text><Text style={styles.kind}>{slide.kind === "member" ? "Thành viên" : "Khách mời"}{slide.company ? ` · ${slide.company}` : ""}</Text></View>
      </Pressable>)}
    </>}
    {deck ? <Button tone="secondary" icon={RefreshCw} fullWidth onPress={reload}>Làm mới slide</Button> : null}
    <Modal visible={expanded && !!selected} animationType="slide" onRequestClose={() => setExpanded(false)}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle} numberOfLines={1}>{selected?.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng slide" onPress={() => setExpanded(false)} style={styles.close}><X color={colors.text} size={24} /></Pressable></View>
        <Text style={styles.modalHelp}>Vuốt ngang để xem toàn bộ slide.</Text>
        <ScrollView horizontal contentContainerStyle={styles.largeSlide} showsHorizontalScrollIndicator>
          {selected ? <ProfileSlideCanvas key={selected.id} slide={selected} width={Math.max(screenWidth, 1120)} /> : null}
        </ScrollView>
      </View>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  previewCard: { gap: spacing.sm, alignItems: "center" },
  previewHeading: { width: "100%", flexDirection: "row", justifyContent: "space-between" },
  heading: { color: colors.text, fontSize: 15, fontWeight: "800" },
  counter: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  previewTap: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  expandHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  expandText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  listTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginLeft: spacing.xs },
  slideRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  selectedRow: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: "800" },
  kind: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  modal: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xxl },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg },
  modalTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  modalHelp: { color: colors.muted, fontSize: 12, marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  largeSlide: { alignItems: "flex-start", paddingHorizontal: spacing.lg },
});
