import { useEffect, useState } from "react";
import { Crown } from "lucide-react-native";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { buildActiveMemberRankings } from "@/components/ActiveMemberRanking";
import { Avatar, Card, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { userService } from "@/services/users";
import { meetingService } from "@/services/meeting";
import { colors, spacing } from "@/theme/tokens";
import { buildMemberAbsenceRanking } from "@/utils/memberAbsenceRanking";

const initials = (name: string) => name.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();

function AnimatedRankingsColumn({
  rankIndex,
  item,
  delay,
  reduceMotion,
}: {
  rankIndex: number;
  item?: {
    id: string;
    name: string;
    photoURL?: string;
    attendedCount: number;
  };
  delay: number;
  reduceMotion: boolean;
}) {
  const targetHeight = rankIndex === 0 ? 130 : rankIndex === 1 ? 98 : 72;
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    if (reduceMotion) { anim.setValue(1); return; }
    const animation = Animated.spring(anim, {
      toValue: 1,
      delay,
      friction: 8,
      tension: 52,
      overshootClamping: true,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, delay, item?.id, reduceMotion]);

  const opacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.8, 1],
  });

  if (!item) return <View style={styles.column} />;

  return (
    <Animated.View style={[styles.column, { opacity, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <View style={styles.crownSlot}>
        {rankIndex === 0 ? <Crown color={colors.warning} fill="#FFE0A3" size={20} /> : null}
      </View>
      <Avatar initials={initials(item.name)} url={item.photoURL} />
      <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
      <Text style={styles.score}>{item.attendedCount} buổi</Text>
      <Animated.View
        style={[
          styles.bar,
          { height: targetHeight, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [targetHeight / 2, 0] }) }, { scaleY: anim }] },
        ]}
      >
        <Text style={styles.rank}>
          #{rankIndex + 1}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function AnimatedRankingRow({ children, index, reduceMotion }: { children: React.ReactNode; index: number; reduceMotion: boolean }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    if (reduceMotion) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 360,
      delay: Math.min(index * 65, 550),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reduceMotion]);

  return <Animated.View style={[styles.row, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>{children}</Animated.View>;
}

export default function RankingsScreen() {
  const [tab, setTab] = useState<"active" | "absence">("active");
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const { data, error, isLoading, reload } = useAsyncData(async () => {
    const [meetings, members] = await Promise.all([
      meetingService.history(),
      userService.directory(),
    ]);
    return {
      active: buildActiveMemberRankings(meetings, members).rankings
        .filter((member) => member.attendedCount > 0).slice(0, 10),
      absence: buildMemberAbsenceRanking(members, meetings).slice(0, 10),
      completedCount: meetings.filter((meeting) => meeting.status === "ended" && Date.parse(meeting.startsAt) <= Date.now()).length,
    };
  });
  const active = data?.active || [];
  const absence = data?.absence || [];
  const top = active.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  return <Screen>
    <BackHeader title="Bảng xếp hạng" subtitle="Tính từ lịch sử cuộc họp" compact />
    <View style={styles.tabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "active" }} onPress={() => setTab("active")} style={[styles.tab, tab === "active" && styles.tabSelected]}>
        <Text numberOfLines={1} style={[styles.tabText, tab === "active" && styles.tabTextSelected]}>Thành viên tích cực</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "absence" }} onPress={() => setTab("absence")} style={[styles.tab, tab === "absence" && styles.tabSelected]}>
        <Text numberOfLines={1} style={[styles.tabText, tab === "absence" && styles.tabTextSelected]}>Thành viên lười nhất</Text>
      </Pressable>
    </View>
    {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} />
      : tab === "active" ? !active.length ? <EmptyState title="Chưa có dữ liệu" message="Bảng xếp hạng sẽ xuất hiện sau khi có dữ liệu tham dự cuộc họp." /> : <>
        <Card>
          <SectionTitle>Top 10 thành viên tích cực</SectionTitle>
          <View style={styles.columns}>
            {podiumOrder.map((rankIndex, i) => (
              <AnimatedRankingsColumn
                key={rankIndex}
                rankIndex={rankIndex}
                item={top[rankIndex]}
                delay={rankIndex === 0 ? 0 : i * 120 + 80}
                reduceMotion={reduceMotion}
              />
            ))}
          </View>
        </Card>
        {active.length > 3 ? <Card style={styles.list}>{active.slice(3).map((item, index) => <AnimatedRankingRow key={item.id} index={index + 3} reduceMotion={reduceMotion}>
          <Text style={styles.rowRank}>{index + 4}</Text>
          <Avatar initials={initials(item.name)} url={item.photoURL} size={34} />
          <View style={styles.grow}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.meta}>{item.attendedCount} buổi · {item.attendanceRate}% tham dự</Text>
          </View>
        </AnimatedRankingRow>)}</Card> : null}
      </> : !data?.completedCount ? <EmptyState title="Chưa có cuộc họp đã kết thúc" message="Bảng xếp hạng vắng mặt sẽ xuất hiện sau khi cuộc họp kết thúc." />
      : !absence.length ? <EmptyState title="Chưa có dữ liệu thành viên" message="Không có thành viên đủ điều kiện để xếp hạng." />
      : <Card style={styles.list}>
        <SectionTitle>Top 10 thành viên lười nhất</SectionTitle>
        <Text style={styles.description}>Xếp theo số buổi vắng, rồi số lần check-in muộn.</Text>
        {absence.map((item, index) => <AnimatedRankingRow key={item.id} index={index} reduceMotion={reduceMotion}>
          <Text style={styles.rowRank}>#{index + 1}</Text>
          <Avatar initials={initials(item.name)} url={item.photoURL} size={34} />
          <View style={styles.grow}>
            <Text numberOfLines={1} style={styles.rowName}>{item.name}</Text>
            <Text style={styles.meta}>Vắng {item.absentCount}/{item.eligibleCount} buổi · muộn {item.lateCount} lần</Text>
          </View>
        </AnimatedRankingRow>)}
      </Card>}
  </Screen>;
}
const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.xs, padding: 3, borderRadius: 12, backgroundColor: colors.primarySoft },
  tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xs, borderRadius: 9 },
  tabSelected: { backgroundColor: colors.surface },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  tabTextSelected: { color: colors.primaryDark },
  description: { paddingVertical: spacing.sm, color: colors.muted, fontSize: 11 },
  columns: { height: 270, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: spacing.sm },
  column: { width: "30%", alignItems: "center" },
  crownSlot: { height: 22, alignItems: "center", justifyContent: "center" },
  name: { width: "100%", marginTop: spacing.xs, color: colors.text, fontSize: 11, fontWeight: "800", textAlign: "center" },
  score: { marginVertical: 3, color: colors.primaryDark, fontSize: 12, fontWeight: "900" },
  bar: { width: "100%", alignItems: "center", justifyContent: "flex-end", paddingBottom: spacing.sm, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: "rgba(0, 173, 252, 0.25)", borderWidth: 1, borderColor: "rgba(0, 173, 252, 0.25)" },
  rank: { color: colors.primaryDark, fontSize: 13, fontWeight: "900" },
  list: { paddingVertical: 0 },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowRank: { width: 26, color: colors.muted, fontSize: 13, fontWeight: "900" },
  grow: { flex: 1 },
  rowName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  meta: { marginTop: 3, color: colors.muted, fontSize: 11 },
});
