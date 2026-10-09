import { friendlyErrorMessage } from "@/utils/userFacingError";
import { Alert } from "@/components/AppAlert";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Link,
  MessageCircle,
  MessageSquare,
  Play,
  Plus,
  Save,
  Settings2,
  Share2,
  Square,
  Trash2,
  X,
} from "lucide-react-native";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { HeaderRefreshAction } from "@/components/HeaderRefreshAction";
import { ResponseWordCloud } from "@/components/meetings/ResponseWordCloud";
import { Avatar, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { useLiveMeetingInteraction } from "@/hooks/useLiveMeetingInteraction";
import { apiConfig } from "@/services/api";
import {
  meetingService,
  type MeetingInteraction,
  type MeetingInteractionInput,
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

export function InteractionManager({
  meetingId,
  initial,
  canManage,
  canControl = true,
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

  const [question, setQuestion] = useState(initial.session?.question || "");
  const [duration, setDuration] = useState(String(initial.session?.durationSeconds || 60));
  const [requireName, setRequireName] = useState(initial.session?.requireName ?? true);
  const [showNames, setShowNames] = useState(initial.session?.showNames ?? true);
  const [moderation, setModeration] = useState(initial.session?.moderationEnabled ?? true);
  const [multiple, setMultiple] = useState(initial.session?.allowMultipleResponses ?? false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewQuestionId, setPreviewQuestionId] = useState(
    initial.session?.activeQuestionId || initial.session?.questions[0]?.id || ""
  );
  const [adding, setAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
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
    setDuration(String(next.session.durationSeconds));
    setRequireName(next.session.requireName);
    setShowNames(next.session.showNames);
    setModeration(next.session.moderationEnabled);
    setMultiple(next.session.allowMultipleResponses);
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
    return {
      question: question.trim(),
      durationSeconds: seconds,
      requireName,
      showNames,
      moderationEnabled: moderation,
      allowMultipleResponses: multiple,
    };
  };

  const save = () => {
    const input = formData();
    if (input) void run("save", () => meetingService.saveInteraction(meetingId, input));
  };

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    void run("add", async () => {
      const next = await meetingService.addInteractionQuestion(meetingId, newQuestion.trim());
      setNewQuestion("");
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

  const participationUrl = state.session?.participationUrl
    ? state.session.participationUrl.startsWith("http")
      ? state.session.participationUrl
      : `${apiConfig.baseUrl}${state.session.participationUrl.startsWith("/") ? "" : "/"}${state.session.participationUrl}`
    : "";

  const previewQuestion =
    state.session?.questions.find((item) => item.id === previewQuestionId) || state.session?.questions[0];

  const copyParticipationLink = async () => {
    if (!participationUrl) return;
    await Clipboard.setStringAsync(participationUrl);
    Alert.alert("Đã sao chép", "Đã sao chép liên kết vào bộ nhớ tạm.");
  };

  const shareParticipationLink = async () => {
    if (!participationUrl) return;
    try {
      await Share.share({
        title: "Liên kết tham gia tương tác BNI",
        message: `Mời bạn tham gia trả lời khảo sát và tương tác buổi họp:\n${participationUrl}`,
        url: participationUrl,
      });
    } catch {}
  };

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
            <View>
              <Text style={s.heading}>Câu hỏi tương tác</Text>
              <Text style={s.metaSubtitle}>Khảo sát và thu thập ý kiến người tham dự</Text>
            </View>
          </View>
          {state.session ? (
            <Badge tone={state.session.status === "open" ? "primary" : state.session.status === "closed" ? "danger" : "default"}>
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
              {duration || 0}s · {moderation ? "Có kiểm duyệt" : "Tự động hiển thị"} · {requireName ? "Yêu cầu tên" : "Ẩn danh"}
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
            <Toggle
              label="Yêu cầu người tham dự nhập tên"
              subtitle="Khách mời phải điền tên trước khi gửi ý kiến"
              value={requireName}
              onChange={setRequireName}
              disabled={locked}
            />
            <Toggle
              label="Cho phép hiển thị tên"
              subtitle="Hiển thị tên người gửi trên màn hình chiếu"
              value={showNames}
              onChange={setShowNames}
              disabled={locked}
            />
            <Toggle
              label="Duyệt trước khi trình chiếu"
              subtitle="Ban tổ chức duyệt phản hồi trước khi hiện lên màn hình"
              value={moderation}
              onChange={setModeration}
              disabled={locked}
            />
            <Toggle
              label="Cho phép gửi nhiều lần"
              subtitle="Mỗi người có thể đóng góp nhiều câu trả lời"
              value={multiple}
              onChange={setMultiple}
              disabled={locked}
            />
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
              <Button icon={Save} fullWidth disabled={Boolean(busy)} onPress={save}>
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

      {/* CARD 2: LINK TƯƠNG TÁC CHO KHÁCH MỜI */}
      {state.session ? (
        <Card style={s.card}>
          <View style={s.shareHeader}>
            <View style={s.iconBox}>
              <Globe color={colors.primaryDark} size={18} />
            </View>
            <View style={s.grow}>
              <Text style={s.heading}>Link tương tác cho khách mời</Text>
              <Text style={s.metaSubtitle}>
                Thành viên có thể tương tác trực tiếp không cần truy cập qua link đóng góp ý kiến
              </Text>
            </View>
          </View>

          <Pressable onPress={copyParticipationLink} style={s.linkBox}>
            <Link color={colors.primaryDark} size={16} />
            <Text numberOfLines={1} ellipsizeMode="middle" style={s.linkText}>
              {participationUrl}
            </Text>
            <Copy color={colors.muted} size={16} />
          </Pressable>

          <View style={s.shareActionRow}>
            <Button
              tone="secondary"
              icon={Copy}
              onPress={copyParticipationLink}
              style={s.shareBtn}
            >
              Sao chép
            </Button>
            <Button
              tone="primary"
              icon={Share2}
              onPress={shareParticipationLink}
              style={s.shareBtn}
            >
              Chia sẻ
            </Button>
          </View>

          <View style={s.statRow}>
            <View style={s.statBadge}>
              <Text style={s.statLabel}>Đã nhận:</Text>
              <Text style={s.statValue}>{state.session.responseCount} ý kiến</Text>
            </View>
            <View style={[s.statBadge, s.statBadgeActive]}>
              <Text style={[s.statLabel, { color: colors.primaryDark }]}>Đang hiển thị:</Text>
              <Text style={[s.statValue, { color: colors.primaryDark }]}>
                {state.session.approvedCount} ý kiến
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* CARD 3: CÂU TRẢ LỜI / PHẢN HỒI CỦA THÀNH VIÊN */}
      <Card style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.row}>
            <View style={s.iconBox}>
              <MessageSquare color={colors.primaryDark} size={18} />
            </View>
            <View>
              <Text style={s.heading}>Phản hồi từ người tham dự</Text>
              <Text style={s.metaSubtitle}>
                {state.session?.moderationEnabled
                  ? "Duyệt và điều phối các ý kiến đóng góp"
                  : "Ý kiến được tự động hiển thị trên màn hình chiếu"}
              </Text>
            </View>
          </View>
          <Badge tone={responses.length > 0 ? "primary" : "default"}>
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

function Toggle({
  label,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.toggle}>
      <View style={s.grow}>
        <Text style={s.toggleLabel}>{label}</Text>
        {subtitle ? <Text style={s.toggleSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: "#83D9E5" }}
        thumbColor={value ? colors.primaryDark : "#FFFFFF"}
      />
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
  previewTabActive: { borderColor: colors.primaryDark, backgroundColor: colors.primaryDark },
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
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
  orderBadgeActive: { backgroundColor: colors.primaryDark },
  orderBadgeText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  orderBadgeTextActive: { color: "#FFFFFF" },
  questionText: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  questionTextActive: { color: colors.primaryDark },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  activeChip: {
    backgroundColor: colors.primaryDark,
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

  // Cấu hình bài tương tác
  settingsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#B9E7EE",
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
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  settingsPanel: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#B9E7EE",
    backgroundColor: "#F9FEFF",
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  settingField: { marginBottom: spacing.xs },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  toggleSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },

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

  // CARD 2: Share link
  shareHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  linkText: { flex: 1, color: colors.primaryDark, fontSize: 12, fontWeight: "600" },
  shareActionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  shareBtn: { flex: 1 },
  statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  statBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  statBadgeActive: {
    backgroundColor: colors.primarySoft,
    borderColor: "#B9E7EE",
  },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  statValue: { color: colors.text, fontSize: 12, fontWeight: "800" },

  // CARD 3: Responses
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
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
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
  modBtnShow: { backgroundColor: colors.primarySoft, borderColor: "#B9E7EE" },
  modBtnReject: { backgroundColor: "#FEECEF", borderColor: "#F8B4C0" },
  modBtnText: { fontSize: 12, fontWeight: "800" },
});
