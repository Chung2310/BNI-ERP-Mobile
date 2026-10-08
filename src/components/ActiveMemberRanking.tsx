import { router } from 'expo-router';
import { Crown, Trophy } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Card } from '@/components/ui';
import type { Meeting } from '@/services/meeting';
import type { UserProfile } from '@/types';
import { colors, radius, spacing } from '@/theme/tokens';

type Ranking = {
  id: string;
  name: string;
  photoURL?: string;
  companyName?: string;
  attendedCount: number;
  avgEarlyMinutes: number;
  attendanceRate: number;
  score: number;
};

export function buildActiveMemberRankings(meetings: Meeting[], members: UserProfile[], anchorMeeting?: Meeting) {
  const anchor = anchorMeeting || [...meetings]
    .filter((meeting) => ['live', 'paused', 'ended'].includes(meeting.status) && +new Date(meeting.startsAt) <= Date.now())
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))[0];
  if (!anchor) return { rankings: [] as Ranking[], meetingCount: 0 };
  const eligibleMeetings = meetings.filter((meeting) =>
    meeting._id === anchor._id ||
    (['live', 'paused', 'ended'].includes(meeting.status) &&
      +new Date(meeting.startsAt) <= +new Date(anchor.startsAt))
  );
  const map = new Map<string, Ranking & { totalEarlyMinutes: number; earlyCount: number }>();
  members.filter((member) => member.role !== 'admin' && member.isActive !== false).forEach((member) => {
    if (!member.uid) return;
    map.set(member.uid, {
      id: member.uid,
      name: member.displayName || member.email.split('@')[0],
      photoURL: member.photoURL,
      companyName: member.companyName,
      attendedCount: 0,
      avgEarlyMinutes: 0,
      attendanceRate: 0,
      score: 0,
      totalEarlyMinutes: 0,
      earlyCount: 0,
    });
  });
  eligibleMeetings.forEach((meeting) => {
    const startsAt = +new Date(meeting.startsAt);
    meeting.speakers.forEach((speaker) => {
      if (!speaker.userId) return;
      const entry = map.get(String(speaker.userId));
      if (!entry) return;
      if (!entry.photoURL && speaker.photoURL) entry.photoURL = speaker.photoURL;
      entry.attendedCount += 1;
      const checkedInAt = +new Date(speaker.checkedInAt);
      if (!Number.isNaN(checkedInAt) && !Number.isNaN(startsAt)) {
        const earlyMinutes = Math.round((startsAt - checkedInAt) / 60000);
        entry.totalEarlyMinutes += Math.max(-30, Math.min(90, earlyMinutes));
        if (earlyMinutes >= 5) entry.earlyCount += 1;
      }
    });
  });
  const meetingCount = eligibleMeetings.length || 1;
  const rankings = [...map.values()].map((entry) => {
    const avgEarlyMinutes = entry.attendedCount ? Math.round(entry.totalEarlyMinutes / entry.attendedCount) : 0;
    const attendanceRate = Math.round(entry.attendedCount / meetingCount * 100);
    const score = Math.round(attendanceRate * 0.6 + Math.min(40, Math.max(0, avgEarlyMinutes * 1.5) + entry.earlyCount * 2));
    return { ...entry, avgEarlyMinutes, attendanceRate, score };
  }).sort((a, b) =>
    b.attendedCount - a.attendedCount ||
    b.avgEarlyMinutes - a.avgEarlyMinutes ||
    b.score - a.score
  );
  return { rankings, meetingCount };
}

const podium = [
  { index: 3, rank: 4, height: 68 }, { index: 1, rank: 2, height: 96 },
  { index: 0, rank: 1, height: 124 }, { index: 2, rank: 3, height: 84 },
  { index: 4, rank: 5, height: 58 },
];

function initials(name?: string) {
  return (name || '?').split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
}

export function ActiveMemberRanking({ meetings, members }: { meetings: Meeting[]; members: UserProfile[] }) {
  const { rankings, meetingCount } = buildActiveMemberRankings(meetings, members);
  const topTen = rankings.filter((member) => member.attendedCount > 0).slice(0, 10);
  return <Card style={styles.card}>
    <View style={styles.header}>
      <View style={styles.heading}><Trophy color={colors.warning} size={19} /><View style={styles.grow}><Text style={styles.title}>Bảng xếp hạng thành viên tích cực</Text><Text style={styles.subtitle}>Điểm danh và đến sớm trong {meetingCount} buổi họp</Text></View></View>
      <Pressable accessibilityRole='button' onPress={() => router.push('/rankings')}><Text style={styles.link}>Xem tất cả</Text></Pressable>
    </View>
    {!topTen.length ? <View style={styles.empty}><Trophy color={colors.border} size={30} /><Text style={styles.emptyText}>Chưa có dữ liệu điểm danh để xếp hạng.</Text></View> : <>
      <View style={styles.podium}>
        {podium.map((slot) => {
          const member = rankings[slot.index];
          return <View key={slot.rank} style={styles.podiumSlot}>
            {slot.rank === 1 ? <Crown color={colors.warning} fill='#FFE0A3' size={18} /> : null}
            {member?.attendedCount ? <><Avatar initials={initials(member.name)} url={member.photoURL} size={38} /><Text numberOfLines={1} style={styles.podiumName}>{member.name}</Text></> : <View style={styles.placeholder}><Text style={styles.placeholderText}>#{slot.rank}</Text></View>}
            <View style={[styles.pillar, { height: slot.height }, slot.rank === 1 && styles.firstPillar]}><Text style={styles.rank}>#{slot.rank}</Text>{member?.attendedCount ? <><Text style={styles.sessions}>{member.attendedCount} buổi</Text><Text style={styles.rate}>{member.attendanceRate}%</Text></> : null}</View>
          </View>;
        })}
      </View>
      <View style={styles.list}>
        {topTen.map((member, index) => <View key={member.id} style={[styles.row, index > 0 && styles.rowBorder]}>
          <Text style={styles.rowRank}>#{index + 1}</Text><Avatar initials={initials(member.name)} url={member.photoURL} size={34} />
          <View style={styles.grow}><Text numberOfLines={1} style={styles.name}>{member.name}</Text><Text numberOfLines={1} style={styles.company}>{member.companyName || 'Thành viên Chapter'}</Text></View>
          <View style={styles.stats}><Text style={styles.attended}>{member.attendedCount} buổi · {member.attendanceRate}%</Text><Text style={styles.early}>{member.avgEarlyMinutes > 0 ? 'Sớm +' + member.avgEarlyMinutes + 'p' : 'Đúng giờ'}</Text></View>
        </View>)}
      </View>
    </>}
  </Card>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.md }, header: { gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, grow: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' }, subtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  link: { color: colors.primaryDark, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  empty: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, emptyText: { color: colors.muted, fontSize: 11 },
  podium: { height: 226, flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingTop: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  podiumSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' }, podiumName: { width: '100%', color: colors.text, fontSize: 9, fontWeight: '700', textAlign: 'center', marginVertical: 5 },
  placeholder: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border }, placeholderText: { color: colors.muted, fontSize: 10 },
  pillar: { width: '88%', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#B9E7EE' },
  firstPillar: { backgroundColor: '#FFF5D9', borderColor: '#F3D58A' }, rank: { color: colors.primaryDark, fontSize: 11, fontWeight: '900' },
  sessions: { color: colors.text, fontSize: 10, fontWeight: '800', marginTop: 4 }, rate: { color: colors.muted, fontSize: 9, marginTop: 2 },
  list: { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 7 }, rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowRank: { width: 25, color: colors.muted, fontSize: 11, fontWeight: '800' }, name: { color: colors.text, fontSize: 12, fontWeight: '800' },
  company: { color: colors.muted, fontSize: 9, marginTop: 2 }, stats: { alignItems: 'flex-end' }, attended: { color: colors.text, fontSize: 10, fontWeight: '700' },
  early: { color: colors.success, fontSize: 9, fontWeight: '700', marginTop: 3 },
});
