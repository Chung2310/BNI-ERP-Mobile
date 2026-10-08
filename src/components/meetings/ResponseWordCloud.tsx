import { useEffect, useMemo, useState } from "react";
import { Alert, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Badge, Card } from "@/components/ui";
import type { MeetingInteractionQuestion, MeetingInteractionResponse } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

type CloudTerm = { key: string; text: string; count: number; firstIndex: number };

type DisplayTerm = CloudTerm & {
  rank: number;
  rotation: string;
  fontSize: number;
  fontWeight: "900" | "800" | "700" | "600" | "500";
  color: string;
  isVertical: boolean;
};

// Bảng màu sắc sinh động, phong phú chuẩn phong cách Wordle
const palette = [
  "#E8590C", // Cam cháy
  "#0CA678", // Xanh ngọc lục bảo
  "#1C7ED6", // Xanh dương tươi
  "#D6336C", // Đỏ hồng
  "#F59F00", // Vàng hổ phách
  "#7048E8", // Tím hoàng gia
  "#1098AD", // Xanh cyan đậm
  "#2F9E44", // Xanh lá cây
  "#AE3EC9", // Tím violet
  "#E03131", // Đỏ tươi
  "#364FC7", // Xanh chàm
  "#F08C00", // Cam vàng
  "#099268", // Xanh rêu
  "#4C6EF5", // Xanh coban
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildTerms(responses: MeetingInteractionResponse[]): CloudTerm[] {
  const terms = new Map<string, CloudTerm>();
  responses
    .filter((response) => response.status === "approved")
    .forEach((response, firstIndex) => {
      const text = response.answer.trim().replace(/\s+/g, " ");
      const key = text.toLocaleLowerCase("vi");
      if (!key) return;
      const existing = terms.get(key);
      if (existing) existing.count += 1;
      else terms.set(key, { key, text, count: 1, firstIndex });
    });
  return [...terms.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .slice(0, 45);
}

// Xác định góc xoay nghệ thuật chuẩn Wordle
function getWordRotation(text: string, rank: number, compact: boolean): { rotation: string; isVertical: boolean } {
  // Từ khóa xuất hiện nhiều nhất luôn nằm ngang ở trung tâm
  if (rank === 0) return { rotation: "0deg", isVertical: false };

  if (compact) {
    const compactAngles = ["0deg", "-10deg", "0deg", "10deg", "0deg", "-8deg", "8deg"];
    return { rotation: compactAngles[rank % compactAngles.length], isVertical: false };
  }

  const hashVal = stringHash(text) + rank * 7;
  const mod = hashVal % 9;

  // Xoay dọc 90 độ hoặc -90 độ (chỉ dành cho từ ngắn gọn)
  if (text.length <= 7 && (mod === 1 || mod === 5)) {
    return { rotation: mod === 1 ? "-90deg" : "90deg", isVertical: true };
  }

  // Xiên xéo theo các góc sinh động
  if (mod === 2) return { rotation: "-14deg", isVertical: false };
  if (mod === 3) return { rotation: "14deg", isVertical: false };
  if (mod === 4) return { rotation: "-8deg", isVertical: false };
  if (mod === 6) return { rotation: "8deg", isVertical: false };
  if (mod === 7) return { rotation: "-18deg", isVertical: false };
  if (mod === 8) return { rotation: "18deg", isVertical: false };

  return { rotation: "0deg", isVertical: false };
}

// Thuật toán sắp xếp từ trung tâm ra ngoài (Center-out order):
// Đưa từ lớn nhất và các từ quan trọng vào chính giữa cụm đám mây!
function arrangeCenterOut(items: DisplayTerm[]): DisplayTerm[] {
  if (items.length <= 2) return items;
  const left: DisplayTerm[] = [];
  const right: DisplayTerm[] = [];

  // Duyệt từ các từ nhỏ nhất về từ lớn nhất (rank 0)
  for (let i = items.length - 1; i >= 0; i--) {
    if (i % 2 === 0) {
      right.push(items[i]);
    } else {
      left.push(items[i]);
    }
  }

  // Kết hợp lại: các từ nhỏ ở rìa 2 đầu, từ to nhất nằm ngay TRUNG TÂM mảng
  return [...left.reverse(), ...right];
}

function CloudWord({
  item,
  compact,
}: {
  item: DisplayTerm;
  compact: boolean;
}) {
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const limit = compact ? 22 : 36;
  const label =
    item.text.length > limit ? `${item.text.slice(0, limit - 3).trimEnd()}…` : item.text;

  const showDetail = () => {
    Alert.alert(
      `"${item.text}"`,
      `Từ khóa này đã được ${item.count} người tham dự gửi trong buổi họp.`
    );
  };

  return (
    <Pressable
      onPress={showDetail}
      accessibilityRole="button"
      accessibilityLabel={`${item.text}, ${item.count} lượt trả lời`}
      style={[
        styles.wordWrapper,
        item.isVertical && styles.verticalWrapper,
        item.rank === 0 && styles.centerWordWrapper,
      ]}
    >
      <Animated.View
        style={[
          styles.wordContainer,
          item.rank === 0 && styles.topRankWordContainer,
          {
            opacity: entrance,
            transform: [
              { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              { rotate: item.rotation },
            ],
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.wordText,
            {
              color: item.color,
              fontSize: item.fontSize,
              fontWeight: item.fontWeight,
            },
            item.rank === 0 && styles.topRankText,
          ]}
        >
          {label}
        </Text>
        {item.count > 1 ? (
          <View
            style={[
              styles.countPill,
              { backgroundColor: item.color },
              item.rank === 0 && styles.topRankCountPill,
            ]}
          >
            <Text style={styles.countPillText}>{item.count}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function QuestionCloud({
  question,
  responses,
  compact,
}: {
  question: MeetingInteractionQuestion;
  responses: MeetingInteractionResponse[];
  compact: boolean;
}) {
  const questionResponses = useMemo(
    () => responses.filter((response) => response.questionId === question.id),
    [question.id, responses]
  );
  const rawTerms = useMemo(() => buildTerms(questionResponses), [questionResponses]);
  const approvedCount = questionResponses.filter((response) => response.status === "approved").length;
  const maxCount = rawTerms[0]?.count || 1;

  // Tính toán thuộc tính cho từng từ khóa (kích thước, độ đậm, màu sắc, góc xoay)
  const displayTerms: DisplayTerm[] = useMemo(() => {
    return rawTerms.map((term, rank) => {
      const { rotation, isVertical } = getWordRotation(term.text, rank, compact);

      let fontSize = compact ? 11 : 13;
      let fontWeight: "900" | "800" | "700" | "600" | "500" = "500";

      if (rank === 0) {
        // Từ khóa xuất hiện nhiều nhất: To đại & in cực đậm ở trung tâm
        fontSize = compact ? 22 : Math.min(38, 28 + Math.sqrt(term.count) * 4);
        fontWeight = "900";
      } else if (rank <= 2) {
        fontSize = compact ? 16 : Math.min(26, 20 + Math.sqrt(term.count) * 2.5);
        fontWeight = "800";
      } else if (rank <= 6) {
        fontSize = compact ? 13 : Math.min(20, 16 + Math.sqrt(term.count) * 1.8);
        fontWeight = "700";
      } else if (rank <= 12) {
        fontSize = compact ? 12 : 15;
        fontWeight = "600";
      } else {
        fontSize = compact ? 10 : 12;
        fontWeight = "500";
      }

      const color = palette[rank % palette.length];

      return {
        ...term,
        rank,
        rotation,
        fontSize,
        fontWeight,
        color,
        isVertical,
      };
    });
  }, [rawTerms, compact]);

  // Sắp xếp các từ theo bố cục từ tâm ra ngoài (Center-out order)
  const arrangedTerms = useMemo(() => arrangeCenterOut(displayTerms), [displayTerms]);

  return (
    <Card style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles color={colors.primaryDark} size={16} />
          <Text style={styles.number}>CÂU {question.order}</Text>
        </View>
        <Badge tone="primary">{approvedCount} Ý KIẾN ĐÃ DUYỆT</Badge>
      </View>

      <Text
        numberOfLines={compact ? 2 : undefined}
        style={[styles.question, compact && styles.compactQuestion]}
      >
        {question.text}
      </Text>

      {arrangedTerms.length ? (
        <View style={[styles.cloudWrapper, compact && styles.compactCloudWrapper]}>
          <View style={[styles.cloud, compact && styles.compactCloud]}>
            {arrangedTerms.map((item) => (
              <CloudWord key={item.key} item={item} compact={compact} />
            ))}
          </View>
          {!compact ? (
            <Text style={styles.helperTip}>
              Từ khóa nổi bật ở giữa được nhắc nhiều nhất · Chạm vào từ để xem chi tiết
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={[styles.emptyBox, compact && styles.compactEmpty]}>
          <Text style={styles.empty}>Chưa có câu trả lời nào được duyệt…</Text>
        </View>
      )}
    </Card>
  );
}

export function ResponseWordCloud({
  questions,
  responses,
  compact = false,
}: {
  questions: MeetingInteractionQuestion[];
  responses: MeetingInteractionResponse[];
  compact?: boolean;
}) {
  if (!questions.length) return null;
  return (
    <View style={styles.section}>
      {!compact ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.title}>Ý kiến đã ghi nhận</Text>
          <Text style={styles.description}>
            Đám mây từ khóa được tổng hợp và làm nổi bật theo mức độ nhắc lại.
          </Text>
        </View>
      ) : null}
      {questions.map((question) => (
        <QuestionCloud
          key={question.id}
          question={question}
          responses={responses}
          compact={compact}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionHeader: { marginBottom: 2 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },

  card: { gap: spacing.sm, padding: spacing.md },
  compactCard: { gap: 4, padding: spacing.xs },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  number: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  question: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "800" },
  compactQuestion: { fontSize: 13, lineHeight: 18 },

  // Khung đám mây nghệ thuật
  cloudWrapper: {
    backgroundColor: "#F4FAFD",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#D2EAF2",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    overflow: "hidden",
  },
  compactCloudWrapper: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
    marginTop: 2,
  },

  cloud: {
    minHeight: 180,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    alignContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  compactCloud: {
    minHeight: 80,
    maxHeight: 110,
    paddingVertical: 2,
    paddingHorizontal: 2,
    overflow: "hidden",
  },

  wordWrapper: {
    marginHorizontal: 5,
    marginVertical: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  verticalWrapper: {
    marginHorizontal: 10,
    marginVertical: 12,
  },
  centerWordWrapper: {
    marginHorizontal: 8,
    marginVertical: 6,
    zIndex: 10,
  },

  wordContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  topRankWordContainer: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  wordText: {
    textAlign: "center",
    letterSpacing: -0.3,
  },
  topRankText: {
    letterSpacing: -0.8,
    textShadowColor: "rgba(0, 0, 0, 0.08)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  countPill: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  topRankCountPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
  },
  countPillText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },

  helperTip: {
    color: colors.muted,
    fontSize: 10,
    textAlign: "center",
    marginTop: spacing.xs,
  },

  emptyBox: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  empty: { color: colors.muted, fontSize: 13, textAlign: "center" },
  compactEmpty: { minHeight: 60, paddingVertical: spacing.sm },
});
