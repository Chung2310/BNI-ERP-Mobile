import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

type AlertButton = { text?: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" };
type AlertOptions = { cancelable?: boolean; onDismiss?: () => void };
type AlertRequest = { title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions };

const queue: AlertRequest[] = [];
let notify: (() => void) | null = null;

function safeMessage(message?: string) {
  if (!message) return "";
  const firstLine = message.trim().split(/\r?\n/)[0];
  const cleaned = firstLine.replace(/\s*\(?\b(?:mã lỗi|error code|status|code)\s*[:=]?\s*[A-Z0-9_-]+\)?/gi, "").trim();
  if (!cleaned || /(?:\b(?:HTTP\s*\d{3}|Error:|Exception|TypeError|ReferenceError|SyntaxError|Mongo|Mongoose|ECONN\w*|ETIMEDOUT|undefined|stack trace)\b|\b[45]\d{2}\b|\bE\d{4,}\b|\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b|^[{<])/i.test(cleaned)) {
    return "Có lỗi xảy ra. Vui lòng thử lại.";
  }
  return cleaned;
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    queue.push({ title, message: safeMessage(message), buttons: buttons?.length ? buttons : [{ text: "Đóng" }], options });
    notify?.();
  },
};

export function AppAlertHost() {
  const [current, setCurrent] = useState<AlertRequest | null>(null);

  useEffect(() => {
    notify = () => setCurrent((shown) => shown || queue.shift() || null);
    notify();
    return () => { notify = null; };
  }, []);

  const dismiss = (button?: AlertButton) => {
    if (!current) return;
    const callback = button?.onPress || current.options?.onDismiss;
    setCurrent(queue.shift() || null);
    if (callback) setTimeout(callback, 0);
  };
  const cancel = () => {
    if (!current) return;
    const cancelButton = current.buttons.find((button) => button.style === "cancel");
    if (cancelButton) dismiss(cancelButton);
    else if (current.options?.cancelable) dismiss();
  };

  return <Modal visible={Boolean(current)} transparent animationType="fade" statusBarTranslucent onRequestClose={cancel}>
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Đóng thông báo" onPress={cancel} style={styles.backdrop} />
      {current ? <View accessibilityViewIsModal style={styles.dialog}>
        <Text style={styles.title}>{current.title}</Text>
        {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
        <View style={[styles.actions, current.buttons.length > 2 && styles.actionsStacked]}>
          {current.buttons.map((button, index) => <Pressable key={`${button.text || "action"}-${index}`} accessibilityRole="button" onPress={() => dismiss(button)} style={[styles.action, button.style === "destructive" && styles.destructiveAction]}>
            <Text style={[styles.actionText, button.style === "cancel" && styles.cancelText, button.style === "destructive" && styles.destructiveText]}>{button.text || "Đóng"}</Text>
          </Pressable>)}
        </View>
      </View> : null}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, paddingHorizontal: spacing.lg },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  dialog: { width: "100%", maxWidth: 360, borderRadius: radius.xl, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md, overflow: "hidden" },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  message: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionsStacked: { flexDirection: "column" },
  action: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.background, paddingHorizontal: spacing.sm },
  destructiveAction: { backgroundColor: "#FDECEF" },
  actionText: { color: colors.primaryDark, fontSize: 14, fontWeight: "600", textAlign: "center" },
  cancelText: { color: colors.muted },
  destructiveText: { color: colors.danger },
});
