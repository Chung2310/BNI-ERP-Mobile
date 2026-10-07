import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { Bell, Camera, MapPin, Mic, Settings, ShieldCheck } from "lucide-react-native";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAppPermissions } from "@/context/AppPermissionsContext";
import { colors, spacing } from "@/theme/tokens";

export default function PermissionsScreen() {
  const { token } = useAuth();
  const { camera, microphone, location, notifications, allGranted, isLoading, isRequesting, requestAll } = useAppPermissions();
  const requested = useRef(false);
  const blocked = (!camera.granted && !camera.canAskAgain)
    || (!microphone.granted && !microphone.canAskAgain)
    || (!location.granted && !location.canAskAgain)
    || (!notifications.granted && !notifications.canAskAgain);

  useEffect(() => {
    if (isLoading || allGranted || requested.current) return;
    requested.current = true;
    const timer = setTimeout(() => void requestAll(), 250);
    return () => clearTimeout(timer);
  }, [allGranted, isLoading, requestAll]);

  useEffect(() => {
    if (!allGranted) return;
    const timer = setTimeout(() => router.replace(token ? "/(tabs)" : "/login"), 0);
    return () => clearTimeout(timer);
  }, [allGranted, token]);

  if (isLoading) return <Screen scroll={false}><LoadingState label="Đang kiểm tra quyền ứng dụng..." /></Screen>;

  return <Screen style={styles.screen}>
    <View style={styles.hero}>
      <View style={styles.shield}><ShieldCheck color="#FFFFFF" size={36} /></View>
      <Text style={styles.title}>Quyền ứng dụng bắt buộc</Text>
      <Text style={styles.description}>iGen Connect cần Camera, Micro, Vị trí và Thông báo để vận hành đầy đủ. Bạn chỉ có thể tiếp tục khi đã cấp đủ bốn quyền.</Text>
    </View>
    <Card style={styles.permission}>
      <Camera color={camera.granted ? colors.success : colors.danger} size={26} />
      <View style={styles.grow}><Text style={styles.permissionTitle}>Camera</Text><Text style={styles.meta}>Quét mã QR check-in cuộc họp.</Text></View>
      <Badge tone={camera.granted ? "primary" : "danger"}>{camera.granted ? "ĐÃ CẤP" : "CHƯA CẤP"}</Badge>
    </Card>
    <Card style={styles.permission}>
      <Mic color={microphone.granted ? colors.success : colors.danger} size={26} />
      <View style={styles.grow}><Text style={styles.permissionTitle}>Micro và ghi âm</Text><Text style={styles.meta}>Thu âm trong các chức năng có hỗ trợ âm thanh.</Text></View>
      <Badge tone={microphone.granted ? "primary" : "danger"}>{microphone.granted ? "ĐÃ CẤP" : "CHƯA CẤP"}</Badge>
    </Card>
    <Card style={styles.permission}>
      <MapPin color={location.granted ? colors.success : colors.danger} size={26} />
      <View style={styles.grow}><Text style={styles.permissionTitle}>Vị trí</Text><Text style={styles.meta}>Kiểm tra bạn đang ở trong phạm vi cuộc họp.</Text></View>
      <Badge tone={location.granted ? "primary" : "danger"}>{location.granted ? "ĐÃ CẤP" : "CHƯA CẤP"}</Badge>
    </Card>
    <Card style={styles.permission}>
      <Bell color={notifications.granted ? colors.success : colors.danger} size={26} />
      <View style={styles.grow}><Text style={styles.permissionTitle}>Thông báo</Text><Text style={styles.meta}>Nhận nhắc lịch họp và các cập nhật quan trọng.</Text></View>
      <Badge tone={notifications.granted ? "primary" : "danger"}>{notifications.granted ? "ĐÃ CẤP" : "CHƯA CẤP"}</Badge>
    </Card>
    {blocked ? <Text style={styles.warning}>Một hoặc nhiều quyền đã bị từ chối. Hãy mở Cài đặt của thiết bị và bật lại quyền cho iGen Connect.</Text> : null}
    <Button fullWidth icon={blocked ? Settings : ShieldCheck} disabled={isRequesting} onPress={() => blocked ? void Linking.openSettings() : void requestAll()}>
      {isRequesting ? "Đang yêu cầu quyền..." : blocked ? "Mở cài đặt thiết bị" : "Cấp các quyền còn thiếu"}
    </Button>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  hero: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  shield: { width: 68, height: 68, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  title: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  permission: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  permissionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  warning: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
