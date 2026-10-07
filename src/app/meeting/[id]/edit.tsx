import { Alert } from "@/components/AppAlert";
import { useMemo, useState, type ReactNode } from "react";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { ImagePlus, MapPin, Plus, Save, Trash2, Upload } from "lucide-react-native";
import {  Image, Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { DateTimeField } from "@/components/DateTimeField";
import { Button, Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, meetingVersion, type Meeting, type SpeakingTimeSlot } from "@/services/meeting";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { parseVietnamDateTime, validateSpeakingTimeSlots } from "@/utils/meetingForm";

const vietnamInput = (value?: string) => value ? new Date(new Date(value).getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace("T", " ") : "";

export default function EditMeetingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: meeting, error, isLoading, reload } = useAsyncData(() => meetingService.get(id), id);
  if (isLoading) return <Screen><BackHeader title="Chỉnh sửa cuộc họp" /><LoadingState /></Screen>;
  if (error || !meeting) return <Screen><BackHeader title="Chỉnh sửa cuộc họp" /><ErrorState message={error || "Không tìm thấy cuộc họp."} onRetry={reload} /></Screen>;
  return <EditForm key={meeting._id + meetingVersion(meeting)} meeting={meeting} />;
}

function EditForm({ meeting }: { meeting: Meeting }) {
  const [title, setTitle] = useState(meeting.title);
  const [startsAt, setStartsAt] = useState(vietnamInput(meeting.startsAt));
  const [endsAt, setEndsAt] = useState(vietnamInput(meeting.endsAt));
  const [location, setLocation] = useState(meeting.location || "");
  const [latitude, setLatitude] = useState(meeting.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(meeting.longitude?.toString() || "");
  const [gpsRadiusMeters, setGpsRadiusMeters] = useState(String(meeting.gpsRadiusMeters || 200));
  const [coverImage, setCoverImage] = useState(meeting.coverImage || "");
  const [reminderDays, setReminderDays] = useState(String(meeting.reminderDays ?? 1));
  const [tiers, setTiers] = useState<SpeakingTimeSlot[]>(meeting.tiers?.length ? meeting.tiers.map((slot) => ({ ...slot })) : [{ startTime: "07:00", endTime: "08:00", seconds: 30 }, { startTime: "08:00", endTime: "09:00", seconds: 20 }]);
  const [fallbackSeconds, setFallbackSeconds] = useState(String(meeting.fallbackSeconds || 20));
  const [bulk, setBulk] = useState(false);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openedAt] = useState(Date.now);
  const { data: history } = useAsyncData(() => meeting.seriesId ? meetingService.history() : Promise.resolve([]), meeting.seriesId || "single");
  const seriesMeetings = useMemo(() => (history || []).filter((item) => item.seriesId === meeting.seriesId && item.status === "scheduled" && new Date(item.startsAt).getTime() > openedAt).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)), [history, meeting.seriesId, openedAt]);

  const updateSlot = (index: number, change: Partial<SpeakingTimeSlot>) =>
    setTiers((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...change } : slot));

  const locate = async () => {
    setLocating(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Bạn cần cấp quyền vị trí để lấy tọa độ.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lấy vị trí.");
    } finally {
      setLocating(false);
    }
  };

  const pickCover = async () => {
    setError("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Bạn cần cấp quyền thư viện ảnh.");
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.85, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error("Ảnh bìa không được vượt quá 10MB.");
      if (!asset.base64) throw new Error("Không đọc được dữ liệu ảnh.");
      setUploading(true);
      setCoverImage(await meetingService.uploadCover(asset.base64));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải ảnh bìa.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (saving || uploading) return;
    setError("");
    try {
      const start = parseVietnamDateTime(startsAt);
      const end = parseVietnamDateTime(endsAt);
      const radius = Number(gpsRadiusMeters);
      const reminder = Number(reminderDays);
      const fallback = Number(fallbackSeconds);
      if (!title.trim()) throw new Error("Vui lòng nhập tên cuộc họp.");
      if (!start || !end || end <= start) throw new Error("Thời gian bắt đầu và kết thúc không hợp lệ.");
      if (!Number.isInteger(radius) || radius < 50 || radius > 5000) throw new Error("Bán kính GPS phải từ 50 đến 5000 mét.");
      if (!Number.isInteger(reminder) || reminder < 0 || reminder > 365) throw new Error("Số ngày nhắc hẹn phải từ 0 đến 365.");
      if (!Number.isInteger(fallback) || fallback < 1 || fallback > 3600) throw new Error("Thời lượng ngoài khung phải từ 1 đến 3600 giây.");
      const slotError = validateSpeakingTimeSlots(tiers);
      if (slotError) throw new Error(slotError);
      if ((latitude && !longitude) || (!latitude && longitude)) throw new Error("Vui lòng nhập đủ vĩ độ và kinh độ.");
      const lat = latitude ? Number(latitude) : null;
      const lng = longitude ? Number(longitude) : null;
      if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) throw new Error("Vĩ độ không hợp lệ.");
      if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) throw new Error("Kinh độ không hợp lệ.");
      setSaving(true);
      await meetingService.update(meeting._id, {
        version: meetingVersion(meeting),
        title: title.trim(),
        ...(meeting.status === "scheduled" ? { startsAt: start.toISOString() } : {}),
        endsAt: end.toISOString(),
        location: location.trim(),
        latitude: lat,
        longitude: lng,
        gpsRadiusMeters: radius,
        coverImage,
        reminderDays: reminder,
        tiers,
        fallbackSeconds: fallback,
      });
      if (bulk && meeting.seriesId && seriesMeetings.length) {
        const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
        await meetingService.updateSeries(meeting._id, seriesMeetings.map((item) => item._id), {
          location: location.trim(),
          latitude: lat,
          longitude: lng,
          gpsRadiusMeters: radius,
          coverImage,
          startsTime: startsAt.slice(11, 16),
          durationMinutes,
          tiers,
          fallbackSeconds: fallback,
        });
      }
      Alert.alert("Cập nhật thành công", bulk ? `Đã cập nhật cuộc họp và ${seriesMeetings.length} buổi sắp tới.` : "Thông tin cuộc họp đã được lưu.", [{ text: "Xong", onPress: () => router.back() }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật cuộc họp.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Chỉnh sửa cuộc họp" subtitle={meeting.status === "scheduled" ? "Có thể thay đổi toàn bộ thông tin" : "Không thể đổi giờ bắt đầu khi cuộc họp đã mở"} compact />
      <FormSection title="Thông tin chung">
        <Field label="Tên cuộc họp *" value={title} onChangeText={setTitle} placeholder="Tên cuộc họp" maxLength={200} />
        {meeting.status === "scheduled" ? <DateTimeField label="Thời gian bắt đầu *" mode="datetime" value={startsAt} onChange={setStartsAt} /> : <View><Text style={styles.label}>THỜI GIAN BẮT ĐẦU</Text><Text style={styles.readonly}>{new Date(meeting.startsAt).toLocaleString("vi-VN")}</Text></View>}
        <DateTimeField label="Thời gian kết thúc *" mode="datetime" value={endsAt} onChange={setEndsAt} />
        <Field label="Địa điểm / Link họp" value={location} onChangeText={setLocation} placeholder="Khách sạn / Zoom" maxLength={500} />
      </FormSection>

      <FormSection title="Vị trí check-in">
        <Button icon={MapPin} tone="secondary" fullWidth disabled={locating} onPress={locate}>{locating ? "Đang lấy vị trí…" : "Lấy vị trí hiện tại"}</Button>
        <View style={styles.columns}><View style={styles.column}><Field label="Vĩ độ" value={latitude} onChangeText={setLatitude} placeholder="10.776" keyboardType="decimal-pad" /></View><View style={styles.column}><Field label="Kinh độ" value={longitude} onChangeText={setLongitude} placeholder="106.700" keyboardType="decimal-pad" /></View></View>
        <Field label="Bán kính cho phép (m) *" value={gpsRadiusMeters} onChangeText={setGpsRadiusMeters} placeholder="200" keyboardType="number-pad" />
      </FormSection>

      <FormSection title="Ảnh bìa sự kiện">
        {coverImage ? <Image source={{ uri: coverImage }} style={styles.cover} /> : <View style={styles.coverPlaceholder}><ImagePlus color={colors.primary} size={34} /><Text style={styles.help}>Chưa có ảnh bìa</Text></View>}
        <View style={styles.columns}><View style={styles.column}><Button icon={Upload} tone="secondary" fullWidth disabled={uploading} onPress={pickCover}>{uploading ? "Đang tải…" : "Chọn ảnh"}</Button></View>{coverImage ? <View style={styles.column}><Button icon={Trash2} tone="secondary" fullWidth onPress={() => setCoverImage("")}>Xóa ảnh</Button></View> : null}</View>
      </FormSection>

      <FormSection title="Nhắc hẹn">
        <Field label="Nhắc hẹn trước (ngày)" value={reminderDays} onChangeText={setReminderDays} placeholder="1" keyboardType="number-pad" />
      </FormSection>

      <FormSection title="Thời lượng phát biểu theo giờ check-in">
        <Text style={styles.help}>Áp dụng cho thành viên và khách mời theo giờ Việt Nam.</Text>
        {tiers.map((slot, index) => <View key={index} style={styles.slot}>
          <View style={styles.slotHeader}><Text style={styles.slotTitle}>Khung {index + 1}</Text><Pressable accessibilityLabel={`Xóa khung ${index + 1}`} disabled={tiers.length <= 1} onPress={() => setTiers((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.remove}><Trash2 color={colors.danger} size={18} /></Pressable></View>
          <View style={styles.columns}><View style={styles.column}><DateTimeField label="Từ giờ *" mode="time" value={slot.startTime} onChange={(value) => updateSlot(index, { startTime: value })} /></View><View style={styles.column}><DateTimeField label="Đến giờ *" mode="time" value={slot.endTime} onChange={(value) => updateSlot(index, { endTime: value })} /></View></View>
          <Field label="Số giây phát biểu *" value={Number.isFinite(slot.seconds) ? String(slot.seconds) : ""} onChangeText={(value) => updateSlot(index, { seconds: Number(value) })} placeholder="30" keyboardType="number-pad" />
        </View>)}
        <Button icon={Plus} tone="secondary" fullWidth disabled={tiers.length >= 20} onPress={() => setTiers((current) => [...current, { startTime: current.at(-1)?.endTime || "", endTime: "", seconds: Number(fallbackSeconds) || 20 }])}>Thêm khung giờ</Button>
        <Field label="Ngoài khung giờ (giây) *" value={fallbackSeconds} onChangeText={setFallbackSeconds} placeholder="20" keyboardType="number-pad" />
      </FormSection>

      {meeting.seriesId && meeting.status === "scheduled" ? <Card style={styles.bulk}>
        <View style={styles.bulkRow}><View style={styles.bulkText}><Text style={styles.sectionTitle}>Sửa hàng loạt</Text><Text style={styles.help}>Áp dụng địa điểm, GPS, ảnh bìa, giờ họp và thời lượng phát biểu cho {seriesMeetings.length} buổi sắp tới trong chuỗi.</Text></View><Switch value={bulk} onValueChange={setBulk} trackColor={{ true: colors.primary }} /></View>
      </Card> : null}

      {error ? <Card style={styles.errorCard}><Text style={styles.error}>{error}</Text></Card> : null}
      <Button icon={Save} fullWidth disabled={saving || uploading} onPress={save}>{saving ? "Đang lưu…" : bulk ? "Lưu và áp dụng hàng loạt" : "Lưu thay đổi"}</Button>
    </Screen>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <Card style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</Card>;
}
function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label.toUpperCase()}</Text><TextInput {...props} placeholderTextColor={colors.muted} style={styles.input} /></View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  field: { gap: spacing.xs },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  input: { minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md },
  readonly: { marginTop: spacing.xs, borderRadius: radius.md, backgroundColor: colors.background, color: colors.muted, padding: spacing.md },
  columns: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  column: { flex: 1 },
  cover: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: colors.background },
  coverPlaceholder: { height: 130, alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  slot: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, padding: spacing.md },
  slotHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  remove: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  bulk: { borderColor: "#B9E7EE", backgroundColor: colors.primarySoft },
  bulkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bulkText: { flex: 1, gap: spacing.xs },
  errorCard: { borderColor: "#F4BCC5", backgroundColor: "#FFF4F6" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
});
