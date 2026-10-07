import { router } from 'expo-router';
import { Bell, ChevronRight, FolderOpen, Settings, Trophy, WalletCards } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Avatar, Card, Screen } from '@/components/ui';
import { MenuTile } from '@/components/MenuTile';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing } from '@/theme/tokens';

export default function MoreScreen() {
  const { user } = useAuth();
  return (
    <Screen>
      <AppHeader title='Thêm' subtitle='Tài khoản và công cụ' />
      <Pressable accessibilityRole='button' accessibilityLabel='Xem thông tin tài khoản' onPress={() => router.push('/profile')}>
        {({ pressed }) => (
          <Card style={[styles.profile, pressed && styles.pressed]}>
            <Avatar
              initials={(user?.displayName || 'Nguyễn Minh').split(' ').map((part) => part[0]).slice(-2).join('').toUpperCase()}
              url={user?.photoURL}
            />
            <View style={styles.grow}>
              <Text style={styles.name}>{user?.displayName || 'Nguyễn Minh'}</Text>
              <Text style={styles.meta}>{user?.role || 'Thành viên'} · {user?.companyCode || 'IGEN'}</Text>
            </View>
            <View style={styles.chevron}><ChevronRight color={colors.muted} size={24} /></View>
          </Card>
        )}
      </Pressable>
      <View style={styles.grid}>
        <MenuTile icon={Trophy} title='Bảng xếp hạng' subtitle='Hoạt động thành viên' href='/rankings' />
        <MenuTile icon={FolderOpen} title='Tài nguyên' subtitle='File và Google Drive' href='/resources' />
        <MenuTile icon={WalletCards} title='Phí thường niên' subtitle='Thanh toán và đối soát' href='/fees' />
        <MenuTile icon={Bell} title='Thông báo' subtitle='Hộp thư cập nhật' href='/notifications' />
        <MenuTile icon={Settings} title='Cài đặt' subtitle='Hồ sơ và bảo mật' href='/settings' />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  meta: { marginTop: 3, color: colors.muted, fontSize: 12 },
  chevron: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
