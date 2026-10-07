import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Eye, EyeOff, Fingerprint, X } from "lucide-react-native";
import {
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
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
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    authService.canUseBiometricLogin().then(setCanUseBiometrics);
  }, []);

  const openSheet = () => {
    setError("");
    setIsSheetVisible(true);
  };

  const closeSheet = () => {
    Keyboard.dismiss();
    setError("");
    setIsSheetVisible(false);
  };

  const submit = async () => {
    if (!identifier.trim() || password.length < 6) {
      setError("Nhập số điện thoại/email và mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await signIn(identifier.trim(), password);
      setIsSheetVisible(false);
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
      setIsSheetVisible(false);
      router.replace("/(tabs)");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xác thực sinh trắc học.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/images/login-bg.png")}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeContainer}>
        {/* Top-left corner brand logo */}
        <View style={styles.topBar}>
          <Image
            source={require("../../assets/images/igen-connect-transparent.png")}
            style={styles.cornerLogo}
            resizeMode="contain"
          />
        </View>

        {/* Unobstructed space showcasing background artwork */}
        <View style={styles.contentSpacer} />

        {/* Footer with primary login button */}
        <View style={styles.footerContainer}>
          <Button
            fullWidth
            onPress={openSheet}
            style={styles.mainLoginButton}
            textStyle={styles.loginButtonText}
          >
            Đăng nhập
          </Button>
        </View>
      </SafeAreaView>

      {/* Bottom Sheet Modal for Login Form */}
      <Modal
        visible={isSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.backdrop}
            accessibilityLabel="Đóng khung đăng nhập"
            onPress={closeSheet}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetKeyboardAvoid}
          >
            <View style={styles.sheetCard}>
              <View style={styles.sheetHandleBar}>
                <View style={styles.sheetHandle} />
              </View>

              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <Image
                    source={require("../../assets/images/igen-connect-transparent.png")}
                    style={styles.sheetLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.sheetTitle}>Đăng nhập</Text>
                </View>
                <Pressable
                  accessibilityLabel="Đóng"
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={closeSheet}
                  style={styles.closeButton}
                >
                  <X color={colors.muted} size={20} />
                </Pressable>
              </View>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Số điện thoại hoặc email</Text>
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
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Mật khẩu</Text>
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

                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ) : null}

                <Button
                  fullWidth
                  disabled={submitting}
                  onPress={submit}
                  style={styles.submitButton}
                  textStyle={styles.loginButtonText}
                >
                  {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
                </Button>

                {canUseBiometrics ? (
                  <Button
                    icon={Fingerprint}
                    tone="secondary"
                    fullWidth
                    disabled={submitting}
                    onPress={submitBiometrics}
                    style={styles.biometricButton}
                  >
                    Đăng nhập bằng vân tay / Face ID
                  </Button>
                ) : null}

                <Text style={styles.legal}>Bảo mật · Điều khoản · Hỗ trợ</Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  safeContainer: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "android" ? spacing.md : spacing.xs,
    alignItems: "flex-start",
  },
  cornerLogo: {
    width: 110,
    height: 55,
  },
  contentSpacer: {
    flex: 1,
  },
  footerContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? spacing.sm : spacing.lg,
  },
  mainLoginButton: {
    backgroundColor: "#00BAE8",
    minHeight: 52,
    borderRadius: radius.pill,
    shadowColor: "#00BAE8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(16, 37, 51, 0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetKeyboardAvoid: {
    width: "100%",
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === "ios" ? 44 : 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetHandleBar: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sheetHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sheetLogo: {
    width: 76,
    height: 38,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    gap: 10,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
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
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: "#00BAE8",
    minHeight: 50,
    borderRadius: radius.pill,
    marginTop: 4,
    shadowColor: "#00BAE8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 4,
  },
  biometricButton: {
    minHeight: 44,
    borderRadius: radius.pill,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  legal: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
});
