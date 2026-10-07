import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Fingerprint, LogOut, ScanFace } from "lucide-react-native";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth";
import { colors, spacing } from "@/theme/tokens";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [loginBiometric, setLoginBiometric] = useState(false);
  const [checkInBiometric, setCheckInBiometric] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Face ID / vân tay");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      authService.isBiometricEnabled(),
      authService.isBiometricCheckInEnabled(),
      authService.biometricAvailability(),
    ]).then(([loginEnabled, checkInEnabled, availability]) => {
      setLoginBiometric(loginEnabled);
      setCheckInBiometric(checkInEnabled);
      setBiometricLabel(availability.label);
    });
  }, []);

  const updateBiometric = async (kind: "login" | "checkin", enabled: boolean) => {
    setIsSaving(true);
    try {
      if (kind === "login") {
        await authService.setBiometricEnabled(enabled);
        setLoginBiometric(enabled);
      } else {
        await authService.setBiometricCheckInEnabled(enabled);
        setCheckInBiometric(enabled);
      }
    } catch (cause) {
      Alert.alert("Không thể cập nhật", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return <Screen>
    <BackHeader title="Cài đặt" subtitle="Hồ sơ và bảo mật" />
    <Card>
      <Text style={styles.label}>Tài khoản</Text>
      <Text style={styles.title}>{user?.displayName || "Thành viên"}</Text>
      <Text style={styles.meta}>{user?.email || "Chưa cập nhật email"}</Text>
      <Text style={styles.meta}>{user?.branchName || "iGen Connect"}</Text>
    </Card>
    <Card>
      <Text style={styles.label}>Bảo mật sinh trắc học</Text>
      <View style={styles.optionRow}>
        <Fingerprint color={colors.primaryDark} size={24} />
        <View style={styles.grow}>
          <Text style={styles.title}>Đăng nhập bằng {biometricLabel}</Text>
          <Text style={styles.meta}>Mở lại phiên đăng nhập đã lưu trên thiết bị này.</Text>
        </View>
        <Switch accessibilityLabel="Bật đăng nhập sinh trắc học" disabled={isSaving} onValueChange={(value) => void updateBiometric("login", value)} trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={loginBiometric ? colors.primary : colors.muted} value={loginBiometric} />
      </View>
      <View style={styles.divider} />
      <View style={styles.optionRow}>
        <ScanFace color={colors.primaryDark} size={24} />
        <View style={styles.grow}>
          <Text style={styles.title}>Xác nhận check-in bằng {biometricLabel}</Text>
          <Text style={styles.meta}>Xác thực trước khi gửi vị trí hoặc hoàn tất check-in QR.</Text>
        </View>
        <Switch accessibilityLabel="Bật xác thực check-in sinh trắc học" disabled={isSaving} onValueChange={(value) => void updateBiometric("checkin", value)} trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={checkInBiometric ? colors.primary : colors.muted} value={checkInBiometric} />
      </View>
    </Card>
    <Card><Text style={styles.title}>Giao diện</Text><Text style={styles.meta}>Chế độ sáng · Cyan và trắng</Text></Card>
    <Button icon={LogOut} tone="danger" fullWidth onPress={handleSignOut}>Đăng xuất</Button>
  </Screen>;
}

const styles = StyleSheet.create({
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  grow: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  label: { color: colors.primaryDark, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  title: { marginTop: spacing.xs, color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { marginTop: spacing.xs, color: colors.muted, fontSize: 12, lineHeight: 18 },
});
