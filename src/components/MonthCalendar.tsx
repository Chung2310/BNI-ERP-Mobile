import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { colors, radius, spacing } from "@/theme/tokens";

export function MonthCalendar({
  date,
  eventDates,
  liveDates = [],
  onPrevious,
  onNext,
  onSelectDate,
  selectedDate,
}: {
  date: Date;
  eventDates: string[];
  liveDates?: string[];
  onPrevious: () => void;
  onNext: () => void;
  onSelectDate?: (date: Date) => void;
  selectedDate?: Date;
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const days = Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const events = new Set(eventDates.map((item) => new Date(item).toDateString()));
  const liveEvents = new Set(liveDates.map((item) => new Date(item).toDateString()));
  const today = new Date().toDateString();

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <Pressable accessibilityLabel="Tháng trước" style={styles.arrow} onPress={onPrevious}>
          <ChevronLeft color={colors.primaryDark} size={22} />
        </Pressable>
        <Text style={styles.month}>
          Tháng {month + 1}, {year}
        </Text>
        <Pressable accessibilityLabel="Tháng sau" style={styles.arrow} onPress={onNext}>
          <ChevronRight color={colors.primaryDark} size={22} />
        </Pressable>
      </View>
      <View style={styles.weekdaysRow}>
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => {
          const outside = day.getMonth() !== month;
          const isToday = day.toDateString() === today;
          const isLive = liveEvents.has(day.toDateString()) && !outside;
          const hasEvent = events.has(day.toDateString()) && !outside;
          const isSelected = selectedDate && selectedDate.toDateString() === day.toDateString();

          return (
            <Pressable
              key={day.toISOString()}
              disabled={!onSelectDate}
              onPress={() => onSelectDate?.(day)}
              style={[
                styles.day,
                isToday && styles.dayToday,
                isLive && styles.dayLive,
                isSelected && !isLive && styles.daySelected,
                outside && styles.dayOutside,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  isToday && styles.dayTextToday,
                  isLive && styles.dayTextLive,
                  outside && styles.dayTextOutside,
                ]}
              >
                {day.getDate()}
              </Text>
              {isLive ? (
                <View style={styles.livePulseDot} />
              ) : hasEvent ? (
                <View style={[styles.dot, isToday && styles.dotActive]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {/* Legend guide */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.legendBoxLive]} />
          <Text style={styles.legendText}>Đang diễn ra</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.legendBoxEvent]} />
          <Text style={styles.legendText}>Có cuộc họp</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.legendBoxToday]} />
          <Text style={styles.legendText}>Hôm nay</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  monthHeader: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  month: { color: colors.text, fontSize: 15, fontWeight: "800" },
  arrow: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  weekdaysRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF3F5",
    paddingBottom: 4,
    marginBottom: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.2857%",
    paddingVertical: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  day: {
    width: "14.2857%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#F0FAFC",
  },
  dayLive: {
    backgroundColor: "#00AECA", // Brand jade cyan / ngọc bích
    shadowColor: "#00AECA",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  daySelected: {
    backgroundColor: colors.primarySoft,
  },
  dayOutside: { opacity: 0.28 },
  dayText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  dayTextToday: { color: colors.primaryDark, fontWeight: "800" },
  dayTextLive: { color: "#FFFFFF", fontWeight: "900" },
  dayTextOutside: { color: colors.muted },
  dot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  dotActive: { backgroundColor: colors.primaryDark },
  livePulseDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  legendContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingRight: spacing.xs,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#EDF3F5",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendBox: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendBoxLive: {
    backgroundColor: "#00AECA",
  },
  legendBoxEvent: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  legendBoxToday: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#F0FAFC",
  },
  legendText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
  },
});
