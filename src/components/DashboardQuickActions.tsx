import { router, type Href } from 'expo-router';
import {
  Bell,
  CalendarPlus,
  FolderOpen,
  Network,
  QrCode,
  Settings,
  ShieldCheck,
  Trophy,
  UserCog,
  WalletCards,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UserProfile } from '@/types';
import { colors, radius, shadow, spacing } from '@/theme/tokens';
import { hasPermission } from '@/utils/permissions';

interface QuickActionDef {
  icon: LucideIcon;
  title: string;
  href: Href;
  color: string;
  bgColor: string;
}

function ActionItem({ icon: Icon, title, href, color, bgColor }: QuickActionDef) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      onPress={() => router.push(href)}
    >
      <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
        <Icon color={color} size={22} strokeWidth={2} />
      </View>
      <Text style={styles.itemTitle} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

export function DashboardQuickActions({
  user,
  liveMeetingId,
}: {
  user: UserProfile | null;
  liveMeetingId?: string;
}) {
  const isManager = user?.role === 'manager' || user?.role === 'branch_owner' || user?.role === 'admin';
  const isOwner = user?.role === 'branch_owner' || user?.role === 'admin';
  const canCreateMeeting = isManager && hasPermission(user, 'meetings:manage', 'access:manage');
  const canViewUsers = isOwner && hasPermission(user, 'access:read', 'access:manage');
  const canManageRoles = user?.role === 'admin' && hasPermission(user, 'access:manage');

  const actions: QuickActionDef[] = [];

  if (liveMeetingId) {
    actions.push({
      icon: QrCode,
      title: 'Check-in',
      href: { pathname: '/meeting/[id]/check-in', params: { id: liveMeetingId } },
      color: '#00A86B',
      bgColor: '#E6FAF2',
    });
  }

  if (canCreateMeeting) {
    actions.push({
      icon: CalendarPlus,
      title: 'Tạo cuộc họp',
      href: '/meeting/create',
      color: '#00AECA',
      bgColor: '#E6F8FB',
    });
  }

  actions.push(
    {
      icon: WalletCards,
      title: 'Hội phí',
      href: '/fees',
      color: '#D97706',
      bgColor: '#FFFBEB',
    },
    {
      icon: Trophy,
      title: 'Xếp hạng',
      href: '/rankings',
      color: '#EA580C',
      bgColor: '#FFF4ED',
    },
    {
      icon: FolderOpen,
      title: 'Tài nguyên',
      href: '/resources',
      color: '#2563EB',
      bgColor: '#EFF6FF',
    },
    {
      icon: Network,
      title: 'Sơ đồ Chapter',
      href: '/org-chart',
      color: '#7C3AED',
      bgColor: '#F5F3FF',
    },
    {
      icon: Bell,
      title: 'Thông báo',
      href: '/notifications',
      color: '#DB2777',
      bgColor: '#FDF2F8',
    },
    {
      icon: Settings,
      title: 'Cài đặt',
      href: '/settings',
      color: '#475569',
      bgColor: '#F1F5F9',
    }
  );

  if (canViewUsers) {
    actions.push({
      icon: UserCog,
      title: 'Quản trị user',
      href: '/admin/users',
      color: '#0284C7',
      bgColor: '#F0F9FF',
    });
  }

  if (canManageRoles) {
    actions.push({
      icon: ShieldCheck,
      title: 'Phân quyền',
      href: '/admin/roles',
      color: '#0D9488',
      bgColor: '#F0FDFA',
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    ...shadow,
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
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
    marginBottom: spacing.xs,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    marginTop: 6,
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },
});
