import { friendlyErrorMessage } from "@/utils/userFacingError";
import { Alert } from "@/components/AppAlert";
import { useCallback, useState } from "react";
import {
  Clock3,
  Edit2,
  Plus,
  Save,
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
import { Badge, Button, Card, Screen } from "@/components/ui";
import { useLiveMeetingInteraction } from "@/hooks/useLiveMeetingInteraction";
import {
  meetingService,
  type MeetingInteraction,
  type MeetingInteractionInput,
  type MeetingInteractionQuestion,
  type MeetingInteractionQuestionType,
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
  return (
    values.length >= 2 &&
    values.length <= 6 &&
    values.every((value) => value.length > 0 && value.length <= 200) &&
    new Set(values).size === values.length
  );
};

const simpleInteractionSettings = {
  requireName: false,
  showNames: false,
  moderationEnabled: false,
  allowMultipleResponses: true,
} as const;

const DURATION_PRESETS = [30, 60, 90, 120];

export function InteractionManager({
  meetingId,
  initial,
  canManage,
  embedded = false,
  onStateChange,
}: Props) {
  const [state, setState] = useState(initial);
  const onLiveUpdate = useCallback(
    (next: MeetingInteraction) => {
      setState(next);
      onStateChange?.(next);
    },
    [onStateChange]
  );
  useLiveMeetingInteraction(meetingId, onLiveUpdate);

  const session = state.session;
  const questions = session?.questions || [];

  // Quản lý câu hỏi đang chọn để sửa
  const initialActive = questions.find((q) => q.id === session?.activeQuestionId) || questions[0];
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(initialActive?.id || "");
  const [questionText, setQuestionText] = useState(initialActive?.text || session?.question || "");
  const [questionType, setQuestionType] = useState<MeetingInteractionQuestionType>(initialActive?.type || "text");
  const [questionOptions, setQuestionOptions] = useState<string[]>(
    initialActive?.options?.length ? initialActive.options : ["", ""]
  );

  // Thời gian trả lời (cấu hình chung cho phiên)
  const [duration, setDuration] = useState(String(session?.durationSeconds || 60));

  // Trạng thái form thêm câu hỏi mới
  const [isCreating, setIsCreating] = useState(questions.length === 0);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<MeetingInteractionQuestionType>("text");
  const [newQuestionOptions, setNewQuestionOptions] = useState(["", ""]);

  const [busy, setBusy] = useState("");

  const apply = (next: MeetingInteraction) => {
    setState(next);
    onStateChange?.(next);
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

  // Nạp câu hỏi vào form chỉnh sửa
  const handleSelectQuestionToEdit = (q: MeetingInteractionQuestion) => {
    setIsCreating(false);
    setSelectedQuestionId(q.id);
    setQuestionText(q.text);
    setQuestionType(q.type || "text");
    setQuestionOptions(q.options?.length ? q.options : ["", ""]);
  };

  // Lưu câu hỏi đang chỉnh sửa + cập nhật thời gian
  const handleSaveEdit = () => {
    const seconds = Number(duration);
    if (!questionText.trim()) {
      Alert.alert("Thiếu nội dung", "Vui lòng nhập nội dung câu hỏi.");
      return;
    }
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) {
      Alert.alert("Thời gian không hợp lệ", "Thời gian trả lời phải từ 1 đến 3600 giây.");
      return;
    }
    if (questionType === "single_choice" && !validOptions(questionOptions)) {
      Alert.alert("Lựa chọn không hợp lệ", "Trắc nghiệm cần từ 2 đến 6 lựa chọn không trùng nhau.");
      return;
    }

    const payload: MeetingInteractionInput = {
      question: questionText.trim(),
      type: questionType,
      ...(questionType === "single_choice" ? { options: questionOptions.map((o) => o.trim()) } : {}),
      durationSeconds: seconds,
      ...simpleInteractionSettings,
    };

    void run("save", async () => {
      if (selectedQuestionId && selectedQuestionId !== session?.activeQuestionId) {
        await meetingService.selectInteractionQuestion(meetingId, selectedQuestionId);
      }
      return meetingService.saveInteraction(meetingId, payload);
    });
  };

  // Tạo thêm câu hỏi mới
  const handleCreateQuestion = () => {
    if (!newQuestionText.trim()) {
      Alert.alert("Thiếu nội dung", "Vui lòng nhập câu hỏi mới.");
      return;
    }
    if (newQuestionType === "single_choice" && !validOptions(newQuestionOptions)) {
      Alert.alert("Lựa chọn không hợp lệ", "Trắc nghiệm cần từ 2 đến 6 lựa chọn không trùng nhau.");
      return;
    }

    void run("create", async () => {
      // Nếu chưa có session, tạo session đầu tiên bằng saveInteraction
      if (!session) {
        const payload: MeetingInteractionInput = {
          question: newQuestionText.trim(),
          type: newQuestionType,
          ...(newQuestionType === "single_choice" ? { options: newQuestionOptions.map((o) => o.trim()) } : {}),
          durationSeconds: Number(duration) || 60,
          ...simpleInteractionSettings,
        };
        const next = await meetingService.saveInteraction(meetingId, payload);
        setIsCreating(false);
        return next;
      }

      // Đã có session thì thêm câu hỏi
      const next = await meetingService.addInteractionQuestion(meetingId, {
        question: newQuestionText.trim(),
        type: newQuestionType,
        ...(newQuestionType === "single_choice" ? { options: newQuestionOptions.map((o) => o.trim()) } : {}),
      });

      setNewQuestionText("");
      setNewQuestionType("text");
      setNewQuestionOptions(["", ""]);
      setIsCreating(false);

      const latestQ = next.session?.questions[next.session.questions.length - 1];
      if (latestQ) {
        handleSelectQuestionToEdit(latestQ);
      }
      return next;
    });
  };

  // Xóa câu hỏi
  const handleDeleteQuestion = (qId: string, qText: string) => {
    Alert.alert("Xóa câu hỏi?", `“${qText}” sẽ bị xóa vĩnh viễn.`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () =>
          void run("delete", async () => {
            const next = await meetingService.deleteInteractionQuestion(meetingId, qId);
            const remainingQuestions = next.session?.questions || [];
            if (remainingQuestions.length > 0) {
              handleSelectQuestionToEdit(remainingQuestions[0]);
            } else {
              setIsCreating(true);
            }
            return next;
          }),
      },
    ]);
  };

  // Đổi thời gian trả lời
  const handleChangeDuration = (sec: number | string) => {
    setDuration(String(sec));
  };

  const Container = embedded ? View : Screen;

  return (
    <Container style={embedded ? s.embedded : undefined}>
      {!embedded ? (
        <BackHeader
          title="Thu ý kiến"
          subtitle="Soạn câu hỏi & Cài đặt thời gian"
          compact
          action={
            <HeaderRefreshAction
              label="Làm mới"
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.contentScroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. KHỐI CẤU HÌNH THỜI GIAN TRẢ LỜI */}
        <Card style={s.card}>
          <View style={s.rowBetween}>
            <View style={s.row}>
              <Clock3 size={17} color={colors.primaryDark} />
              <Text style={s.sectionTitle}>Thời gian trả lời</Text>
            </View>
            <Text style={s.durationHighlight}>{duration}s</Text>
          </View>

          {/* Dàn đều 4 thẻ preset cân đối 100% bề ngang */}
          <View style={s.durationGrid}>
            {DURATION_PRESETS.map((val) => {
              const active = Number(duration) === val;
              return (
                <Pressable
                  key={val}
                  disabled={!canManage}
                  onPress={() => handleChangeDuration(val)}
                  style={[s.durationChip, active && s.durationChipActive]}
                >
                  <Text style={[s.durationChipText, active && s.durationChipTextActive]}>
                    {val}s
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 2. DANH SÁCH CÂU HỎI */}
        {questions.length > 0 ? (
          <View style={s.questionListSection}>
            <View style={s.rowBetween}>
              <Text style={s.sectionTitle}>Danh sách câu hỏi</Text>
              {canManage && !isCreating && questions.length < 20 ? (
                <Pressable
                  onPress={() => {
                    setIsCreating(true);
                    setNewQuestionText("");
                    setNewQuestionType("text");
                    setNewQuestionOptions(["", ""]);
                  }}
                  style={s.addQuestionLink}
                >
                  <Plus size={15} color={colors.primaryDark} />
                  <Text style={s.addQuestionLinkText}>Thêm câu hỏi</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={s.questionItems}>
              {questions.map((q) => {
                const isSelected = selectedQuestionId === q.id && !isCreating;
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => handleSelectQuestionToEdit(q)}
                    style={[s.questionItem, isSelected && s.questionItemActive]}
                  >
                    <View style={[s.orderBadge, isSelected && s.orderBadgeActive]}>
                      <Text style={[s.orderBadgeText, isSelected && s.orderBadgeTextActive]}>{q.order}</Text>
                    </View>
                    <View style={s.grow}>
                      <Text numberOfLines={2} style={s.questionText}>{q.text}</Text>
                      <View style={s.row}>
                        <Badge tone="default">
                          {q.type === "single_choice" ? "Trắc nghiệm" : "Tự luận"}
                        </Badge>
                        {isSelected ? <Text style={s.editingIndicator}>· Đang sửa</Text> : null}
                      </View>
                    </View>

                    {canManage && questions.length > 1 ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() => handleDeleteQuestion(q.id, q.text)}
                        style={s.deleteBtn}
                      >
                        <Trash2 size={16} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* 3. TRÌNH SOẠN THẢO (FORM THÊM MỚI HOẶC CHỈNH SỬA) */}
        {canManage ? (
          isCreating ? (
            /* Form thêm câu hỏi mới */
            <Card style={s.editorCard}>
              <View style={s.rowBetween}>
                <View style={s.row}>
                  <Plus size={17} color={colors.primaryDark} />
                  <Text style={s.sectionTitle}>
                    {questions.length === 0 ? "Tạo câu hỏi đầu tiên" : "Thêm câu hỏi mới"}
                  </Text>
                </View>
                {questions.length > 0 ? (
                  <Pressable hitSlop={8} onPress={() => setIsCreating(false)}>
                    <X size={18} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>

              <TextInput
                value={newQuestionText}
                onChangeText={setNewQuestionText}
                placeholder="Nhập nội dung câu hỏi..."
                placeholderTextColor={colors.muted}
                maxLength={300}
                multiline
                style={[s.input, s.textarea]}
                autoFocus={questions.length > 0}
              />

              <QuestionTypeEditor
                type={newQuestionType}
                options={newQuestionOptions}
                onTypeChange={setNewQuestionType}
                onOptionsChange={setNewQuestionOptions}
              />

              <Button
                icon={Plus}
                fullWidth
                disabled={!newQuestionText.trim() || Boolean(busy)}
                onPress={handleCreateQuestion}
                style={s.submitBtn}
              >
                {busy === "create" ? "Đang thêm..." : "Thêm câu hỏi này"}
              </Button>
            </Card>
          ) : (
            /* Form chỉnh sửa câu hỏi đang chọn */
            <Card style={s.editorCard}>
              <View style={s.rowBetween}>
                <View style={s.row}>
                  <Edit2 size={16} color={colors.primaryDark} />
                  <Text style={s.sectionTitle}>Nội dung câu hỏi</Text>
                </View>
                <Text style={s.counterText}>{questionText.length}/300</Text>
              </View>

              <TextInput
                value={questionText}
                onChangeText={setQuestionText}
                placeholder="Nhập nội dung câu hỏi..."
                placeholderTextColor={colors.muted}
                maxLength={300}
                multiline
                style={[s.input, s.textarea]}
              />

              <QuestionTypeEditor
                type={questionType}
                options={questionOptions}
                onTypeChange={setQuestionType}
                onOptionsChange={setQuestionOptions}
              />

              <Button
                icon={Save}
                fullWidth
                disabled={!questionText.trim() || Boolean(busy)}
                onPress={handleSaveEdit}
                style={s.submitBtn}
              >
                {busy === "save" ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </Card>
          )
        ) : null}
      </ScrollView>
    </Container>
  );
}

// Trình chọn loại câu hỏi & chỉnh sửa đáp án trắc nghiệm
function QuestionTypeEditor({
  type,
  options,
  onTypeChange,
  onOptionsChange,
}: {
  type: MeetingInteractionQuestionType;
  options: string[];
  onTypeChange: (v: MeetingInteractionQuestionType) => void;
  onOptionsChange: (opts: string[]) => void;
}) {
  return (
    <View style={s.typeEditorContainer}>
      <Text style={s.inputLabel}>Hình thức câu hỏi</Text>
      <View style={s.typeToggleRow}>
        <Pressable
          onPress={() => onTypeChange("text")}
          style={[s.typeToggleBtn, type === "text" && s.typeToggleBtnActive]}
        >
          <Text style={[s.typeToggleText, type === "text" && s.typeToggleTextActive]}>Tự luận</Text>
        </Pressable>
        <Pressable
          onPress={() => onTypeChange("single_choice")}
          style={[s.typeToggleBtn, type === "single_choice" && s.typeToggleBtnActive]}
        >
          <Text style={[s.typeToggleText, type === "single_choice" && s.typeToggleTextActive]}>
            Trắc nghiệm
          </Text>
        </Pressable>
      </View>

      {type === "single_choice" ? (
        <View style={s.choiceList}>
          {options.map((opt, idx) => (
            <View key={idx} style={s.choiceItemRow}>
              <View style={s.choiceLetterBadge}>
                <Text style={s.choiceLetterText}>{String.fromCharCode(65 + idx)}</Text>
              </View>
              <TextInput
                value={opt}
                onChangeText={(text) =>
                  onOptionsChange(options.map((item, itemIdx) => (itemIdx === idx ? text : item)))
                }
                placeholder={`Lựa chọn ${String.fromCharCode(65 + idx)}`}
                placeholderTextColor={colors.muted}
                maxLength={200}
                style={[s.input, s.choiceInput]}
              />
              {options.length > 2 ? (
                <Pressable
                  hitSlop={6}
                  onPress={() => onOptionsChange(options.filter((_, itemIdx) => itemIdx !== idx))}
                  style={s.choiceRemoveBtn}
                >
                  <X size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ))}

          {options.length < 6 ? (
            <Pressable
              onPress={() => onOptionsChange([...options, ""])}
              style={s.addChoiceBtn}
            >
              <Plus size={15} color={colors.primaryDark} />
              <Text style={s.addChoiceBtnText}>Thêm lựa chọn</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  embedded: { gap: spacing.md },
  grow: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },

  contentScroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: 40,
    gap: spacing.md,
  },

  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  // Cấu hình thời gian
  durationHighlight: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  durationGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  durationChip: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipActive: {
    backgroundColor: colors.brandBlue,
    borderColor: colors.brandBlue,
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  durationChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  // Danh sách câu hỏi
  questionListSection: {
    gap: spacing.sm,
  },
  addQuestionLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addQuestionLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  questionItems: {
    gap: 8,
  },
  questionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionItemActive: {
    borderColor: colors.brandBlue,
    borderWidth: 1.5,
    backgroundColor: colors.primarySoft,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeActive: {
    backgroundColor: colors.brandBlue,
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  orderBadgeTextActive: {
    color: "#FFFFFF",
  },
  questionText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 19,
    marginBottom: 4,
  },
  editingIndicator: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDark,
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 6,
  },

  // Trình soạn thảo
  editorCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: "#E2EEF4",
  },
  counterText: {
    fontSize: 11,
    color: colors.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textarea: {
    minHeight: 80,
    paddingTop: spacing.sm,
    textAlignVertical: "top",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  typeEditorContainer: {
    gap: 8,
    marginTop: 4,
  },
  typeToggleRow: {
    flexDirection: "row",
    backgroundColor: "#EAF0F3",
    borderRadius: radius.md,
    padding: 3,
  },
  typeToggleBtn: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  typeToggleBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeToggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
  },
  typeToggleTextActive: {
    color: colors.brandBlue,
    fontWeight: "800",
  },
  choiceList: {
    gap: 6,
    marginTop: 4,
  },
  choiceItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  choiceLetterBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceLetterText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  choiceInput: {
    flex: 1,
    minHeight: 40,
  },
  choiceRemoveBtn: {
    padding: 6,
  },
  addChoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  addChoiceBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
});
