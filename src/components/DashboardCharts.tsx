import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, ChevronDown, Filter, Search, X } from "lucide-react-native";
import type { Meeting } from "@/services/meeting";
import { colors, radius } from "@/theme/tokens";

import Svg, { Circle } from 'react-native-svg';
import { Card } from '@/components/ui';
import { KeyboardResponsiveView } from '@/components/KeyboardResponsiveView';

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

function MeetingSelector({
  meetings,
  selectedId,
  onSelect,
}: {
  meetings: Meeting[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m._id === selectedId) || meetings[0],
    [meetings, selectedId],
  );

  const selectedLabel = useMemo(() => {
    if (!selectedMeeting) return "Chọn cuộc họp";
    const date = new Date(selectedMeeting.startsAt).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
    return `${date} · ${selectedMeeting.title}`;
  }, [selectedMeeting]);

  const filteredMeetings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return meetings;
    return meetings.filter((m) => {
      const titleMatch = m.title.toLowerCase().includes(q);
      const locMatch = (m.location || "").toLowerCase().includes(q);
      const dateStr = new Date(m.startsAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      });
      return titleMatch || locMatch || dateStr.includes(q);
    });
  }, [meetings, searchQuery]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsSheetVisible(false);
    setSearchQuery("");
  };

  return (
    <>
      <View style={s.selectorContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn cuộc họp"
          style={({ pressed }) => [s.selectorTrigger, pressed && s.triggerPressed]}
          onPress={() => setIsSheetVisible(true)}
        >
          <View style={s.triggerLeft}>
            <View style={s.funnelCircle}>
              <Filter color={colors.primaryDark} size={11.5} strokeWidth={2.4} />
            </View>
            <Text style={s.triggerText} numberOfLines={1}>
              {selectedLabel}
            </Text>
          </View>
          <View style={s.triggerRight}>
            <Text style={s.triggerActionText}>Đổi</Text>
            <ChevronDown color={colors.muted} size={13} strokeWidth={2.2} />
          </View>
        </Pressable>
      </View>

      {/* Bottom Sheet Lọc cuộc họp */}
      <Modal
        visible={isSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsSheetVisible(false);
          setSearchQuery("");
        }}
        statusBarTranslucent
      >
        <KeyboardResponsiveView>
        <View style={s.sheetOverlay}>
          <Pressable
            style={s.sheetBackdrop}
            accessibilityLabel="Đóng bộ lọc"
            onPress={() => {
              setIsSheetVisible(false);
              setSearchQuery("");
            }}
          />
          <View style={s.sheetContent}>
            <View style={s.sheetHandle} />

            {/* Header */}
            <View style={s.sheetHeader}>
              <View style={s.sheetHeaderInfo}>
                <Text style={s.sheetTitle}>Chọn cuộc họp</Text>
                <Text style={s.sheetSubtitle}>
                  {meetings.length} cuộc họp có dữ liệu thống kê
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Đóng"
                hitSlop={10}
                style={s.sheetCloseBtn}
                onPress={() => {
                  setIsSheetVisible(false);
                  setSearchQuery("");
                }}
              >
                <X color={colors.muted} size={20} strokeWidth={2.4} />
              </Pressable>
            </View>

            {/* Search Bar */}
            <View style={s.searchBar}>
              <Search color={colors.muted} size={16} strokeWidth={2.2} />
              <TextInput
                style={s.searchInput}
                placeholder="Tìm theo tên chapter, ngày (dd/mm)..."
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  accessibilityLabel="Xóa tìm kiếm"
                  hitSlop={8}
                  onPress={() => setSearchQuery("")}
                >
                  <X color={colors.muted} size={16} strokeWidth={2.2} />
                </Pressable>
              ) : null}
            </View>

            {/* List */}
            <ScrollView
              style={s.sheetList}
              contentContainerStyle={s.sheetListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => {
                  const isSelected = meeting._id === (selectedId || selectedMeeting?._id);
                  const date = new Date(meeting.startsAt).toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                  });
                  return (
                    <Pressable
                      key={meeting._id}
                      accessibilityRole="button"
                      accessibilityLabel={`${meeting.title}, ngày ${date}`}
                      style={({ pressed }) => [
                        s.sheetItem,
                        isSelected && s.sheetItemActive,
                        pressed && s.sheetItemPressed,
                      ]}
                      onPress={() => handleSelect(meeting._id)}
                    >
                      <View style={[s.itemDateBadge, isSelected && s.itemDateBadgeActive]}>
                        <Text style={[s.itemDateText, isSelected && s.itemDateTextActive]}>
                          {date}
                        </Text>
                      </View>
                      <View style={s.itemInfo}>
                        <Text
                          style={[s.itemTitle, isSelected && s.itemTitleActive]}
                          numberOfLines={1}
                        >
                          {meeting.title}
                        </Text>
                        <Text style={s.itemMeta} numberOfLines={1}>
                          {meeting.speakers.length} check-in · {meeting.location || "Trực tiếp"}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={s.checkIconWrap}>
                          <Check color={colors.primaryDark} size={18} strokeWidth={2.8} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })
              ) : (
                <View style={s.sheetEmpty}>
                  <Text style={s.sheetEmptyText}>
                    {`Không tìm thấy cuộc họp nào phù hợp với "${searchQuery}"`}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
        </KeyboardResponsiveView>
      </Modal>
    </>
  );
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
  selectorContainer: { marginTop: 6, marginBottom: 2 },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F4F9FA',
    borderWidth: 1,
    borderColor: '#D4EBF0',
    borderRadius: radius.pill,
    paddingVertical: 4.5,
    paddingHorizontal: 10,
    minHeight: 32,
  },
  triggerPressed: { opacity: 0.85 },
  triggerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 6 },
  funnelCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: { color: colors.text, fontSize: 11.5, fontWeight: '600', flex: 1 },
  triggerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  triggerActionText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetHeaderInfo: { flex: 1, gap: 2 },
  sheetTitle: { color: colors.text, fontSize: 15.5, fontWeight: '800' },
  sheetSubtitle: { color: colors.muted, fontSize: 11.5 },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  sheetList: { flexGrow: 0, maxHeight: 380 },
  sheetListContent: { gap: 6, paddingVertical: 4 },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#FAFCFD',
  },
  sheetItemActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  sheetItemPressed: { opacity: 0.8 },
  itemDateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EEF3F5',
  },
  itemDateBadgeActive: {
    backgroundColor: colors.primary,
  },
  itemDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  itemDateTextActive: {
    color: '#FFFFFF',
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  itemTitleActive: { color: colors.primaryDark, fontWeight: '800' },
  itemMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  checkIconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  sheetEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  sheetEmptyText: { color: colors.muted, fontSize: 12.5, textAlign: 'center' },
  selector: { gap: 8 },
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
