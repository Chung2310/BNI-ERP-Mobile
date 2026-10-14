import * as Linking from "expo-linking";
import { ExternalLink, Gift } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Card, Screen } from "@/components/ui";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

const PUBLIC_RULES_URL = "https://erp.igentechnology.net/lucky-draw-rules";

const sections = [
  {
    title: "1. Đơn vị tổ chức và phạm vi sử dụng",
    paragraphs: [
      "Vòng quay may mắn là công cụ chọn người tham gia trong cuộc họp trên iGen Connect. Quản trị viên điều khiển vòng quay trên màn hình trình chiếu hoặc qua app.",
      "Chapter tổ chức cuộc họp là bên tài trợ và chịu trách nhiệm về quà tặng thực tế của cuộc họp đó. iGen Connect chỉ cung cấp công cụ vòng quay, không tài trợ hoặc trao quà của Chapter.",
      "Ứng dụng không bán lượt quay, không nhận tiền cược và không yêu cầu mua hàng trong ứng dụng để tham gia. Việc quay không đồng nghĩa cuộc họp có phần thưởng hiện vật.",
    ],
  },
  {
    title: "2. Người tham gia",
    paragraphs: [
      "Trước mỗi lượt quay, quản trị viên chọn bộ lọc và có thể chọn từng người. Bộ lọc gồm người có mặt, tất cả, thành viên Chapter, thành viên vắng mặt và khách mời. Chỉ những người còn trong danh sách đủ điều kiện được đưa vào lượt quay.",
      "Chapter tổ chức cần thông báo trước thời gian, điều kiện tham gia, phần thưởng và các điều kiện riêng của buổi họp. Người đã bị loại khỏi danh sách sẽ không tham gia lượt quay đó.",
    ],
  },
  {
    title: "3. Cách chọn người thắng",
    paragraphs: [
      "Máy chủ chọn ngẫu nhiên một người trong danh sách đủ điều kiện. Hoạt ảnh vòng quay trên màn hình trình chiếu thể hiện kết quả đã chọn.",
      "Kết quả được ghi vào danh sách trúng thưởng của cuộc họp. Sau mỗi lượt, quản trị viên có thể loại người thắng khỏi các lượt sau hoặc giữ họ đủ điều kiện quay tiếp. Bộ lọc và danh sách có thể được điều chỉnh trước lượt quay tiếp theo.",
    ],
  },
  {
    title: "4. Phần thưởng và xác minh",
    paragraphs: [
      "Chapter tổ chức công bố phần thưởng, số lượng, cách trao và điều kiện riêng nếu có. Ứng dụng chỉ ghi nhận kết quả vòng quay, không tự trao thưởng hoặc xác minh danh tính.",
      "Chapter tổ chức chịu trách nhiệm kiểm tra điều kiện, liên hệ người được chọn, giải quyết khiếu nại và trao phần thưởng đã công bố. Nếu cuộc họp không công bố phần thưởng, vòng quay chỉ phục vụ hoạt động trong cuộc họp.",
    ],
  },
  {
    title: "5. Apple và liên hệ",
    paragraphs: [
      "Apple Inc. không tài trợ, điều hành hoặc tham gia vòng quay hay bất kỳ phần thưởng nào. Apple không chịu trách nhiệm về việc tổ chức, chọn người thắng hoặc trao thưởng.",
      "Cần hỗ trợ về ứng dụng hoặc thể lệ: igen.work99@gmail.com. Về phần thưởng của một cuộc họp cụ thể, vui lòng liên hệ Chapter tổ chức cuộc họp đó.",
    ],
  },
];

export default function WheelRulesScreen() {
  return <Screen>
    <BackHeader title="Thể lệ vòng quay" subtitle="Vòng quay may mắn trong cuộc họp" />
    <Card style={styles.hero}>
      <View style={styles.heroHeading}>
        <View style={styles.icon}><Gift size={22} color={colors.brandBlue} /></View>
        <Text style={styles.title}>Thể lệ vòng quay may mắn</Text>
      </View>
      <Text style={styles.updated}>Cập nhật ngày 13/10/2026</Text>
      <Text style={styles.intro}>Quy định về người tham gia, cách chọn kết quả và trách nhiệm đối với phần thưởng trong cuộc họp.</Text>
    </Card>
    <Card style={styles.notice}>
      <Text style={styles.noticeText}>Apple không phải đơn vị tài trợ và không tham gia vòng quay hoặc trao thưởng dưới bất kỳ hình thức nào.</Text>
    </Card>
    {sections.map((section) => <Card key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
    </Card>)}
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PUBLIC_RULES_URL)} style={styles.publicLink}>
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
