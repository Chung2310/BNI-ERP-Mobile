import { friendlyErrorMessage } from "@/utils/userFacingError";
import { Alert } from "@/components/AppAlert";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  MessageCircle,
  MessageSquare,
  Play,
  Plus,
  Save,
  Settings2,
  Square,
  Trash2,
  X,
} from "lucide-react-native";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { HeaderRefreshAction } from "@/components/HeaderRefreshAction";
import { ResponseWordCloud } from "@/components/meetings/ResponseWordCloud";
import { Avatar, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { useLiveMeetingInteraction } from "@/hooks/useLiveMeetingInteraction";
import {
  meetingService,
  type MeetingInteraction,
  type MeetingInteractionInput,
  type MeetingInteractionQuestionType,
  type MeetingInteractionResponseStatus,
} from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

type Props = {
  meetingId: string;
  initial: MeetingInteraction;
  canManage: boolean;
  canControl?: boolean;
  embedded?: boolean;
  onStateChange?: (next: MeetingInteraction) => void;
};

const message = (error: unknown) => friendlyErrorMessage(error, "Vui lòng thử lại.");
const validOptions = (options: string[]) => {
  const values = options.map((option) => option.trim());
  return values.length >= 2 && values.length <= 6 && values.every((value) => value.length > 0 && value.length <= 200) && new Set(values).size === values.length;
};
const simpleInteractionSettings = {
  requireName: false,
  showNames: false,
  moderationEnabled: false,
  allowMultipleResponses: true,
} as const;

export function InteractionManager({
  meetingId,
  initial,
  canManage,
  canControl = true,
  embedded = false,
  onStateChange,
}: Props) {
  const initialQuestion = initial.session?.questions.find((item) => item.id === initial.session?.activeQuestionId);
  const [state, setState] = useState(initial);
  const onLiveUpdate = useCallback(
    (next: MeetingInteraction) => {
      setState(next);
      onStateChange?.(next);
    },
    [onStateChange]
  );
  useLiveMeetingInteraction(meetingId, onLiveUpdate);

  const [question, setQuestion] = useState(initial.session?.question || "");
  const [questionType, setQuestionType] = useState<MeetingInteractionQuestionType>(initialQuestion?.type || "text");
  const [questionOptions, setQuestionOptions] = useState<string[]>(initialQuestion?.options?.length ? initialQuestion.options : ["", ""]);
  const [duration, setDuration] = useState(String(initial.session?.durationSeconds || 60));
  const [showSettings, setShowSettings] = useState(false);
  const [previewQuestionId, setPreviewQuestionId] = useState(
    initial.session?.activeQuestionId || initial.session?.questions[0]?.id || ""
  );
  const [adding, setAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<MeetingInteractionQuestionType>("text");
  const [newQuestionOptions, setNewQuestionOptions] = useState(["", ""]);
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | MeetingInteractionResponseStatus>("all");

  useEffect(() => {
    if (state.session?.status !== "open") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.session?.status]);

  const apply = (next: MeetingInteraction) => {
    setState(next);
    onStateChange?.(next);
    if (!next.session) return;
    setQuestion(next.session.question);
    const activeQuestion = next.session.questions.find((item) => item.id === next.session?.activeQuestionId);
    setQuestionType(activeQuestion?.type || "text");
    setQuestionOptions(activeQuestion?.options?.length ? activeQuestion.options : ["", ""]);
    setDuration(String(next.session.durationSeconds));
  };

  const run = async (key: string, task: () => Promise<MeetingInteraction>) => {
    setBusy(key);
    try {
      apply(await task());
    } catch (error) {
      Alert.alert("Không thể cập nhật", message(error));
    } finally {
      setBusy("");
    }
  };

  const formData = (): MeetingInteractionInput | null => {
    const seconds = Number(duration);
    if (!question.trim()) {
      Alert.alert("Thiếu câu hỏi", "Vui lòng nhập nội dung câu hỏi.");
      return null;
    }
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) {
      Alert.alert("Thời gian không hợp lệ", "Thời gian phải từ 1 đến 3600 giây.");
      return null;
    }
    if (questionType === "single_choice" && !validOptions(questionOptions)) {
      Alert.alert("Lựa chọn không hợp lệ", "Trắc nghiệm cần 2–6 lựa chọn khác nhau, mỗi lựa chọn có nội dung.");
      return null;
    }
    return {
      question: question.trim(),
      type: questionType,
      ...(questionType === "single_choice" ? { options: questionOptions.map((option) => option.trim()) } : {}),
      durationSeconds: seconds,
      ...simpleInteractionSettings,
    };
  };

  const save = () => {
    const input = formData();
    if (!input) return;
    const activeQuestion = state.session?.questions.find((item) => item.id === state.session?.activeQuestionId);
    const nextOptions = input.type === "single_choice" ? input.options || [] : [];
    const changesAnsweredQuestion = activeQuestion && activeQuestion.responseCount > 0 && (
      activeQuestion.text !== input.question ||
      (activeQuestion.type || "text") !== (input.type || "text") ||
      JSON.stringify(activeQuestion.options || []) !== JSON.stringify(nextOptions)
    );
    if (changesAnsweredQuestion) {
      Alert.alert(
        "Thay đổi câu hỏi?",
        "Các phản hồi đã gửi cho câu hỏi này sẽ bị xóa khi lưu nội dung hoặc đáp án mới.",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Lưu và xóa phản hồi", style: "destructive", onPress: () => void run("save", () => meetingService.saveInteraction(meetingId, input)) },
        ]
      );
      return;
    }
    void run("save", () => meetingService.saveInteraction(meetingId, input));
  };

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    if (newQuestionType === "single_choice" && !validOptions(newQuestionOptions)) {
      Alert.alert("Lựa chọn không hợp lệ", "Trắc nghiệm cần 2–6 lựa chọn khác nhau, mỗi lựa chọn có nội dung.");
      return;
    }
    void run("add", async () => {
      const next = await meetingService.addInteractionQuestion(meetingId, {
        question: newQuestion.trim(),
        type: newQuestionType,
        ...(newQuestionType === "single_choice" ? { options: newQuestionOptions.map((option) => option.trim()) } : {}),
      });
      setNewQuestion("");
      setNewQuestionType("text");
      setNewQuestionOptions(["", ""]);
      setAdding(false);
      return next;
    });
  };

  const removeQuestion = (id: string, text: string) =>
    Alert.alert(
      "Xóa câu hỏi?",
      `“${text}” và toàn bộ câu trả lời của câu này sẽ bị xóa khỏi hệ thống.`,
      [
        { text: "Giữ lại", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => void run("delete", () => meetingService.deleteInteractionQuestion(meetingId, id)),
        },
      ]
    );

  const remaining =
    state.session?.status === "open" && state.session.closesAt && now !== null
      ? Math.max(0, Math.ceil((Date.parse(state.session.closesAt) - now) / 1000))
      : state.session?.durationSeconds || 0;

  const locked = !canManage || state.session?.status === "open";
  const labels: Record<MeetingInteractionResponseStatus, string> = {
    pending: "Chờ duyệt",
    approved: "Đang hiển thị",
    hidden: "Đã ẩn",
    rejected: "Đã từ chối",
  };

  const responses = useMemo(
    () => [...(state.allResponses || state.responses)].reverse(),
    [state.allResponses, state.responses]
  );

  const filteredResponses = useMemo(() => {
    if (filterStatus === "all") return responses;
    return responses.filter((item) => item.status === filterStatus);
  }, [responses, filterStatus]);

  const previewQuestion =
    state.session?.questions.find((item) => item.id === previewQuestionId) || state.session?.questions[0];

  const Container = embedded ? View : Screen;

  return (
    <Container style={embedded ? s.embedded : undefined}>
      {!embedded ? (
        <BackHeader
          title="Thu ý kiến"
          subtitle="Câu hỏi & thảo luận trực tiếp"
          compact
          action={
            <HeaderRefreshAction
              label="Làm mới ý kiến"
              disabled={Boolean(busy)}
              onPress={() =>
                void meetingService
                  .interaction(meetingId)
                  .then(setState)
                  .catch((error) => Alert.alert("Không thể làm mới", message(error)))
              }
            />
          }
        />
      ) : null}

      {!embedded && state.session ? (
        <>
          {state.session.questions.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.previewTabs}>
              {state.session.questions.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: item.id === previewQuestion?.id }}
                  onPress={() => setPreviewQuestionId(item.id)}
                  style={[s.previewTab, item.id === previewQuestion?.id && s.previewTabActive]}
                >
                  <Text style={[s.previewTabText, item.id === previewQuestion?.id && s.previewTabTextActive]}>
                    Câu {item.order}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {previewQuestion ? (
            <ResponseWordCloud questions={[previewQuestion]} responses={state.allResponses || state.responses} />
          ) : null}
        </>
      ) : null}

      {/* CARD 1: CÂU HỎI TƯƠNG TÁC */}
      <Card style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.row}>
            <View style={s.iconBox}>
              <MessageCircle color={colors.primaryDark} size={18} />
            </View>
            <View style={s.cardHeaderText}>
              <Text style={s.heading}>Câu hỏi tương tác</Text>
              <Text style={s.metaSubtitle}>Khảo sát và thu thập ý kiến người tham dự</Text>
            </View>
          </View>
          {state.session ? (
            <Badge style={s.cardHeaderBadge} tone={state.session.status === "open" ? "primary" : state.session.status === "closed" ? "danger" : "default"}>
              {state.session.status === "open" ? "ĐANG MỞ" : state.session.status === "closed" ? "ĐÃ ĐÓNG" : "BẢN NHÁP"}
            </Badge>
          ) : null}
        </View>

        {/* Danh sách câu hỏi */}
        {state.session ? (
          <View style={s.listWrapper}>
            <View style={s.between}>
              <Text style={s.sectionSubtitle}>Danh sách câu hỏi</Text>
              <Text style={s.countBadge}>{state.session.questions.length}/20 câu</Text>
            </View>
            <View style={s.questionList}>
              {state.session.questions.map((item) => {
                const active = item.id === state.session?.activeQuestionId;
                return (
                  <View key={item.id} style={[s.questionItem, active && s.questionItemActive]}>
                    <Pressable
                      disabled={!canManage || !canControl || Boolean(busy)}
                      onPress={() =>
                        !active &&
                        void run("select", () => meetingService.selectInteractionQuestion(meetingId, item.id))
                      }
                      style={s.questionPress}
                    >
                      <View style={[s.orderBadge, active && s.orderBadgeActive]}>
                        <Text style={[s.orderBadgeText, active && s.orderBadgeTextActive]}>{item.order}</Text>
                      </View>
                      <View style={s.grow}>
                        <Text numberOfLines={2} style={[s.questionText, active && s.questionTextActive]}>
                          {item.text}
                        </Text>
                        <View style={s.itemMetaRow}>
                          <Text style={s.meta}>{item.type === "single_choice" ? "Trắc nghiệm" : "Tự luận"}</Text>
                          <Text style={s.meta}>·</Text>
                          <Text style={s.meta}>{item.responseCount} phản hồi</Text>
                          {active ? (
                            <View style={s.activeChip}>
                              <Text style={s.activeChipText}>Đang chọn</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {!active ? <ChevronRight color={colors.muted} size={18} /> : null}
                    </Pressable>
                    {canManage && state.session!.status !== "open" && state.session!.questions.length > 1 ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() => removeQuestion(item.id, item.text)}
                        style={s.deleteBtn}
                      >
                        <Trash2 color={colors.danger} size={17} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Ô soạn nội dung câu hỏi */}
        <View style={s.editorBox}>
          <View style={s.between}>
            <Text style={s.fieldLabel}>
              {state.session
                ? `Nội dung câu hỏi ${state.session.questionNumber}/${state.session.totalQuestions}`
                : "Nội dung câu hỏi đầu tiên"}
            </Text>
            <Text style={s.counter}>{question.length}/300</Text>
          </View>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            editable={!locked}
            maxLength={300}
            multiline
            placeholder="Ví dụ: Điều giá trị nhất bạn nhận được từ buổi họp hôm nay là gì?"
            placeholderTextColor={colors.muted}
            style={[s.input, s.textarea, locked && s.disabled]}
          />
          <QuestionOptionsEditor
            type={questionType}
            options={questionOptions}
            disabled={locked}
            onTypeChange={setQuestionType}
            onOptionsChange={setQuestionOptions}
          />
        </View>

        {/* Cấu hình bài tương tác (Accordion) */}
        <Pressable
          disabled={locked}
          onPress={() => setShowSettings((v) => !v)}
          style={[s.settingsCard, showSettings && s.settingsCardOpen]}
        >
          <View style={s.settingsIconWrap}>
            <Settings2 color={colors.primaryDark} size={18} />
          </View>
          <View style={s.grow}>
            <Text style={s.settingsTitle}>Cấu hình bài tương tác</Text>
            <Text style={s.meta}>
              {duration || 0} giây
            </Text>
          </View>
          <ChevronDown
            color={colors.muted}
            size={18}
            style={showSettings ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </Pressable>

        {showSettings ? (
          <View style={s.settingsPanel}>
            <View style={s.settingField}>
              <Text style={s.label}>Thời gian nhận câu trả lời (giây)</Text>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="60"
                style={s.input}
              />
            </View>
          </View>
        ) : null}

        {/* Đồng hồ đếm ngược khi phiên đang mở */}
        {state.session?.status === "open" ? (
          <View style={[s.timer, remaining <= 10 && s.timerDanger]}>
            <Clock3 color={remaining <= 10 ? colors.danger : colors.primaryDark} size={18} />
            <Text style={[s.timerText, remaining <= 10 && { color: colors.danger }]}>
              Đang mở nhận · Tự động đóng sau {remaining} giây
            </Text>
          </View>
        ) : null}

        {/* Cụm nút hành động */}
        {canManage ? (
          <View style={s.actionGroup}>
            {!state.session ? (
              <Button fullWidth disabled={Boolean(busy)} onPress={save}>
                Tạo phiên tương tác
              </Button>
            ) : null}

            {canControl && state.session && state.session.status !== "open" ? (
              <Button
                icon={Play}
                fullWidth
                disabled={Boolean(busy)}
                onPress={() => void run("open", () => meetingService.setInteractionStatus(meetingId, "open"))}
              >
                Mở nhận câu trả lời
              </Button>
            ) : null}

            {canControl && state.session?.status === "open" ? (
              <Button
                tone="danger"
                icon={Square}
                fullWidth
                disabled={Boolean(busy)}
                onPress={() => void run("close", () => meetingService.setInteractionStatus(meetingId, "closed"))}
              >
                Đóng nhận phản hồi
              </Button>
            ) : null}

            {state.session && state.session.status !== "open" ? (
              <View style={s.buttonRow}>
                <Button
                  tone="primary"
                  icon={Save}
                  disabled={Boolean(busy)}
                  onPress={save}
                  style={s.buttonFlex}
                >
                  Lưu thay đổi
                </Button>
                {state.session.questions.length < 20 ? (
                  <Button
                    tone="secondary"
                    icon={Plus}
                    disabled={Boolean(busy)}
                    onPress={() => setAdding(!adding)}
                    style={s.buttonFlex}
                  >
                    Thêm câu hỏi
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Form thêm câu hỏi mới */}
        {adding ? (
          <View style={s.inlineAddBox}>
            <Text style={s.label}>Nội dung câu hỏi mới</Text>
            <TextInput
              value={newQuestion}
              onChangeText={setNewQuestion}
              placeholder="Nhập nội dung câu hỏi mới..."
              placeholderTextColor={colors.muted}
              maxLength={300}
              multiline
              style={[s.input, s.textarea]}
              autoFocus
            />
            <QuestionOptionsEditor
              type={newQuestionType}
              options={newQuestionOptions}
              disabled={Boolean(busy)}
              onTypeChange={setNewQuestionType}
              onOptionsChange={setNewQuestionOptions}
            />
            <View style={s.addActions}>
              <Button tone="secondary" icon={X} onPress={() => setAdding(false)} style={s.buttonFlex}>
                Hủy
              </Button>
              <Button
                icon={Plus}
                disabled={!newQuestion.trim() || Boolean(busy)}
                onPress={addQuestion}
                style={s.buttonFlex}
              >
                Thêm ngay
              </Button>
            </View>
          </View>
        ) : null}
      </Card>

      {/* CARD 3: CÂU TRẢ LỜI / PHẢN HỒI CỦA THÀNH VIÊN */}
      <Card style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.row}>
            <View style={s.iconBox}>
              <MessageSquare color={colors.primaryDark} size={18} />
            </View>
            <View style={s.cardHeaderText}>
              <Text style={s.heading}>Phản hồi từ người tham dự</Text>
              <Text style={s.metaSubtitle}>
                {state.session?.moderationEnabled
                  ? "Duyệt và điều phối các ý kiến đóng góp"
                  : "Ý kiến được tự động hiển thị trên màn hình chiếu"}
              </Text>
            </View>
          </View>
          <Badge style={s.cardHeaderBadge} tone={responses.length > 0 ? "primary" : "default"}>
            {responses.length} PHẢN HỒI
          </Badge>
        </View>

        {/* Filter Chips */}
        {responses.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterScroll}
          >
            <Pressable
              onPress={() => setFilterStatus("all")}
              style={[s.filterChip, filterStatus === "all" && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, filterStatus === "all" && s.filterChipTextActive]}>
                Tất cả ({responses.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFilterStatus("approved")}
              style={[s.filterChip, filterStatus === "approved" && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, filterStatus === "approved" && s.filterChipTextActive]}>
                Đang hiển thị ({responses.filter((r) => r.status === "approved").length})
              </Text>
            </Pressable>
            {state.session?.moderationEnabled ? (
              <Pressable
                onPress={() => setFilterStatus("pending")}
                style={[s.filterChip, filterStatus === "pending" && s.filterChipActive]}
              >
                <Text style={[s.filterChipText, filterStatus === "pending" && s.filterChipTextActive]}>
                  Chờ duyệt ({responses.filter((r) => r.status === "pending").length})
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setFilterStatus("hidden")}
              style={[s.filterChip, filterStatus === "hidden" && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, filterStatus === "hidden" && s.filterChipTextActive]}>
                Đã ẩn ({responses.filter((r) => r.status === "hidden").length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFilterStatus("rejected")}
              style={[s.filterChip, filterStatus === "rejected" && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, filterStatus === "rejected" && s.filterChipTextActive]}>
                Đã từ chối ({responses.filter((r) => r.status === "rejected").length})
              </Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {/* Danh sách phản hồi */}
        {!responses.length ? (
          <EmptyState
            title="Chưa có phản hồi nào"
            message="Phản hồi của người tham gia buổi họp sẽ hiển thị trực tiếp tại đây."
          />
        ) : filteredResponses.length === 0 ? (
          <View style={s.emptyFilter}>
            <Text style={s.emptyFilterText}>Không có phản hồi nào trong mục này.</Text>
          </View>
        ) : (
          filteredResponses.map((response) => {
            const qOrder =
              state.session?.questions.find((item) => item.id === response.questionId)?.order || 1;
            const responderName = response.name || "Khách ẩn danh";
            const userInitials =
              responderName
                .split(" ")
                .filter(Boolean)
                .slice(-2)
                .map((p) => p[0])
                .join("")
                .toUpperCase() || "TV";

            return (
              <View key={response.id} style={s.responseCard}>
                <View style={s.responseHeader}>
                  <Avatar initials={userInitials} size={36} />
                  <View style={s.responseMeta}>
                    <View style={s.nameRow}>
                      <Text style={s.responderName}>{responderName}</Text>
                      <View style={s.qOrderTag}>
                        <Text style={s.qOrderTagText}>Câu {qOrder}</Text>
                      </View>
                    </View>
                  </View>
                  <Badge
                    tone={
                      response.status === "approved"
                        ? "success"
                        : response.status === "pending"
                        ? "warning"
                        : response.status === "rejected"
                        ? "danger"
                        : "default"
                    }
                  >
                    {labels[response.status]}
                  </Badge>
                </View>

                <View style={s.answerBubble}>
                  <Text style={s.answerText}>{response.answer}</Text>
                </View>

                {canManage && state.session?.moderationEnabled ? (
                  <View style={s.moderationRow}>
                    {response.status !== "approved" ? (
                      <Pressable
                        onPress={() =>
                          void run("approve", () =>
                            meetingService.moderateInteractionResponse(meetingId, response.id, "approved")
                          )
                        }
                        style={[s.modBtn, s.modBtnApprove]}
                      >
                        <Check color={colors.success} size={15} />
                        <Text style={[s.modBtnText, { color: colors.success }]}>Duyệt</Text>
                      </Pressable>
                    ) : null}

                    {response.status === "approved" ? (
                      <Pressable
                        onPress={() =>
                          void run("hide", () =>
                            meetingService.moderateInteractionResponse(meetingId, response.id, "hidden")
                          )
                        }
                        style={[s.modBtn, s.modBtnHide]}
                      >
                        <EyeOff color={colors.muted} size={15} />
                        <Text style={[s.modBtnText, { color: colors.text }]}>Ẩn</Text>
                      </Pressable>
                    ) : null}

                    {response.status === "hidden" ? (
                      <Pressable
                        onPress={() =>
                          void run("show", () =>
                            meetingService.moderateInteractionResponse(meetingId, response.id, "approved")
                          )
                        }
                        style={[s.modBtn, s.modBtnShow]}
                      >
                        <Eye color={colors.primaryDark} size={15} />
                        <Text style={[s.modBtnText, { color: colors.primaryDark }]}>Hiện lại</Text>
                      </Pressable>
                    ) : null}

                    {response.status !== "rejected" ? (
                      <Pressable
                        onPress={() =>
                          void run("reject", () =>
                            meetingService.moderateInteractionResponse(meetingId, response.id, "rejected")
                          )
                        }
                        style={[s.modBtn, s.modBtnReject]}
                      >
                        <X color={colors.danger} size={15} />
                        <Text style={[s.modBtnText, { color: colors.danger }]}>Từ chối</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </Card>
    </Container>
  );
}

function QuestionOptionsEditor({
  type,
  options,
  disabled,
  onTypeChange,
  onOptionsChange,
}: {
  type: MeetingInteractionQuestionType;
  options: string[];
  disabled: boolean;
  onTypeChange: (value: MeetingInteractionQuestionType) => void;
  onOptionsChange: (value: string[]) => void;
}) {
  return (
    <View style={s.questionOptionsEditor}>
      <Text style={s.fieldLabel}>Loại câu hỏi</Text>
      <View style={s.questionTypeRow}>
        {(["text", "single_choice"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: type === value, disabled }}
            disabled={disabled}
            onPress={() => onTypeChange(value)}
            style={[s.questionTypeButton, type === value && s.questionTypeButtonActive]}
          >
            <Text style={[s.questionTypeText, type === value && s.questionTypeTextActive]}>
              {value === "text" ? "Tự luận" : "Trắc nghiệm"}
            </Text>
          </Pressable>
        ))}
      </View>
      {type === "single_choice" ? (
        <View style={s.choiceList}>
          <Text style={s.meta}>Người tham dự chọn một trong 2–6 đáp án.</Text>
          {options.map((option, index) => (
            <View key={index} style={s.choiceRow}>
              <Text style={s.choiceNumber}>{index + 1}.</Text>
              <TextInput
                accessibilityLabel={`Lựa chọn ${index + 1}`}
                value={option}
                onChangeText={(text) => onOptionsChange(options.map((item, itemIndex) => itemIndex === index ? text : item))}
                editable={!disabled}
                maxLength={200}
                placeholder={`Lựa chọn ${index + 1}`}
                placeholderTextColor={colors.muted}
                style={[s.input, s.choiceInput, disabled && s.disabled]}
              />
              {options.length > 2 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa lựa chọn ${index + 1}`}
                  disabled={disabled}
                  onPress={() => onOptionsChange(options.filter((_, itemIndex) => itemIndex !== index))}
                  style={s.choiceRemove}
                >
                  <X color={colors.danger} size={18} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {options.length < 6 ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onOptionsChange([...options, ""])}
              style={s.addChoice}
            >
              <Plus color={colors.primaryDark} size={17} />
              <Text style={s.addChoiceText}>Thêm lựa chọn</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  embedded: { gap: spacing.md },
  card: { padding: spacing.md, marginBottom: spacing.md },
  previewTabs: { gap: spacing.sm, paddingRight: spacing.md, marginBottom: spacing.md },
  previewTab: {
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  previewTabActive: { borderColor: colors.brandBlue, backgroundColor: colors.brandBlue },
  previewTabText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  previewTabTextActive: { color: "#FFFFFF" },

  grow: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },

  cardHeader: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardHeaderText: { flex: 1, minWidth: 0 },
  cardHeaderBadge: { alignSelf: "flex-end" },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { color: colors.text, fontSize: 16, fontWeight: "800" },
  metaSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  sectionSubtitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  countBadge: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  label: { color: colors.text, fontSize: 12, fontWeight: "700" },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16 },

  // Danh sách câu hỏi
  listWrapper: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  questionList: { marginTop: spacing.xs, gap: spacing.xs },
  questionItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  questionItemActive: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primarySoft,
  },
  questionPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  orderBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF2F7",
  },
  orderBadgeActive: { backgroundColor: colors.brandBlue },
  orderBadgeText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  orderBadgeTextActive: { color: "#FFFFFF" },
  questionText: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  questionTextActive: { color: colors.primaryDark },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  activeChip: {
    backgroundColor: colors.brandBlue,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeChipText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },

  // Input soạn câu hỏi
  editorBox: { marginBottom: spacing.sm },
  counter: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  textarea: {
    minHeight: 84,
    paddingTop: spacing.md,
    textAlignVertical: "top",
    marginTop: spacing.xs,
  },
  disabled: { backgroundColor: colors.background, color: colors.muted },
  questionOptionsEditor: { gap: spacing.xs, marginTop: spacing.md },
  questionTypeRow: { flexDirection: "row", gap: spacing.sm },
  questionTypeButton: {
    flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center",
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  questionTypeButtonActive: { borderColor: colors.brandBlue, backgroundColor: colors.primarySoft },
  questionTypeText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  questionTypeTextActive: { color: colors.primaryDark },
  choiceList: { gap: spacing.sm, marginTop: spacing.xs },
  choiceRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  choiceNumber: { width: 22, color: colors.muted, fontSize: 13, fontWeight: "700" },
  choiceInput: { flex: 1, minWidth: 0 },
  choiceRemove: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  addChoice: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  addChoiceText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },

  // Cấu hình bài tương tác
  settingsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0, 173, 252, 0.25)",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  settingsCardOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  settingsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  settingsPanel: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "rgba(0, 173, 252, 0.25)",
    backgroundColor: "rgba(0, 173, 252, 0.06)",
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  settingField: { marginBottom: spacing.xs },
  // Timer
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  timerDanger: { backgroundColor: "#FDECEF" },
  timerText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },

  // Nút hành động
  actionGroup: { marginTop: spacing.md, gap: spacing.sm },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  buttonFlex: { flex: 1 },

  // Form thêm câu hỏi mới
  inlineAddBox: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  addActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },

  // Phản hồi của người tham dự
  filterScroll: { gap: spacing.xs, paddingBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.brandBlue,
    borderColor: colors.brandBlue,
  },
  filterChipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: "#FFFFFF" },
  emptyFilter: { paddingVertical: spacing.lg, alignItems: "center" },
  emptyFilterText: { color: colors.muted, fontSize: 13 },

  responseCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  responseHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  responseMeta: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  responderName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  qOrderTag: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  qOrderTagText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  answerBubble: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  answerText: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  moderationRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  modBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  modBtnApprove: { backgroundColor: "#E7F7F0", borderColor: "#B2E5D0" },
  modBtnHide: { backgroundColor: "#F1F5F9", borderColor: colors.border },
  modBtnShow: { backgroundColor: colors.primarySoft, borderColor: "rgba(0, 173, 252, 0.25)" },
  modBtnReject: { backgroundColor: "#FEECEF", borderColor: "#F8B4C0" },
  modBtnText: { fontSize: 12, fontWeight: "800" },
});
