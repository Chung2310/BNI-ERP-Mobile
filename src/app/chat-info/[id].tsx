import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Pin, Search, Shield, UserPlus, X } from 'lucide-react-native';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/BackHeader';
import { Avatar, Badge, Button, Card, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { chatService, type ChatRoomMember } from '@/services/chat';
import { userService } from '@/services/users';
import { colors, radius, spacing, touchTarget } from '@/theme/tokens';
import type { UserProfile } from '@/types';

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).slice(-2).join('').toUpperCase();

const roleLabel = (role?: string) =>
  role === 'admin' ? 'Trưởng nhóm' : role === 'deputy' ? 'Phó nhóm' : 'Thành viên';

export default function ChatInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: room, setData: setRoom, error, isLoading, reload } = useAsyncData(() => chatService.room(id), id);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const currentMember = room?.members.find((member) => member.userId._id === user?.uid || member.userId.uid === user?.uid);
  const isAdmin = currentMember?.role === 'admin';
  const isDeputy = currentMember?.role === 'deputy';
  const isBlocked = Boolean(room?.blockedBy?.includes(user?.uid || ''));

  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
    } catch (cause) {
      Alert.alert('Không thể thực hiện', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setBusy('');
    }
  };

  const saveName = () => void run('name', async () => {
    if (!name.trim() || name.trim() === room?.name) return;
    setRoom(await chatService.updateRoom(id, { name: name.trim() }));
    setName('');
  });

  const toggleAdminsOnly = (value: boolean) => void run('permission', async () => {
    setRoom(await chatService.updateRoom(id, { onlyAdminsCanMessage: value }));
  });

  const togglePin = () => void run('pin', async () => {
    setRoom(await chatService.togglePinRoom(id));
  });

  const toggleBlock = () => {
    Alert.alert(
      isBlocked ? 'Bỏ chặn cuộc trò chuyện?' : 'Chặn cuộc trò chuyện?',
      isBlocked ? 'Bạn sẽ có thể gửi và nhận tin nhắn trở lại.' : 'Bạn sẽ không thể gửi tin nhắn trong cuộc trò chuyện này.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: isBlocked ? 'Bỏ chặn' : 'Chặn',
          style: isBlocked ? 'default' : 'destructive',
          onPress: () => void run('block', async () => setRoom(await chatService.setBlocked(id, !isBlocked))),
        },
      ],
    );
  };

  const memberActions = (member: ChatRoomMember) => {
    if (!isAdmin || member.userId._id === user?.uid || member.userId.uid === user?.uid) return;
    Alert.alert(member.userId.displayName, 'Quản lý thành viên', [
      {
        text: member.role === 'deputy' ? 'Chuyển thành thành viên' : 'Đặt làm phó nhóm',
        onPress: () => void run('role', async () => {
          setRoom(await chatService.updateMemberRole(id, member.userId._id, member.role === 'deputy' ? 'member' : 'deputy'));
        }),
      },
      {
        text: 'Xóa khỏi nhóm',
        style: 'destructive',
        onPress: () => void run('remove', async () => setRoom(await chatService.removeMember(id, member.userId._id))),
      },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const exitRoom = () => {
    const deleting = Boolean(isAdmin);
    Alert.alert(
      deleting ? 'Giải tán nhóm?' : 'Rời khỏi nhóm?',
      deleting ? 'Nhóm và toàn bộ tin nhắn sẽ bị xóa.' : 'Bạn sẽ không còn nhận được tin nhắn từ nhóm.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: deleting ? 'Giải tán' : 'Rời nhóm',
          style: 'destructive',
          onPress: () => void run('exit', async () => {
            if (deleting) await chatService.deleteRoom(id);
            else await chatService.leaveRoom(id);
            router.replace('/(tabs)/chat');
          }),
        },
      ],
    );
  };

  if (isLoading && !room) return <Screen scroll={false}><BackHeader title='Thông tin trò chuyện' /><LoadingState /></Screen>;
  if (error && !room) return <Screen><BackHeader title='Thông tin trò chuyện' /><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!room) return null;

  const other = room.members.find((member) => member.userId._id !== user?.uid && member.userId.uid !== user?.uid)?.userId;
  const roomName = room.name || other?.displayName || 'Cuộc trò chuyện';

  return (
    <>
      <Screen>
        <BackHeader title='Thông tin trò chuyện' />
        <View style={styles.hero}>
          <Avatar initials={initials(roomName)} url={room.avatarURL || (!room.isGroup ? other?.photoURL : undefined)} size={76} />
          <Text style={styles.roomName}>{roomName}</Text>
          <Text style={styles.roomMeta}>{room.isGroup ? room.members.length + ' thành viên' : other?.email}</Text>
        </View>

        <Card style={styles.actions}>
          <Pressable onPress={togglePin} style={styles.actionRow}>
            <Pin color={colors.primaryDark} size={20} />
            <Text style={styles.actionText}>{currentMember?.isPinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'}</Text>
          </Pressable>
          {!room.isGroup ? (
            <Pressable onPress={toggleBlock} style={styles.actionRow}>
              <Shield color={isBlocked ? colors.danger : colors.primaryDark} size={20} />
              <Text style={[styles.actionText, isBlocked && styles.dangerText]}>{isBlocked ? 'Bỏ chặn' : 'Chặn người dùng'}</Text>
            </Pressable>
          ) : null}
        </Card>

        {room.isGroup && isAdmin ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Quản lý nhóm</Text>
            <View style={styles.nameEditor}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={room.name || 'Tên nhóm'}
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Button onPress={saveName} disabled={!name.trim() || busy === 'name'}>Lưu</Button>
            </View>
            <View style={styles.switchRow}>
              <View style={styles.grow}>
                <Text style={styles.switchTitle}>Chỉ quản trị viên được nhắn</Text>
                <Text style={styles.switchHint}>Thành viên thường chỉ có thể đọc tin nhắn.</Text>
              </View>
              <Switch value={Boolean(room.onlyAdminsCanMessage)} onValueChange={toggleAdminsOnly} trackColor={{ true: colors.primary }} />
            </View>
          </Card>
        ) : null}

        {room.isGroup ? (
          <Card style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>Thành viên</Text>
                <Text style={styles.count}>{room.members.length} người</Text>
              </View>
              {isAdmin || isDeputy ? (
                <Pressable onPress={() => setShowAddMembers(true)} style={styles.addMember}>
                  <UserPlus color='#FFFFFF' size={18} />
                  <Text style={styles.addMemberText}>Thêm</Text>
                </Pressable>
              ) : null}
            </View>
            {room.members.map((member) => (
              <Pressable key={member.userId._id} onLongPress={() => memberActions(member)} style={styles.member}>
                <Avatar initials={initials(member.userId.displayName)} url={member.userId.photoURL} size={42} />
                <View style={styles.grow}>
                  <Text style={styles.memberName}>{member.userId.displayName}</Text>
                  <Text style={styles.memberEmail}>{member.userId.email}</Text>
                </View>
                <Badge tone={member.role === 'admin' ? 'primary' : 'default'}>{roleLabel(member.role)}</Badge>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {room.isGroup ? (
          <Button tone='danger' fullWidth onPress={exitRoom} disabled={busy === 'exit'}>
            {isAdmin ? 'Giải tán nhóm' : 'Rời khỏi nhóm'}
          </Button>
        ) : null}
      </Screen>

      {showAddMembers ? (
        <AddMembersModal
          roomId={id}
          existingIds={room.members.map((member) => member.userId._id)}
          onClose={() => setShowAddMembers(false)}
          onUpdated={(updated) => { setRoom(updated); setShowAddMembers(false); }}
        />
      ) : null}
    </>
  );
}

function AddMembersModal({
  roomId,
  existingIds,
  onClose,
  onUpdated,
}: {
  roomId: string;
  existingIds: string[];
  onClose: () => void;
  onUpdated: (room: Awaited<ReturnType<typeof chatService.addMembers>>) => void;
}) {
  const { data, error, isLoading } = useAsyncData(userService.directory);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const candidates = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    return (data || []).filter((item) =>
      !existingIds.includes(item.uid) &&
      (!keyword || [item.displayName, item.email].some((value) => value.toLocaleLowerCase('vi').includes(keyword))),
    );
  }, [data, existingIds, query]);

  const add = async () => {
    if (!selected.length || saving) return;
    setSaving(true);
    try {
      onUpdated(await chatService.addMembers(roomId, selected));
    } catch (cause) {
      Alert.alert('Không thể thêm thành viên', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType='slide' onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <View style={styles.grow}><Text style={styles.modalTitle}>Thêm thành viên</Text><Text style={styles.switchHint}>Chọn người muốn thêm vào nhóm.</Text></View>
          <Pressable onPress={onClose} style={styles.close}><X color={colors.text} size={22} /></Pressable>
        </View>
        <View style={styles.search}>
          <Search color={colors.muted} size={18} />
          <TextInput value={query} onChangeText={setQuery} placeholder='Tìm thành viên...' placeholderTextColor={colors.muted} style={styles.searchInput} />
        </View>
        {isLoading ? <LoadingState /> : error ? <Text style={styles.dangerText}>{error}</Text> : (
          <FlatList
            data={candidates}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }: { item: UserProfile }) => {
              const checked = selected.includes(item.uid);
              return (
                <Pressable onPress={() => setSelected((current) => checked ? current.filter((value) => value !== item.uid) : [...current, item.uid])} style={styles.member}>
                  <Avatar initials={initials(item.displayName)} url={item.photoURL} size={42} />
                  <View style={styles.grow}><Text style={styles.memberName}>{item.displayName}</Text><Text style={styles.memberEmail}>{item.email}</Text></View>
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Check color='#FFFFFF' size={15} /> : null}</View>
                </Pressable>
              );
            }}
          />
        )}
        <Button fullWidth onPress={add} disabled={!selected.length || saving}>{saving ? 'Đang thêm...' : 'Thêm ' + selected.length + ' thành viên'}</Button>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  roomName: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  roomMeta: { color: colors.muted, fontSize: 12 },
  actions: { paddingVertical: 0 },
  actionRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  actionText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  dangerText: { color: colors.danger },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { marginTop: 2, color: colors.muted, fontSize: 11 },
  nameEditor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minHeight: touchTarget, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, backgroundColor: colors.background },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  switchTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  switchHint: { marginTop: 2, color: colors.muted, fontSize: 11, lineHeight: 16 },
  addMember: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary },
  addMemberText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  member: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  memberName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  memberEmail: { marginTop: 2, color: colors.muted, fontSize: 10 },
  modal: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  modalTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  close: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface },
  search: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.text },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12 },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
});
