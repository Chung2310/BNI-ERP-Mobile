import { useEffect, useMemo, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui";
import type { MeetingInteractionQuestion, MeetingInteractionResponse } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";

type CloudTerm = { key: string; text: string; count: number; firstIndex: number };
const palette = ["#0797AD", "#EF476F", "#20A464", "#EE9B00", "#7656A8", "#12A4C4", "#D45D79", "#62A744"];

function buildTerms(responses: MeetingInteractionResponse[]): CloudTerm[] {
  const terms = new Map<string, CloudTerm>();
  responses.filter((response) => response.status === "approved").forEach((response, firstIndex) => {
    const text = response.answer.trim().replace(/\s+/g, " ");
    const key = text.toLocaleLowerCase("vi");
    if (!key) return;
    const existing = terms.get(key);
    if (existing) existing.count += 1;
    else terms.set(key, { key, text, count: 1, firstIndex });
  });
  return [...terms.values()].sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex).slice(0, 60);
}

function CloudWord({ term, maxCount, index }: { term: CloudTerm; maxCount: number; index: number }) {
  const [entrance] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [entrance]);

  const size = maxCount === 1 ? 17 : 14 + 13 * Math.sqrt(term.count / maxCount);
  const label = term.text.length > 48 ? `${term.text.slice(0, 45).trimEnd()}…` : term.text;
  return <Animated.Text
    accessibilityLabel={`${term.text}, ${term.count} câu trả lời`}
    numberOfLines={2}
    style={[styles.word, {
      color: palette[index % palette.length],
      fontSize: size,
      fontWeight: term.count === maxCount ? "700" : "500",
      opacity: entrance,
      transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }],
    }]}
  >{label}</Animated.Text>;
}

function QuestionCloud({ question, responses }: { question: MeetingInteractionQuestion; responses: MeetingInteractionResponse[] }) {
  const questionResponses = useMemo(() => responses.filter((response) => response.questionId === question.id), [question.id, responses]);
  const terms = useMemo(() => buildTerms(questionResponses), [questionResponses]);
  const approvedCount = questionResponses.filter((response) => response.status === "approved").length;
  const maxCount = terms[0]?.count || 1;

  return <Card style={styles.card}>
    <View style={styles.header}>
      <Text style={styles.number}>CÂU {question.order}</Text>
      <Text style={styles.count}>{approvedCount} ý kiến đã duyệt</Text>
    </View>
    <Text style={styles.question}>{question.text}</Text>
    {terms.length ? <View style={styles.cloud}>
      {terms.map((term, index) => <CloudWord key={term.key} term={term} maxCount={maxCount} index={index} />)}
    </View> : <Text style={styles.empty}>Chờ câu trả lời được duyệt…</Text>}
  </Card>;
}

export function ResponseWordCloud({ questions, responses }: { questions: MeetingInteractionQuestion[]; responses: MeetingInteractionResponse[] }) {
  if (!questions.length) return null;
  return <View style={styles.section}>
    <Text style={styles.title}>Ý kiến đã ghi nhận</Text>
    <Text style={styles.description}>Các câu trả lời đã duyệt được hiển thị theo mức độ lặp lại.</Text>
    {questions.map((question) => <QuestionCloud key={question.id} question={question} responses={responses} />)}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: spacing.xs },
  card: { gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  number: { color: colors.primaryDark, fontSize: 11, fontWeight: "900" },
  count: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  question: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: "700" },
  cloud: { minHeight: 120, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.xs },
  word: { maxWidth: "95%", textAlign: "center", lineHeight: 30 },
  empty: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: spacing.xl },
});
