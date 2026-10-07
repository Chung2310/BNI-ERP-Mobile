import { createElement, type ChangeEvent, type CSSProperties } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme/tokens";

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode: "date" | "time" | "datetime";
  help?: string;
  minimumDate?: Date;
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  boxSizing: "border-box",
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  background: colors.background,
  color: colors.text,
  padding: "0 12px",
  fontSize: 14,
  fontFamily: "inherit",
};

export function DateTimeField({ label, value, onChange, mode, help, minimumDate }: DateTimeFieldProps) {
  const type = mode === "datetime" ? "datetime-local" : mode;
  const webValue = mode === "datetime" ? value.replace(" ", "T") : value;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      {createElement("input", {
        "aria-label": label,
        type,
        value: webValue,
        min: mode === "date" && minimumDate ? minimumDate.toISOString().slice(0, 10) : undefined,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(mode === "datetime" ? event.target.value.replace("T", " ") : event.target.value),
        style: inputStyle,
      })}
      {help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
