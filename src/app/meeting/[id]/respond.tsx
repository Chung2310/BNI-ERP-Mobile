import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Check, CheckCircle2, Clock3, MessageCircle, Send } from "lucide-react-native";
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
  const { data, error, isLoading, reload, setData } = useAsyncData(
    () => meetingService.interaction(id),
    id
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<
    (MeetingInteractionSubmission & { sessionId: string }) | null
  >(null);
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
  const activeQuestion =
    session?.questions.find((question) => question.id === selectedQuestionId) ||
    session?.questions[0];
  const currentSubmission = submitted?.sessionId === session?.id ? submitted : null;

  const remaining =
    session?.status === "open" && session.closesAt
      ? Math.max(0, Math.ceil((Date.parse(session.closesAt) - now) / 1000))
      : 0;
  const accepting = session?.status === "open" && remaining > 0;
  const existingAnswer = (data?.allResponses || data?.responses || []).find(
    (response) => response.participantId === user?.uid
  );
  const alreadyAnswered = Boolean(existingAnswer) && !session?.allowMultipleResponses;
  const answeredCount =
    session?.questions.filter((question) => answers[question.id]?.trim()).length || 0;
  const token = session ? tokenFromUrl(session.participationUrl) : "";

  const submit = async () => {
    if (!user || !session || !accepting || !token || sendingRef.current || alreadyAnswered)
      return;
    const submittedAnswers = session.questions
      .map((question) => ({
        questionId: question.id,
        answer: answers[question.id]?.trim() || "",
      }))
      .filter(({ answer }) => answer.length > 0);
    if (!submittedAnswers.length) return;
    sendingRef.current = true;
    setSending(true);
    setSubmitError("");
    try {
      const result = await meetingService.submitInteractionAnswers(token, {
        participantId: user.uid,
        name: user.displayName?.trim() || user.email?.split("@")[0] || "Thành viên",
        answers: submittedAnswers,
      });
      if (!session.allowMultipleResponses) {
        setSubmitted({ ...result, sessionId: session.id });
      } else {
        setSubmitted(null);
      }
      // Làm trống ô nhập để thành viên tiếp tục nhập ngay lập tức
      setAnswers((current) => ({ ...current, [activeQuestion?.id || ""]: "" }));
      void reload();
    } catch (cause) {
      setSubmitError(
        friendlyErrorMessage(cause, "Không thể gửi câu trả lời. Vui lòng thử lại.")
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (isAuthLoading)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (!user) return <Redirect href="/login" />;

  return (
    <Screen style={styles.screen}>
      <BackHeader
        title="Trả lời ý kiến"
        subtitle="Khảo sát ý kiến trong cuộc họp"
        compact
      />
      {isLoading && !data ? (
        <LoadingState />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !session ? (
        <EmptyState
          title="Chưa có câu hỏi"
          message="Người điều hành chưa tạo phần thu ý kiến cho cuộc họp này."
        />
      ) : (
        <>
          {/* 1. Thanh chọn câu hỏi (tab nằm ngang gọn gàng) */}
          {session.questions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScroll}
              contentContainerStyle={styles.tabs}
            >
              {session.questions.map((question) => {
                const selected = question.id === activeQuestion?.id;
                const answered = Boolean(answers[question.id]?.trim());
                return (
                  <Pressable
                    key={question.id}
                    accessibilityRole="tab"
                    accessibilityLabel={`Câu ${question.order}: ${question.text}`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedQuestionId(question.id)}
                    style={[styles.tab, selected && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                      Câu {question.order}
                    </Text>
                    {answered ? (
                      <Check
                        color={selected ? "#FFFFFF" : colors.success}
                        size={14}
                        strokeWidth={2.5}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* 2. Thẻ câu hỏi & Khung trả lời chính (Đặt lên đầu) */}
          {activeQuestion ? (
            <Card style={styles.mainCard}>
              {/* Header thẻ: Số câu hỏi + Badge trạng thái */}
              <View style={styles.headingRow}>
                <View style={styles.questionNumberBox}>
                  <MessageCircle color={colors.primaryDark} size={16} />
                  <Text style={styles.questionNumber}>
                    CÂU HỎI {activeQuestion.order}/{session.questions.length}
                  </Text>
                </View>
                <Badge
                  tone={
                    accepting
                      ? "success"
                      : session.status === "draft"
                      ? "default"
                      : "danger"
                  }
                >
                  {accepting
                    ? "ĐANG MỞ NHẬN"
                    : session.status === "draft"
                    ? "CHƯA MỞ"
                    : "ĐÃ KẾT THÚC"}
                </Badge>
              </View>

              {/* Timer đếm ngược khi phiên đang mở */}
              {accepting ? (
                <View style={[styles.timer, remaining <= 10 && styles.timerDanger]}>
                  <Clock3
                    color={remaining <= 10 ? colors.danger : colors.primaryDark}
                    size={16}
                  />
                  <Text style={[styles.timerText, remaining <= 10 && styles.danger]}>
                    Thời gian còn lại: {remaining} giây
                  </Text>
                </View>
              ) : null}

              {/* Nội dung câu hỏi to rõ ràng */}
              <Text style={styles.questionText}>{activeQuestion.text}</Text>

              {/* Trạng thái 1: Đã gửi câu trả lời (chỉ áp dụng khi không cho phép gửi nhiều lần) */}
              {(!session.allowMultipleResponses && (currentSubmission || alreadyAnswered)) ? (
                <View style={styles.resultBox}>
                  <CheckCircle2 color={colors.success} size={34} />
                  <Text style={styles.resultTitle}>Đã gửi câu trả lời</Text>
                  <Text style={styles.resultMeta}>
                    {(currentSubmission?.status || existingAnswer?.status) === "pending"
                      ? "Câu trả lời của bạn đang chờ người điều hành duyệt."
                      : "Cảm ơn bạn đã tham gia đóng góp ý kiến!"}
                  </Text>
                </View>
              ) : !accepting ? (
                /* Trạng thái 2: Chưa mở hoặc đã kết thúc */
                <View style={styles.closedBox}>
                  <Clock3 color={colors.muted} size={26} />
                  <Text style={styles.closedTitle}>
                    {session.status === "draft"
                      ? "Chưa mở nhận câu trả lời"
                      : "Thời gian trả lời đã kết thúc"}
                  </Text>
                  <Text style={styles.closedSubtitle}>
                    {session.status === "draft"
                      ? "Vui lòng đợi người điều hành mở phiên tương tác."
                      : "Cảm ơn bạn đã theo dõi. Kết quả tổng hợp được hiển thị bên dưới."}
                  </Text>
                </View>
              ) : (
                /* Trạng thái 3: Đang mở nhận câu trả lời */
                <View style={styles.inputArea}>
                  <TextInput
                    accessibilityLabel={`Trả lời câu ${activeQuestion.order}`}
                    value={answers[activeQuestion.id] || ""}
                    onChangeText={(value) =>
                      setAnswers((current) => ({ ...current, [activeQuestion.id]: value }))
                    }
                    maxLength={200}
                    multiline
                    textAlignVertical="top"
                    placeholder="Viết câu trả lời của bạn..."
                    placeholderTextColor={colors.muted}
                    style={styles.answerInput}
                  />
                  <View style={styles.inputFooter}>
                    <Text style={styles.progress}>
                      {session.questions.length > 1
                        ? `Đã trả lời ${answeredCount}/${session.questions.length} · có thể gửi`
                        : ""}
                    </Text>
                    <Text style={styles.counter}>
                      {(answers[activeQuestion.id] || "").length}/200
                    </Text>
                  </View>

                  {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

                  <Button
                    icon={Send}
                    fullWidth
                    disabled={answeredCount === 0 || sending || !token}
                    onPress={() => void submit()}
                    style={styles.submitBtn}
                  >
                    {sending ? "Đang gửi..." : "Gửi câu trả lời"}
                  </Button>
                </View>
              )}
            </Card>
          ) : null}

          {/* 3. Kết quả tổng hợp: Đám mây từ khóa đặt ở dưới cùng */}
          {activeQuestion ? (
            <ResponseWordCloud
              questions={[activeQuestion]}
              responses={data?.allResponses || data?.responses || []}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },

  // Tabs câu hỏi nằm ngang gọn gàng
  tabScroll: {
    flexGrow: 0,
    marginBottom: spacing.xs,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  tab: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.brandBlue,
    borderColor: colors.brandBlue,
  },
  tabText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },

  // Thẻ câu hỏi chính
  mainCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  questionNumberBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  questionNumber: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  questionText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 23,
    marginTop: spacing.xs,
  },

  // Đồng hồ đếm ngược
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  timerDanger: {
    backgroundColor: "#FDECEF",
  },
  timerText: {
    color: colors.primaryDark,
    fontWeight: "800",
    fontSize: 13,
  },
  danger: {
    color: colors.danger,
  },

  // Khu vực nhập trả lời
  inputArea: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  answerInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  progress: {
    color: colors.muted,
    fontSize: 12,
    flexShrink: 1,
  },
  counter: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },

  // Kết quả sau khi gửi
  resultBox: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  retryBtn: {
    marginTop: spacing.sm,
  },

  // Thông báo khi đóng / chưa mở
  closedBox: {
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  closedTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  closedSubtitle: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
});
