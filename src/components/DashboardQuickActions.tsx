import { useContext } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarCheck, CalendarPlus, ChartNoAxesCombined, MessageSquareMore, Podium, Settings, Users, type LucideIcon } from 'lucide-react-native';
import { ChatUnreadCountContext } from '@/context/ChatUnreadCountContext';
import type { UserProfile } from '@/types';
import { colors, radius, spacing } from '@/theme/tokens';
import { canCreateMeeting } from '@/utils/permissions';

interface QuickActionDef {
  icon: LucideIcon;
  title: string;
  href: Href;
  color: string;
  unreadCount?: number;
}

function ActionItem({ icon: Icon, title, href, color, unreadCount = 0 }: QuickActionDef) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `${title}, ${unreadCount} tin nhắn chưa đọc` : title}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      onPress={() => router.push(href)}
    >
      <View style={styles.iconBox}>
        <Icon color={color} size={25} strokeWidth={2.2} />
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
}: {
  user: UserProfile | null;
  liveMeetingId?: string;
}) {
  const showCreateMeeting = canCreateMeeting(user);
  const chatUnreadCount = useContext(ChatUnreadCountContext);

  const actions: QuickActionDef[] = [];

  // Thêm Lịch trình lên đầu tiện ích (dẫn đến tab cuộc họp/lịch trình)
  actions.push({
    icon: CalendarCheck,
    title: 'Lịch trình',
    href: '/(tabs)/meetings',
    color: colors.brandBlue,
  });

  // Thêm Thống kê vào tiện ích
  actions.push({
    icon: ChartNoAxesCombined,
    title: 'Thống kê',
    href: '/(tabs)/statistics',
    color: colors.brandBlue,
  });

  if (user && user.role !== 'admin') {
    actions.push({
      icon: Users,
      title: 'Thành viên',
      href: '/(tabs)/members',
      color: colors.brandBlue,
    });
  }

  if (showCreateMeeting) {
    actions.push({
      icon: CalendarPlus,
      title: 'Tạo cuộc họp',
      href: '/meeting/create',
      color: colors.brandBlue,
    });
  }

  actions.push(
    {
      icon: MessageSquareMore,
      title: 'Trò chuyện',
      href: '/(tabs)/chat',
      color: colors.brandBlue,
      unreadCount: chatUnreadCount,
    },
    {
      icon: Podium,
      title: 'Xếp hạng',
      href: '/rankings',
      color: colors.brandBlue,
    },
    {
      icon: Settings,
      title: 'Cài đặt',
      href: '/settings',
      color: colors.brandBlue,
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
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 1,
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
