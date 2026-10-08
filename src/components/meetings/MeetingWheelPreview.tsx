import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import type { Meeting } from '@/services/meeting';
import { spacing } from '@/theme/tokens';

const colors = ['#cf142b', '#f59e0b', '#059669', '#2563eb', '#9333ea', '#db2777', '#0284c7', '#65a30d'];
const center = 100;
const radius = 92;

function point(angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: center + Math.cos(radians) * radius, y: center + Math.sin(radians) * radius };
}

function slicePath(index: number, count: number) {
  const start = point(index * 360 / count);
  const end = point((index + 1) * 360 / count);
  if (count === 1) return `M 100 100 L 100 8 A 92 92 0 1 1 100 192 A 92 92 0 1 1 100 8 Z`;
  return `M 100 100 L ${start.x} ${start.y} A 92 92 0 ${360 / count > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`;
}

export function MeetingWheelPreview({ meeting, now, selectedPrizeId, width }: { meeting: Meeting; now: number; selectedPrizeId?: string; width?: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = width ?? screenWidth - 16;
  const wheelSize = Math.min(width ? 320 : 176, Math.floor(availableWidth * 0.48), Math.floor(availableWidth * 9 / 16) - 8);
  const state = meeting.presentation;
  const winner = meeting.luckyDraw?.prizes.flatMap((prize) => prize.winners).find((item) => item.id === state?.drawWinnerId);
  const selectedPrize = meeting.luckyDraw?.prizes.find((prize) => prize.id === selectedPrizeId) || meeting.luckyDraw?.prizes.find((prize) => prize.winners.length < prize.quantity);
  const numeric = meeting.luckyDraw?.drawMode === 'numbers';
  const min = meeting.luckyDraw?.numberMin || 1;
  const max = Math.max(min, meeting.luckyDraw?.numberMax || 100);
  const range = max - min + 1;
  const entries = useMemo(() => {
    if (!numeric) return meeting.speakers.map((person) => person.name);
    const count = Math.min(range, 180);
    return Array.from({ length: count }, (_, index) => {
      const from = min + Math.floor(index * range / count);
      const to = min + Math.floor((index + 1) * range / count) - 1;
      return from === to ? `#${from}` : `#${from}–${to}`;
    });
  }, [numeric, min, range, meeting.speakers]);
  const count = entries.length;
  const targetIndex = winner ? numeric
    ? Math.max(0, Math.min(count - 1, Math.floor(((winner.ticketNumber ?? min) - min) * count / range)))
    : Math.max(0, meeting.speakers.findIndex((person) => person.id === winner.winnerId || (winner.userId && person.userId === winner.userId))) : 0;
  const slice = count ? 360 / count : 360;
  const base = -slice / 2;
  const target = -(targetIndex + 0.5) * slice;
  const extra = 7 * 360 + ((target - base) % 360 + 360) % 360;
  const started = Date.parse(state?.drawStartedAt || '');
  const reveals = Date.parse(state?.drawRevealsAt || '');
  const spinning = Boolean(winner && Number.isFinite(started) && Number.isFinite(reveals) && now < reveals);
  const [rotation] = useState(() => new Animated.Value(base));

  useEffect(() => {
    rotation.stopAnimation();
    if (!winner || !Number.isFinite(started) || !Number.isFinite(reveals) || reveals <= started) {
      rotation.setValue(winner ? base + extra : base);
      return;
    }
    const progress = Math.max(0, Math.min(1, (now - started) / (reveals - started)));
    const ease = (value: number) => 1 - Math.pow(1 - value, 4);
    const initialEase = ease(progress);
    rotation.setValue(base + extra * initialEase);
    if (progress < 1) Animated.timing(rotation, {
      toValue: base + extra,
      duration: reveals - Math.max(now, started),
      easing: (value) => (ease(progress + (1 - progress) * value) - initialEase) / (1 - initialEase),
      useNativeDriver: true,
    }).start();
    return () => rotation.stopAnimation();
    // The animation follows server timestamps and restarts only for a new draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner?.id, started, reveals, count, targetIndex]);

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });
  return <View style={[styles.stage, width !== undefined ? { width } : undefined]}>
    <View style={[styles.wheelBox, { width: wheelSize, height: wheelSize }]}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={wheelSize} height={wheelSize} viewBox="0 0 200 200">
          <Circle cx={center} cy={center} r={98} fill="#fbbf24" />
          {entries.map((entry, index) => <Path key={`${entry}-${index}`} d={slicePath(index, count)} fill={colors[index % colors.length]} stroke="#fff7ed" strokeWidth={1} />)}
          {!count && <Circle cx={center} cy={center} r={radius} fill="#334155" />}
          {count <= 12 && entries.map((entry, index) => {
            const angle = (index + 0.5) * slice;
            const position = { x: center + Math.cos((angle - 90) * Math.PI / 180) * 60, y: center + Math.sin((angle - 90) * Math.PI / 180) * 60 };
            return <SvgText key={`label-${index}`} x={position.x} y={position.y} fill="#FFFFFF" fontSize={count > 8 ? 8 : 10} fontWeight="700" textAnchor="middle">{entry.length > 9 ? `${entry.slice(0, 8)}…` : entry}</SvgText>;
          })}
          <Circle cx={center} cy={center} r={19} fill="#f8fafc" stroke="#fbbf24" strokeWidth={5} />
        </Svg>
      </Animated.View>
      <View style={[styles.pointer, { left: wheelSize / 2 - 9 }]} />
    </View>
    <View style={styles.info}>
      <Text style={styles.eyebrow}>{spinning ? 'ĐANG QUAY TRÊN LAPTOP' : 'QUAY THƯỞNG'}</Text>
      <Text numberOfLines={2} style={styles.prize}>{winner?.prizeName || selectedPrize?.name || 'Chọn giải để bắt đầu'}</Text>
      <Text style={styles.detail}>{numeric ? `${range} số may mắn` : `${count} người tham gia`}</Text>
      {winner && !spinning ? <View style={styles.winner}><Text style={styles.winnerCaption}>NGƯỜI TRÚNG</Text><Text numberOfLines={2} style={styles.winnerName}>{winner.name}</Text>{winner.ticketNumber ? <Text style={styles.detail}>Số {winner.ticketNumber}</Text> : null}</View> : null}
      {spinning ? <Text style={styles.detail}>Kết quả sắp công bố…</Text> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  stage: { width: '100%', aspectRatio: 16 / 9, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: '#101827' },
  wheelBox: { alignItems: 'center', justifyContent: 'center' },
  pointer: { position: 'absolute', top: -1, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 18, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fbbf24' },
  info: { flex: 1, gap: spacing.xs },
  eyebrow: { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
  prize: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  detail: { color: '#CBD5E1', fontSize: 12 },
  winner: { gap: 2, paddingTop: spacing.xs },
  winnerCaption: { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
  winnerName: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
