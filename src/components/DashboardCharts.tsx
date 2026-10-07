import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Meeting } from "@/services/meeting";
import { colors } from "@/theme/tokens";

import Svg, { Circle } from 'react-native-svg';
import { Card } from '@/components/ui';

const palette = {
  present: '#00AECA', // Brand primary jade cyan
  guest: '#5EE2F6',   // Lighter brand cyan
  absent: '#CDEAF1',  // Soft pale ice cyan tint
};

function absent(meeting: Meeting, members: number) {
  if (!["live", "paused", "ended"].includes(meeting.status)) return 0;
  return Math.max(0, members - meeting.speakers.filter((speaker) => speaker.userId).length);
}

function Legend({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.legendText}>
        {label}{value === undefined ? '' : ` (${value})`}
      </Text>
    </View>
  );
}

type Totals = { present: number; guest: number; absent: number };
type Bar = Totals & { id: string; title: string; checkedIn: number; date: string };

function AttendanceChart({ bars, selectedId, onSelect }: { bars: Bar[]; selectedId?: string; onSelect: (id?: string) => void }) {
  const max = Math.max(5, ...bars.map((item) => item.present + item.guest + item.absent));
  return <Card style={s.card}>
    <Text style={s.title}>Thống kê tham dự và vắng mặt theo cuộc họp</Text>
    <View style={s.legendRow}>
      <Legend color={palette.present} label='Có mặt' />
      <Legend color={palette.guest} label='Khách mời' />
      <Legend color={palette.absent} label='Vắng mặt' />
    </View>
    {!bars.length ? <View style={s.empty}><Text style={s.hint}>Chưa có dữ liệu cuộc họp.</Text></View> : <View style={s.plot}>
      {bars.map((item) => {
        const height = Math.max(14, (item.present + item.guest + item.absent) / max * 150);
        const active = item.id === selectedId;
        return <Pressable key={item.id} onPress={() => onSelect(active ? undefined : item.id)} style={[s.slot, active && s.active]}>
          <Text style={s.count}>{item.checkedIn}{item.absent ? ' (-' + item.absent + ')' : ''}</Text>
          <View style={[s.bar, { height }]}>
            <View style={{ flex: item.present || 0.001, backgroundColor: palette.present }} />
            <View style={{ flex: item.guest || 0.001, backgroundColor: palette.guest }} />
            <View style={{ flex: item.absent || 0.001, backgroundColor: palette.absent }} />
          </View>
          <Text style={s.date}>{item.date}</Text>
        </Pressable>;
      })}
    </View>}
    <Text style={s.footer}>{bars.length ? `Hiển thị ${bars.length} cuộc họp gần nhất` : 'Chưa có cuộc họp đã diễn ra'}</Text>
  </Card>;
}

function DonutChart({ totals, meetings, selectedId, onSelect }: { totals: Totals; meetings: Meeting[]; selectedId?: string; onSelect: (id: string) => void }) {
  const total = totals.present + totals.guest + totals.absent;
  const circumference = Math.PI * 116;
  let used = 0;
  return <Card style={s.card}>
    <Text style={s.title}>Cơ cấu cuộc họp được chọn</Text>
    <MeetingSelector meetings={meetings} selectedId={selectedId} onSelect={onSelect} />
    <View style={s.donut}>
      <Svg width={174} height={174} viewBox='0 0 150 150' accessibilityLabel='Cơ cấu tham dự và vắng mặt'>
        <Circle cx='75' cy='75' r='58' fill='none' stroke='#EEF3F5' strokeWidth='18' />
        {total ? Object.entries(palette).map(([key, color]) => {
          const value = totals[key as keyof Totals];
          const length = value / total * circumference;
          const offset = -used;
          used += length;
          return <Circle key={key} cx='75' cy='75' r='58' fill='none' rotation='-90' origin='75,75' stroke={color} strokeDasharray={length + ' ' + (circumference - length)} strokeDashoffset={offset} strokeWidth='18' />;
        }) : null}
      </Svg>
      <View pointerEvents='none' style={s.center}><Text style={s.total}>{total}</Text><Text style={s.hint}>tổng lượt</Text></View>
    </View>
    <View style={s.donutLegend}>
      <Legend color={palette.present} label='Thành viên có mặt' value={totals.present} />
      <Legend color={palette.guest} label='Khách mời' value={totals.guest} />
      <Legend color={palette.absent} label='Thành viên vắng' value={totals.absent} />
    </View>
  </Card>;
}

function MeetingSelector({ meetings, selectedId, onSelect }: { meetings: Meeting[]; selectedId?: string; onSelect: (id: string) => void }) {
  return <View style={s.selector}>
    <Text style={s.selectorLabel}>Chọn cuộc họp</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.options}>
      {meetings.map((meeting) => {
        const active = meeting._id === selectedId;
        const date = new Date(meeting.startsAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        return <Pressable key={meeting._id} accessibilityRole='button' accessibilityState={{ selected: active }} onPress={() => onSelect(meeting._id)} style={[s.option, active && s.optionActive]}>
          <Text numberOfLines={1} style={[s.optionText, active && s.optionTextActive]}>{date} · {meeting.title}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

export function DashboardCharts({ meetings, memberCount }: { meetings: Meeting[]; memberCount: number }) {
  const [donutMeetingId, setDonutMeetingId] = useState<string>();
  const [selectedBarId, setSelectedBarId] = useState<string>();
  const availableMeetings = useMemo(() => [...meetings]
    .filter((meeting) => ['live', 'paused', 'ended'].includes(meeting.status))
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)), [meetings]);
  const defaultMeeting = availableMeetings.find((meeting) => meeting.status === 'ended') || availableMeetings[0];
  const activeMeeting = availableMeetings.find((meeting) => meeting._id === donutMeetingId) || defaultMeeting;
  const data = useMemo(() => {
    const latestMeeting = activeMeeting;
    const latestPresent = latestMeeting?.speakers.filter((speaker) => speaker.userId).length || 0;
    const totals = {
      present: latestPresent,
      guest: latestMeeting ? latestMeeting.speakers.length - latestPresent : 0,
      absent: latestMeeting ? absent(latestMeeting, memberCount) : 0,
    };
    const bars = [...availableMeetings].slice(0, 8).reverse()
      .map((meeting) => {
        const present = meeting.speakers.filter((speaker) => speaker.userId).length;
        return {
          id: meeting._id,
          title: meeting.title,
          present,
          guest: meeting.speakers.length - present,
          absent: absent(meeting, memberCount),
          checkedIn: meeting.speakers.length,
          date: new Date(meeting.startsAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        };
      });
    return { totals, bars };
  }, [activeMeeting, availableMeetings, memberCount]);

  const selected = data.bars.find((item) => item.id === selectedBarId);
  return <View style={s.wrap}>
    <AttendanceChart bars={data.bars} selectedId={selectedBarId} onSelect={setSelectedBarId} />
    {selected ? <View style={s.detail}><Text numberOfLines={1} style={s.detailTitle}>{selected.title}</Text><Text style={s.detailText}>Có mặt {selected.present} · Khách {selected.guest} · Vắng {selected.absent}</Text></View> : null}
    <DonutChart totals={data.totals} meetings={availableMeetings} selectedId={activeMeeting?._id} onSelect={setDonutMeetingId} />
  </View>;
}

const s = StyleSheet.create({
  selector: { gap: 8 },
  selectorLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  options: { gap: 8, paddingRight: 16 },
  option: { maxWidth: 230, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 9 },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  optionTextActive: { color: colors.primaryDark, fontWeight: '900' },
  wrap: { gap: 12 },
  card: { padding: 12 },
  title: { color: colors.text, fontSize: 13, fontWeight: '800' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderTopWidth: 1, borderTopColor: '#EDF2F4', paddingTop: 12, marginTop: 12 },
  plot: { height: 208, flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: '#E7EEF1' },
  slot: { flex: 1, height: '100%', minWidth: 24, alignItems: 'center', justifyContent: 'flex-end', gap: 5, borderRadius: 8 },
  active: { backgroundColor: colors.primarySoft },
  count: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  bar: { width: '60%', maxWidth: 34, minWidth: 12, overflow: 'hidden', borderTopLeftRadius: 5, borderTopRightRadius: 5, borderWidth: 1, borderColor: '#BDE4EA' },
  date: { color: colors.muted, fontSize: 9 },
  footer: { color: colors.muted, fontSize: 10, textAlign: 'right', marginTop: 10 },
  empty: { height: 180, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  detail: { borderRadius: 10, backgroundColor: colors.primarySoft, padding: 10 },
  detailTitle: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  detailText: { color: colors.primaryDark, fontSize: 11, marginTop: 3 },
  donut: { height: 184, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  center: { position: 'absolute', alignItems: 'center' },
  total: { color: colors.text, fontSize: 28, fontWeight: '900' },
  donutLegend: { gap: 8, alignSelf: 'center', minWidth: 190 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, color: colors.muted },
});
