import { useContext } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UtilityIcon, UtilityLockIcon, type UtilityIconName } from '@/components/UtilityIcon';
import { Alert } from '@/components/AppAlert';
import { isChapterGuest } from '@/utils/guest';
import { ChatUnreadCountContext } from '@/context/ChatUnreadCountContext';
import type { UserProfile } from '@/types';
import { colors } from '@/theme/tokens';
import { canCreateMeeting } from '@/utils/permissions';

interface QuickActionDef {
  icon: UtilityIconName;
  title: string;
  href: Href;
  unreadCount?: number;
  locked?: boolean;
}

const iconColors: Record<UtilityIconName, { color: string; accent: string; background: string }> = {
  schedule: { color: '#079BFA', accent: '#75D3FF', background: '#E6F6FF' },
  statistics: { color: '#7552E9', accent: '#B5A1FF', background: '#F1EEFF' },
  chapter: { color: '#10AB87', accent: '#8EE5CC', background: '#E6F8F1' },
  members: { color: '#54A9F0', accent: '#9CB7F5', background: '#EDF6FF' },
  createMeeting: { color: '#FFA31A', accent: '#FFD48D', background: '#FFF4E5' },
  chat: { color: '#FC5E7E', accent: '#FFB0C0', background: '#FFF0F3' },
  ranking: { color: '#FFA51F', accent: '#FFCC76', background: '#FFF5E7' },
  settings: { color: '#6795C8', accent: '#AACBE9', background: '#EFF5FC' },
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
        <View style={[styles.iconFace, { backgroundColor: palette.background }]}>
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
    borderRadius: 24,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 8,
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
    paddingVertical: 2,
    paddingHorizontal: 2,
    marginBottom: 12,
    overflow: 'visible',
  },
  iconBox: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 1,
  },
  iconFace: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  itemTitle: {
    marginTop: 6,
    color: '#081735',
    fontSize: 11.5,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },
});
