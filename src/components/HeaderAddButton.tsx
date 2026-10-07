import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { colors, radius } from "@/theme/tokens";

type Props = {
  accessibilityLabel: string;
  onPress: () => void;
};

export function HeaderAddButton({ accessibilityLabel, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Plus color="#FFFFFF" size={20} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.75 },
});
