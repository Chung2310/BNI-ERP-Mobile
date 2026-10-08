import { Alert } from "@/components/AppAlert";
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardResponsiveView } from '@/components/KeyboardResponsiveView';
import { Ban, Check, ChevronRight, ImagePlus, LogOut, MessageCircle, MessageSquareLock, Pencil, Pin, ShieldCheck, Trash2, UserPlus, UserRound, Users, X, type LucideIcon } from 'lucide-react-native';
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
  const insets = useSafeAreaInsets();
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
  const otherMember = room.members.find((member) => member.userId._id !== currentUserId);
  const roomTitle = room.name?.trim() || (room.isGroup ? 'Nhóm trò chuyện' : otherMember?.userId.displayName || 'Trò chuyện');

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
    <Modal visible transparent animationType='slide' onRequestClose={onClose}>
      <KeyboardResponsiveView>
      <View style={styles.overlay}>
      <Pressable accessibilityLabel='Đóng thông tin trò chuyện' onPress={onClose} style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }, adding && styles.addingSheet]}>
        <View style={styles.header}>
          <Text style={styles.title}>{adding ? 'Thêm thành viên' : 'Thông tin trò chuyện'}</Text>
          <Pressable accessibilityLabel='Đóng' onPress={() => adding ? setAdding(false) : onClose()} style={styles.close}><X size={22} color={colors.text} /></Pressable>
        </View>
        {adding ? (
          <>
            <TextInput value={query} onChangeText={setQuery} placeholder='Tìm thành viên' placeholderTextColor={colors.muted} style={styles.input} />
            <ScrollView keyboardShouldPersistTaps='handled' style={styles.scroll} contentContainerStyle={styles.addingContent}>
              {directory.filter((person) => person.displayName?.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).map((person) => {
                const checked = selected.includes(person.uid);
                return <Pressable key={person.uid} accessibilityRole='checkbox' accessibilityState={{ checked }} onPress={() => setSelected((current) => checked ? current.filter((id) => id !== person.uid) : [...current, person.uid])} style={styles.memberRow}>
                  <View style={styles.memberIcon}><UserRound size={17} color={colors.primaryDark} /></View>
                  <View style={styles.rowText}><Text style={styles.rowTitle}>{person.displayName}</Text><Text style={styles.hint}>{person.email}</Text></View>
                  {checked ? <Check size={19} color={colors.primaryDark} /> : null}
                </Pressable>;
              })}
            </ScrollView>
            <Pressable accessibilityRole='button' disabled={!selected.length || busy} onPress={() => void run(() => chatService.addMembers(room._id, selected), () => { setSelected([]); setAdding(false); })} style={[styles.addButton, (!selected.length || busy) && styles.disabled]}><Text style={styles.addButtonText}>Thêm {selected.length} thành viên</Text></Pressable>
          </>
        ) : (
          <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={styles.content}>
            {busy ? <ActivityIndicator color={colors.primaryDark} /> : null}
            <View style={styles.summary}>
              <View style={styles.summaryIcon}>{room.isGroup ? <Users size={28} color={colors.primaryDark} /> : <MessageCircle size={28} color={colors.primaryDark} />}</View>
              <Text style={styles.summaryTitle} numberOfLines={2}>{roomTitle}</Text>
              <Text style={styles.summaryMeta}>{room.isGroup ? `${room.members.length} thành viên` : 'Trò chuyện cá nhân'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tùy chọn</Text>
              <View style={styles.group}>
                <Action icon={Pin} label={pinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'} disabled={busy} divider={!room.isGroup} onPress={() => void run(() => chatService.togglePinRoom(room._id))} />
                {!room.isGroup ? <Action icon={blocked ? ShieldCheck : Ban} label={blocked ? 'Bỏ chặn người này' : 'Chặn người này'} disabled={busy} danger={!blocked} onPress={() => void run(() => chatService.setBlocked(room._id, !blocked))} /> : null}
              </View>
            </View>

            {room.isGroup ? (
              <>
                {isAdmin ? <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quản lý nhóm</Text>
                  <View style={styles.group}>
                    <Action icon={ImagePlus} label='Đổi ảnh nhóm' disabled={busy} divider onPress={() => void updateAvatar()} />
                    <View style={[styles.settingRow, styles.divider]}>
                      <View style={styles.iconBox}><Pencil size={18} color={colors.primaryDark} /></View>
                      <TextInput accessibilityLabel='Tên nhóm' value={name} onChangeText={setName} placeholder='Tên nhóm' placeholderTextColor={colors.muted} maxLength={80} style={styles.renameInput} />
                      <Pressable accessibilityRole='button' accessibilityLabel='Lưu tên nhóm' disabled={busy || !name.trim() || name.trim() === room.name} onPress={() => void run(() => chatService.updateRoom(room._id, { name: name.trim() }))} style={[styles.save, (busy || !name.trim() || name.trim() === room.name) && styles.disabled]}><Text style={styles.saveText}>Lưu</Text></Pressable>
                    </View>
                    <View style={styles.settingRow}>
                      <View style={styles.iconBox}><MessageSquareLock size={18} color={colors.primaryDark} /></View>
                      <Text style={styles.switchTitle}>Chỉ quản trị viên được nhắn</Text>
                      <Switch accessibilityLabel='Chỉ quản trị viên được nhắn' value={Boolean(room.onlyAdminsCanMessage)} disabled={busy} onValueChange={(value) => void run(() => chatService.updateRoom(room._id, { onlyAdminsCanMessage: value }))} />
                    </View>
                  </View>
                </View> : null}

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeading}><Users size={17} color={colors.primaryDark} /><Text style={styles.sectionTitle}>Thành viên ({room.members.length})</Text></View>
                    {isAdmin ? <Pressable accessibilityRole='button' accessibilityLabel='Thêm thành viên' disabled={busy} onPress={() => void startAdding()} style={styles.addMember}><UserPlus size={17} color={colors.primaryDark} /><Text style={styles.addMemberText}>Thêm</Text></Pressable> : null}
                  </View>
                  <View style={styles.group}>
                    {room.members.map((member, index) => {
                      const targetId = member.userId._id;
                      return <View key={targetId} style={[styles.memberRow, index < room.members.length - 1 && styles.divider]}>
                        <View style={styles.memberIcon}><UserRound size={17} color={colors.primaryDark} /></View>
                        <View style={styles.rowText}><Text style={styles.rowTitle} numberOfLines={1}>{member.userId.displayName}{targetId === currentUserId ? ' (Bạn)' : ''}</Text><Text style={styles.hint}>{member.role === 'admin' ? 'Trưởng nhóm' : member.role === 'deputy' ? 'Phó nhóm' : member.userId.email}</Text></View>
                        {isAdmin && targetId !== currentUserId ? <Pressable accessibilityRole='button' accessibilityLabel={`Quản lý ${member.userId.displayName}`} onPress={() => manageMember(targetId, member.userId.displayName, member.role)} style={styles.manage}><ChevronRight size={19} color={colors.muted} /></Pressable> : null}
                      </View>;
                    })}
                  </View>
                </View>

                <View style={styles.group}>
                  <Action icon={LogOut} label='Rời nhóm' disabled={busy} danger divider={isAdmin} onPress={leave} />
                  {isAdmin ? <Action icon={Trash2} label='Xóa trò chuyện' disabled={busy} danger onPress={deleteGroup} /> : null}
                </View>
              </>
            ) : null}
          </ScrollView>
        )}
      </View>
      </View>
      </KeyboardResponsiveView>
    </Modal>
  );
}

function Action({ icon: Icon, label, onPress, danger, disabled, divider }: { icon: LucideIcon; label: string; onPress: () => void; danger?: boolean; disabled?: boolean; divider?: boolean }) {
  return <Pressable accessibilityRole='button' accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.settingRow, divider && styles.divider, disabled && styles.disabled]}><View style={[styles.iconBox, danger && styles.dangerIconBox]}><Icon size={18} color={danger ? colors.danger : colors.primaryDark} /></View><Text style={[styles.actionText, danger && styles.danger]}>{label}</Text><ChevronRight size={17} color={colors.muted} /></Pressable>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.background, overflow: 'hidden' },
  addingSheet: { height: '80%' },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  scroll: { flexShrink: 1 },
  summary: { alignItems: 'center', gap: 5, paddingVertical: spacing.sm },
  summaryIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  summaryTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  summaryMeta: { color: colors.muted, fontSize: 12 },
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
  settingRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dangerIconBox: { backgroundColor: '#FFF0F2' },
  actionText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  danger: { color: colors.danger },
  disabled: { opacity: 0.4 },
  section: { gap: spacing.sm },
  sectionHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  addMember: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm },
  addMemberText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  memberRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  memberIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  switchTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  hint: { marginTop: 3, color: colors.muted, fontSize: 11 },
  manage: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  renameInput: { flex: 1, minWidth: 0, minHeight: 44, color: colors.text, fontSize: 14 },
  save: { minWidth: 48, minHeight: 36, justifyContent: 'center', alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  saveText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 46, margin: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text },
  addingContent: { marginHorizontal: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  addButton: { minHeight: 48, marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
