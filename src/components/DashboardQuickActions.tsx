import type { ComponentType } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import {
  DuotoneAnalyticsIcon,
  DuotoneCalendarIcon,
  DuotoneChatIcon,
  DuotoneCreateMeetingIcon,
  DuotoneFolderIcon,
  DuotoneSettingsIcon,
  DuotoneShieldIcon,
  DuotoneTrophyIcon,
} from '@/components/icons/DuotoneActionIcons';
import type { UserProfile } from '@/types';
import { colors, radius, spacing } from '@/theme/tokens';
import { canAccessSystem, canCreateMeeting } from '@/utils/permissions';

interface QuickActionDef {
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  title: string;
  href: Href;
  color: string;
}

function ActionItem({ icon: Icon, title, href, color }: QuickActionDef) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      onPress={() => router.push(href)}
    >
      <View style={styles.iconBox}>
        <Icon color={color} size={25} strokeWidth={2.2} />
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
  const showSystem = canAccessSystem(user);

  const actions: QuickActionDef[] = [];

  // Thêm Lịch trình lên đầu tiện ích (dẫn đến tab cuộc họp/lịch trình)
  actions.push({
    icon: DuotoneCalendarIcon,
    title: 'Lịch trình',
    href: '/(tabs)/meetings',
    color: '#00AECA',
  });

  // Thêm Thống kê vào tiện ích
  actions.push({
    icon: DuotoneAnalyticsIcon,
    title: 'Thống kê',
    href: '/(tabs)/statistics',
    color: '#00AECA',
  });

  if (user && user.role !== 'admin') {
    actions.push({
      icon: Users,
      title: 'Thành viên',
      href: '/(tabs)/members',
      color: '#00AECA',
    });
  }

  if (showCreateMeeting) {
    actions.push({
      icon: DuotoneCreateMeetingIcon,
      title: 'Tạo cuộc họp',
      href: '/meeting/create',
      color: '#00AECA',
    });
  }

  actions.push(
    {
      icon: DuotoneChatIcon,
      title: 'Trò chuyện',
      href: '/(tabs)/chat',
      color: '#00AECA',
    },
    {
      icon: DuotoneTrophyIcon,
      title: 'Xếp hạng',
      href: '/rankings',
      color: '#00AECA',
    },
    {
      icon: DuotoneFolderIcon,
      title: 'Tài nguyên',
      href: '/resources',
      color: '#00AECA',
    },
    {
      icon: DuotoneSettingsIcon,
      title: 'Cài đặt',
      href: '/settings',
      color: '#00AECA',
    }
  );

  if (showSystem) {
    actions.push({
      icon: DuotoneShieldIcon,
      title: 'Quản trị hệ thống',
      href: '/(tabs)/more',
      color: '#00AECA',
    });
  }

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
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF', // Nền màu trắng trùng với màu card
    alignItems: 'center',
    justifyContent: 'center',
  },
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
