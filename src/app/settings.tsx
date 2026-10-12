import { Alert } from "@/components/AppAlert";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Fingerprint, ScanFace, type LucideIcon } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService, type BiometricCapabilities, type BiometricMethod } from "@/services/auth";
import { colors, spacing } from "@/theme/tokens";

const EMPTY_CAPABILITIES: BiometricCapabilities = { fingerprint: false, face: false };

const METHOD_CONFIG: Record<BiometricMethod, { title: string; description: string; Icon: LucideIcon }> = {
  fingerprint: {
    title: "Đăng nhập/check-in bằng vân tay",
    description: "Tự động yêu cầu quét vân tay khi đăng nhập và sau khi quét QR check-in.",
    Icon: Fingerprint,
  },
  face: {
    title: "Đăng nhập/check-in bằng Face ID",
    description: "Tự động yêu cầu quét khuôn mặt khi đăng nhập và sau khi quét QR check-in.",
    Icon: ScanFace,
  },
};

export default function SettingsScreen() {
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<BiometricMethod | null>(null);
  const [capabilities, setCapabilities] = useState<BiometricCapabilities>(EMPTY_CAPABILITIES);
  const [isLoadingBiometrics, setIsLoadingBiometrics] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      authService.getBiometricMethod(),
      authService.getBiometricCapabilities(),
    ]).then(([method, nextCapabilities]) => {
      if (!active) return;
      setSelectedMethod(method);
      setCapabilities(nextCapabilities);
    }).catch(() => undefined).finally(() => {
      if (active) setIsLoadingBiometrics(false);
    });
    return () => { active = false; };
  }, []);

  const updateBiometric = async (method: BiometricMethod, enabled: boolean) => {
    setIsSaving(true);
    try {
      if (enabled && !capabilities[method]) {
        Alert.alert(
          "Chưa thể bật sinh trắc học",
          `Thiết bị chưa hỗ trợ hoặc chưa cài đặt ${method === "face" ? "Face ID" : "vân tay"}.`,
        );
        return;
      }
      const nextMethod = enabled ? method : selectedMethod === method ? null : selectedMethod;
      await authService.setBiometricMethod(nextMethod);
      setSelectedMethod(nextMethod);
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
      {(["fingerprint", "face"] as const).map((method) => {
        const { title, description, Icon } = METHOD_CONFIG[method];
        const selected = selectedMethod === method;
        const available = capabilities[method];
        return (
          <Card key={method} style={styles.row}>
            <View style={[styles.iconBox, !available && !selected && styles.iconBoxDisabled]}>
              <Icon color={available || selected ? colors.primaryDark : colors.muted} size={22} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.meta}>
                {available || selected ? description : "Thiết bị chưa hỗ trợ hoặc chưa thiết lập phương thức này."}
              </Text>
            </View>
            <Switch
              accessibilityLabel={title}
              disabled={isSaving || isLoadingBiometrics || (!available && !selected)}
              onValueChange={(enabled) => updateBiometric(method, enabled)}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={selected ? colors.primary : colors.muted}
              value={selected}
            />
          </Card>
        );
      })}
      <Text style={styles.note}>Chỉ chọn một phương thức. Cấu hình được lưu riêng trên thiết bị này.</Text>
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
  note: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: -spacing.xs },
});
