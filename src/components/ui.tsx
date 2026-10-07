import { useState, type PropsWithChildren, type ReactNode, type Ref } from "react";
import { CircleAlert, Inbox, type LucideIcon } from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardResponsiveView } from "@/components/KeyboardResponsiveView";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

export function Screen({
  children,
  scroll = true,
  style,
  scrollViewProps,
  scrollRef,
}: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle>; scrollViewProps?: ScrollViewProps; scrollRef?: Ref<ScrollView> }>) {
  const body = scroll ? (
    <ScrollView
      {...scrollViewProps}
      ref={scrollRef}
      contentContainerStyle={[styles.screenContent, style, scrollViewProps?.contentContainerStyle]}
      keyboardShouldPersistTaps={scrollViewProps?.keyboardShouldPersistTaps || "handled"}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.flex, style]}>{children}</View>
  );
  return <SafeAreaView edges={["top"]} style={styles.safe}>
    <KeyboardResponsiveView>{body}</KeyboardResponsiveView>
  </SafeAreaView>;
}

export function AppHeader({
  title,
  subtitle,
  action,
  avatar,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  avatar?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {avatar}
      <View style={styles.flex}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.caption}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Avatar({
  initials,
  url,
  size = 44,
  style,
}: {
  initials: string;
  url?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [imageError, setImageError] = useState(false);

  if (url && !imageError) {
    return (
      <Image
        source={{ uri: url }}
        onError={() => setImageError(true)}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
          style as ImageStyle,
        ]}
      />
    );
  }

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Text style={[styles.avatarText, { fontSize: Math.max(11, size * 0.27) }]}>{initials}</Text>
    </View>
  );
}

type BadgeTone = "default" | "primary" | "danger" | "warning";

export function Badge({ children, tone = "default" }: PropsWithChildren<{ tone?: BadgeTone }>) {
  return (
    <View style={[styles.badge, badgeToneStyles[tone]]}>
      <Text style={[styles.badgeText, badgeTextToneStyles[tone]]}>{children}</Text>
    </View>
  );
}

type ButtonProps = PressableProps & {
  children: ReactNode;
  tone?: ButtonTone;
  fullWidth?: boolean;
  icon?: LucideIcon;
  iconColor?: string;
  textStyle?: StyleProp<TextStyle>;
};

type ButtonTone = "primary" | "secondary" | "danger";

export function Button({
  children,
  tone = "primary",
  fullWidth,
  icon: Icon,
  iconColor: customIconColor,
  textStyle,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const iconColor = customIconColor ?? (tone === "secondary" ? colors.text : "#FFFFFF");
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.button,
        buttonToneStyles[tone],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <View style={styles.buttonContent}>
        {Icon ? <Icon color={iconColor} size={18} strokeWidth={2.2} /> : null}
        <Text style={[styles.buttonText, buttonTextToneStyles[tone], textStyle]}>{children}</Text>
      </View>
    </Pressable>
  );
}

export function SectionTitle({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionTitleText}>{children}</Text>{action}</View>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <Card style={styles.state}><Inbox color={colors.primary} size={30} strokeWidth={1.8} /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateMessage}>{message}</Text></Card>;
}

export function LoadingState({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.caption}>{label}</Text></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={styles.state}>
      <CircleAlert color={colors.danger} size={30} strokeWidth={1.8} />
      <Text style={styles.stateTitle}>Không thể tải dữ liệu</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      <Button tone="secondary" style={styles.retryButton} textStyle={styles.retryText} onPress={onRetry}>Thử lại</Button>
    </Card>
  );
}

export const textStyles: Record<string, TextStyle> = {
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  body: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
  caption: { color: colors.muted, fontSize: 11.5, lineHeight: 16 },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  screenContent: { flexGrow: 1, gap: 10, paddingHorizontal: 8, paddingVertical: spacing.sm, paddingBottom: spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2, paddingHorizontal: 4 },
  headerTitle: { color: colors.text, fontSize: 16.5, fontWeight: "800" },
  caption: { color: colors.muted, fontSize: 11.5, lineHeight: 16 },
  card: { borderWidth: 0, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.md },
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#B9E7EE" },
  avatarText: { color: colors.primaryDark, fontWeight: "900" },
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: "#EDF3F5" },
  badge_primary: { backgroundColor: colors.primarySoft },
  badge_danger: { backgroundColor: "#FDECEF" },
  badge_warning: { backgroundColor: "#FFF2D9" },
  badge_default: {},
  badgeText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  badgeText_primary: { color: colors.primaryDark },
  badgeText_danger: { color: "#A72B40" },
  badgeText_warning: { color: "#996316" },
  badgeText_default: {},
  button: { minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1 },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  button_primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  button_secondary: { backgroundColor: colors.surface, borderColor: colors.border },
  button_danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  buttonText: { fontSize: 14, fontWeight: "800" },
  buttonText_primary: { color: "#FFFFFF" },
  buttonText_secondary: { color: colors.text },
  buttonText_danger: { color: "#FFFFFF" },
  fullWidth: { width: "100%" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  sectionTitle: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: 8,
  },
  sectionTitleText: { color: colors.text, fontSize: 13.5, fontWeight: "700" },
  state: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  stateTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  stateMessage: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  retryButton: { backgroundColor: "#FFFFFF", borderWidth: 0 },
  retryText: { color: colors.danger },
  loading: { flex: 1, minHeight: 180, alignItems: "center", justifyContent: "center", gap: spacing.md },
});

const badgeToneStyles: Record<BadgeTone, ViewStyle> = {
  default: styles.badge_default,
  primary: styles.badge_primary,
  danger: styles.badge_danger,
  warning: styles.badge_warning,
};

const badgeTextToneStyles: Record<BadgeTone, TextStyle> = {
  default: styles.badgeText_default,
  primary: styles.badgeText_primary,
  danger: styles.badgeText_danger,
  warning: styles.badgeText_warning,
};

const buttonToneStyles: Record<ButtonTone, ViewStyle> = {
  primary: styles.button_primary,
  secondary: styles.button_secondary,
  danger: styles.button_danger,
};

const buttonTextToneStyles: Record<ButtonTone, TextStyle> = {
  primary: styles.buttonText_primary,
  secondary: styles.buttonText_secondary,
  danger: styles.buttonText_danger,
};
