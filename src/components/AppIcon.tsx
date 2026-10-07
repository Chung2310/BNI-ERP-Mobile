import type { LucideIcon } from "lucide-react-native";
import { colors } from "@/theme/tokens";

export function AppIcon({ icon: Icon, size = 20, color = colors.primaryDark, strokeWidth = 2 }: { icon: LucideIcon; size?: number; color?: string; strokeWidth?: number }) {
  return <Icon aria-hidden color={color} size={size} strokeWidth={strokeWidth} />;
}
