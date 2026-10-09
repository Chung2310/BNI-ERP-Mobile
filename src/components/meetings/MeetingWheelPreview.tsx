import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Circle,
  Path,
  Text as SvgText,
} from "react-native-svg";
import {
  Award,
  Crown,
  Gift,
  PartyPopper,
  Sparkles,
  Trophy,
  X,
} from "lucide-react-native";
import { Avatar, Badge, Card } from "@/components/ui";
import type { Meeting } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

const SLICE_COLORS = [
  "#EF4444", // Đỏ tươi
  "#F59E0B", // Vàng hổ phách
  "#10B981", // Xanh ngọc
  "#00ADFC", // Xanh biển
  "#8B5CF6", // Tím thạch anh
  "#EC4899", // Hồng sen
  "#D4A017", // Vàng đất
  "#F97316", // Cam rực rỡ
  "#C026D3", // Tím hồng
  "#84CC16", // Xanh lá mạ
];

const center = 100;
const innerRadius = 88;

function point(angle: number, r: number = innerRadius) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + Math.cos(radians) * r,
    y: center + Math.sin(radians) * r,
  };
}

function slicePath(index: number, count: number) {
  const start = point((index * 360) / count, innerRadius);
  const end = point(((index + 1) * 360) / count, innerRadius);
  if (count === 1) {
    return `M 100 100 L 100 ${100 - innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 100 ${100 + innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 100 ${100 - innerRadius} Z`;
  }
  return `M 100 100 L ${start.x} ${start.y} A ${innerRadius} ${innerRadius} 0 ${360 / count > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`;
}

// 16 bóng đèn LED bao quanh vành vàng của vòng quay
const LED_BULBS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i * 360) / 16;
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + Math.cos(rad) * 94,
    y: center + Math.sin(rad) * 94,
    color: i % 2 === 0 ? "#FFFFFF" : "#FEF08A",
  };
});

export function MeetingWheelPreview({
  meeting,
  now,
  selectedPrizeId,
  width,
  fullscreen = false,
}: {
  meeting: Meeting;
  now: number;
  selectedPrizeId?: string;
  width?: number;
  fullscreen?: boolean;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = width ?? screenWidth - 32;

  // Kích thước vòng quay: trên mobile hiển thị to rõ (đường kính ~200 - 220px)
  const wheelSize = fullscreen
    ? Math.min(260, Math.floor(availableWidth * 0.42))
    : Math.min(220, Math.floor(availableWidth * 0.64));

  const state = meeting.presentation;
  const winner = meeting.luckyDraw?.prizes
    .flatMap((prize) => prize.winners)
    .find((item) => item.id === state?.drawWinnerId);

  const selectedPrize =
    meeting.luckyDraw?.prizes.find((prize) => prize.id === selectedPrizeId) ||
    meeting.luckyDraw?.prizes.find((prize) => prize.winners.length < prize.quantity) ||
    meeting.luckyDraw?.prizes[0];

  const numeric = meeting.luckyDraw?.drawMode === "numbers";
  const min = meeting.luckyDraw?.numberMin || 1;
  const max = Math.max(min, meeting.luckyDraw?.numberMax || 100);
  const range = max - min + 1;

  const entries = useMemo(() => {
    if (!numeric) return meeting.speakers.map((person) => person.name);
    const count = Math.min(range, 180);
    return Array.from({ length: count }, (_, index) => {
      const from = min + Math.floor((index * range) / count);
      const to = min + Math.floor(((index + 1) * range) / count) - 1;
      return from === to ? `#${from}` : `#${from}-${to}`;
    });
  }, [numeric, min, range, meeting.speakers]);

  const count = entries.length;
  const targetIndex = winner
    ? numeric
      ? Math.max(
          0,
          Math.min(
            count - 1,
            Math.floor((((winner.ticketNumber ?? min) - min) * count) / range)
          )
        )
      : Math.max(
          0,
          meeting.speakers.findIndex(
            (person) =>
              person.id === winner.winnerId ||
              (winner.userId && person.userId === winner.userId)
          )
        )
    : 0;

  const slice = count ? 360 / count : 360;
  const base = -slice / 2;
  const target = -(targetIndex + 0.5) * slice;
  const extra = 7 * 360 + (((target - base) % 360) + 360) % 360;
  const started = Date.parse(state?.drawStartedAt || "");
  const reveals = Date.parse(state?.drawRevealsAt || "");
  const spinning = Boolean(
    winner && Number.isFinite(started) && Number.isFinite(reveals) && now < reveals
  );

  const [rotation] = useState(() => new Animated.Value(base));
  const [dismissedWinnerId, setDismissedWinnerId] = useState<string | null>(null);

  // Hiệu ứng quay số theo timestamps thực
  useEffect(() => {
    rotation.stopAnimation();
    if (
      !winner ||
      !Number.isFinite(started) ||
      !Number.isFinite(reveals) ||
      reveals <= started
    ) {
      rotation.setValue(winner ? base + extra : base);
      return;
    }
    const progress = Math.max(0, Math.min(1, (now - started) / (reveals - started)));
    const ease = (value: number) => 1 - Math.pow(1 - value, 4);
    const initialEase = ease(progress);
    rotation.setValue(base + extra * initialEase);

    if (progress < 1) {
      Animated.timing(rotation, {
        toValue: base + extra,
        duration: reveals - Math.max(now, started),
        easing: (value) =>
          (ease(progress + (1 - progress) * value) - initialEase) /
          (1 - initialEase),
        useNativeDriver: true,
      }).start();
    }
    return () => rotation.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner?.id, started, reveals, count, targetIndex]);

  // Tự động ẩn banner chúc mừng sau 8 giây kể từ khi công bố kết quả
  useEffect(() => {
    if (winner && !spinning && Number.isFinite(reveals)) {
      const remaining = Math.max(1000, 8000 - (now - reveals));
      const timer = setTimeout(() => {
        setDismissedWinnerId(winner.id);
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [winner?.id, spinning, reveals, now]);

  const showCelebrationBanner = Boolean(
    winner &&
    !spinning &&
    dismissedWinnerId !== winner.id &&
    (now - reveals < 9000 || !Number.isFinite(reveals))
  );

  const rotate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
    extrapolate: "extend",
  });

  // Render Vòng quay may mắn xịn xò
  const renderWheel = () => (
    <View style={[styles.wheelContainer, { width: wheelSize, height: wheelSize }]}>
      {/* Vành vàng tĩnh với đèn LED xung quanh */}
      <Svg width={wheelSize} height={wheelSize} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={99} fill="#F59E0B" />
        <Circle cx={center} cy={center} r={96} fill="#FEF3C7" />
        <Circle cx={center} cy={center} r={91} fill="#D97706" />
        {LED_BULBS.map((bulb, idx) => (
          <Circle key={`bulb-${idx}`} cx={bulb.x} cy={bulb.y} r={2.6} fill={bulb.color} />
        ))}
      </Svg>

      {/* Lõi vòng quay xoay mượt mà */}
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={wheelSize} height={wheelSize} viewBox="0 0 200 200">
          {entries.map((entry, index) => (
            <Path
              key={`${entry}-${index}`}
              d={slicePath(index, count)}
              fill={SLICE_COLORS[index % SLICE_COLORS.length]}
              stroke="#FFFBEB"
              strokeWidth={1.5}
            />
          ))}
          {!count && <Circle cx={center} cy={center} r={innerRadius} fill="#E2E8F0" />}
          {count <= 12 &&
            entries.map((entry, index) => {
              const angle = (index + 0.5) * slice;
              const rad = ((angle - 90) * Math.PI) / 180;
              const px = center + Math.cos(rad) * 54;
              const py = center + Math.sin(rad) * 54;
              return (
                <SvgText
                  key={`label-${index}`}
                  x={px}
                  y={py + 3}
                  fill="#FFFFFF"
                  fontSize={count > 8 ? 8 : 10}
                  fontWeight="800"
                  textAnchor="middle"
                  transform={`rotate(${angle}, ${px}, ${py})`}
                >
                  {entry.length > 8 ? `${entry.slice(0, 7)}.` : entry}
                </SvgText>
              );
            })}
          {/* Trục tâm mạ vàng sang trọng */}
          <Circle cx={center} cy={center} r={22} fill="#D97706" />
          <Circle cx={center} cy={center} r={17} fill="#F59E0B" />
          <Circle cx={center} cy={center} r={12} fill="#FEF3C7" />
          <Circle cx={center} cy={center} r={6} fill="#FFFFFF" />
        </Svg>
      </Animated.View>

      {/* Mũi tên kim loại 3D chỉ giải thưởng ở đỉnh */}
      <View style={[styles.pointerWrap, { left: wheelSize / 2 - 13 }]}>
        <Svg width={26} height={32} viewBox="0 0 26 32">
          <Path
            d="M 13 30 L 3 6 C 3 2 7 0 13 0 C 19 0 23 2 23 6 Z"
            fill="#DC2626"
            stroke="#FEF08A"
            strokeWidth={2.5}
          />
          <Circle cx={13} cy={8} r={3.5} fill="#FEF08A" />
        </Svg>
      </View>
    </View>
  );

  // CHẾ ĐỘ TOÀN MÀN HÌNH (LANDSCAPE / FULLSCREEN STAGE)
  if (fullscreen) {
    return (
      <View style={[styles.fullscreenStage, width !== undefined ? { width } : undefined]}>
        <View style={styles.fullscreenLeft}>{renderWheel()}</View>
        <View style={styles.fullscreenRight}>
          <Badge tone={spinning ? "danger" : "warning"}>
            {spinning ? "⚡ ĐANG QUAY THƯỞNG..." : "QUAY THƯỞNG MAY MẮN"}
          </Badge>
          {(() => {
            const prizeTitle = (winner?.prizeName || selectedPrize?.name || "").trim();
            if (!prizeTitle || prizeTitle.toLowerCase() === "giải thưởng may mắn") return null;
            return (
              <Text numberOfLines={2} style={styles.fullscreenPrizeName}>
                {prizeTitle}
              </Text>
            );
          })()}
          <Text style={styles.fullscreenSubtext}>
            {numeric ? `${range} số may mắn` : `${count} người tham gia`}
          </Text>

          {winner && !spinning ? (
            <View style={styles.fullscreenWinnerCard}>
              <Text style={styles.fullscreenWinnerEyebrow}>🎉 NGƯỜI TRÚNG GIẢI</Text>
              <Text numberOfLines={1} style={styles.fullscreenWinnerName}>
                {winner.name}
              </Text>
              {winner.ticketNumber ? (
                <Text style={styles.fullscreenWinnerTicket}>Số #{winner.ticketNumber}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  // CHẾ ĐỘ MOBILE THƯỜNG (PORTRAIT - KHÔNG NỀN ĐEN, ĐẦY ĐỦ TIỆN ÍCH)
  return (
    <View style={styles.container}>
      {/* 1. KHUNG VÒNG QUAY NỀN SÁNG CAO CẤP */}
      <Card style={styles.wheelCard}>
        {/* Header trạng thái */}
        <View style={styles.headerRow}>
          <View style={styles.prizeInfoCol}>
            <View style={styles.statusBadgeRow}>
              {spinning ? (
                <View style={styles.liveSpinningBadge}>
                  <Sparkles size={13} color="#FFFFFF" />
                  <Text style={styles.liveSpinningText}>ĐANG QUAY...</Text>
                </View>
              ) : (
                <View style={styles.idleBadge}>
                  <Trophy size={13} color="#D97706" />
                  <Text style={styles.idleBadgeText}>QUAY THƯỞNG</Text>
                </View>
              )}
              <Text style={styles.participantCount}>
                {numeric ? `${range} số` : `${count} người tham gia`}
              </Text>
            </View>

            {(() => {
              const prizeTitle = (winner?.prizeName || selectedPrize?.name || "").trim();
              if (!prizeTitle || prizeTitle.toLowerCase() === "giải thưởng may mắn") return null;
              return (
                <Text numberOfLines={1} style={styles.mainPrizeTitle}>
                  {prizeTitle}
                </Text>
              );
            })()}
          </View>
        </View>

        {/* Khu vực vòng quay */}
        <View style={styles.wheelCenterWrap}>{renderWheel()}</View>
      </Card>

      {/* 2. BANNER CHÚC MỪNG NGƯỜI TRÚNG (TỰ ĐỘNG ẨN SAU 8S HOẶC BẤM ĐÓNG) */}
      {showCelebrationBanner && winner ? (
        <View style={styles.celebrationCard}>
          <View style={styles.celebrationHeader}>
            <View style={styles.celebrationTag}>
              <PartyPopper size={16} color="#B45309" />
              <Text style={styles.celebrationTitle}>CHÚC MỪNG CHIẾN THẮNG!</Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => setDismissedWinnerId(winner.id)}
              style={styles.closeBtn}
            >
              <X size={16} color="#92400E" />
            </Pressable>
          </View>

          <View style={styles.celebrationBody}>
            <Avatar
              url={winner.photoURL}
              initials={winner.name ? winner.name.slice(0, 1) : "?"}
              size={48}
            />
            <View style={styles.celebrationInfo}>
              <Text numberOfLines={1} style={styles.celebrationWinnerName}>
                {winner.name}
              </Text>
              {(() => {
                const prizeTitle = (winner.prizeName || selectedPrize?.name || "").trim();
                const hasCustomPrize = prizeTitle && prizeTitle.toLowerCase() !== "giải thưởng may mắn";
                const parts = [
                  hasCustomPrize ? prizeTitle : null,
                  winner.ticketNumber ? `Vé số #${winner.ticketNumber}` : null,
                ].filter(Boolean);
                if (!parts.length) return null;
                return (
                  <Text numberOfLines={1} style={styles.celebrationPrizeText}>
                    {parts.join(" · ")}
                  </Text>
                );
              })()}
            </View>
          </View>
        </View>
      ) : null}

      <MeetingWinnersList meeting={meeting} now={now} />
    </View>
  );
}

export function MeetingWinnersList({ meeting, now }: { meeting: Meeting; now: number }) {
  const winner = meeting.luckyDraw?.prizes
    .flatMap((prize) => prize.winners)
    .find((item) => item.id === meeting.presentation?.drawWinnerId);
  const reveals = Date.parse(meeting.presentation?.drawRevealsAt || "");
  const spinning = Boolean(winner && Number.isFinite(reveals) && now < reveals);
  const allWinners = useMemo(() => {
    const list = (meeting.luckyDraw?.prizes || []).flatMap((prize) =>
      (prize.winners || []).map((item) => ({
        ...item,
        prizeName: item.prizeName || prize.name,
      }))
    );
    return list.sort((a, b) => {
      const timeA = Date.parse(a.wonAt || "");
      const timeB = Date.parse(b.wonAt || "");
      return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
    });
  }, [meeting.luckyDraw?.prizes]);

  return (
    <View style={styles.winnersSection}>
      <View style={styles.winnersHeader}>
        <View style={styles.winnersTitleRow}>
          <Trophy size={18} color="#D97706" />
          <Text style={styles.winnersTitle}>Danh sách trúng thưởng</Text>
        </View>
        <Badge tone={allWinners.length > 0 ? "warning" : "default"}>
          {allWinners.length} người đã trúng
        </Badge>
      </View>

      {allWinners.length > 0 ? (
        <View style={styles.winnersList}>
          {allWinners.map((item, index) => {
            const isRecent = item.id === winner?.id && !spinning;
            return (
              <View
                key={item.id || `winner-${index}`}
                style={[styles.winnerItem, isRecent && styles.latestWinnerItem]}
              >
                <View style={styles.rankCol}>
                  {index === 0 ? (
                    <Crown size={18} color="#D97706" />
                  ) : index === 1 ? (
                    <Award size={18} color="#64748B" />
                  ) : (
                    <Text style={styles.rankNumber}>#{index + 1}</Text>
                  )}
                </View>

                <Avatar
                  url={item.photoURL}
                  initials={item.name ? item.name.slice(0, 1) : "?"}
                  size={38}
                />

                <View style={styles.winnerItemContent}>
                  <View style={styles.winnerNameRow}>
                    <Text numberOfLines={1} style={styles.winnerNameText}>
                      {item.name}
                    </Text>
                    {isRecent ? (
                      <View style={styles.recentPill}>
                        <Gift size={11} color="#B45309" />
                        <Text style={styles.recentPillText}>Vừa trúng</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.winnerMetaRow}>
                    {item.prizeName && item.prizeName.toLowerCase() !== "giải thưởng may mắn" ? (
                      <Text numberOfLines={1} style={styles.prizeBadgeText}>
                        {item.prizeName}
                      </Text>
                    ) : null}
                    {item.ticketNumber ? (
                      <Text style={styles.ticketBadgeText}>
                        Số #{item.ticketNumber}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Gift size={32} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Chưa có người trúng thưởng</Text>
          <Text style={styles.emptySubtitle}>
            {spinning
              ? "Vòng quay đang xoay để tìm người may mắn..."
              : "Kết quả trúng thưởng sẽ hiển thị tại đây theo thời gian thực."}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },

  // Khung vòng quay sáng sủa
  wheelCard: {
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: spacing.sm,
  },
  headerRow: {
    width: "100%",
    alignItems: "center",
  },
  prizeInfoCol: {
    alignItems: "center",
    gap: 4,
  },
  statusBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveSpinningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DC2626",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  liveSpinningText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  idleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  idleBadgeText: {
    color: "#B45309",
    fontSize: 11,
    fontWeight: "700",
  },
  participantCount: {
    color: colors.muted,
    fontSize: 12,
  },
  mainPrizeTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
  },

  wheelCenterWrap: {
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pointerWrap: {
    position: "absolute",
    top: -4,
    zIndex: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  // Banner chúc mừng nổi bật
  celebrationCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  celebrationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  celebrationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  celebrationTitle: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  closeBtn: {
    padding: 2,
  },
  celebrationBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  celebrationInfo: {
    flex: 1,
    gap: 2,
  },
  celebrationWinnerName: {
    color: "#78350F",
    fontSize: 17,
    fontWeight: "800",
  },
  celebrationPrizeText: {
    color: "#B45309",
    fontSize: 13,
    fontWeight: "600",
  },

  // Danh sách người trúng giải Real-time
  winnersSection: {
    gap: spacing.sm,
  },
  winnersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  winnersTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  winnersTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  winnersList: {
    gap: 8,
  },
  winnerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    gap: spacing.sm,
  },
  latestWinnerItem: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFDF7",
    borderWidth: 1.5,
  },
  rankCol: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumber: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  winnerItemContent: {
    flex: 1,
    gap: 3,
  },
  winnerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  winnerNameText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  recentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  recentPillText: {
    color: "#B45309",
    fontSize: 10,
    fontWeight: "800",
  },
  winnerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prizeBadgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "600",
  },
  ticketBadgeText: {
    color: colors.muted,
    fontSize: 12,
  },

  // Empty box
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },

  // Fullscreen Landscape
  fullscreenStage: {
    width: "100%",
    aspectRatio: 16 / 9,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: "#0F172A",
    borderRadius: radius.lg,
  },
  fullscreenLeft: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenRight: {
    flex: 1,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  fullscreenPrizeName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  fullscreenSubtext: {
    color: "#94A3B8",
    fontSize: 12,
  },
  fullscreenWinnerCard: {
    marginTop: spacing.xs,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  fullscreenWinnerEyebrow: {
    color: "#FDE047",
    fontSize: 11,
    fontWeight: "800",
  },
  fullscreenWinnerName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  fullscreenWinnerTicket: {
    color: "#FDE047",
    fontSize: 12,
  },
});
