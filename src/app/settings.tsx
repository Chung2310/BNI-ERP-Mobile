import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { AppState, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  Bell, ChevronRight, FileText, Fingerprint, ScanFace, Settings2,
  ShieldCheck, Trash2, Users, type LucideIcon,
} from "lucide-react-native";
import { Alert } from "@/components/AppAlert";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService, type BiometricStatus } from "@/services/auth";
import { getDevicePushPermission, registerCurrentDeviceForPush } from "@/services/pushNotifications";
import { colors, radius, spacing } from "@/theme/tokens";
import { friendlyErrorMessage } from "@/utils/userFacingError";

function SettingsRow({
  icon: Icon, title, subtitle, onPress, danger = false, disabled = false, divider = false,
}: {
  icon: LucideIcon; title: string; subtitle?: string; onPress: () => void;
  danger?: boolean; disabled?: boolean; divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, divider && styles.divider, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.iconBox, danger && styles.dangerIcon]}>
        <Icon color={danger ? colors.danger : "#0075A8"} size={21} />
      </View>
      <View style={styles.grow}>
        <Text style={[styles.rowTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight color={danger ? colors.danger : colors.muted} size={18} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user } = useAuth();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [isLoadingBiometrics, setIsLoadingBiometrics] = useState(true);
  const [biometricError, setBiometricError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingBiometrics = useRef(false);
  const biometricRevision = useRef(0);
  const [pushPermission, setPushPermission] = useState<"enabled" | "notGranted" | "unavailable" | "loading">("loading");
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const registeringPush = useRef(false);

  useEffect(() => {
    let active = true;
    const refreshPush = async () => {
      try {
        const permission = await getDevicePushPermission();
        if (active) setPushPermission(permission);
      } catch {
        if (active) setPushPermission("unavailable");
      }
    };
    const refreshBiometrics = async () => {
      // The native authentication dialog also changes AppState.
      if (savingBiometrics.current) return;
      const revision = ++biometricRevision.current;
      try {
        const [enabled, status] = await Promise.all([
          authService.isBiometricEnabled(),
          authService.getBiometricStatus(),
        ]);
        if (!active || revision !== biometricRevision.current) return;
        setBiometricEnabled(enabled);
        setBiometricStatus(status);
        setBiometricError("");
      } catch (cause) {
        if (active && revision === biometricRevision.current) {
          setBiometricStatus(null);
          setBiometricError(friendlyErrorMessage(cause, "Không đọc được trạng thái sinh trắc học. Hãy mở lại Cài đặt để thử lại."));
        }
      } finally {
        if (active && revision === biometricRevision.current) setIsLoadingBiometrics(false);
      }
    };
    const refresh = () => {
      void refreshPush();
      void refreshBiometrics();
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => { active = false; subscription.remove(); };
  }, []);

  const openPermissions = () => {
    void Linking.openSettings().catch(() => Alert.alert(
      "Không thể mở Cài đặt",
      "Bạn có thể mở Cài đặt trên thiết bị rồi chọn iGen Connect để thay đổi quyền.",
    ));
  };

  const enablePush = async () => {
    if (registeringPush.current) return;
    registeringPush.current = true;
    setIsEnablingPush(true);
    try {
      const token = await registerCurrentDeviceForPush(undefined, true);
      setPushPermission(await getDevicePushPermission());
      if (token) Alert.alert("Đã đăng ký thông báo", "Thiết bị đã đăng ký nhận thông báo mới từ iGen Connect.");
    } catch (cause) {
      Alert.alert("Không thể bật thông báo", friendlyErrorMessage(cause, "Vui lòng thử lại."));
    } finally {
      registeringPush.current = false;
      setIsEnablingPush(false);
    }
  };

  const updateBiometric = async (enabled: boolean) => {
    if (savingBiometrics.current || (enabled && !biometricStatus?.available)) return;
    savingBiometrics.current = true;
    biometricRevision.current += 1;
    setIsSaving(true);
    try {
      await authService.setBiometricEnabled(enabled);
      setBiometricEnabled(enabled);
    } catch (cause) {
      Alert.alert("Không thể cập nhật", friendlyErrorMessage(cause, "Không thể cập nhật xác thực sinh trắc học."));
    } finally {
      savingBiometrics.current = false;
      setIsSaving(false);
    }
  };

  const biometricLabel = biometricStatus?.label || "Sinh trắc học";
  const BiometricIcon = biometricStatus?.supported.face ? ScanFace : Fingerprint;
  const biometricDetail = isLoadingBiometrics ? "Đang kiểm tra thiết bị..."
    : biometricError || (biometricStatus?.unavailableReason === "expoGo"
      ? "Face ID không dùng được trong Expo Go. Hãy dùng bản iGen Connect cài riêng hoặc TestFlight để bật tính năng này."
      : biometricStatus?.unavailableReason === "unsupported"
        ? "Thiết bị này chưa hỗ trợ xác thực bằng khuôn mặt hoặc vân tay."
        : biometricStatus?.unavailableReason === "notEnrolled"
          ? "Hãy thiết lập sinh trắc học và kiểm tra quyền của iGen Connect trong Cài đặt thiết bị, sau đó quay lại đây."
          : "Dùng để đăng nhập và xác nhận check-in. Dữ liệu khuôn mặt và vân tay do thiết bị quản lý; ứng dụng không thu thập dữ liệu này.");
  const biometricState = isLoadingBiometrics ? "Đang kiểm tra..."
    : isSaving ? "Đang xác thực..."
      : biometricError ? "Không kiểm tra được thiết bị"
        : !biometricStatus?.available ? "Chưa khả dụng"
          : biometricEnabled ? "Đã bật" : "Chưa bật";
  const pushState = pushPermission === "loading" ? "Đang kiểm tra quyền..."
    : pushPermission === "enabled" ? "Đã cấp quyền thông báo"
      : pushPermission === "unavailable" ? "Cần bản ứng dụng cài trên thiết bị thật"
        : "Chưa cấp quyền thông báo";

  return (
    <Screen style={styles.screen}>
      <BackHeader title="Cài đặt" compact />

      <View style={styles.content}>
        <View style={[styles.group, styles.account]}>
          <Avatar initials={user?.displayName?.trim().slice(0, 2).toUpperCase() || "IG"} url={user?.photoURL} size={52} />
          <View style={styles.grow}>
            <Text style={styles.accountName}>{user?.displayName || "Chưa đăng nhập"}</Text>
            {user?.email ? <Text style={styles.rowSubtitle}>{user.email}</Text> : null}
            <Text style={styles.accountChapter}>{user?.branchName || "iGen Connect"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bảo mật</Text>
          <View style={styles.group}>
            <View style={styles.menuRow}>
              <View style={styles.iconBox}><BiometricIcon color="#0075A8" size={23} /></View>
              <View style={styles.grow}>
                <Text style={styles.rowTitle}>{biometricLabel}</Text>
                <Text style={styles.rowSubtitle}>{biometricState}</Text>
              </View>
              <Switch
                accessibilityLabel={"Bật " + biometricLabel + " cho đăng nhập và check-in"}
                disabled={isSaving || isLoadingBiometrics || (!biometricEnabled && !biometricStatus?.available)}
                onValueChange={(enabled) => void updateBiometric(enabled)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
                value={biometricEnabled}
              />
            </View>
            <View style={styles.detail}>
              <Text style={styles.detailText}>{biometricDetail}</Text>
            </View>
            {biometricStatus?.unavailableReason === "notEnrolled" || biometricError ? (
              <SettingsRow divider icon={Settings2} title="Mở Cài đặt thiết bị" onPress={openPermissions} />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông báo và quyền truy cập</Text>
          <View style={styles.group}>
            <SettingsRow icon={Bell} title="Thông báo" subtitle={pushState} onPress={openPermissions} />
            {user ? (
              <SettingsRow
                divider icon={Bell}
                title={isEnablingPush ? "Đang đăng ký..." : pushPermission === "enabled" ? "Đăng ký lại thông báo" : "Bật thông báo"}
                onPress={() => void enablePush()}
                disabled={isEnablingPush || pushPermission === "loading" || pushPermission === "unavailable"}
              />
            ) : null}
            <SettingsRow divider icon={Settings2} title="Quyền truy cập thiết bị" subtitle="Camera, ảnh, micro và vị trí" onPress={openPermissions} />
            <View style={styles.detail}>
              <Text style={styles.detailText}>Quyền được xin khi bạn sử dụng tính năng tương ứng. Thông báo chỉ hiển thị nội dung chung; mở ứng dụng để xem chi tiết.</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quyền riêng tư và cộng đồng</Text>
          <View style={styles.group}>
            {user ? <SettingsRow icon={ShieldCheck} title="An toàn nội dung" onPress={() => router.push("/chat-safety")} /> : null}
            <SettingsRow divider={Boolean(user)} icon={FileText} title="Chính sách bảo mật" onPress={() => router.push("/privacy-policy")} />
            <SettingsRow divider icon={Users} title="Quy tắc cộng đồng" onPress={() => router.push("/community-rules")} />
          </View>
        </View>

        {user ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quản lý tài khoản</Text>
            <View style={styles.group}>
              <SettingsRow danger icon={Trash2} title="Xóa tài khoản và dữ liệu" subtitle="Xem thông tin và xác nhận trước khi xóa" onPress={() => router.push("/delete-account")} />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  content: { width: "100%", maxWidth: 640, alignSelf: "center" },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: "#E5EDF2", overflow: "hidden" },
  account: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.lg },
  accountName: { color: colors.text, fontSize: 17, fontWeight: "700", lineHeight: 24 },
  accountChapter: { color: "#0075A8", fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  section: { marginTop: spacing.xl, gap: spacing.sm },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.5, paddingHorizontal: spacing.xs },
  menuRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  grow: { flex: 1 },
  iconBox: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "600", lineHeight: 22 },
  rowSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: spacing.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  detail: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  detailText: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  pressed: { backgroundColor: colors.background },
  disabled: { opacity: 0.5 },
  dangerIcon: { backgroundColor: "#FFF0F2" },
  dangerText: { color: colors.danger },
});
