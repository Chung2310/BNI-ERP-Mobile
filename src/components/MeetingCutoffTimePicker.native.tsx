import { useState } from "react";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Clock3 } from "lucide-react-native";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { MeetingCutoffTimePickerProps } from "./MeetingCutoffTimePicker";

const pad = (part: number) => String(part).padStart(2, "0");
const toTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const fromTime = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const date = new Date();
  date.setHours(match ? Number(match[1]) : 7, match ? Number(match[2]) : 0, 0, 0);
  return date;
};

export function MeetingCutoffTimePicker({ value, onChange, disabled = false }: MeetingCutoffTimePickerProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => fromTime(value));

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: fromTime(value),
        mode: "time",
        display: "clock",
        is24Hour: true,
        onValueChange: (_event, selected) => onChange(toTime(selected)),
      });
      return;
    }
    setDraft(fromTime(value));
    setVisible(true);
  };

  return <View style={styles.container}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chọn giờ tham gia vòng quay, hiện tại ${value}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={open}
      style={({ pressed }) => [styles.input, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Clock3 size={20} color={colors.primaryDark} />
      <Text style={styles.value}>{value}</Text>
    </Pressable>
    {visible ? <Modal visible transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Đóng bộ chọn giờ" onPress={() => setVisible(false)} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>Chọn giờ tham gia vòng quay</Text>
          <DateTimePicker value={draft} mode="time" display="spinner" locale="vi-VN" onValueChange={(_event, selected) => setDraft(selected)} />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={styles.cancel}><Text style={styles.cancelText}>Hủy</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { onChange(toTime(draft)); setVisible(false); }} style={styles.confirm}><Text style={styles.confirmText}>Chọn giờ</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0 },
  input: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  value: { color: colors.text, fontSize: 16 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, paddingHorizontal: spacing.lg },
  dialog: { width: "100%", maxWidth: 400, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm },
  cancel: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.background },
  confirm: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.brandBlue },
  cancelText: { color: colors.muted, fontSize: 14 },
  confirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
