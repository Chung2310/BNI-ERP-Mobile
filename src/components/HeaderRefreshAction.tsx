import { RefreshCw } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { colors, touchTarget } from "@/theme/tokens";

export function HeaderRefreshAction({ onPress, disabled = false, label = "Làm mới dữ liệu" }: { onPress: () => void; disabled?: boolean; label?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}>
    <RefreshCw color={colors.primaryDark} size={21} />
  </Pressable>;
}

const styles = StyleSheet.create({
  action: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.4 },
});
