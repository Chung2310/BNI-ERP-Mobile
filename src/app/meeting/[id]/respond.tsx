import { useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Check, CheckCircle2, Clock3, Send } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { ResponseWordCloud } from "@/components/meetings/ResponseWordCloud";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useLiveMeetingInteraction } from "@/hooks/useLiveMeetingInteraction";
import { meetingService, type MeetingInteractionSubmission } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

function tokenFromUrl(url: string) {
  const marker = "/meeting-interaction/";
  const start = url.indexOf(marker);
  return start < 0 ? "" : url.slice(start + marker.length).split(/[/?#]/)[0];
}

export default function MeetingResponseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data, error, isLoading, reload, setData } = useAsyncData(() => meetingService.interaction(id), id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<(MeetingInteractionSubmission & { sessionId: string }) | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now);
  const sendingRef = useRef(false);

  useLiveMeetingInteraction(id, setData);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  const session = data?.session;
  const activeQuestion = session?.questions.find((question) => question.id === selectedQuestionId) || session?.questions[0];
  const currentSubmission = submitted?.sessionId === session?.id ? submitted : null;

  const remaining = session?.status === "open" && session.closesAt
    ? Math.max(0, Math.ceil((Date.parse(session.closesAt) - now) / 1000))
    : 0;
  const accepting = session?.status === "open" && remaining > 0;
  const existingAnswer = (data?.allResponses || data?.responses || []).find((response) => response.participantId === user?.uid);
  const alreadyAnswered = Boolean(existingAnswer) && !session?.allowMultipleResponses;
  const answeredCount = session?.questions.filter((question) => answers[question.id]?.trim()).length || 0;
  const complete = Boolean(session?.questions.length && answeredCount === session.questions.length);
  const token = session ? tokenFromUrl(session.participationUrl) : "";

  const submit = async () => {
    if (!user || !session || !accepting || !complete || !token || sendingRef.current || alreadyAnswered) return;
    sendingRef.current = true;
    setSending(true);
    setSubmitError("");
    try {
      const result = await meetingService.submitInteractionAnswers(token, {
        participantId: user.uid,
        name: user.displayName?.trim() || user.email?.split("@")[0] || "Thành viên",
        answers: session.questions.map((question) => ({ questionId: question.id, answer: answers[question.id].trim() })),
      });
      setSubmitted({ ...result, sessionId: session.id });
      setAnswers({});
      void reload();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Không thể gửi câu trả lời. Vui lòng thử lại.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (isAuthLoading) return <Screen><LoadingState /></Screen>;
  if (!user) return <Redirect href="/login" />;

  return <Screen style={styles.screen}>
    <BackHeader title="Trả lời ý kiến" subtitle="Câu hỏi từ người điều hành cuộc họp" compact />
    {isLoading && !data ? <LoadingState /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : !session ? (
      <EmptyState title="Chưa có câu hỏi" message="Người điều hành chưa tạo phần thu ý kiến cho cuộc họp này." />
    ) : <>
      {session.questions.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {session.questions.map((question) => {
          const selected = question.id === activeQuestion?.id;
          const answered = Boolean(answers[question.id]?.trim());
          return <Pressable
            key={question.id}
            accessibilityRole="tab"
            accessibilityLabel={`Câu ${question.order}: ${question.text}`}
            accessibilityState={{ selected }}
            onPress={() => setSelectedQuestionId(question.id)}
            style={[styles.tab, selected && styles.tabActive]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>Câu {question.order}</Text>
            {answered ? <Check color={selected ? "#FFFFFF" : colors.success} size={15} strokeWidth={2.5} /> : null}
          </Pressable>;
        })}
      </ScrollView> : null}
      {activeQuestion ? <ResponseWordCloud questions={[activeQuestion]} responses={data?.allResponses || data?.responses || []} /> : null}
      <Card style={styles.intro}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Thu ý kiến</Text>
          <Badge tone={accepting ? "success" : "default"}>{accepting ? "ĐANG MỞ" : "CHƯA MỞ / ĐÃ ĐÓNG"}</Badge>
        </View>
        {accepting ? <View style={styles.timer}><Clock3 color={remaining <= 10 ? colors.danger : colors.primaryDark} size={17} /><Text style={[styles.timerText, remaining <= 10 && styles.danger]}>Còn {remaining} giây để trả lời</Text></View> : null}
      </Card>

      {(currentSubmission && !session.allowMultipleResponses) || alreadyAnswered ? <Card style={styles.result}>
        <CheckCircle2 color={colors.success} size={36} />
        <Text style={styles.resultTitle}>Đã gửi câu trả lời</Text>
        <Text style={styles.meta}>{(currentSubmission?.status || existingAnswer?.status) === "pending" ? "Câu trả lời đang chờ người điều hành duyệt." : "Cảm ơn bạn đã tham gia."}</Text>
      </Card> : currentSubmission && session.allowMultipleResponses ? <Card style={styles.result}>
        <CheckCircle2 color={colors.success} size={36} />
        <Text style={styles.resultTitle}>Đã gửi câu trả lời</Text>
        <Text style={styles.meta}>{currentSubmission.status === "pending" ? "Câu trả lời đang chờ người điều hành duyệt." : "Bạn có thể gửi thêm một lượt trả lời."}</Text>
        {accepting ? <Button tone="secondary" onPress={() => setSubmitted(null)}>Trả lời lượt khác</Button> : null}
      </Card> : !accepting ? <Card>
        <Text style={styles.closedText}>{session.status === "draft" ? "Người điều hành chưa mở nhận câu trả lời." : "Thời gian trả lời đã kết thúc."}</Text>
      </Card> : activeQuestion ? <>
        <Card style={styles.questionCard}>
          <Text style={styles.questionNumber}>TRẢ LỜI CÂU {activeQuestion.order}</Text>
          <Text style={styles.question}>{activeQuestion.text}</Text>
          <TextInput
            accessibilityLabel={`Trả lời câu ${activeQuestion.order}`}
            value={answers[activeQuestion.id] || ""}
            onChangeText={(value) => setAnswers((current) => ({ ...current, [activeQuestion.id]: value }))}
            maxLength={200}
            multiline
            textAlignVertical="top"
            placeholder="Viết câu trả lời của bạn..."
            placeholderTextColor={colors.muted}
            style={styles.answer}
          />
          <Text style={styles.counter}>{(answers[activeQuestion.id] || "").length}/200</Text>
        </Card>
        {session.questions.length > 1 ? <Text style={styles.progress}>Đã trả lời {answeredCount}/{session.questions.length} câu</Text> : null}
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <Button icon={Send} fullWidth disabled={!complete || sending || !token} onPress={() => void submit()}>{sending ? "Đang gửi..." : "Gửi câu trả lời"}</Button>
      </> : null}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingRight: spacing.md },
  tab: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  tabText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#FFFFFF" },
  intro: { gap: spacing.sm },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  heading: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  timer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  timerText: { color: colors.primaryDark, fontWeight: "800", fontSize: 13 },
  danger: { color: colors.danger },
  result: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  resultTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  closedText: { color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: spacing.lg },
  questionCard: { gap: spacing.sm },
  questionNumber: { color: colors.primaryDark, fontSize: 11, fontWeight: "900" },
  question: { color: colors.text, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  answer: { minHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, padding: spacing.md, color: colors.text, fontSize: 14 },
  counter: { color: colors.muted, fontSize: 11, textAlign: "right" },
  progress: { color: colors.muted, fontSize: 12, textAlign: "center" },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
