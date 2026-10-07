import { Alert } from "@/components/AppAlert";
import { useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import { LogOut } from "lucide-react-native";
import {  StyleSheet, Switch, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth";
import { colors, spacing } from "@/theme/tokens";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    authService.isBiometricEnabled().then(setBiometricEnabled);
  }, []);

  const updateBiometric = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      if (enabled) {
        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (!hasHardware || !isEnrolled) {
          Alert.alert("Chưa thể bật sinh trắc học", "Thiết bị chưa hỗ trợ hoặc chưa cài đặt vân tay/Face ID.");
          return;
        }
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Xác nhận bật đăng nhập sinh trắc học",
          cancelLabel: "Hủy",
          fallbackLabel: "Dùng mật mã thiết bị",
        });
        if (!result.success) return;
      }
      await authService.setBiometricEnabled(enabled);
      setBiometricEnabled(enabled);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen>
      <BackHeader title="Cài đặt" subtitle="Hồ sơ và bảo mật" compact />
      <Card>
        <Text style={styles.label}>Tài khoản</Text>
        <Text style={styles.title}>{user?.displayName || "Nguyễn Minh"}</Text>
        <Text style={styles.meta}>{user?.email || "minh@igen.vn"}</Text>
        <Text style={styles.meta}>{user?.branchName || "iGen Connect"}</Text>
      </Card>
      <Card style={styles.row}>
        <View style={styles.grow}>
          <Text style={styles.title}>Vân tay / Face ID</Text>
          <Text style={styles.meta}>Chỉ bật sau khi đã đăng nhập tài khoản thành công trên thiết bị này.</Text>
        </View>
        <Switch
          accessibilityLabel="Bật đăng nhập sinh trắc học"
          disabled={isSaving}
          onValueChange={updateBiometric}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={biometricEnabled ? colors.primary : colors.muted}
          value={biometricEnabled}
        />
      </Card>
      <Card>
        <Text style={styles.title}>Giao diện</Text>
        <Text style={styles.meta}>Chế độ sáng · Cyan và trắng</Text>
      </Card>
      <Button icon={LogOut} tone="danger" fullWidth onPress={handleSignOut}>Đăng xuất</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  label: { color: colors.primaryDark, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  title: { marginTop: spacing.xs, color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { marginTop: spacing.xs, color: colors.muted, fontSize: 12, lineHeight: 18 },
});
