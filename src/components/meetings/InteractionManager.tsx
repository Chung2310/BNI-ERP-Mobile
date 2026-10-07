import { useEffect, useState } from "react";
import { Check, ChevronRight, Clock3, Eye, EyeOff, MessageCircle, Play, Plus, RefreshCw, Save, Settings2, Share2, Square, Trash2, X, type LucideIcon } from "lucide-react-native";
import { Alert, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { meetingService, type MeetingInteraction, type MeetingInteractionInput, type MeetingInteractionResponseStatus } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

type Props = { meetingId: string; initial: MeetingInteraction; canManage: boolean; reload: () => Promise<void> };
const message = (error: unknown) => error instanceof Error ? error.message : "Vui lòng thử lại.";

export function InteractionManager({ meetingId, initial, canManage, reload }: Props) {
  const [state, setState] = useState(initial);
  const [question, setQuestion] = useState(initial.session?.question || "");
  const [duration, setDuration] = useState(String(initial.session?.durationSeconds || 60));
  const [requireName, setRequireName] = useState(initial.session?.requireName ?? true);
  const [showNames, setShowNames] = useState(initial.session?.showNames ?? true);
  const [moderation, setModeration] = useState(initial.session?.moderationEnabled ?? true);
  const [multiple, setMultiple] = useState(initial.session?.allowMultipleResponses ?? false);
  const [showSettings, setShowSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (state.session?.status !== "open") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.session?.status]);

  const apply = (next: MeetingInteraction) => {
    setState(next);
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
    try { apply(await task()); }
    catch (error) { Alert.alert("Không thể cập nhật", message(error)); }
    finally { setBusy(""); }
  };
  const formData = (): MeetingInteractionInput | null => {
    const seconds = Number(duration);
    if (!question.trim()) { Alert.alert("Thiếu câu hỏi", "Vui lòng nhập nội dung câu hỏi."); return null; }
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) { Alert.alert("Thời gian không hợp lệ", "Thời gian phải từ 1 đến 3600 giây."); return null; }
    return { question: question.trim(), durationSeconds: seconds, requireName, showNames, moderationEnabled: moderation, allowMultipleResponses: multiple };
  };
  const save = () => { const input = formData(); if (input) void run("save", () => meetingService.saveInteraction(meetingId, input)); };
  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    void run("add", async () => {
      const next = await meetingService.addInteractionQuestion(meetingId, newQuestion.trim());
      setNewQuestion(""); setAdding(false);
      return next;
    });
  };
  const removeQuestion = (id: string, text: string) => Alert.alert(
    "Xóa câu hỏi?", `“${text}” và toàn bộ câu trả lời của câu này sẽ bị xóa.`,
    [{ text: "Giữ lại", style: "cancel" }, { text: "Xóa", style: "destructive", onPress: () => void run("delete", () => meetingService.deleteInteractionQuestion(meetingId, id)) }],
  );
  const remaining = state.session?.status === "open" && state.session.closesAt && now !== null
    ? Math.max(0, Math.ceil((Date.parse(state.session.closesAt) - now) / 1000))
    : state.session?.durationSeconds || 0;
  const locked = !canManage || state.session?.status === "open";
  const labels: Record<MeetingInteractionResponseStatus, string> = { pending: "Chờ duyệt", approved: "Đang hiển thị", hidden: "Đã ẩn", rejected: "Đã từ chối" };

  return <Screen>
    <BackHeader title="Tương tác" subtitle="Câu hỏi và phản hồi trực tiếp" />
    <Card>
      <View style={s.between}><View style={s.row}><MessageCircle color={colors.primaryDark} size={22} /><Text style={s.heading}>Câu hỏi tương tác</Text></View>{state.session ? <Badge tone={state.session.status === "open" ? "primary" : "default"}>{state.session.status === "open" ? "ĐANG MỞ" : state.session.status === "closed" ? "ĐÃ ĐÓNG" : "BẢN NHÁP"}</Badge> : null}</View>
      {state.session ? <View style={s.list}>
        <View style={s.between}><Text style={s.label}>Danh sách câu hỏi</Text><Text style={s.meta}>{state.session.questions.length}/20</Text></View>
        {state.session.questions.map((item) => {
          const active = item.id === state.session?.activeQuestionId;
          return <View key={item.id} style={[s.questionRow, active && s.active]}>
            <Pressable disabled={!canManage || Boolean(busy)} onPress={() => !active && void run("select", () => meetingService.selectInteractionQuestion(meetingId, item.id))} style={s.questionPress}>
              <View style={[s.order, active && s.orderActive]}><Text style={[s.orderText, active && s.orderTextActive]}>{item.order}</Text></View>
              <View style={s.grow}><Text style={s.question}>{item.text}</Text><Text style={s.meta}>{item.responseCount} phản hồi{active ? " · Đang chọn" : ""}</Text></View>
              {!active ? <ChevronRight color={colors.muted} size={18} /> : null}
            </Pressable>
            {canManage && state.session!.status !== "open" && state.session!.questions.length > 1 ? <Pressable onPress={() => removeQuestion(item.id, item.text)} style={s.icon}><Trash2 color={colors.danger} size={18} /></Pressable> : null}
          </View>;
        })}
      </View> : null}
      <Text style={s.fieldLabel}>{state.session ? `Câu hỏi ${state.session.questionNumber}/${state.session.totalQuestions}` : "Câu hỏi đầu tiên"}</Text>
      <TextInput value={question} onChangeText={setQuestion} editable={!locked} maxLength={300} multiline placeholder="Ví dụ: Điều giá trị nhất bạn nhận được hôm nay là gì?" placeholderTextColor={colors.muted} style={[s.input, s.textarea, locked && s.disabled]} />
      <Text style={s.counter}>{question.length}/300</Text>
      <Pressable disabled={locked} onPress={() => setShowSettings((value) => !value)} style={s.settings}><Settings2 color={colors.primaryDark} size={18} /><View style={s.grow}><Text style={s.settingsTitle}>Cấu hình bài tương tác</Text><Text style={s.meta}>{duration || 0} giây · {moderation ? "Có kiểm duyệt" : "Tự động hiển thị"}</Text></View><ChevronRight color={colors.muted} size={18} /></Pressable>
      {showSettings ? <View style={s.panel}>
        <Text style={s.label}>Thời gian trả lời toàn bài (giây)</Text><TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" style={s.input} />
        <Toggle label="Yêu cầu người tham dự nhập tên" value={requireName} onChange={setRequireName} disabled={locked} />
        <Toggle label="Cho phép hiển thị tên" value={showNames} onChange={setShowNames} disabled={locked} />
        <Toggle label="Duyệt trước khi trình chiếu" value={moderation} onChange={setModeration} disabled={locked} />
        <Toggle label="Cho phép gửi nhiều lần" value={multiple} onChange={setMultiple} disabled={locked} />
      </View> : null}
      {state.session?.status === "open" ? <View style={[s.timer, remaining <= 10 && s.timerDanger]}><Clock3 color={remaining <= 10 ? colors.danger : colors.primaryDark} size={18} /><Text style={[s.timerText, remaining <= 10 && { color: colors.danger }]}>Tự động đóng sau {remaining} giây</Text></View> : null}
      {canManage ? <View style={s.actions}>
        {!state.session ? <Button icon={Save} disabled={Boolean(busy)} onPress={save}>Tạo phiên tương tác</Button> : null}
        {state.session && state.session.status !== "open" ? <><Button icon={Play} disabled={Boolean(busy)} onPress={() => void run("open", () => meetingService.setInteractionStatus(meetingId, "open"))}>Mở nhận câu trả lời</Button><Button tone="secondary" icon={Save} disabled={Boolean(busy)} onPress={save}>Lưu thay đổi</Button></> : null}
        {state.session?.status === "open" ? <Button tone="danger" icon={Square} disabled={Boolean(busy)} onPress={() => void run("close", () => meetingService.setInteractionStatus(meetingId, "closed"))}>Đóng nhận</Button> : null}
        {state.session && state.session.status !== "open" && state.session.questions.length < 20 ? <Button tone="secondary" icon={Plus} disabled={Boolean(busy)} onPress={() => setAdding(!adding)}>Thêm câu hỏi</Button> : null}
      </View> : null}
      {adding ? <View style={s.inline}><Text style={s.label}>Nội dung câu hỏi mới</Text><TextInput value={newQuestion} onChangeText={setNewQuestion} maxLength={300} multiline style={[s.input, s.textarea]} autoFocus /><View style={s.actions}><Button tone="secondary" icon={X} onPress={() => setAdding(false)}>Hủy</Button><Button icon={Plus} disabled={!newQuestion.trim() || Boolean(busy)} onPress={addQuestion}>Thêm</Button></View></View> : null}
    </Card>
    {state.session ? <Card><View style={s.between}><Text style={s.heading}>Đường dẫn tham gia</Text><Button tone="secondary" icon={Share2} onPress={() => void Share.share({ message: state.session!.participationUrl })}>Chia sẻ</Button></View><Text selectable style={s.link}>{state.session.participationUrl}</Text><Text style={s.meta}>{state.session.approvedCount} đang hiển thị / {state.session.responseCount} đã nhận</Text></Card> : null}
    <Card>
      <View style={s.between}><Text style={s.heading}>Câu trả lời</Text><Badge>{state.responses.length} PHẢN HỒI</Badge></View>
      {!state.responses.length ? <EmptyState title="Chưa có câu trả lời" message="Phản hồi của người tham dự sẽ xuất hiện tại đây." /> : state.responses.map((response) => <View key={response.id} style={s.response}>
        <View style={s.between}><Text style={s.name}>{response.name || "Ẩn danh"}</Text><Badge tone={response.status === "approved" ? "primary" : response.status === "pending" ? "warning" : "default"}>{labels[response.status]}</Badge></View>
        <Text style={s.answer}>{response.answer}</Text>
        {canManage ? <View style={s.miniActions}>
          {response.status !== "approved" ? <Mini label="Duyệt" icon={Check} onPress={() => void run("approve", () => meetingService.moderateInteractionResponse(meetingId, response.id, "approved"))} /> : null}
          {response.status === "approved" ? <Mini label="Ẩn" icon={EyeOff} onPress={() => void run("hide", () => meetingService.moderateInteractionResponse(meetingId, response.id, "hidden"))} /> : null}
          {response.status === "hidden" ? <Mini label="Hiện lại" icon={Eye} onPress={() => void run("show", () => meetingService.moderateInteractionResponse(meetingId, response.id, "approved"))} /> : null}
          {response.status !== "rejected" ? <Mini label="Từ chối" icon={X} danger onPress={() => void run("reject", () => meetingService.moderateInteractionResponse(meetingId, response.id, "rejected"))} /> : null}
        </View> : null}
      </View>)}
    </Card>
    <Button tone="secondary" icon={RefreshCw} onPress={reload}>Làm mới dữ liệu</Button>
  </Screen>;
}

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <View style={s.toggle}><Text style={s.toggleLabel}>{label}</Text><Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: colors.border, true: "#83D9E5" }} thumbColor={value ? colors.primaryDark : "#FFFFFF"} /></View>;
}
function Mini({ label, icon: Icon, onPress, danger }: { label: string; icon: LucideIcon; onPress: () => void; danger?: boolean }) {
  return <Pressable onPress={onPress} style={s.mini}><Icon color={danger ? colors.danger : colors.primaryDark} size={15} /><Text style={[s.miniText, danger && { color: colors.danger }]}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  grow: { flex: 1 }, row: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, heading: { color: colors.text, fontSize: 16, fontWeight: "900" }, label: { color: colors.text, fontSize: 12, fontWeight: "800" }, fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.xs }, meta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface, fontSize: 14 }, textarea: { minHeight: 90, paddingTop: spacing.md, textAlignVertical: "top" }, disabled: { backgroundColor: colors.background, color: colors.muted }, counter: { color: colors.muted, fontSize: 10, textAlign: "right", marginTop: spacing.xs },
  list: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md }, questionRow: { flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, marginTop: spacing.sm, overflow: "hidden" }, active: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, questionPress: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }, order: { width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }, orderActive: { backgroundColor: colors.primary }, orderText: { color: colors.primaryDark, fontSize: 12, fontWeight: "900" }, orderTextActive: { color: "#FFFFFF" }, question: { color: colors.text, fontSize: 13, fontWeight: "800", lineHeight: 18 }, icon: { minWidth: 42, minHeight: 42, alignItems: "center", justifyContent: "center" },
  settings: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: "#B9E7EE", backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }, settingsTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" }, panel: { gap: spacing.sm, marginTop: spacing.md }, toggle: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md }, toggleLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  timer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: spacing.md, marginTop: spacing.md }, timerDanger: { backgroundColor: "#FDECEF" }, timerText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, inline: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }, link: { color: colors.primaryDark, fontSize: 12, lineHeight: 18, marginTop: spacing.md, marginBottom: spacing.sm },
  response: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.md }, name: { color: colors.text, fontSize: 13, fontWeight: "900" }, answer: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: spacing.sm }, miniActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }, mini: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm }, miniText: { color: colors.primaryDark, fontSize: 11, fontWeight: "800" },
});
