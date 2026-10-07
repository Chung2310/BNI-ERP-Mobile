import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, X } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userService } from "@/services/users";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { UserProfile, UserRole } from "@/types";

const roles: { value: UserRole; label: string }[] = [
  { value: "user", label: "Thành viên" },
  { value: "admin", label: "Quản trị viên" },
];

export function AddAccountSheet({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (user: UserProfile) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setIndustry("");
    setRole("user");
    setPassword("");
    setShowPassword(false);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const save = async () => {
    const displayName = name.trim();
    const loginEmail = email.trim().toLowerCase();
    if (!displayName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      Alert.alert("Thông tin chưa đầy đủ", "Nhập họ tên và email đăng nhập hợp lệ.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Mật khẩu chưa hợp lệ", "Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }

    setSaving(true);
    try {
      const created = await userService.create({
        displayName,
        email: loginEmail,
        password,
        role,
        phone: phone.trim() || undefined,
        companyName: company.trim() || undefined,
        industry: industry.trim() || undefined,
      });
      reset();
      onCreated(created);
      Alert.alert("Đã tạo tài khoản", `Tài khoản ${displayName} đã được thêm.`);
    } catch (error) {
      Alert.alert("Không thể tạo tài khoản", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} accessibilityLabel="Đóng form thêm tài khoản" onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboard}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>Thêm tài khoản</Text>
                <Text style={styles.subtitle}>Thông tin đăng nhập và hồ sơ cơ bản</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={8} onPress={close} style={styles.closeButton}>
                <X color={colors.muted} size={20} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.fields}>
              <Field label="Họ và tên *" value={name} onChangeText={setName} placeholder="Nguyễn Văn A" />
              <Field label="Email đăng nhập *" value={email} onChangeText={setEmail} placeholder="email@congty.com" keyboardType="email-address" autoCapitalize="none" />
              <View style={styles.field}>
                <Text style={styles.label}>Vai trò *</Text>
                <View style={styles.roles}>
                  {roles.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: role === option.value }}
                      onPress={() => setRole(option.value)}
                      style={[styles.roleOption, role === option.value && styles.roleSelected]}
                    >
                      <Text style={[styles.roleText, role === option.value && styles.roleTextSelected]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Field label="Doanh nghiệp / công ty" value={company} onChangeText={setCompany} placeholder="Tên doanh nghiệp" />
              <Field label="Lĩnh vực hoạt động" value={industry} onChangeText={setIndustry} placeholder="Ví dụ: Công nghệ thông tin" />
              <Field label="Số điện thoại" value={phone} onChangeText={setPhone} placeholder="Số điện thoại" keyboardType="phone-pad" />
              <View style={styles.field}>
                <Text style={styles.label}>Mật khẩu khởi tạo *</Text>
                <View style={styles.passwordBox}>
                  <TextInput
                    accessibilityLabel="Mật khẩu khởi tạo"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Tối thiểu 6 ký tự"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showPassword}
                    style={styles.passwordInput}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} hitSlop={8} onPress={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff color={colors.muted} size={18} /> : <Eye color={colors.muted} size={18} />}
                  </Pressable>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" disabled={saving} onPress={close} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Hủy</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}>
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveText}>Lưu tài khoản</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field({ label, ...props }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  backdrop: { ...StyleSheet.absoluteFill },
  keyboard: { width: "100%", maxHeight: "90%" },
  sheet: { maxHeight: "100%", borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handle: { width: 36, height: 4, alignSelf: "center", borderRadius: radius.pill, backgroundColor: colors.border, marginBottom: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.md },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  subtitle: { marginTop: 2, color: colors.muted, fontSize: 11 },
  closeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  fields: { gap: spacing.md, paddingBottom: spacing.md },
  field: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 11, fontWeight: "700" },
  input: { height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 0, color: colors.text, fontSize: 13 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  roleOption: { minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  roleSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleText: { color: colors.muted, fontSize: 11 },
  roleTextSelected: { color: colors.primaryDark, fontWeight: "700" },
  passwordBox: { height: 40, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  passwordInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13, paddingVertical: 0 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, paddingTop: spacing.xs },
  cancelButton: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.lg },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  saveButton: { minHeight: touchTarget, minWidth: 120, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg },
  saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
