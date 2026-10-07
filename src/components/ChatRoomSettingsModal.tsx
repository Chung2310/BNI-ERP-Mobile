import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardResponsiveView } from '@/components/KeyboardResponsiveView';
import { Check, X } from 'lucide-react-native';
import { chatService, type ChatRoom } from '@/services/chat';
import { userService } from '@/services/users';
import type { UserProfile } from '@/types';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  room: ChatRoom;
  currentUserId?: string;
  onClose: () => void;
  onUpdated: (room: ChatRoom) => void;
  onExit: () => void;
};

export function ChatRoomSettingsModal({ room, currentUserId, onClose, onUpdated, onExit }: Props) {
  const [name, setName] = useState(room.name || '');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const self = room.members.find((member) => member.userId._id === currentUserId);
  const isAdmin = self?.role === 'admin';
  const pinned = Boolean(self?.isPinned);
  const blocked = Boolean(room.blockedBy?.some((id) => id === currentUserId));

  const run = async (operation: () => Promise<ChatRoom>, success?: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      onUpdated(await operation());
      success?.();
    } catch (cause) {
      Alert.alert('Không thể cập nhật', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const startAdding = async () => {
    setAdding(true);
    try {
      setDirectory((await userService.directory()).filter((person) => !room.members.some((member) => member.userId._id === person.uid)));
    } catch (cause) {
      Alert.alert('Không thể tải thành viên', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  };

  const updateAvatar = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (picked.canceled) return;
      const image = picked.assets[0];
      await run(async () => {
        const uploaded = await chatService.uploadAttachment({ uri: image.uri, name: image.fileName || `group-${Date.now()}.jpg`, mimeType: image.mimeType || 'image/jpeg', size: image.fileSize });
        return chatService.updateRoom(room._id, { avatarURL: uploaded.url });
      });
    } catch (cause) {
      Alert.alert('Không thể đổi ảnh nhóm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  };

  const leave = () => Alert.alert('Rời nhóm?', 'Bạn sẽ không còn xem được cuộc trò chuyện này.', [
    { text: 'Ở lại', style: 'cancel' },
    { text: 'Rời nhóm', style: 'destructive', onPress: () => void chatService.leaveRoom(room._id).then(onExit).catch((cause) => Alert.alert('Không thể rời nhóm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.')) },
  ]);

  const deleteGroup = () => Alert.alert('Giải tán nhóm?', 'Cuộc trò chuyện sẽ bị xóa cho tất cả thành viên.', [
    { text: 'Đóng', style: 'cancel' },
    { text: 'Giải tán', style: 'destructive', onPress: () => void chatService.deleteRoom(room._id).then(onExit).catch((cause) => Alert.alert('Không thể giải tán', cause instanceof Error ? cause.message : 'Vui lòng thử lại.')) },
  ]);

  const manageMember = (targetId: string, targetName: string, role?: string) => {
    const otherActions = () => Alert.alert(targetName, 'Quản lý thành viên', [
      { text: 'Chuyển quyền trưởng nhóm', onPress: () => Alert.alert('Chuyển quyền?', `Chuyển quyền trưởng nhóm cho ${targetName}?`, [{ text: 'Đóng', style: 'cancel' }, { text: 'Chuyển', onPress: () => void run(() => chatService.transferAdmin(room._id, targetId)) }]) },
      { text: 'Xóa khỏi nhóm', style: 'destructive', onPress: () => Alert.alert('Xóa thành viên?', `Xóa ${targetName} khỏi nhóm?`, [{ text: 'Đóng', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => void run(() => chatService.removeMember(room._id, targetId)) }]) },
      { text: 'Đóng', style: 'cancel' },
    ]);
    Alert.alert(targetName, 'Quản lý thành viên', [
      { text: role === 'deputy' ? 'Bỏ quyền phó nhóm' : 'Bổ nhiệm phó nhóm', onPress: () => void run(() => chatService.updateMemberRole(room._id, targetId, role === 'deputy' ? 'member' : 'deputy')) },
      { text: 'Thao tác khác', onPress: otherActions },
      { text: 'Đóng', style: 'cancel' },
    ]);
  };

  return (
    <Modal visible animationType='slide' onRequestClose={onClose}>
      <KeyboardResponsiveView>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{adding ? 'Thêm thành viên' : 'Thông tin trò chuyện'}</Text>
          <Pressable accessibilityLabel='Đóng' onPress={() => adding ? setAdding(false) : onClose()} style={styles.close}><X size={22} color={colors.text} /></Pressable>
        </View>
        {adding ? (
          <>
            <TextInput value={query} onChangeText={setQuery} placeholder='Tìm thành viên' placeholderTextColor={colors.muted} style={styles.input} />
            <ScrollView keyboardShouldPersistTaps='handled' style={styles.scroll}>
              {directory.filter((person) => person.displayName?.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).map((person) => {
                const checked = selected.includes(person.uid);
                return <Pressable key={person.uid} onPress={() => setSelected((current) => checked ? current.filter((id) => id !== person.uid) : [...current, person.uid])} style={styles.row}>
                  <View style={styles.rowText}><Text style={styles.rowTitle}>{person.displayName}</Text><Text style={styles.hint}>{person.email}</Text></View>
                  {checked ? <Check size={19} color={colors.primaryDark} /> : null}
                </Pressable>;
              })}
            </ScrollView>
            <Action label={`Thêm ${selected.length} thành viên`} disabled={!selected.length || busy} onPress={() => void run(() => chatService.addMembers(room._id, selected), () => { setSelected([]); setAdding(false); })} />
          </>
        ) : (
          <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={styles.content}>
            {busy ? <ActivityIndicator color={colors.primaryDark} /> : null}
            <Action label={pinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'} disabled={busy} onPress={() => void run(() => chatService.togglePinRoom(room._id))} />
            {!room.isGroup ? <Action label={blocked ? 'Bỏ chặn người này' : 'Chặn người này'} disabled={busy} danger={!blocked} onPress={() => void run(() => chatService.setBlocked(room._id, !blocked))} /> : null}

            {room.isGroup ? (
              <>
                {isAdmin ? <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Tên nhóm</Text>
                  <Action label='Đổi ảnh nhóm' disabled={busy} onPress={() => void updateAvatar()} />
                  <View style={styles.rename}><TextInput value={name} onChangeText={setName} maxLength={80} style={styles.renameInput} /><Pressable disabled={busy || !name.trim() || name.trim() === room.name} onPress={() => void run(() => chatService.updateRoom(room._id, { name: name.trim() }))} style={styles.save}><Text style={styles.saveText}>Lưu</Text></Pressable></View>
                  <View style={styles.row}><Text style={styles.rowTitle}>Chỉ quản trị viên được nhắn</Text><Switch value={Boolean(room.onlyAdminsCanMessage)} disabled={busy} onValueChange={(value) => void run(() => chatService.updateRoom(room._id, { onlyAdminsCanMessage: value }))} /></View>
                </View> : null}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Thành viên ({room.members.length})</Text>
                  {isAdmin ? <Action label='Thêm thành viên' disabled={busy} onPress={() => void startAdding()} /> : null}
                  {room.members.map((member) => {
                    const targetId = member.userId._id;
                    return <View key={targetId} style={styles.row}>
                      <View style={styles.rowText}><Text style={styles.rowTitle}>{member.userId.displayName}{targetId === currentUserId ? ' (Bạn)' : ''}</Text><Text style={styles.hint}>{member.role === 'admin' ? 'Trưởng nhóm' : member.role === 'deputy' ? 'Phó nhóm' : member.userId.email}</Text></View>
                      {isAdmin && targetId !== currentUserId ? <Pressable onPress={() => manageMember(targetId, member.userId.displayName, member.role)} style={styles.manage}><Text style={styles.manageText}>Quản lý</Text></Pressable> : null}
                    </View>;
                  })}
                </View>
                <Action label='Rời nhóm' disabled={busy} danger onPress={leave} />
                {isAdmin ? <Action label='Giải tán nhóm' disabled={busy} danger onPress={deleteGroup} /> : null}
              </>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
      </KeyboardResponsiveView>
    </Modal>
  );
}

function Action({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole='button' disabled={disabled} onPress={onPress} style={styles.action}><Text style={[styles.actionText, danger && styles.danger, disabled && styles.disabled]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },
  scroll: { flex: 1, paddingHorizontal: spacing.md },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  actionText: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
  danger: { color: colors.danger },
  disabled: { opacity: 0.4 },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  hint: { marginTop: 3, color: colors.muted, fontSize: 11 },
  manage: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  manageText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  rename: { flexDirection: 'row', gap: spacing.sm },
  renameInput: { flex: 1, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text },
  save: { minWidth: 54, justifyContent: 'center', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.primarySoft },
  saveText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 46, margin: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text },
});
