import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, X as LucideX } from "lucide-react-native";
import { colors, radius, spacing } from "@/theme/tokens";

export function MonthCalendar({
  date,
  eventDates,
  liveDates = [],
  cancelledDates = [],
  onPrevious,
  onNext,
  onSelectDate,
  selectedDate,
}: {
  date: Date;
  eventDates: string[];
  liveDates?: string[];
  cancelledDates?: string[];
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
  const cancelledEvents = new Set(cancelledDates.map((item) => new Date(item).toDateString()));
  const today = new Date().toDateString();

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <Pressable accessibilityLabel="Tháng trước" style={styles.arrow} onPress={onPrevious}>
          <ChevronLeft color={colors.primaryDark} size={20} />
        </Pressable>
        <Text style={styles.month}>
          Tháng {month + 1}, {year}
        </Text>
        <Pressable accessibilityLabel="Tháng sau" style={styles.arrow} onPress={onNext}>
          <ChevronRight color={colors.primaryDark} size={20} />
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
          const isCancelled = cancelledEvents.has(day.toDateString()) && !outside && !hasEvent;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${day.getDate()} tháng ${day.getMonth() + 1}${
                isCancelled ? ", cuộc họp bị hủy" : hasEvent ? ", có cuộc họp" : ", không có cuộc họp"
              }`}
              key={day.toISOString()}
              disabled={outside || !onSelectDate}
              onPress={() => onSelectDate?.(day)}
              style={[styles.dayCell, outside && styles.dayOutside]}
            >
              <View
                style={[
                  styles.dayCircle,
                  hasEvent && styles.dayCircleEvent,
                  isLive && styles.dayCircleLive,
                  isCancelled && styles.dayCircleCancelled,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    hasEvent && styles.dayTextEvent,
                    isLive && styles.dayTextLive,
                    isCancelled && styles.dayTextCancelled,
                    isToday && !isLive && !hasEvent && !isCancelled && styles.dayTextToday,
                    outside && styles.dayTextOutside,
                  ]}
                >
                  {day.getDate()}
                </Text>
                {isCancelled ? (
                  <LucideX
                    color={colors.danger}
                    size={20}
                    strokeWidth={2.8}
                    style={styles.cancelledIcon}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Legend guide */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, styles.legendCircleLive]} />
          <Text style={styles.legendText}>Đang diễn ra</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, styles.legendCircleEvent]} />
          <Text style={styles.legendText}>Có cuộc họp</Text>
        </View>
        <View style={styles.legendItem}>
          <LucideX color={colors.danger} size={11} strokeWidth={2.6} />
          <Text style={styles.legendText}>Bị hủy</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 0,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  monthHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  month: { color: colors.text, fontSize: 14, fontWeight: "700" },
  arrow: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  weekdaysRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF3F5",
    paddingBottom: 5,
    marginBottom: 5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.2857%",
    paddingVertical: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  dayCell: {
    width: "14.2857%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleEvent: {
    borderWidth: 1.2,
    borderColor: "#00AECA",
    borderRadius: 14.5,
    overflow: "hidden",
    backgroundColor: "#F2FCFE",
  },
  dayCircleLive: {
    backgroundColor: "#00AECA",
    borderRadius: 14.5,
    overflow: "hidden",
    borderWidth: 0,
  },
  dayCircleCancelled: {
    backgroundColor: "#FDF0F2",
    borderRadius: 14.5,
    overflow: "hidden",
  },
  cancelledIcon: {
    position: "absolute",
    alignSelf: "center",
  },
  dayOutside: {
    opacity: 0.25,
  },
  dayText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: "400",
  },
  dayTextEvent: {
    color: "#00AECA",
    fontWeight: "500",
  },
  dayTextLive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  dayTextCancelled: {
    color: "#C53B4F",
    fontWeight: "500",
  },
  dayTextToday: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  dayTextOutside: {
    color: colors.muted,
  },
  legendContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.md,
    paddingTop: 6,
    paddingRight: spacing.xs,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#EDF3F5",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendCircleLive: {
    backgroundColor: "#00AECA",
  },
  legendCircleEvent: {
    borderWidth: 1,
    borderColor: "#00AECA",
    backgroundColor: "#F2FCFE",
  },
  legendText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
  },
});
