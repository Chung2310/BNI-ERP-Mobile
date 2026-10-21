import { useState } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Check, ChevronLeft, ImagePlus } from "lucide-react-native";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert } from "@/components/AppAlert";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService, MAX_SELF_PROFILE_IMAGE_BASE64_LENGTH } from "@/services/auth";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { chooseImageSource, pickImages, type ImageSource } from "@/utils/imageSource";

type Registration = { displayName: string; email: string; phone: string; companyName: string; industry: string; password: string };
type Field = keyof Registration;
const fields: { key: Field; label: string; placeholder: string; maxLength: number; keyboardType?: "email-address" | "phone-pad"; autoComplete?: "name" | "email" | "tel" | "new-password" }[] = [
  { key: "displayName", label: "Họ và tên", placeholder: "Nhập họ và tên", maxLength: 150, autoComplete: "name" },
  { key: "email", label: "Email", placeholder: "Nhập email", maxLength: 150, keyboardType: "email-address", autoComplete: "email" },
  { key: "phone", label: "Số điện thoại", placeholder: "Ví dụ: 0987654321", maxLength: 13, keyboardType: "phone-pad", autoComplete: "tel" },
  { key: "companyName", label: "Công ty", placeholder: "Tên công ty", maxLength: 150 },
  { key: "industry", label: "Lĩnh vực", placeholder: "Lĩnh vực hoạt động", maxLength: 150 },
  { key: "password", label: "Mật khẩu", placeholder: "Ít nhất 8 ký tự", maxLength: 128, autoComplete: "new-password" },
];
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phonePattern = /^(0|\+84|84)[35789][0-9]{8}$/;
const requiredFields: Field[] = ["displayName", "email", "password"];

export default function RegisterScreen() {
  const { activateSession } = useAuth();
  const [form, setForm] = useState<Registration>({ displayName: "", email: "", phone: "", companyName: "", industry: "", password: "" });
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/login");
  };

  const pickAvatar = async (source: ImageSource) => {
    try {
      const result = await pickImages(source, { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
      if (result.canceled || !result.assets[0]) return;
      const selected = result.assets[0];
      if (!selected.base64) return setError("Không đọc được dữ liệu ảnh đại diện. Vui lòng chọn lại.");
      if (selected.base64.length > MAX_SELF_PROFILE_IMAGE_BASE64_LENGTH) return setError("Ảnh đại diện không được vượt quá 5 MB.");
      setAvatar(selected);
      setError("");
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể chọn ảnh đại diện."));
    }
  };

  const submit = async () => {
    if (!acceptedPolicies) return setError("Vui lòng đồng ý chính sách bảo mật và quy tắc cộng đồng trước khi tạo tài khoản.");
    const data = Object.fromEntries(fields.map(({ key }) => [key, form[key].trim()])) as Registration;
    data.email = data.email.toLowerCase();
    data.password = form.password;
    for (const { key, label } of fields) {
      if (requiredFields.includes(key) && !data[key].trim()) return setError(`Vui lòng nhập ${label.toLowerCase()}.`);
    }
    if (!emailPattern.test(data.email)) return setError("Email không đúng định dạng.");
    if (data.phone && !phonePattern.test(data.phone)) return setError("Số điện thoại không đúng định dạng (ví dụ: 0987654321).");
    if (data.password.trim().length < 8) return setError("Mật khẩu phải có ít nhất 8 ký tự.");
    if (data.password.length > 128) return setError("Mật khẩu không được vượt quá 128 ký tự.");
    setSubmitting(true);
    setError("");
    try {
      await authService.register(data);
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Chưa thể tạo tài khoản. Vui lòng thử lại."));
      setSubmitting(false);
      return;
    }
    let session: Awaited<ReturnType<typeof authService.login>>;
    try {
      session = await authService.login(data.email, data.password);
    } catch {
      setError("Tài khoản đã được tạo. Vui lòng quay lại đăng nhập.");
      setSubmitting(false);
      return;
    }
    let signedInUser: UserProfile = session.user;
    let avatarError = "";
    if (avatar) {
      try {
        const photoURL = await authService.uploadSelfProfileImage(avatar.base64 || "", "avatar", avatar);
        signedInUser = { ...signedInUser, photoURL };
        await authService.cacheProfile(signedInUser);
      } catch (cause) {
        avatarError = friendlyErrorMessage(cause, "Chưa tải được ảnh đại diện. Vui lòng thử lại trong mục Cá nhân.");
      }
    }
    setSubmitting(false);
    activateSession(session.token, signedInUser);
    if (avatarError) Alert.alert("Tài khoản đã được tạo", avatarError);
  };

  const renderField = ({ key, label, placeholder, maxLength, keyboardType, autoComplete }: typeof fields[number]) => (
    <View key={key} style={styles.field}>
      <Text style={styles.label}>{label} {requiredFields.includes(key) ? <Text style={styles.required}>*</Text> : "(tùy chọn)"}</Text>
      <TextInput style={styles.input} value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
        autoCapitalize={key === "email" || key === "password" ? "none" : undefined} autoComplete={autoComplete} keyboardType={keyboardType}
        secureTextEntry={key === "password"} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={colors.muted} />
    </View>
  );

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={goBack} style={styles.backButton}>
            <ChevronLeft size={25} color={colors.text} strokeWidth={2.3} />
          </Pressable>
          <View style={styles.headingRow}>
            <Text style={styles.heading}>Đăng kí tài khoản</Text>
            <Image source={require("../../assets/images/igen-connect-transparent.png")} resizeMode="contain" style={styles.headingLogo} accessibilityLabel="iGen Connect" />
          </View>
        </View>
        <View style={styles.form}>
          {fields.map((field) => renderField(field))}
          <View style={styles.avatarField}>
            <Text style={styles.label}>Ảnh đại diện (tùy chọn)</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={avatar ? "Đổi ảnh đại diện" : "Tải ảnh đại diện lên"} onPress={() => chooseImageSource((source) => void pickAvatar(source))} style={styles.avatarPicker}>
              {avatar ? <Image source={{ uri: avatar.uri }} style={styles.avatarPreview} /> : <ImagePlus size={27} color={colors.brandBlue} strokeWidth={1.8} />}
            </Pressable>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.consentRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Đồng ý chính sách bảo mật và quy tắc cộng đồng"
              accessibilityState={{ checked: acceptedPolicies, disabled: submitting }}
              disabled={submitting}
              onPress={() => setAcceptedPolicies(current => !current)}
              style={styles.checkboxTarget}
            >
              <View style={[styles.checkbox, acceptedPolicies && styles.checkboxChecked]}>
                {acceptedPolicies ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
            <Text style={styles.consentText}>
              Tôi đồng ý với{" "}
              <Text accessibilityRole="link" style={styles.consentLink} onPress={() => router.push("/privacy-policy")}>Chính sách bảo mật</Text>
              {" và "}
              <Text accessibilityRole="link" style={styles.consentLink} onPress={() => router.push("/community-rules")}>Quy tắc cộng đồng</Text>.
            </Text>
          </View>
          <Button fullWidth disabled={submitting || !acceptedPolicies} onPress={submit} style={styles.submitButton}>{submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}</Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs, gap: spacing.xs },
  header: { height: 44, flexDirection: "row", alignItems: "center" },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headingRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  heading: { color: colors.text, fontSize: 16, fontWeight: "700" },
  headingLogo: { width: 92, height: 42 },
  form: { gap: spacing.xs },
  field: { gap: 2 },
  label: { color: colors.text, fontSize: 12, fontWeight: "600" },
  required: { color: colors.danger },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, fontSize: 14 },
  avatarField: { gap: 2, alignItems: "flex-start" },
  avatarPicker: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  avatarPreview: { width: 40, height: 40, borderRadius: radius.pill },
  error: { color: colors.danger, fontSize: 12 },
  consentRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  checkboxTarget: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkboxChecked: { borderColor: colors.brandBlue, backgroundColor: colors.brandBlue },
  consentText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 },
  consentLink: { color: "#0075A8", fontWeight: "700" },
  submitButton: { minHeight: 48 },
});
