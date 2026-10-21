import { createElement, type ChangeEvent, type CSSProperties } from "react";
import { View } from "react-native";
import { colors, radius, spacing } from "@/theme/tokens";
import type { MeetingCutoffTimePickerProps } from "./MeetingCutoffTimePicker";

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  boxSizing: "border-box",
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.text,
  padding: `0 ${spacing.md}px`,
  fontSize: 16,
};

export function MeetingCutoffTimePicker({ value, onChange, disabled = false }: MeetingCutoffTimePickerProps) {
  return <View style={{ flex: 1, minWidth: 0 }}>
    {createElement("input", {
      "aria-label": "Chọn giờ tham gia vòng quay",
      type: "time",
      value,
      disabled,
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
      style: inputStyle,
    })}
  </View>;
}
