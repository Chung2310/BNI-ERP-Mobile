import * as Linking from "expo-linking";
import { ExternalLink, Users } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Card, Screen } from "@/components/ui";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { wheelSelectionGuide } from "@/data/wheel-selection";
import { Alert } from "@/components/AppAlert";

const PUBLIC_RULES_URL = "https://erp.igentechnology.net/lucky-draw-rules";

export default function WheelRulesScreen() {
  return <Screen>
    <BackHeader title="Vòng quay chọn người" subtitle="Hướng dẫn sử dụng trong cuộc họp" />
    <Card style={styles.hero}>
      <View style={styles.heroHeading}>
        <View style={styles.icon}><Users size={22} color={colors.brandBlue} /></View>
        <Text style={styles.title}>Hướng dẫn vòng quay chọn người</Text>
      </View>
      <Text style={styles.updated}>Cập nhật ngày {wheelSelectionGuide.updatedAt}</Text>
      <Text style={styles.intro}>Chọn ngẫu nhiên người phát biểu, trình bày hoặc tham gia hoạt động trong cuộc họp.</Text>
    </Card>
    {wheelSelectionGuide.sections.map((section) => <Card key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
    </Card>)}
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PUBLIC_RULES_URL).catch(() => Alert.alert("Không thể mở website", PUBLIC_RULES_URL))} style={styles.publicLink}>
      <Text style={styles.publicLinkText}>Xem bản công khai trên website</Text>
      <ExternalLink size={16} color={colors.primaryDark} />
    </Pressable>
  </Screen>;
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  heroHeading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: colors.text, fontSize: 20, fontWeight: "800" },
  updated: { color: colors.muted, fontSize: 12 },
  intro: { color: colors.text, fontSize: 13, lineHeight: 20 },
  notice: { backgroundColor: "#FFF7E8", borderColor: "#F1D49C" },
  noticeText: { color: colors.text, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  paragraph: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  publicLink: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  publicLinkText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
