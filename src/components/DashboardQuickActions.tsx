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
import { ActionIcon3D, type ActionIcon3DType } from '@/components/ActionIcon3D';
import type { UserProfile } from '@/types';
import { colors, radius, shadow, spacing } from '@/theme/tokens';
import { hasPermission } from '@/utils/permissions';

interface QuickActionDef {
  type: ActionIcon3DType;
  icon: LucideIcon;
  title: string;
  href: Href;
}

function ActionItem({ type, icon, title, href }: QuickActionDef) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      onPress={() => router.push(href)}
    >
      <ActionIcon3D type={type} icon={icon} size={46} />
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
      type: 'checkin',
      icon: QrCode,
      title: 'Check-in',
      href: { pathname: '/meeting/[id]/check-in', params: { id: liveMeetingId } },
    });
  }

  if (canCreateMeeting) {
    actions.push({
      type: 'create',
      icon: CalendarPlus,
      title: 'Tạo cuộc họp',
      href: '/meeting/create',
    });
  }

  actions.push(
    {
      type: 'fees',
      icon: WalletCards,
      title: 'Hội phí',
      href: '/fees',
    },
    {
      type: 'rankings',
      icon: Trophy,
      title: 'Xếp hạng',
      href: '/rankings',
    },
    {
      type: 'resources',
      icon: FolderOpen,
      title: 'Tài nguyên',
      href: '/resources',
    },
    {
      type: 'org',
      icon: Network,
      title: 'Sơ đồ Chapter',
      href: '/org-chart',
    },
    {
      type: 'notifications',
      icon: Bell,
      title: 'Thông báo',
      href: '/notifications',
    },
    {
      type: 'settings',
      icon: Settings,
      title: 'Cài đặt',
      href: '/settings',
    }
  );

  if (canViewUsers) {
    actions.push({
      type: 'users',
      icon: UserCog,
      title: 'Quản trị user',
      href: '/admin/users',
    });
  }

  if (canManageRoles) {
    actions.push({
      type: 'roles',
      icon: ShieldCheck,
      title: 'Phân quyền',
      href: '/admin/roles',
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
  itemTitle: {
    marginTop: 6,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },
});
