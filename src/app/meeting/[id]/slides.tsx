import { useCallback, useEffect, useMemo, useState } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { useLocalSearchParams } from "expo-router";
import { Expand, X } from "lucide-react-native";
import { Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "@/components/BackHeader";
import { HeaderRefreshAction } from "@/components/HeaderRefreshAction";
import { ProfileSlideCanvas } from "@/components/meetings/ProfileSlideCanvas";
import { Avatar, Badge, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();

export default function MeetingSlidesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: deck, error, isLoading, reload } = useAsyncData(() => meetingService.slides(id), id);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [modalSize, setModalSize] = useState({ width: screenWidth, height: screenHeight });
  const selected = deck?.slides.find((slide) => slide.id === selectedId) || deck?.slides[0];
  const previewWidth = Math.min(screenWidth - 42, 760);
  const slideWidth = Math.max(0, Math.min(modalSize.width - 16, (modalSize.height - insets.top - insets.bottom - 64) * 16 / 9));

  const nextSlide = useCallback(() => {
    const slides = deck?.slides || [];
    if (slides.length < 2) return;
    setSelectedId((current) => {
      const index = slides.findIndex((slide) => slide.id === current);
      return slides[((index < 0 ? 0 : index) + 1) % slides.length].id;
    });
  }, [deck?.slides]);

  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 16,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, gesture) => {
      if (Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) < 40) return;
      nextSlide();
    },
  }), [nextSlide]);
  const fullscreenSwipe = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, gesture) => {
      if (Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) >= 40) nextSlide();
    },
  }), [nextSlide]);

  useEffect(() => {
    if (!expanded) return;
    let disposed = false;
    let previousLock: ScreenOrientation.OrientationLock | null = null;

    const rotate = async () => {
      try {
        previousLock = await ScreenOrientation.getOrientationLockAsync();
        if (disposed) return;
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        if (disposed && previousLock !== null) await ScreenOrientation.lockAsync(previousLock);
      } catch {
        // The full-screen slide still fits when this device cannot rotate.
      }
    };

    void rotate();
    return () => {
      disposed = true;
      if (previousLock !== null) void ScreenOrientation.lockAsync(previousLock).catch(() => undefined);
    };
  }, [expanded]);

  return <Screen style={styles.screen}>
    <BackHeader title="Slide thuyết trình" subtitle={deck ? `${deck.slides.length} người trình bày` : undefined} compact action={<HeaderRefreshAction label="Làm mới slide" disabled={isLoading} onPress={() => void reload()} />} />
    {isLoading && !deck ? <LoadingState /> : error && !deck ? <ErrorState message={error} onRetry={reload} /> : !deck ? null : !deck.slides.length ? (
      <EmptyState title="Chưa có slide" message="Slide sẽ xuất hiện khi có người tham gia check-in." />
    ) : <>
      <Card style={styles.previewCard}>
        <View style={styles.previewHeading}><Text style={styles.heading}>Nội dung slide</Text><Text style={styles.counter}>{deck.slides.findIndex((slide) => slide.id === selected?.id) + 1}/{deck.slides.length}</Text></View>
        {selected ? <View {...swipe.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel={`Phóng to slide của ${selected.name}`} onPress={() => setExpanded(true)} style={styles.previewTap}>
          <ProfileSlideCanvas key={selected.id} slide={selected} width={previewWidth} />
          <View style={styles.expandHint}><Expand size={14} color={colors.primaryDark} /><Text style={styles.expandText}>Chạm để phóng to</Text></View>
        </Pressable></View> : null}
      </Card>
      <Text style={styles.listTitle}>Danh sách slide</Text>
      {deck.slides.map((slide, index) => <Pressable key={slide.id} accessibilityRole="button" accessibilityState={{ selected: slide.id === selected?.id }} onPress={() => setSelectedId(slide.id)} style={[styles.slideRow, slide.id === selected?.id && styles.selectedRow]}>
        <Badge tone="primary">{index + 1}</Badge>
        <Avatar initials={initials(slide.name)} url={slide.photoURL} size={40} />
        <View style={styles.grow}><Text style={styles.name} numberOfLines={1}>{slide.name}</Text><Text style={styles.kind}>{slide.kind === "member" ? "Thành viên" : "Khách mời"}{slide.company ? ` · ${slide.company}` : ""}</Text></View>
      </Pressable>)}
    </>}
    <Modal visible={expanded && !!selected} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setExpanded(false)}>
      <View style={styles.modal} onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        setModalSize((current) => current.width === width && current.height === height ? current : { width, height });
      }}>
        <View style={styles.slideContent}>
          {selected ? <ProfileSlideCanvas key={selected.id} slide={selected} width={slideWidth} /> : null}
          <Text style={styles.modalTitle} numberOfLines={2}>{selected?.name}</Text>
        </View>
        <View {...fullscreenSwipe.panHandlers} collapsable={false} style={styles.fullscreenGesture} />
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng slide" onPress={() => setExpanded(false)} style={[styles.close, { top: insets.top + spacing.sm }]}>
          <X color="#FFFFFF" size={24} />
        </Pressable>
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
  modal: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" },
  slideContent: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  fullscreenGesture: { ...StyleSheet.absoluteFill, zIndex: 1, backgroundColor: "transparent" },
  modalTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textAlign: "center", marginTop: spacing.sm, paddingHorizontal: spacing.md },
  close: { position: "absolute", right: spacing.sm, zIndex: 2, width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
});
