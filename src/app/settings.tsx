import { Alert } from "@/components/AppAlert";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Fingerprint } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService, type BiometricCapabilities } from "@/services/auth";
import { colors, spacing } from "@/theme/tokens";

const EMPTY_CAPABILITIES: BiometricCapabilities = { fingerprint: false, face: false };

export default function SettingsScreen() {
  const { user } = useAuth();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [capabilities, setCapabilities] = useState<BiometricCapabilities>(EMPTY_CAPABILITIES);
  const [isLoadingBiometrics, setIsLoadingBiometrics] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      authService.isBiometricEnabled(),
      authService.getBiometricCapabilities(),
    ]).then(([enabled, nextCapabilities]) => {
      if (!active) return;
      setBiometricEnabled(enabled);
      setCapabilities(nextCapabilities);
    }).catch(() => undefined).finally(() => {
      if (active) setIsLoadingBiometrics(false);
    });
    return () => { active = false; };
  }, []);

  const updateBiometric = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      if (enabled && !capabilities.fingerprint && !capabilities.face) {
        Alert.alert(
          "Chưa thể bật sinh trắc học",
          "Thiết bị chưa hỗ trợ hoặc chưa cài đặt vân tay/nhận diện khuôn mặt.",
        );
        return;
      }
      await authService.setBiometricEnabled(enabled);
      setBiometricEnabled(enabled);
    } catch (cause) {
      Alert.alert("Không thể cập nhật", friendlyErrorMessage(cause, "Không thể cập nhật xác thực sinh trắc học."));
    } finally {
      setIsSaving(false);
    }
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
      <Text style={styles.sectionLabel}>Bảo mật sinh trắc học</Text>
      <Card style={styles.row}>
        <View style={[styles.iconBox, !capabilities.fingerprint && !capabilities.face && styles.iconBoxDisabled]}>
          <Fingerprint
            color={capabilities.fingerprint || capabilities.face ? colors.primaryDark : colors.muted}
            size={22}
          />
        </View>
        <View style={styles.grow}>
          <Text style={styles.title}>Đăng nhập/check-in bằng sinh trắc học</Text>
          <Text style={styles.meta}>Tự động xác thực bằng phương thức sinh trắc học của hệ thống.</Text>
          <Text style={styles.supportedMethods}>
            Hỗ trợ trên thiết bị: {[
              capabilities.fingerprint ? "Vân tay" : null,
              capabilities.face ? "Nhận diện khuôn mặt" : null,
            ].filter(Boolean).join(", ") || "Chưa thiết lập"}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Bật đăng nhập và check-in bằng sinh trắc học"
          disabled={isSaving || isLoadingBiometrics || (!biometricEnabled && !capabilities.fingerprint && !capabilities.face)}
          onValueChange={updateBiometric}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={biometricEnabled ? colors.primary : colors.muted}
          value={biometricEnabled}
        />
      </Card>
      <Text style={styles.note}>Hệ điều hành sẽ cho phép vân tay hoặc nhận diện khuôn mặt đã đăng ký trên thiết bị.</Text>
      <Card>
        <Text style={styles.title}>Giao diện</Text>
        <Text style={styles.meta}>Chế độ sáng · Cyan và trắng</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  label: { color: colors.primaryDark, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  sectionLabel: { color: colors.primaryDark, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  iconBox: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  iconBoxDisabled: { backgroundColor: colors.background },
  title: { marginTop: spacing.xs, color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { marginTop: spacing.xs, color: colors.muted, fontSize: 12, lineHeight: 18 },
  supportedMethods: { marginTop: spacing.xs, color: colors.primaryDark, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: -spacing.xs },
});
