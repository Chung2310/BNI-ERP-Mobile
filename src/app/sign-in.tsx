import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { ChevronLeft, Eye, EyeOff, Fingerprint, ScanFace } from "lucide-react-native";
import {
  Image, ImageBackground, Keyboard, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { KeyboardResponsiveView } from "@/components/KeyboardResponsiveView";
import { useAuth } from "@/context/AuthContext";
import { authService, type BiometricStatus } from "@/services/auth";
import { colors, radius, spacing } from "@/theme/tokens";
import { friendlyErrorMessage } from "@/utils/userFacingError";

export default function SignInScreen() {
  const { signIn, signInWithBiometrics } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const autoBiometricAttempted = useRef(false);
  const signingIn = useRef(false);

  const submit = async () => {
    if (signingIn.current) return;
    if (!identifier.trim() || password.length < 6) {
      setError("Vui lòng nhập số điện thoại/email và mật khẩu.");
      return;
    }
    signingIn.current = true;
    setSubmitting(true);
    setError("");
    try {
      await signIn(identifier.trim(), password);
      Keyboard.dismiss();
      router.replace("/(tabs)");
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Đăng nhập thất bại. Vui lòng thử lại."));
    } finally {
      signingIn.current = false;
      setSubmitting(false);
    }
  };

  const submitBiometrics = useCallback(async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setSubmitting(true);
    setError("");
    try {
      await signInWithBiometrics();
      Keyboard.dismiss();
      router.replace("/(tabs)");
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Không thể xác thực sinh trắc học."));
    } finally {
      signingIn.current = false;
      setSubmitting(false);
    }
  }, [signInWithBiometrics]);

  useEffect(() => {
    if (autoBiometricAttempted.current) return;
    autoBiometricAttempted.current = true;
    void Promise.all([authService.canUseBiometricLogin(), authService.getBiometricStatus()])
      .then(([available, status]) => {
        setBiometricStatus(status);
        setCanUseBiometrics(available);
        if (available) void submitBiometrics();
      })
      .catch(() => setCanUseBiometrics(false));
  }, [submitBiometrics]);

  return (
    <ImageBackground source={require("../../assets/images/login-bg.png")} style={styles.background} resizeMode="cover">
      <View pointerEvents="none" style={styles.backgroundWash} />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeContainer}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            disabled={submitting}
            onPress={() => {
              Keyboard.dismiss();
              if (router.canGoBack()) router.back();
              else router.replace("/login");
            }}
            style={styles.backButton}
          >
            <ChevronLeft color={colors.text} size={26} />
          </Pressable>
        </View>
        <KeyboardResponsiveView>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.authContainer}>
              <View style={styles.header}>
                <Image source={require("../../assets/images/igen-connect-transparent.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="iGen Connect" />
                <Text style={styles.heading}>Đăng nhập</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Số điện thoại hoặc email</Text>
                  <TextInput
                    accessibilityLabel="Số điện thoại hoặc email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="Nhập số điện thoại hoặc email"
                    placeholderTextColor={colors.muted}
                    returnKeyType="next"
                    style={styles.input}
                    value={identifier}
                    editable={!submitting}
                    onChangeText={setIdentifier}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Mật khẩu</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      ref={passwordInputRef}
                      accessibilityLabel="Mật khẩu"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu"
                      placeholderTextColor={colors.muted}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      style={styles.passwordInput}
                      value={password}
                      editable={!submitting}
                      onChangeText={setPassword}
                      onSubmitEditing={() => void submit()}
                    />
                    <Pressable
                      accessibilityLabel={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      accessibilityRole="button"
                      disabled={submitting}
                      onPress={() => setShowPassword(current => !current)}
                      style={styles.eyeButton}
                    >
                      {showPassword ? <EyeOff color={colors.muted} size={20} /> : <Eye color={colors.muted} size={20} />}
                    </Pressable>
                  </View>
                </View>

                {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

                <Button fullWidth disabled={submitting} onPress={() => void submit()} style={styles.submitButton} textStyle={styles.loginButtonText}>
                  {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
                </Button>

                {canUseBiometrics ? (
                  <Button icon={biometricStatus?.supported.face ? ScanFace : Fingerprint} tone="secondary" fullWidth disabled={submitting} onPress={() => void submitBiometrics()} style={styles.biometricButton}>
                    {"Đăng nhập bằng " + (biometricStatus?.label || "sinh trắc học")}
                  </Button>
                ) : null}
              </View>

              <View style={styles.registerRow}>
                <Text style={styles.registerPrompt}>Bạn chưa có tài khoản?</Text>
                <Pressable accessibilityRole="link" disabled={submitting} onPress={() => router.push("/register")} style={styles.registerLink}>
                  <Text style={styles.registerAction}>Tạo tài khoản ngay</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardResponsiveView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  backgroundWash: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(247, 250, 251, 0.88)" },
  safeContainer: { flex: 1 },
  topBar: { paddingHorizontal: spacing.lg },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  authContainer: { width: "100%", maxWidth: 440, alignSelf: "center", gap: spacing.xl },
  header: { alignItems: "center", gap: spacing.lg, marginBottom: spacing.sm },
  logo: { width: 180, height: 80 },
  heading: { color: colors.text, fontSize: 28, fontWeight: "800" },
  form: { gap: spacing.lg },
  fieldGroup: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 13, fontWeight: "600" },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: "rgba(255, 255, 255, 0.96)", color: colors.text, fontSize: 15, paddingHorizontal: spacing.lg },
  passwordWrapper: { minHeight: 52, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: "rgba(255, 255, 255, 0.96)", paddingLeft: spacing.lg, paddingRight: spacing.xs },
  passwordInput: { flex: 1, minHeight: 52, color: colors.text, fontSize: 15 },
  eyeButton: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  submitButton: { backgroundColor: colors.brandBlue, minHeight: 52, borderRadius: radius.lg, marginTop: spacing.sm, shadowColor: colors.brandBlue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 3 },
  biometricButton: { minHeight: 48, borderRadius: radius.lg },
  loginButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  registerRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: spacing.sm },
  registerLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  registerPrompt: { color: "#40586B", fontSize: 13 },
  registerAction: { color: colors.text, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
