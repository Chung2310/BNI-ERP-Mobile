import { router, type Href } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "@/components/AppAlert";
import { useAuth } from "@/context/AuthContext";
import { colors, spacing } from "@/theme/tokens";

export type PolicyDocumentSection = {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  steps?: readonly { title: string; description: string }[];
};

type Props = {
  title: string;
  intro: string;
  updatedAt: string;
  sections: readonly PolicyDocumentSection[];
  related: { label: string; href: Href };
  publicUrl?: string;
};

const SUPPORT_EMAIL = "igen.work99@gmail.com";
const sectionTitle = (title: string) => title.replace(/^\d+\.\s*/, "");

export function PolicyDocumentScreen({ title, intro, updatedAt, sections, related, publicUrl }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(token ? "/(tabs)" : "/login");
  };
  const openExternal = async (url: string, fallback: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("Không thể mở liên kết", fallback); }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.navigationBorder}>
        <View style={styles.navigation}>
          <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={goBack} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.navigationTitle}>{title}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.document}>
          <Text style={styles.updated}>Cập nhật ngày {updatedAt}</Text>
          <Text selectable style={styles.paragraph}>{intro}</Text>

          {sections.map((section, index) => (
            <View key={section.title} style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{index + 1}. {sectionTitle(section.title)}</Text>
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <Text selectable key={paragraphIndex} style={styles.paragraph}>{paragraph}</Text>
              ))}
              {section.bullets?.map((bullet, bulletIndex) => (
                <View key={bulletIndex} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text selectable style={[styles.paragraph, styles.grow]}>{bullet}</Text>
                </View>
              ))}
              {section.steps?.map((step, stepIndex) => (
                <View key={step.title} style={styles.step}>
                  <Text style={styles.stepTitle}>{stepIndex + 1}. {step.title}</Text>
                  <Text selectable style={styles.paragraph}>{step.description}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Liên hệ</Text>
            <Text selectable style={styles.paragraph}>Gửi câu hỏi về chính sách, dữ liệu cá nhân hoặc nội dung vi phạm đến địa chỉ hỗ trợ. Không gửi mật khẩu hay mã xác thực.</Text>
            <Pressable accessibilityRole="link" onPress={() => void openExternal("mailto:" + SUPPORT_EMAIL + "?subject=" + encodeURIComponent("iGen Connect - " + title), "Bạn có thể gửi email đến " + SUPPORT_EMAIL + ".")} style={styles.linkTarget}>
              <Text style={styles.link}>{SUPPORT_EMAIL}</Text>
            </Pressable>
            {publicUrl ? (
              <Pressable accessibilityRole="link" onPress={() => void openExternal(publicUrl, publicUrl)} style={styles.linkTarget}>
                <Text style={styles.link}>Xem bản trên website</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="link" onPress={() => router.push(related.href)} style={styles.linkTarget}>
              <Text style={styles.link}>{related.label}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  grow: { flex: 1 },
  navigationBorder: { borderBottomWidth: 1, borderBottomColor: "#E8EDF2" },
  navigation: { width: "100%", maxWidth: 760, alignSelf: "center", minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navigationTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  document: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
  updated: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
  section: { marginTop: spacing.md, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, lineHeight: 25, fontWeight: "700" },
  paragraph: { color: "#354F61", fontSize: 14, lineHeight: 24 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  bullet: { color: "#354F61", fontSize: 14, lineHeight: 24, width: 12 },
  step: { gap: spacing.xs },
  stepTitle: { color: colors.text, fontSize: 14, lineHeight: 24, fontWeight: "600" },
  linkTarget: { minHeight: 44, justifyContent: "center" },
  link: { color: "#0075A8", fontSize: 14, lineHeight: 22, textDecorationLine: "underline" },
});
