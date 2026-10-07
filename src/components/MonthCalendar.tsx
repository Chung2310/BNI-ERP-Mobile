import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

export function MonthCalendar({ date, eventDates, onPrevious, onNext, onSelectDate }: {
  date: Date;
  eventDates: string[];
  onPrevious: () => void;
  onNext: () => void;
  onSelectDate?: (date: Date) => void;
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const days = Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const events = new Set(eventDates.map((item) => new Date(item).toDateString()));
  const today = new Date().toDateString();
  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}><Pressable accessibilityLabel="Tháng trước" style={styles.arrow} onPress={onPrevious}><ChevronLeft color={colors.primaryDark} size={24} /></Pressable><Text style={styles.month}>Tháng {month + 1}, {year}</Text><Pressable accessibilityLabel="Tháng sau" style={styles.arrow} onPress={onNext}><ChevronRight color={colors.primaryDark} size={24} /></Pressable></View>
      <View style={styles.grid}>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
      <View style={styles.grid}>
        {days.map((day) => {
          const outside = day.getMonth() !== month;
          const active = day.toDateString() === today;
          const hasEvent = events.has(day.toDateString()) && !outside;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${day.getDate()} tháng ${day.getMonth() + 1}${hasEvent ? ", có cuộc họp" : ", không có cuộc họp"}`}
              disabled={outside}
              key={day.toISOString()}
              onPress={() => onSelectDate?.(day)}
              style={({ pressed }) => [styles.day, active && styles.dayActive, outside && styles.dayOutside, pressed && !outside && styles.dayPressed]}
            >
              <Text style={[styles.dayText, active && styles.dayTextActive, outside && styles.dayTextOutside]}>{day.getDate()}</Text>
              {hasEvent ? <View style={[styles.dot, active && styles.dotActive]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.sm },
  monthHeader: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  month: { color: colors.text, fontSize: 15, fontWeight: "800" },
  arrow: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: "14.2857%", paddingVertical: spacing.xs, color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  day: { width: "14.2857%", height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  dayActive: { backgroundColor: colors.primary },
  dayOutside: { opacity: 0.38 },
  dayPressed: { backgroundColor: colors.primarySoft },
  dayText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  dayTextActive: { color: "#FFFFFF", fontWeight: "900" },
  dayTextOutside: { color: colors.muted },
  dot: { position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  dotActive: { backgroundColor: "#FFFFFF" },
});
