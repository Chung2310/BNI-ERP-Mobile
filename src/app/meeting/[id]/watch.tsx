import { AudienceStage } from "@/components/meetings/MeetingAudienceStage";
import { useCallback, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Expand } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Alert } from "@/components/AppAlert";
import { MeetingAudienceFullscreen } from "@/components/meetings/MeetingAudienceFullscreen";
import { Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useMeetingDisplay } from "@/hooks/useMeetingDisplay";
import { hasPermission } from "@/utils/permissions";
import { colors } from "@/theme/tokens";

export default function WatchMeetingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const manage = hasPermission(user, "meetings:manage", "access:manage");
  const [expanded, setExpanded] = useState(false);
  const onClosed = useCallback(() => {
    setExpanded(false);
    Alert.alert("Thông báo", "Cuộc họp chưa mở trình chiếu", [{ text: "Đóng", onPress: () => {
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/meeting/[id]", params: { id } });
    } }], { cancelable: false });
  }, [id]);
  const { data, error, retry } = useMeetingDisplay(id, !!user && !manage, onClosed);
  if (manage) return <Redirect href={{ pathname: "/meeting/[id]/live", params: { id } }} />;
  return <>
    <Screen>
      <BackHeader title="Theo dõi cuộc họp" subtitle={data?.meeting.title} action={data ? <Pressable accessibilityRole="button" accessibilityLabel="Mở trình chiếu toàn màn hình" onPress={() => setExpanded(true)} style={styles.expand}><Expand color={colors.primaryDark} size={22} /></Pressable> : undefined} />
      {error ? <Card><Text style={styles.error}>{error}</Text><Button onPress={retry}>Thử lại</Button></Card> : null}
      {!data && !error ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {data ? <><Text style={styles.connection}>{error ? "Đang kết nối lại · Nội dung lần cập nhật gần nhất" : "● Đang theo dõi trực tiếp"}</Text><AudienceStage data={data} onRefresh={retry} /></> : null}
    </Screen>
    <MeetingAudienceFullscreen data={data} visible={expanded} onClose={() => setExpanded(false)} />
  </>;
}

const styles = StyleSheet.create({ loading: { marginTop: 64 }, error: { color: colors.danger, marginBottom: 12 }, connection: { color: colors.primaryDark, fontSize: 12, marginBottom: 12 }, expand: { width: 44, height: 44, alignItems: "center", justifyContent: "center" } });
