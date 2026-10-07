import { useState } from "react";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { Camera, RefreshCw, ScanLine } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Button, Card, Screen } from "@/components/ui";
import { authService } from "@/services/auth";
import { meetingService } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

function tokenFromQr(value: string) { const marker = "/meeting-checkin/"; const index = value.indexOf(marker); return index >= 0 ? value.slice(index + marker.length).split(/[?#]/)[0] : value.trim(); }

export default function CheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const scan = async ({ data }: BarcodeScanningResult) => {
    if (processing || success) return;
    setProcessing(true); setError("");
    try {
      const token = tokenFromQr(data);
      if (!token) throw new Error("Mã QR không hợp lệ.");
      const target = await meetingService.resolveQr(token);
      if (target.id !== id) throw new Error(`QR này dành cho cuộc họp “${target.title}”.`);
      await authService.authenticateCheckInIfEnabled();
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Cần cho phép truy cập vị trí để check-in.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await meetingService.checkIn(id, { latitude: position.coords.latitude, longitude: position.coords.longitude });
      setSuccess("Check-in thành công. Chúc bạn có một buổi họp hiệu quả!");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check-in thất bại. Vui lòng thử lại."); }
    finally { setProcessing(false); }
  };

  return <Screen><BackHeader title="QR/GPS check-in" />{!cameraPermission?.granted ? <Card style={styles.permission}><Camera color={colors.primaryDark} size={34} /><Text style={styles.title}>Cho phép sử dụng camera</Text><Text style={styles.meta}>Camera chỉ dùng để đọc mã QR check-in của đơn vị.</Text><Button icon={Camera} onPress={requestCameraPermission}>Cấp quyền camera</Button></Card> : <View style={styles.camera}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={processing || success ? undefined : scan} /><View style={styles.frame}><ScanLine color={colors.primary} size={42} strokeWidth={1.6} /></View><Text style={styles.cameraHint}>{processing ? "Đang xác minh QR và vị trí…" : "Đưa mã QR vào giữa khung"}</Text></View>}{success ? <Card style={styles.result}><Badge tone="primary">THÀNH CÔNG</Badge><Text style={styles.success}>{success}</Text></Card> : null}{error ? <Card style={styles.result}><Badge tone="danger">CHƯA THÀNH CÔNG</Badge><Text style={styles.error}>{error}</Text><Button icon={RefreshCw} tone="secondary" onPress={() => setError("")}>Thử lại</Button></Card> : null}</Screen>;
}
const styles = StyleSheet.create({ permission: { alignItems: "center", gap: spacing.md }, title: { color: colors.text, fontSize: 16, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 12, textAlign: "center" }, camera: { minHeight: 380, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: radius.xl, backgroundColor: "#102533" }, frame: { width: 230, height: 230, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.primary, borderRadius: radius.lg }, cameraHint: { position: "absolute", bottom: spacing.lg, color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, result: { alignItems: "center", gap: spacing.md }, success: { color: colors.success, fontSize: 13, textAlign: "center" }, error: { color: colors.danger, fontSize: 13, textAlign: "center" } });
