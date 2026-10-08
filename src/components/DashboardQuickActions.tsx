import { router, type Href } from 'expo-router';
import {
  BarChart3,
  Calendar,
  CalendarPlus,
  FolderOpen,
  ReceiptText,
  Settings,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UserProfile } from '@/types';
import { colors, radius, spacing } from '@/theme/tokens';
import { hasPermission } from '@/utils/permissions';

interface QuickActionDef {
  icon: LucideIcon;
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
        <Icon color={color} size={22} strokeWidth={2.2} />
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
  const isManager = user?.role === 'manager' || user?.role === 'branch_owner' || user?.role === 'admin';
  const canCreateMeeting = isManager && hasPermission(user, 'meetings:manage', 'access:manage');
  const canManageRoles = user?.role === 'admin' && hasPermission(user, 'access:manage');

  const actions: QuickActionDef[] = [];

  // Thêm Lịch trình lên đầu tiện ích (dẫn đến tab cuộc họp/lịch trình)
  actions.push({
    icon: Calendar,
    title: 'Lịch trình',
    href: '/(tabs)/meetings',
    color: '#00AECA',
  });

  // Thêm Thống kê vào tiện ích
  actions.push({
    icon: BarChart3,
    title: 'Thống kê',
    href: '/(tabs)/statistics',
    color: '#0891B2',
  });

  if (canCreateMeeting) {
    actions.push({
      icon: CalendarPlus,
      title: 'Tạo cuộc họp',
      href: '/meeting/create',
      color: '#00AECA',
    });
  }

  actions.push(
    {
      icon: ReceiptText,
      title: 'Hội phí',
      href: '/fees',
      color: '#D97706',
    },
    {
      icon: Trophy,
      title: 'Xếp hạng',
      href: '/rankings',
      color: '#EA580C',
    },
    {
      icon: FolderOpen,
      title: 'Tài nguyên',
      href: '/resources',
      color: '#2563EB',
    },
    {
      icon: Settings,
      title: 'Cài đặt',
      href: '/settings',
      color: '#475569',
    }
  );

  if (canManageRoles) {
    actions.push({
      icon: ShieldCheck,
      title: 'Phân quyền',
      href: '/admin/roles',
      color: '#0D9488',
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
    width: 38,
    height: 38,
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
