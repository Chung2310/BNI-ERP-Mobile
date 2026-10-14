import { useContext } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UtilityIcon, UtilityLockIcon, type UtilityIconName } from '@/components/UtilityIcon';
import { Alert } from '@/components/AppAlert';
import { isChapterGuest } from '@/utils/guest';
import { ChatUnreadCountContext } from '@/context/ChatUnreadCountContext';
import type { UserProfile } from '@/types';
import { colors, radius, spacing } from '@/theme/tokens';
import { canCreateMeeting } from '@/utils/permissions';

interface QuickActionDef {
  icon: UtilityIconName;
  title: string;
  href: Href;
  unreadCount?: number;
  locked?: boolean;
}

const iconColors: Record<UtilityIconName, { color: string; accent: string; background: string }> = {
  schedule: { color: '#00ADFC', accent: '#78D9FF', background: '#E8F8FF' },
  statistics: { color: '#718BED', accent: '#70D7FC', background: '#EEF2FF' },
  chapter: { color: '#00A9DE', accent: '#87D9F6', background: '#E7F8FF' },
  members: { color: '#54A9F0', accent: '#9CB7F5', background: '#EDF6FF' },
  createMeeting: { color: '#369EEF', accent: '#94D8FF', background: '#EAF5FF' },
  chat: { color: '#688CE6', accent: '#72D2FF', background: '#EEF2FF' },
  ranking: { color: '#6D91EA', accent: '#93CEFF', background: '#ECF3FF' },
  settings: { color: '#69A5E1', accent: '#6ED3E8', background: '#EAF7FD' },
};

function ActionItem({ icon, title, href, unreadCount = 0, locked = false }: QuickActionDef) {
  const palette = iconColors[icon];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0
        ? `${title}, ${unreadCount} ${icon === 'chapter' ? 'đơn xin gia nhập chưa xử lý' : 'tin nhắn chưa đọc'}`
        : title}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      onPress={() => locked ? Alert.alert(title, 'Tính năng sẽ mở khi bạn gia nhập Chapter.') : router.push(href)}
    >
      <View style={styles.iconBox}>
        <View style={[styles.iconDepth, { backgroundColor: palette.color }]} />
        <View style={[styles.iconFace, { backgroundColor: palette.background, shadowColor: palette.color }]}>
          <View style={styles.iconShine} />
          <UtilityIcon name={icon} color={palette.color} accent={palette.accent} />
        </View>
        {locked ? <View style={styles.lockBadge}><UtilityLockIcon /></View> : null}
        {unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount >= 100 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.itemTitle} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

export function DashboardQuickActions({
  user,
  pendingChapterApplications = 0,
}: {
  user: UserProfile | null;
  liveMeetingId?: string;
  pendingChapterApplications?: number;
}) {
  const showCreateMeeting = canCreateMeeting(user);
  const guest = isChapterGuest(user);
  const chatUnreadCount = useContext(ChatUnreadCountContext);

  const actions: QuickActionDef[] = [];

  // Thêm Lịch trình lên đầu tiện ích (dẫn đến tab cuộc họp/lịch trình)
  actions.push({
    icon: 'schedule',
    title: 'Lịch trình',
    href: '/(tabs)/meetings',
  });

  // Thêm Thống kê vào tiện ích
  actions.push({
    icon: 'statistics',
    title: 'Thống kê',
    href: '/(tabs)/statistics',
    locked: guest,
  });

  if (user) {
    actions.push({
      icon: 'chapter',
      title: 'Chapter',
      href: guest ? '/(tabs)/chapters' : '/chapter',
      unreadCount: user.role === 'admin' ? pendingChapterApplications : 0,
    });
  }

  if (user && user.role !== 'admin') {
    actions.push({
      icon: 'members',
      title: 'Thành viên',
      href: '/(tabs)/members',
      locked: guest,
    });
  }

  if (showCreateMeeting) {
    actions.push({
      icon: 'createMeeting',
      title: 'Tạo cuộc họp',
      href: '/meeting/create',
    });
  }

  actions.push(
    {
      icon: 'chat',
      title: 'Trò chuyện',
      href: '/(tabs)/chat',
      unreadCount: chatUnreadCount,
      locked: guest,
    },
    {
      icon: 'ranking',
      title: 'Xếp hạng',
      href: '/rankings',
      locked: guest,
    },
    {
      icon: 'settings',
      title: 'Cài đặt',
      href: '/settings',
    }
  );

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {actions.map((action) => (
          <ActionItem key={action.title} {...action} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 0,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  item: {
    width: '25%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 2,
    overflow: 'visible',
  },
  iconBox: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 1,
  },
  iconDepth: {
    position: 'absolute',
    top: 3,
    width: 46,
    height: 46,
    borderRadius: radius.md,
    opacity: 0.22,
  },
  iconFace: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  iconShine: {
    position: 'absolute',
    top: 3,
    left: 5,
    width: 28,
    height: 11,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    opacity: 0.55,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    elevation: 2,
  },
  lockBadge: { position: 'absolute', right: -4, bottom: -3, borderRadius: 8, backgroundColor: colors.surface, padding: 2 },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  itemTitle: {
    marginTop: 2,
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },
});
