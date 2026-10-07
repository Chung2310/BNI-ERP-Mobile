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
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { MenuTile } from '@/components/MenuTile';
import type { UserProfile } from '@/types';
import { spacing } from '@/theme/tokens';
import { hasPermission } from '@/utils/permissions';

export function DashboardQuickActions({ user, liveMeetingId }: { user: UserProfile | null; liveMeetingId?: string }) {
  const isManager = user?.role === 'manager' || user?.role === 'branch_owner' || user?.role === 'admin';
  const isOwner = user?.role === 'branch_owner' || user?.role === 'admin';
  const canCreateMeeting = isManager && hasPermission(user, 'meetings:manage', 'access:manage');
  const canViewUsers = isOwner && hasPermission(user, 'access:read', 'access:manage');
  const canManageRoles = user?.role === 'admin' && hasPermission(user, 'access:manage');

  return (
    <View style={styles.grid}>
      {liveMeetingId ? (
        <MenuTile
          compact
          icon={QrCode}
          title='Check-in cuộc họp'
          subtitle='Xác nhận tham dự'
          href={{ pathname: '/meeting/[id]/check-in', params: { id: liveMeetingId } }}
        />
      ) : null}
      {canCreateMeeting ? <MenuTile compact icon={CalendarPlus} title='Tạo cuộc họp' subtitle='Lên lịch buổi họp mới' href='/meeting/create' /> : null}
      <MenuTile compact icon={WalletCards} title='Thanh toán phí' subtitle='Xem và thanh toán hội phí' href='/fees' />
      <MenuTile compact icon={Trophy} title='Bảng xếp hạng' subtitle='Hoạt động thành viên' href='/rankings' />
      <MenuTile compact icon={FolderOpen} title='Tài nguyên' subtitle='Tệp và tài liệu chung' href='/resources' />
      <MenuTile compact icon={Network} title='Sơ đồ tổ chức' subtitle='Cơ cấu Chapter' href='/org-chart' />
      <MenuTile compact icon={Bell} title='Thông báo' subtitle='Các cập nhật mới nhất' href='/notifications' />
      <MenuTile compact icon={Settings} title='Cài đặt' subtitle='Hồ sơ và bảo mật' href='/settings' />
      {canViewUsers ? <MenuTile compact icon={UserCog} title='Quản trị user' subtitle='Tài khoản và chi nhánh' href='/admin/users' /> : null}
      {canManageRoles ? <MenuTile compact icon={ShieldCheck} title='Phân quyền' subtitle='Vai trò và quyền hạn' href='/admin/roles' /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
