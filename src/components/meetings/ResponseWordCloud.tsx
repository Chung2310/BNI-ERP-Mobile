import { useEffect, useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "@/components/AppAlert";
import { MessageCircle } from "lucide-react-native";
import type { MeetingInteractionQuestion, MeetingInteractionResponse } from "@/services/meeting";
import { Badge, Card } from "@/components/ui";
import { colors, radius, spacing } from "@/theme/tokens";

type CloudTerm = { key: string; text: string; count: number; firstIndex: number };

type DisplayTerm = CloudTerm & {
  rank: number;
  fontSize: number;
  fontWeight: "900" | "800" | "700" | "600" | "500";
  color: string;
};

// Bảng màu chuẩn editorial infographic cao cấp (như hình mẫu tham khảo):
// 4 nhóm màu chủ đạo: Mận chín (Plum), Tím than/Chàm (Midnight Navy), San hô (Coral), Vàng mù tạt (Warm Gold)
const COLOR_FAMILIES = {
  plum: "#86285D",     // Mận chín đậm / Magenta quý phái
  navy: "#28214D",     // Tím than / Ink indigo sâu thẳm
  coral: "#E56754",    // San hô / Cam đào ấm
  gold: "#E8B838",     // Vàng mù tạt / Warm Honey rực rỡ
};

const COLOR_ROTATION = [
  COLOR_FAMILIES.plum,
  COLOR_FAMILIES.navy,
  COLOR_FAMILIES.coral,
  COLOR_FAMILIES.gold,
  COLOR_FAMILIES.navy,
  COLOR_FAMILIES.plum,
  COLOR_FAMILIES.gold,
  COLOR_FAMILIES.coral,
];

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
    .slice(0, 30);
}

/**
 * Thuật toán phân bổ từ khóa thành cụm đám mây (Cloud Silhouette):
 * - Hàng trên cùng (Top Cap): hẹp, gồm 1-3 từ nhỏ/vừa để tạo chóp đám mây
 * - Hàng trên giữa (Upper Mid): rộng, chứa từ khóa #2 và từ đệm
 * - Hàng TRUNG TÂM (Center Core): rộng nhất, chứa TỪ KHÓA LỚN NHẤT (#1) ở chính giữa
 * - Hàng dưới giữa (Lower Mid): rộng, chứa từ khóa #3 và từ đệm
 * - Hàng đáy (Bottom Cap): hẹp, gồm các từ nhỏ/vừa để khép đáy đám mây
 * -> Tạo thành hình elip/đám mây tự nhiên, dày dặn, các từ đan xen khít nhau không có khoảng trống thừa.
 */
function buildCloudRows(terms: DisplayTerm[]): DisplayTerm[][] {
  if (terms.length === 0) return [];
  if (terms.length <= 2) return [terms];
  if (terms.length <= 4) {
    return [
      [terms[1], terms[3]].filter(Boolean),
      [terms[0], terms[2]].filter(Boolean),
    ];
  }
  if (terms.length <= 7) {
    return [
      [terms[2], terms[5]].filter(Boolean),
      [terms[3], terms[0], terms[4]].filter(Boolean),
      [terms[1], terms[6]].filter(Boolean),
    ];
  }

  // 5 tầng hình đám mây tự nhiên
  const row0: DisplayTerm[] = [];
  const row1: DisplayTerm[] = [];
  const row2: DisplayTerm[] = [];
  const row3: DisplayTerm[] = [];
  const row4: DisplayTerm[] = [];

  // Đặt các từ khóa cốt lõi
  if (terms[0]) row2.push(terms[0]); // Từ to nhất (#1) luôn ở TRUNG TÂM đám mây
  if (terms[1]) row1.push(terms[1]); // Từ #2 ở tầng trên
  if (terms[2]) row3.push(terms[2]); // Từ #3 ở tầng dưới

  const remaining = terms.slice(3);

  remaining.forEach((term, index) => {
    const cycle = index % 8;
    switch (cycle) {
      case 0:
        row2.unshift(term); // Đệm bên trái từ trung tâm
        break;
      case 1:
        row1.push(term);
        break;
      case 2:
        row3.push(term);
        break;
      case 3:
        row0.push(term); // Đỉnh đám mây
        break;
      case 4:
        row4.push(term); // Đáy đám mây
        break;
      case 5:
        row2.push(term); // Đệm bên phải từ trung tâm
        break;
      case 6:
        row1.unshift(term);
        break;
      case 7:
        row3.unshift(term);
        break;
    }
  });

  return [row0, row1, row2, row3, row4].filter((r) => r.length > 0);
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
      friction: 7,
      tension: 45,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const limit = compact ? 18 : 28;
  const label =
    item.text.length > limit ? `${item.text.slice(0, limit - 3).trimEnd()}…` : item.text;

  const showDetail = () => {
    Alert.alert(
      `"${item.text}"`,
      `Từ khóa này đã được ${item.count} người tham dự gửi trong buổi họp.`,
      [{ text: "OK" }]
    );
  };

  return (
    <Pressable
      onPress={showDetail}
      accessibilityRole="button"
      accessibilityLabel={`${item.text}, ${item.count} lượt trả lời`}
      style={({ pressed }) => [
        styles.wordWrapper,
        pressed && styles.wordPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.wordContainer,
          {
            opacity: entrance,
            transform: [
              { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
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
              styles.countBadge,
              { backgroundColor: item.color + "18" },
              item.rank === 0 && styles.topRankCountBadge,
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                { color: item.color },
                item.rank === 0 && styles.topRankCountBadgeText,
              ]}
            >
              ×{item.count}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Chia câu hỏi thành các hàng dạng Board:
 * - 4 câu: 2 trên, 2 dưới (2-2)
 * - 3 câu: 2 trên, 1 dưới (2-1)
 * - 2 câu: 2 cột (1 hàng 2 câu)
 * - 1 câu: 1 card lớn
 * - 5 câu: 2 - 2 - 1
 * - 6 câu: 3 - 3 (hoặc 2-2-2)
 */
function groupQuestionsForBoard(questions: MeetingInteractionQuestion[]): MeetingInteractionQuestion[][] {
  const count = questions.length;
  if (count <= 1) return [questions];
  if (count === 2) return [[questions[0], questions[1]]];
  if (count === 3) {
    return [
      [questions[0], questions[1]],
      [questions[2]],
    ];
  }
  if (count === 4) {
    return [
      [questions[0], questions[1]],
      [questions[2], questions[3]],
    ];
  }
  if (count === 5) {
    return [
      [questions[0], questions[1]],
      [questions[2], questions[3]],
      [questions[4]],
    ];
  }
  if (count === 6) {
    return [
      [questions[0], questions[1], questions[2]],
      [questions[3], questions[4], questions[5]],
    ];
  }

  const rows: MeetingInteractionQuestion[][] = [];
  for (let i = 0; i < count; i += 2) {
    rows.push(questions.slice(i, i + 2));
  }
  return rows;
}

function QuestionCloud({
  question,
  responses,
  compact,
  isBoard = false,
}: {
  question: MeetingInteractionQuestion;
  responses: MeetingInteractionResponse[];
  compact: boolean;
  isBoard?: boolean;
}) {
  const questionResponses = useMemo(
    () => responses.filter((response) => response.questionId === question.id),
    [question.id, responses]
  );
  const rawTerms = useMemo(() => buildTerms(questionResponses), [questionResponses]);
  const approvedCount = questionResponses.filter((response) => response.status === "approved").length;

  // Tính toán kích thước chữ, độ đậm và màu sắc phân cấp chuẩn visual typography
  const displayTerms: DisplayTerm[] = useMemo(() => {
    return rawTerms.map((term, rank) => {
      let fontSize = compact ? 11 : 13;
      let fontWeight: "900" | "800" | "700" | "600" | "500" = "600";
      let color = COLOR_ROTATION[rank % COLOR_ROTATION.length];

      if (rank === 0) {
        // Từ khóa xuất hiện nhiều nhất: to vượt trội, đậm nhất, nằm trung tâm
        fontSize = compact ? 22 : Math.min(38, 28 + Math.sqrt(term.count) * 4);
        fontWeight = "900";
        color = COLOR_FAMILIES.plum;
      } else if (rank <= 2) {
        fontSize = compact ? 16 : Math.min(26, 20 + Math.sqrt(term.count) * 2.5);
        fontWeight = "800";
        color = rank === 1 ? COLOR_FAMILIES.navy : COLOR_FAMILIES.coral;
      } else if (rank <= 6) {
        fontSize = compact ? 13 : Math.min(20, 16 + Math.sqrt(term.count) * 1.8);
        fontWeight = "700";
      } else if (rank <= 12) {
        fontSize = compact ? 11 : 14;
        fontWeight = "600";
      } else {
        fontSize = compact ? 10 : 12;
        fontWeight = "500";
      }

      return {
        ...term,
        rank,
        fontSize,
        fontWeight,
        color,
      };
    });
  }, [rawTerms, compact]);

  const rows = useMemo(() => buildCloudRows(displayTerms), [displayTerms]);

  return (
    <Card style={[styles.card, compact && styles.compactCard, isBoard && styles.boardCard]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MessageCircle color={colors.primaryDark} size={16} />
          <Text style={styles.number}>CÂU {question.order}</Text>
        </View>
        <View style={styles.headerRightActions}>
          <Badge tone="primary">{approvedCount} Ý KIẾN</Badge>
        </View>
      </View>

      <Text
        numberOfLines={compact ? 2 : undefined}
        style={[styles.question, compact && styles.compactQuestion]}
      >
        {question.text}
      </Text>

      {rows.length ? (
        <View style={[styles.cloudWrapper, compact && styles.compactCloudWrapper, isBoard && styles.boardCloudWrapper]}>
          <View style={styles.cloudContainer}>
            {rows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={[styles.cloudRow, compact && styles.compactCloudRow]}>
                {row.map((item) => (
                  <CloudWord key={item.key} item={item} compact={compact} />
                ))}
              </View>
            ))}
          </View>
          {!compact ? (
            <Text style={styles.helperTip}>
              Từ khóa nổi bật ở giữa được nhắc nhiều nhất · Chạm vào từ để xem số lượt
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
  boardMode = false,
  darkHeader = false,
}: {
  questions: MeetingInteractionQuestion[];
  responses: MeetingInteractionResponse[];
  compact?: boolean;
  boardMode?: boolean;
  darkHeader?: boolean;
}) {
  const boardRows = useMemo(() => {
    if (!boardMode || questions.length <= 1) return null;
    return groupQuestionsForBoard(questions);
  }, [boardMode, questions]);

  if (!questions.length) return null;

  return (
    <View style={[styles.section, boardMode && styles.boardSection]}>
      {!compact && !boardMode ? (
        <View style={styles.sectionHeader}>
          <Text style={[styles.title, darkHeader && styles.darkTitle]}>Ý kiến đã ghi nhận</Text>
          <Text style={[styles.description, darkHeader && styles.darkDescription]}>
            Đám mây từ khóa được tổng hợp và làm nổi bật theo mức độ nhắc lại.
          </Text>
        </View>
      ) : darkHeader ? (
        <View style={styles.fullscreenHeaderRow}>
          <Text style={styles.darkTitle}>
            Ý KIẾN ĐÃ GHI NHẬN ({questions.length} CÂU HỎI)
          </Text>
        </View>
      ) : null}

      {boardRows ? (
        <View style={styles.boardGrid}>
          {boardRows.map((row, rowIndex) => (
            <View key={`board-row-${rowIndex}`} style={styles.boardRow}>
              {row.map((q) => (
                <View
                  key={q.id}
                  style={[
                    styles.boardCol,
                    row.length === 1 && questions.length === 3 && styles.singleCenteredCol,
                  ]}
                >
                  <QuestionCloud
                    question={q}
                    responses={responses}
                    compact={true}
                    isBoard={true}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        questions.map((question) => (
          <QuestionCloud
            key={question.id}
            question={question}
            responses={responses}
            compact={compact}
          />
        ))
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  boardSection: {
    width: "100%",
    gap: spacing.sm,
  },
  fullscreenHeaderRow: {
    paddingHorizontal: 4,
    marginBottom: spacing.xs,
    gap: 2,
  },
  darkTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  darkDescription: {
    color: "#94A3B8",
    fontSize: 12,
  },
  boardGrid: {
    width: "100%",
    gap: spacing.sm,
  },
  boardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
  },
  boardCol: {
    flex: 1,
    minWidth: 0,
  },
  singleCenteredCol: {
    flex: 0,
    width: "80%",
  },
  boardCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  boardCloudWrapper: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    marginTop: 4,
    minHeight: 100,
    backgroundColor: "#FBFBFC",
    borderColor: "#F1F5F9",
  },

  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

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

  // Khung đám mây nghệ thuật tinh tế
  cloudWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "#EAEBF0",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  compactCloudWrapper: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    marginTop: 2,
    borderRadius: radius.md,
  },

  cloudContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cloudRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 1,
  },
  compactCloudRow: {
    gap: 4,
    marginVertical: 0,
  },

  wordWrapper: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  wordPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },

  wordContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  wordText: {
    textAlign: "center",
    letterSpacing: -0.4,
  },
  topRankText: {
    letterSpacing: -0.8,
  },

  countBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topRankCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  topRankCountBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },

  helperTip: {
    color: colors.muted,
    fontSize: 10,
    textAlign: "center",
    marginTop: spacing.sm,
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
