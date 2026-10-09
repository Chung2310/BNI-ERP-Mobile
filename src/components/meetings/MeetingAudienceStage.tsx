import { useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Crown, Fingerprint, Presentation } from "lucide-react-native";
import { Avatar, Card } from "@/components/ui";
import { ProfileSlideCanvas } from "@/components/meetings/ProfileSlideCanvas";
import { MeetingWheelPreview } from "@/components/meetings/MeetingWheelPreview";
import { ResponseWordCloud } from "@/components/meetings/ResponseWordCloud";
import { buildActiveMemberRankings } from "@/components/ActiveMemberRanking";
import type { AudienceSnapshot } from "@/hooks/useMeetingDisplay";
import { colors } from "@/theme/tokens";

export function AudienceStage({ data, fullscreen = false, stageWidth }: { data: AudienceSnapshot; fullscreen?: boolean; stageWidth?: number }) {
  const { width } = useWindowDimensions();
  const contentWidth = stageWidth ?? width - 40;
  const contentHeight = contentWidth * 9 / 16;
  const [time, setTime] = useState(() => Date.now());

  const { meeting, display } = data;
  const now = time + data.clockOffset;
  const view = meeting.presentation?.view || "waiting";
  useEffect(() => {
    if (view !== "speaker" && view !== "luckyDraw") return;
    const timer = setInterval(() => setTime(Date.now()), 250);
    return () => clearInterval(timer);
  }, [view]);
  const speaker = meeting.speakers[meeting.currentIndex];
  const slide = display.slides.find((item) => item.id === speaker?.id);
  const elapsed = Math.max(0, meeting.elapsedSeconds || 0) + (meeting.status === "live" && meeting.speakerStartedAt ? Math.max(0, (now - Date.parse(meeting.speakerStartedAt)) / 1000) : 0);
  const remaining = Math.max(0, Math.ceil((speaker?.seconds || 0) - elapsed));
  if (meeting.status === "ended" || meeting.status === "cancelled") return <Card style={[styles.stage, fullscreen && { width: contentWidth, height: contentHeight }]}><Presentation size={64} color={colors.primary} /><Text style={styles.title}>{meeting.status === "ended" ? "Cuộc họp đã kết thúc" : "Cuộc họp đã hủy"}</Text><Text style={styles.body}>{meeting.title}</Text></Card>;
  if (data.detailError) return <Card style={fullscreen && { width: contentWidth, height: contentHeight }}><Text style={styles.body}>{data.detailError}</Text></Card>;
  if (view === "speaker") return <View style={[styles.stage, fullscreen && styles.fullscreenSpeaker, fullscreen && { width: contentWidth, height: contentHeight }]}>
    {slide ? <ProfileSlideCanvas slide={slide} width={Math.max(1, fullscreen ? Math.min(contentWidth, Math.max(1, contentHeight - 43) * 16 / 9) : contentWidth)} /> : <Presentation color={colors.primary} size={48} />}
    <Text style={[styles.title, fullscreen && styles.fullscreenSpeakerName]}>{speaker?.name || (meeting.speechesCompletedAt ? "Đã hoàn tất phần phát biểu" : "Chờ người trình bày")}</Text>
    {speaker ? fullscreen ? <Text style={styles.fullscreenTimer}>{Math.floor(remaining / 60).toString().padStart(2, "0")}:{(remaining % 60).toString().padStart(2, "0")}{meeting.status === "paused" ? " · Tạm dừng" : ""}</Text> : <><Text style={styles.timer}>{Math.floor(remaining / 60).toString().padStart(2, "0")}:{(remaining % 60).toString().padStart(2, "0")}</Text><Text style={styles.body}>{meeting.status === "paused" ? "Tạm dừng" : `Lượt ${meeting.currentIndex + 1}/${meeting.speakers.length}`}</Text></> : null}
  </View>;
  if (view === "luckyDraw") return <MeetingWheelPreview meeting={meeting} now={now} width={fullscreen ? contentWidth : undefined} fullscreen={fullscreen} />;
  if (view === "audienceResponses") {
    const session = data.interaction?.session;
    const allQuestions = [...(session?.questions || [])].sort((a, b) => a.order - b.order);

    if (!allQuestions.length) {
      return (
        <Card style={fullscreen && { width: contentWidth, minHeight: 180, justifyContent: "center", alignItems: "center" }}>
          <Text style={styles.body}>Chờ câu hỏi từ quản trị viên</Text>
        </Card>
      );
    }

    if (fullscreen) {
      return (
        <View style={{ width: contentWidth, paddingBottom: 40, paddingTop: 4 }}>
          <ResponseWordCloud
            questions={allQuestions}
            responses={data.interaction?.allResponses || data.interaction?.responses || []}
            compact={allQuestions.length > 1}
            boardMode={allQuestions.length > 1}
            darkHeader={true}
          />
        </View>
      );
    }

    // Hiển thị toàn bộ câu hỏi trên màn hình theo dõi (không cần zoom/fullscreen)
    return (
      <ResponseWordCloud
        questions={allQuestions}
        responses={data.interaction?.allResponses || data.interaction?.responses || []}
      />
    );
  }
  if (view === "activeMembers") {
    const { rankings } = buildActiveMemberRankings(data.history || [], data.members || [], meeting);
    const top = rankings.filter((member) => member.attendedCount > 0).slice(0, 10);
    if (fullscreen) return <View style={[styles.fullscreenRanking, { width: contentWidth, height: contentHeight }]}><Text style={styles.fullscreenRankingTitle}>Thành viên tích cực</Text><View style={styles.fullscreenRankingGrid}>{top.map((member, index) => <View key={member.id} style={styles.fullscreenRank}><Text style={styles.fullscreenPosition}>#{index + 1}</Text><Avatar url={member.photoURL} initials={member.name.slice(0, 1)} size={24} /><Text numberOfLines={1} style={styles.fullscreenName}>{member.name}</Text>{index === 0 ? <Crown size={16} color={colors.warning} /> : null}</View>)}</View>{!top.length ? <Text style={styles.body}>Chưa có dữ liệu xếp hạng</Text> : null}</View>;
    return <Card><Text style={styles.title}>Thành viên tích cực</Text>
      {top.length ? <View style={styles.podium}>{[{ index: 3, height: 44 }, { index: 1, height: 76 }, { index: 0, height: 100 }, { index: 2, height: 60 }, { index: 4, height: 32 }].map(({ index, height }) => {
        const member = top[index];
        return <View key={index} style={styles.podiumSlot}>{member ? <>
          {index === 0 ? <Crown color={colors.warning} size={20} /> : null}
          <Avatar url={member.photoURL} initials={member.name.slice(0, 1)} size={36} />
          <Text numberOfLines={2} style={styles.podiumName}>{member.name}</Text>
          <View style={[styles.pillar, { height }]}><Text style={styles.position}>#{index + 1}</Text></View>
        </> : null}</View>;
      })}</View> : null}
      {!top.length ? <Text style={styles.body}>Chưa có dữ liệu xếp hạng</Text> : top.map((member, index) => <View key={member.id} style={styles.rank}>
      <Text style={styles.position}>#{index + 1}</Text><Avatar url={member.photoURL} initials={member.name.slice(0, 1)} size={40} />
      <View style={styles.grow}><Text style={styles.name}>{member.name}</Text><Text style={styles.body}>{member.attendedCount} buổi · {member.attendanceRate}%</Text></View>{index === 0 ? <Crown size={22} color={colors.warning} /> : null}
    </View>)}</Card>;
  }
  return <Card style={[styles.stage, fullscreen && { width: contentWidth, height: contentHeight }]}>
    {view === "checkin" ? <Fingerprint size={64} color={colors.primary} /> : <Presentation size={64} color={colors.primary} />}
    <Text style={styles.title}>{view === "checkin" ? "Điểm danh cuộc họp" : "Chờ nội dung trình chiếu"}</Text>
    <Text style={styles.body}>{view === "checkin" ? `${meeting.speakers.length} người đã check-in` : meeting.title}</Text>
  </Card>;
}

const styles = StyleSheet.create({
  fullscreenSpeaker: { paddingVertical: 0, gap: 2, backgroundColor: "#000000" },
  fullscreenSpeakerName: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  fullscreenTimer: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  fullscreenCloud: { padding: 8 },
  fullscreenRanking: { backgroundColor: "#FFFFFF", justifyContent: "center", gap: 5, padding: 8 },
  fullscreenRankingTitle: { color: colors.text, fontSize: 15, fontWeight: "700", textAlign: "center" },
  fullscreenRankingGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  fullscreenRank: { width: "49%", minHeight: 29, flexDirection: "row", alignItems: "center", gap: 4 },
  fullscreenPosition: { width: 22, color: colors.primaryDark, fontSize: 11, fontWeight: "700" },
  fullscreenName: { flex: 1, color: colors.text, fontSize: 11, fontWeight: "600" },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 5, marginTop: 24, marginBottom: 12 },
  podiumSlot: { flex: 1, alignItems: "center", gap: 5 },
  podiumName: { color: colors.text, fontSize: 10, height: 28, textAlign: "center" },
  pillar: { width: "100%", borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: "#D7F0F3", justifyContent: "flex-end", alignItems: "center", paddingBottom: 8 },
  connection: { color: colors.primaryDark, fontSize: 12, marginBottom: 12 },
  stage: { alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 24, overflow: "hidden" },
  title: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { color: colors.muted, fontSize: 14, textAlign: "center" },
  timer: { color: colors.primaryDark, fontSize: 40, fontWeight: "800", fontVariant: ["tabular-nums"] },
  rank: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  position: { color: colors.primaryDark, fontWeight: "700", width: 30 },
  grow: { flex: 1 },
  name: { color: colors.text, fontWeight: "600" },
  error: { color: colors.danger, marginBottom: 12 },
});
