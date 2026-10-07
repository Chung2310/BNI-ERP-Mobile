import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

type Props = {
  visible: boolean;
  mode: "date" | "time";
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onCancel: () => void;
  onConfirm: (value: Date) => void;
};

const rowHeight = 42;
const range = (start: number, end: number) => Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
const pad = (value: number) => String(value).padStart(2, "0");

function PickerColumn({ label, values, selected, onSelect }: { label: string; values: number[]; selected: number; onSelect: (value: number) => void }) {
  const scroll = useRef<ScrollView>(null);
  const positioned = useRef(false);
  return <View style={styles.column}>
    <Text style={styles.columnLabel}>{label}</Text>
    <ScrollView ref={scroll} style={styles.columnScroll} showsVerticalScrollIndicator={false} onContentSizeChange={() => {
      if (positioned.current) return;
      positioned.current = true;
      scroll.current?.scrollTo({ y: Math.max(0, values.indexOf(selected)) * rowHeight, animated: false });
    }}>
      {values.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: item === selected }} onPress={() => onSelect(item)} style={[styles.choice, item === selected && styles.choiceSelected]}>
        <Text style={[styles.choiceText, item === selected && styles.choiceTextSelected]}>{pad(item)}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}

export function RoundedDateTimePicker({ visible, mode, value, minimumDate, maximumDate, onCancel, onConfirm }: Props) {
  const [draft, setDraft] = useState(() => new Date(value));
  const yearValues = range(1900, 2100);
  const days = new Date(draft.getFullYear(), draft.getMonth() + 1, 0).getDate();
  const updateDate = (year: number, month: number, day: number) => {
    setDraft(new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), draft.getHours(), draft.getMinutes()));
  };
  const updateTime = (hour: number, minute: number) => {
    setDraft(new Date(draft.getFullYear(), draft.getMonth(), draft.getDate(), hour, minute));
  };
  const confirm = () => {
    let next = draft;
    if (minimumDate && next < minimumDate) next = minimumDate;
    if (maximumDate && next > maximumDate) next = maximumDate;
    onConfirm(next);
  };

  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Đóng bộ chọn" onPress={onCancel} style={styles.backdrop} />
      <View accessibilityViewIsModal style={styles.dialog}>
        <Text style={styles.title}>{mode === "date" ? "Chọn ngày" : "Chọn giờ"}</Text>
        <View style={styles.columns}>
          {mode === "date" ? <>
            <PickerColumn label="Ngày" values={range(1, days)} selected={draft.getDate()} onSelect={(day) => updateDate(draft.getFullYear(), draft.getMonth(), day)} />
            <PickerColumn label="Tháng" values={range(1, 12)} selected={draft.getMonth() + 1} onSelect={(month) => updateDate(draft.getFullYear(), month - 1, draft.getDate())} />
            <PickerColumn label="Năm" values={yearValues} selected={draft.getFullYear()} onSelect={(year) => updateDate(year, draft.getMonth(), draft.getDate())} />
          </> : <>
            <PickerColumn label="Giờ" values={range(0, 23)} selected={draft.getHours()} onSelect={(hour) => updateTime(hour, draft.getMinutes())} />
            <PickerColumn label="Phút" values={range(0, 59)} selected={draft.getMinutes()} onSelect={(minute) => updateTime(draft.getHours(), minute)} />
          </>}
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.action}><Text style={styles.cancelText}>Hủy</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={confirm} style={[styles.action, styles.confirm]}><Text style={styles.confirmText}>Xong</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, paddingHorizontal: spacing.lg },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  dialog: { width: "100%", maxWidth: 380, borderRadius: radius.xl, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md, overflow: "hidden" },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  columns: { flexDirection: "row", gap: spacing.sm },
  column: { flex: 1, minWidth: 0 },
  columnLabel: { color: colors.muted, fontSize: 12, textAlign: "center", marginBottom: spacing.xs },
  columnScroll: { maxHeight: rowHeight * 5 },
  choice: { height: rowHeight, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  choiceSelected: { backgroundColor: colors.primarySoft },
  choiceText: { color: colors.muted, fontSize: 15 },
  choiceTextSelected: { color: colors.primaryDark, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.background },
  confirm: { backgroundColor: colors.primary },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  confirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
