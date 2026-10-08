import { createElement, type ChangeEvent, type CSSProperties } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { BirthDateFieldProps } from "./BirthDateField";

const inputStyle: CSSProperties = {
  width: "100%", minHeight: touchTarget, boxSizing: "border-box",
  border: `1px solid ${colors.border}`, borderRadius: radius.md,
  background: colors.surface, color: colors.text, padding: `0 ${spacing.md}px`, fontSize: 14,
};

const todayValue = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export function BirthDateField({ value, onChange, disabled = false }: BirthDateFieldProps) {
  return <View style={styles.field}>
    <Text style={styles.label}>Ngày sinh</Text>
    {createElement("input", {
      "aria-label": "Chọn ngày sinh",
      type: "date",
      value,
      max: todayValue(),
      disabled,
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
      style: inputStyle,
    })}
  </View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: spacing.xs },
});
