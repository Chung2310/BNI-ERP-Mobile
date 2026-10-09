import { useEffect, useState } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { Minimize } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AudienceStage } from "@/components/meetings/MeetingAudienceStage";
import type { AudienceSnapshot } from "@/hooks/useMeetingDisplay";
import { spacing, touchTarget } from "@/theme/tokens";

export function MeetingAudienceFullscreen({ data, visible, onClose }: { data: AudienceSnapshot | null; visible: boolean; onClose: () => void }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: window.width, height: window.height });

  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    let previousLock: ScreenOrientation.OrientationLock | null = null;
    const rotate = async () => {
      try {
        previousLock = await ScreenOrientation.getOrientationLockAsync();
        if (disposed) return;
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        if (disposed && previousLock !== null) await ScreenOrientation.lockAsync(previousLock);
      } catch {
        // The projection stays centered in portrait when rotation is unavailable.
      }
    };
    void rotate();
    return () => {
      disposed = true;
      if (previousLock !== null) void ScreenOrientation.lockAsync(previousLock).catch(() => undefined);
    };
  }, [visible]);

  const availableWidth = Math.max(1, size.width - insets.left - insets.right - 24);
  const availableHeight = Math.max(1, size.height - insets.top - insets.bottom - 24);
  const isVideoOrSlide = data?.meeting.presentation?.view === "speaker";
  const frameWidth = isVideoOrSlide ? Math.max(1, Math.min(availableWidth, availableHeight * 16 / 9)) : availableWidth;
  const frameHeight = isVideoOrSlide ? frameWidth * 9 / 16 : availableHeight;

  return <Modal visible={visible && !!data} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <StatusBar hidden={visible} />
    <View style={styles.root} onLayout={({ nativeEvent }) => {
      const next = nativeEvent.layout;
      setSize((current) => current.width === next.width && current.height === next.height ? current : { width: next.width, height: next.height });
    }}>
      {data ? <ScrollView style={{ width: frameWidth, height: frameHeight }} contentContainerStyle={[styles.content, { width: frameWidth, minHeight: frameHeight }]} bounces={true} showsVerticalScrollIndicator={true}>
        <AudienceStage data={data} fullscreen stageWidth={frameWidth} />
      </ScrollView> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Đóng toàn màn hình" onPress={onClose} style={[styles.close, { top: insets.top + spacing.sm, right: insets.right + spacing.sm }]}>
        <Minimize color="#FFFFFF" size={22} />
      </Pressable>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B132B" },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  close: { position: "absolute", minWidth: touchTarget, minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "rgba(0,0,0,0.65)" },
});
