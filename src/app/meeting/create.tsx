import { Alert } from "@/components/AppAlert";
import { useMemo, useState, type ReactNode } from "react";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarPlus, CalendarRange, ImagePlus, MapPin, Plus, Trash2, Upload, type LucideIcon } from "lucide-react-native";
import {
  ActivityIndicator,

  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { DateTimeField } from "@/components/DateTimeField";
import { Button, Card, Screen } from "@/components/ui";
import { meetingService, type MeetingPoint, type MeetingRecurrence, type SpeakingTimeSlot } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";
import { defaultSpeakingTimeSlots, parseVietnamDateTime, recurringMeetingDates, twoHoursAfter, validateSpeakingTimeSlots } from "@/utils/meetingForm";

type CreateMode = "single" | "recurring";

const weekdays = [
  { value: 1, label: "Thứ Hai" },
  { value: 2, label: "Thứ Ba" },
  { value: 3, label: "Thứ Tư" },
  { value: 4, label: "Thứ Năm" },
  { value: 5, label: "Thứ Sáu" },
  { value: 6, label: "Thứ Bảy" },
  { value: 0, label: "Chủ nhật" },
];

export default function CreateMeetingScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const initialDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  const [mode, setMode] = useState<CreateMode>("single");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(() => initialDate ? `${initialDate} 07:00` : "");
  const [endsAt, setEndsAt] = useState(() => initialDate ? `${initialDate} 09:00` : "");
  const [recurrence, setRecurrence] = useState<MeetingRecurrence>({
    startDate: initialDate,
    months: 6,
    weekday: initialDate ? new Date(`${initialDate}T00:00:00`).getDay() : 3,
    time: "07:00",
    durationMinutes: 120,
  });
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [gpsRadiusMeters, setGpsRadiusMeters] = useState("200");
  const [coverImage, setCoverImage] = useState("");
  const [reminderDays, setReminderDays] = useState("1");
  const [tiers, setTiers] = useState(defaultSpeakingTimeSlots);
  const [fallbackSeconds, setFallbackSeconds] = useState("20");
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const preview = useMemo(() => recurringMeetingDates(recurrence), [recurrence]);
  const updateRecurrence = <K extends keyof MeetingRecurrence>(key: K, value: MeetingRecurrence[K]) =>
    setRecurrence((current) => ({ ...current, [key]: value }));
  const updateSlot = (index: number, change: Partial<SpeakingTimeSlot>) =>
    setTiers((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...change } : slot));

  const locate = async () => {
    setLocating(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Bạn cần cấp quyền vị trí để lấy tọa độ hiện tại.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lấy vị trí hiện tại.");
    } finally {
      setLocating(false);
    }
  };

  const pickCover = async () => {
    setError("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Bạn cần cấp quyền thư viện ảnh để chọn ảnh bìa.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error("Ảnh bìa không được vượt quá 10MB.");
      if (!asset.base64) throw new Error("Không đọc được dữ liệu ảnh đã chọn.");
      setUploading(true);
      setCoverImage(await meetingService.uploadCover(asset.base64));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải ảnh bìa.");
    } finally {
      setUploading(false);
    }
  };

  const commonPayload = () => {
    const radius = Number(gpsRadiusMeters);
    const reminder = Number(reminderDays);
    const fallback = Number(fallbackSeconds);
    if (!Number.isInteger(radius) || radius < 50 || radius > 5000) throw new Error("Bán kính GPS phải từ 50 đến 5000 mét.");
    if (!Number.isInteger(reminder) || reminder < 0 || reminder > 365) throw new Error("Số ngày nhắc hẹn phải từ 0 đến 365.");
    if (!Number.isInteger(fallback) || fallback < 1 || fallback > 3600) throw new Error("Thời lượng ngoài khung phải từ 1 đến 3600 giây.");
    const slotError = validateSpeakingTimeSlots(tiers);
    if (slotError) throw new Error(slotError);
    if ((latitude && !longitude) || (!latitude && longitude)) throw new Error("Vui lòng nhập đủ vĩ độ và kinh độ.");
    let point: MeetingPoint | undefined;
    if (latitude && longitude) {
      point = { latitude: Number(latitude), longitude: Number(longitude) };
      if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90 || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
        throw new Error("Tọa độ GPS không hợp lệ.");
      }
    }
    return {
      location: location.trim(),
      ...(point || {}),
      gpsRadiusMeters: radius,
      coverImage: coverImage.trim(),
      reminderDays: reminder,
      tiers,
      fallbackSeconds: fallback,
    };
  };

  const save = async () => {
    if (saving || uploading) return;
    setError("");
    try {
      const common = commonPayload();
      setSaving(true);
      if (mode === "single") {
        const start = parseVietnamDateTime(startsAt);
        const end = parseVietnamDateTime(endsAt);
        if (!title.trim()) throw new Error("Vui lòng nhập tên cuộc họp.");
        if (title.trim().length > 200) throw new Error("Tên cuộc họp không được vượt quá 200 ký tự.");
        if (!start || !end) throw new Error("Thời gian phải theo định dạng YYYY-MM-DD HH:mm.");
        if (end <= start) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
        const meeting = await meetingService.create({ ...common, title: title.trim(), startsAt: start.toISOString(), endsAt: end.toISOString() });
        router.replace({ pathname: "/meeting/[id]", params: { id: meeting._id } });
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(recurrence.startDate)) throw new Error("Ngày bắt đầu chu kỳ phải theo định dạng YYYY-MM-DD.");
        if (!Number.isInteger(recurrence.months) || recurrence.months < 1 || recurrence.months > 12) throw new Error("Chu kỳ phải từ 1 đến 12 tháng.");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(recurrence.time)) throw new Error("Giờ bắt đầu phải theo định dạng HH:mm.");
        if (!Number.isInteger(recurrence.durationMinutes) || recurrence.durationMinutes < 1 || recurrence.durationMinutes > 1440) throw new Error("Thời lượng mỗi buổi phải từ 1 đến 1440 phút.");
        if (!preview.length) throw new Error("Không có buổi họp nào trong chu kỳ đã chọn.");
        const meetings = await meetingService.createSeries({ ...common, recurrence });
        Alert.alert("Tạo lịch thành công", `Đã tạo ${meetings.length} buổi họp định kỳ.`, [
          { text: "Xem lịch", onPress: () => router.replace("/meetings") },
        ]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo cuộc họp.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Tạo cuộc họp" subtitle="Thiết lập đầy đủ như hệ thống web" compact />
      <View accessibilityRole="tablist" style={styles.modeRow}>
        <ModeButton active={mode === "single"} icon={CalendarPlus} label="Tạo đơn" onPress={() => setMode("single")} />
        <ModeButton active={mode === "recurring"} icon={CalendarRange} label="Tạo hàng loạt" onPress={() => setMode("recurring")} />
      </View>

      {mode === "single" ? (
        <FormSection title="Thông tin cuộc họp">
          <Field label="Tên cuộc họp *" value={title} onChangeText={setTitle} placeholder="Ví dụ: Buổi họp định kỳ Chapter Tuần 40" maxLength={200} />
          <DateTimeField label="Thời gian bắt đầu *" mode="datetime" value={startsAt} onChange={(value) => { setStartsAt(value); if (!endsAt || endsAt <= value) setEndsAt(twoHoursAfter(value)); }} />
          <DateTimeField label="Thời gian kết thúc *" mode="datetime" value={endsAt} onChange={setEndsAt} help="QR dùng chung nhận check-in từ giờ bắt đầu đến trước giờ kết thúc. Mặc định 2 giờ." />
        </FormSection>
      ) : (
        <FormSection title="Lịch định kỳ" tone="primary">
          <DateTimeField label="Từ ngày *" mode="date" value={recurrence.startDate} onChange={(value) => updateRecurrence("startDate", value)} />
          <Field label="Trong thời gian (tháng) *" value={Number.isFinite(recurrence.months) ? String(recurrence.months) : ""} onChangeText={(value) => updateRecurrence("months", Number(value))} placeholder="1 - 12" keyboardType="number-pad" />
          <Text style={styles.label}>THỨ DIỄN RA *</Text>
          <View style={styles.chips}>{weekdays.map((day) => <Chip key={day.value} active={recurrence.weekday === day.value} label={day.label} onPress={() => updateRecurrence("weekday", day.value)} />)}</View>
          <DateTimeField label="Giờ bắt đầu *" mode="time" value={recurrence.time} onChange={(value) => updateRecurrence("time", value)} />
          <Field label="Thời lượng mỗi buổi (phút) *" value={Number.isFinite(recurrence.durationMinutes) ? String(recurrence.durationMinutes) : ""} onChangeText={(value) => updateRecurrence("durationMinutes", Number(value))} placeholder="120" keyboardType="number-pad" />
          <View style={styles.chips}>{[60, 90, 120].map((minutes) => <Chip key={minutes} active={recurrence.durationMinutes === minutes} label={`${minutes} phút`} onPress={() => updateRecurrence("durationMinutes", minutes)} />)}</View>
          {preview.length ? <Text style={styles.preview}>Sẽ tạo {preview.length} buổi · {preview[0].toLocaleDateString("vi-VN")} → {preview[preview.length - 1].toLocaleDateString("vi-VN")}</Text> : null}
        </FormSection>
      )}

      <FormSection title="Địa điểm và check-in">
        <Field label="Địa điểm / Link họp" value={location} onChangeText={setLocation} placeholder="Khách sạn New World / Zoom" maxLength={500} />
        <Button icon={MapPin} tone="secondary" fullWidth disabled={locating} onPress={locate} style={styles.actionBtn}>{locating ? "Đang lấy vị trí…" : "Lấy vị trí hiện tại"}</Button>
        <View style={styles.twoColumns}>
          <View style={styles.column}><Field label="Vĩ độ" value={latitude} onChangeText={setLatitude} placeholder="10.776" keyboardType="decimal-pad" /></View>
          <View style={styles.column}><Field label="Kinh độ" value={longitude} onChangeText={setLongitude} placeholder="106.700" keyboardType="decimal-pad" /></View>
        </View>
        <Field label="Bán kính cho phép (m) *" value={gpsRadiusMeters} onChangeText={setGpsRadiusMeters} placeholder="200" keyboardType="number-pad" help="Giá trị từ 50 đến 5000 mét." />
      </FormSection>

      <FormSection title="Ảnh bìa sự kiện">
        {coverImage ? <Image accessibilityLabel="Ảnh bìa cuộc họp" source={{ uri: coverImage }} style={styles.cover} /> : <View style={styles.coverPlaceholder}><ImagePlus color={colors.primary} size={34} /><Text style={styles.help}>PNG, JPG, WEBP hoặc GIF · tối đa 10MB</Text></View>}
        <Button icon={Upload} tone="secondary" fullWidth disabled={uploading} onPress={pickCover} style={styles.actionBtn}>{uploading ? "Đang tải ảnh…" : coverImage ? "Đổi ảnh bìa" : "Chọn ảnh từ máy"}</Button>
      </FormSection>

      <FormSection title="Nhắc hẹn">
        <Field label="Nhắc hẹn trước (ngày)" value={reminderDays} onChangeText={setReminderDays} placeholder="1" keyboardType="number-pad" />
      </FormSection>

      <FormSection title="Thời lượng phát biểu theo giờ check-in">
        <Text style={styles.help}>Áp dụng cho thành viên và khách mời theo giờ Việt Nam.</Text>
        {tiers.map((slot, index) => (
          <View key={index} style={styles.slot}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotTitle}>Khung {index + 1}</Text>
              <Pressable accessibilityLabel={`Xóa khung ${index + 1}`} disabled={tiers.length <= 1} onPress={() => setTiers((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={({ pressed }) => [styles.iconButton, tiers.length <= 1 && styles.disabled, pressed && styles.pressed]}><Trash2 color={colors.danger} size={18} /></Pressable>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><DateTimeField label="Từ giờ *" mode="time" value={slot.startTime} onChange={(value) => updateSlot(index, { startTime: value })} /></View>
              <View style={styles.column}><DateTimeField label="Đến giờ *" mode="time" value={slot.endTime} onChange={(value) => updateSlot(index, { endTime: value })} /></View>
            </View>
            <Field label="Số giây phát biểu *" value={Number.isFinite(slot.seconds) ? String(slot.seconds) : ""} onChangeText={(value) => updateSlot(index, { seconds: Number(value) })} placeholder="30" keyboardType="number-pad" />
          </View>
        ))}
        <Button icon={Plus} tone="secondary" fullWidth disabled={tiers.length >= 20} onPress={() => setTiers((current) => [...current, { startTime: current.at(-1)?.endTime || "", endTime: "", seconds: Number(fallbackSeconds) || 20 }])} style={styles.actionBtn}>Thêm khung giờ</Button>
        <Field label="Ngoài khung giờ (giây) *" value={fallbackSeconds} onChangeText={setFallbackSeconds} placeholder="20" keyboardType="number-pad" help="Dùng khi giờ check-in không nằm trong các khung đã cấu hình." />
      </FormSection>

      {error ? <Card style={styles.errorCard}><Text accessibilityRole="alert" style={styles.error}>{error}</Text></Card> : null}
      <Button icon={mode === "single" ? CalendarPlus : CalendarRange} fullWidth disabled={saving || uploading} onPress={save} style={styles.submitBtn}>
        {saving ? "Đang tạo…" : mode === "single" ? "Tạo cuộc họp" : preview.length ? `Tạo ${preview.length} buổi họp` : "Tạo lịch định kỳ"}
      </Button>
      {saving ? <ActivityIndicator color={colors.primary} /> : null}
    </Screen>
  );
}

function FormSection({ title, children, tone }: { title: string; children: ReactNode; tone?: "primary" }) {
  return <Card style={[styles.section, tone === "primary" && styles.sectionPrimary]}><Text style={styles.sectionTitle}>{title}</Text>{children}</Card>;
}

function Field({ label, help, ...props }: TextInputProps & { label: string; help?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label.toUpperCase()}</Text><TextInput {...props} placeholderTextColor={colors.muted} style={styles.input} />{help ? <Text style={styles.help}>{help}</Text> : null}</View>;
}

function ModeButton({ active, icon: Icon, label, onPress }: { active: boolean; icon: LucideIcon; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.modeButton, active && styles.modeButtonActive, pressed && styles.pressed]}><Icon color={active ? "#FFFFFF" : colors.primaryDark} size={17} strokeWidth={2.4} /><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>;
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", gap: spacing.sm },
  modeButton: { flex: 1, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  modeButtonActive: { backgroundColor: colors.primary },
  modeText: { color: colors.primaryDark, fontSize: 13.5, fontWeight: "800" },
  modeTextActive: { color: "#FFFFFF" },
  section: { gap: spacing.sm },
  sectionPrimary: { borderColor: "#B9E7EE", backgroundColor: colors.primarySoft },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  field: { gap: spacing.xs },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  input: { height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md, fontSize: 13.5 },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  preview: { borderRadius: radius.md, backgroundColor: colors.surface, color: colors.primaryDark, padding: spacing.md, fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  twoColumns: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  column: { flex: 1 },
  cover: { width: "100%", height: 140, borderRadius: radius.md, backgroundColor: colors.background },
  coverPlaceholder: { height: 100, alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  slot: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, padding: spacing.md },
  slotHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  actionBtn: { minHeight: 40, height: 40, borderRadius: radius.pill },
  submitBtn: { minHeight: 44, height: 44, borderRadius: radius.pill, marginTop: spacing.xs },
  errorCard: { borderColor: "#F4BCC5", backgroundColor: "#FFF4F6", padding: spacing.md },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
