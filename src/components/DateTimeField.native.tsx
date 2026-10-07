import { useState } from "react";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CalendarDays, Clock3 } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/theme/tokens";

export type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode: "date" | "time" | "datetime";
  help?: string;
  minimumDate?: Date;
};

const pad = (value: number) => String(value).padStart(2, "0");
const dateValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const timeValue = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

function parsed(value: string, part: "date" | "time") {
  const now = new Date();
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = value.match(/(?:^| )(\d{2}):(\d{2})$/);
  return new Date(
    dateMatch ? Number(dateMatch[1]) : now.getFullYear(),
    dateMatch ? Number(dateMatch[2]) - 1 : now.getMonth(),
    dateMatch ? Number(dateMatch[3]) : now.getDate(),
    timeMatch ? Number(timeMatch[1]) : part === "time" ? now.getHours() : 7,
    timeMatch ? Number(timeMatch[2]) : 0,
  );
}

function displayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Chọn ngày";
}

function displayTime(value: string) {
  const match = value.match(/(?:^| )(\d{2}:\d{2})$/);
  return match?.[1] || "Chọn giờ";
}

export function DateTimeField({ label, value, onChange, mode, help, minimumDate }: DateTimeFieldProps) {
  const changeDate = (next: Date) => {
    const time = value.match(/ (\d{2}:\d{2})$/)?.[1] || "07:00";
    onChange(mode === "datetime" ? `${dateValue(next)} ${time}` : dateValue(next));
  };
  const changeTime = (next: Date) => {
    const date = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || dateValue(new Date());
    onChange(mode === "datetime" ? `${date} ${timeValue(next)}` : timeValue(next));
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.row}>
        {mode !== "time" ? <PickerPart icon={CalendarDays} label={displayDate(value)} mode="date" value={parsed(value, "date")} minimumDate={minimumDate} onChange={changeDate} /> : null}
        {mode !== "date" ? <PickerPart icon={Clock3} label={displayTime(value)} mode="time" value={parsed(value, "time")} onChange={changeTime} /> : null}
      </View>
      {help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

function PickerPart({ icon: Icon, label, mode, value, minimumDate, onChange }: {
  icon: typeof CalendarDays;
  label: string;
  mode: "date" | "time";
  value: Date;
  minimumDate?: Date;
  onChange: (value: Date) => void;
}) {
  const [visible, setVisible] = useState(false);
  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setVisible(false);
    if (event.type === "set" && selected) onChange(selected);
  };
  return (
    <View style={styles.part}>
      <Pressable accessibilityRole="button" accessibilityLabel={mode === "date" ? "Chọn ngày" : "Chọn giờ"} onPress={() => setVisible(true)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Icon color={colors.primaryDark} size={18} />
        <Text style={styles.value}>{label}</Text>
      </Pressable>
      {visible ? <DateTimePicker value={value} mode={mode} display="default" is24Hour minimumDate={minimumDate} onChange={handleChange} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  row: { flexDirection: "row", gap: spacing.sm },
  part: { flex: 1 },
  button: { height: 42, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  value: { color: colors.text, fontSize: 13.5, fontWeight: "600" },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
});
