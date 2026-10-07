import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Eye, EyeOff, Fingerprint, LogIn } from "lucide-react-native";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

export default function LoginScreen() {
  const { signIn, signInWithBiometrics } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    authService.canUseBiometricLogin().then(setCanUseBiometrics);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const submit = async () => {
    if (!identifier.trim() || password.length < 6) {
      setError("Nhập số điện thoại/email và mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await signIn(identifier.trim(), password);
      router.replace("/(tabs)");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitBiometrics = async () => {
    setSubmitting(true);
    setError("");
    try {
      await signInWithBiometrics();
      router.replace("/(tabs)");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xác thực sinh trắc học.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={styles.keyboard}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible ? styles.contentKeyboardOpen : styles.contentCentered,
          ]}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isKeyboardVisible ? (
            <View style={styles.compactHeader}>
              <View style={styles.compactLogo}>
                <Text style={styles.compactLogoText}>iG</Text>
              </View>
              <View>
                <Text style={styles.compactTitle}>iGen Connect</Text>
                <Text style={styles.compactSubtitle}>Đăng nhập tài khoản</Text>
              </View>
            </View>
          ) : (
            <View style={styles.brandHeader}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>iG</Text>
              </View>
              <Text style={styles.title}>iGen Connect</Text>
              <Text style={styles.subtitle}>Kết nối và vận hành cộng đồng hiệu quả</Text>
            </View>
          )}

          <Card style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>SỐ ĐIỆN THOẠI HOẶC EMAIL</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                placeholder="Nhập tài khoản"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                  }, 120);
                }}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>MẬT KHẨU</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  ref={passwordInputRef}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollTo({ y: 120, animated: true });
                    }, 120);
                  }}
                />
                <Pressable
                  accessibilityLabel={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff color={colors.muted} size={20} />
                  ) : (
                    <Eye color={colors.muted} size={20} />
                  )}
                </Pressable>
              </View>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Button icon={LogIn} fullWidth disabled={submitting} onPress={submit}>
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
            {canUseBiometrics ? (
              <Button icon={Fingerprint} tone="secondary" fullWidth disabled={submitting} onPress={submitBiometrics}>
                Đăng nhập bằng vân tay / Face ID
              </Button>
            ) : null}
          </Card>
          <Text style={styles.legal}>Bảo mật · Điều khoản · Hỗ trợ</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  contentCentered: {
    justifyContent: "center",
    paddingBottom: spacing.xxl,
  },
  contentKeyboardOpen: {
    justifyContent: "flex-start",
    paddingTop: spacing.xs,
    paddingBottom: 160,
  },
  brandHeader: {
    alignItems: "center",
  },
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  compactLogo: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  compactLogoText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  compactTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  compactSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  logo: {
    width: 72,
    height: 72,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    marginBottom: spacing.xs,
  },
  logoText: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center" },
  subtitle: { color: colors.muted, fontSize: 13, textAlign: "center", marginBottom: spacing.md },
  form: { gap: spacing.lg },
  fieldGroup: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: spacing.md,
  },
  passwordWrapper: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingRight: spacing.sm,
  },
  passwordInput: {
    flex: 1,
    minHeight: touchTarget,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: spacing.md,
  },
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  legal: { color: colors.muted, fontSize: 11, textAlign: "center" },
});
