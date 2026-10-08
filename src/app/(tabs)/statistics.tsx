import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { BackHeader } from "@/components/BackHeader";
import { DashboardCharts } from "@/components/DashboardCharts";
import { ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type Meeting } from "@/services/meeting";
import { userService } from "@/services/users";

export default function StatisticsScreen() {
  const { data, error, isLoading, reload } = useAsyncData(async () => {
    const history = await meetingService.history().catch(() => [] as Meeting[]);
    const list = await meetingService.list().catch(() => [] as Meeting[]);
    const members = await userService.colleagues().catch(() => []);

    // Hợp nhất dữ liệu cuộc họp và loại trừ các cuộc họp đã hủy
    const meetingMap = new Map<string, Meeting>();
    [...history, ...list].forEach((m) => {
      if (m && m._id && m.status !== "cancelled") {
        meetingMap.set(m._id, m);
      }
    });

    const activeMeetings = Array.from(meetingMap.values());
    const memberCount =
      members.length ||
      new Set(
        activeMeetings.flatMap((m) => m.speakers.map((s) => s.userId).filter(Boolean)),
      ).size;

    return { meetings: activeMeetings, memberCount };
  }, "statistics-screen");

  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        void reload();
      } else {
        hasFocused.current = true;
      }
    }, [reload]),
  );

  return (
    <Screen>
      <BackHeader
        title="Thống kê"
        subtitle="Biểu đồ tham dự và cơ cấu cuộc họp"
        compact
      />
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DashboardCharts
          meetings={data?.meetings || []}
          memberCount={data?.memberCount || 0}
        />
      )}
    </Screen>
  );
}
