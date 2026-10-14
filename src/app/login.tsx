import { router } from "expo-router";
import { Image, ImageBackground, Platform, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { colors, radius, spacing } from "@/theme/tokens";

export default function LoginScreen() {
  const { height } = useWindowDimensions();

  return (
    <ImageBackground source={require("../../assets/images/login-bg.png")} style={styles.background} resizeMode="cover">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeContainer}>
        <View style={styles.topBar}>
          <Image source={require("../../assets/images/igen-connect-transparent.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="iGen Connect" />
        </View>

        <View style={styles.contentSpacer} />

        <View style={[styles.actions, { paddingBottom: Math.min(96, Math.max(spacing.xxl, height * 0.08)) }]}>
          <Button fullWidth onPress={() => router.push("/sign-in")} style={styles.loginButton} textStyle={styles.loginButtonText}>Đăng nhập</Button>
          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>Bạn chưa có tài khoản?</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push("/register")} style={styles.registerLink}>
              <Text style={styles.registerAction}>Tạo tài khoản ngay</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  safeContainer: { flex: 1 },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: Platform.OS === "android" ? spacing.md : spacing.xs, alignItems: "flex-start" },
  logo: { width: 110, height: 55 },
  contentSpacer: { flex: 1 },
  actions: { width: "100%", maxWidth: 440, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  loginButton: { backgroundColor: colors.brandBlue, minHeight: 52, borderRadius: radius.pill, borderWidth: 1.5, borderColor: "#FFFFFF", shadowColor: colors.brandBlue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  loginButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  registerRow: { minHeight: 44, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  registerLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  registerPrompt: { color: "#000000", fontSize: 13 },
  registerAction: { color: colors.text, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
