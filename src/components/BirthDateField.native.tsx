import { useState } from "react";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { BirthDateFieldProps } from "./BirthDateField";

const pad = (part: number) => String(part).padStart(2, "0");
const toValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(1990, 0, 1);
};
const displayValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Chọn ngày sinh";
};

export function BirthDateField({ value, onChange, disabled = false }: BirthDateFieldProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => fromValue(value));

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: fromValue(value),
        mode: "date",
        display: "calendar",
        maximumDate: new Date(),
        onValueChange: (_event, selected) => onChange(toValue(selected)),
      });
      return;
    }
    setDraft(fromValue(value));
    setVisible(true);
  };

  return <View style={styles.field}>
    <Text style={styles.label}>Ngày sinh</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Chọn ngày sinh" accessibilityState={{ disabled }} disabled={disabled} onPress={open} style={styles.input}>
      <CalendarDays size={18} color={colors.primaryDark} />
      <Text style={[styles.value, !value && styles.placeholder]}>{displayValue(value)}</Text>
    </Pressable>
    {visible ? <Modal visible transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Đóng lịch" onPress={() => setVisible(false)} />
        <View style={styles.dialog}>
          <Text style={styles.title}>Chọn ngày sinh</Text>
          <DateTimePicker value={draft} mode="date" display="inline" maximumDate={new Date()} onValueChange={(_event, selected) => setDraft(selected)} />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={styles.cancel}><Text style={styles.cancelText}>Hủy</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { onChange(toValue(draft)); setVisible(false); }} style={styles.confirm}><Text style={styles.confirmText}>Xác nhận</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal> : null}
  </View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: spacing.xs },
  input: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  value: { color: colors.text, fontSize: 14 },
  placeholder: { color: colors.muted },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, paddingHorizontal: spacing.lg },
  dialog: { width: "100%", maxWidth: 400, borderRadius: 28, overflow: "hidden", backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: "800", paddingHorizontal: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
  cancel: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.background },
  confirm: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.brandBlue },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  confirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
