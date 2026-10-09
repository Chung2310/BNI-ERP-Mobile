import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardResponsiveView } from '@/components/KeyboardResponsiveView';
import { Avatar } from '@/components/ui';
import { chatService, type ChatRoom } from '@/services/chat';
import { userService } from '@/services/users';
import { colors, radius, spacing } from '@/theme/tokens';
import type { UserProfile } from '@/types';

type Props = {
  currentUserId?: string;
  onClose: () => void;
  onCreated: (room: ChatRoom) => void;
};

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).slice(-2).join('').toUpperCase();

export function NewChatModal({ currentUserId, onClose, onCreated }: Props) {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void userService.directory()
      .then((items) => setMembers(items.filter((item) => item.uid && item.uid !== currentUserId)))
      .catch((cause) => setError(friendlyErrorMessage(cause, 'Không thể tải danh sách thành viên.')))
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    if (!keyword) return members;
    return members.filter((member) =>
      [member.displayName, member.email, member.companyName, member.industry]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('vi').includes(keyword)),
    );
  }, [members, query]);

  const toggle = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const create = async () => {
    if (!selectedIds.length || creating) return;
    setCreating(true);
    setError('');
    try {
      const room = await chatService.createRoom({
        isGroup: selectedIds.length > 1,
        memberIds: selectedIds,
        ...(selectedIds.length > 1 && groupName.trim() ? { name: groupName.trim() } : {}),
      });
      onCreated(room);
    } catch (cause) {
      setError(friendlyErrorMessage(cause, 'Không thể tạo cuộc trò chuyện.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible animationType='slide' onRequestClose={onClose}>
      <KeyboardResponsiveView>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Cuộc trò chuyện mới</Text>
          <Pressable accessibilityLabel='Đóng' onPress={onClose} hitSlop={8} style={styles.close}>
            <X color={colors.text} size={20} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Search color={colors.muted} size={18} strokeWidth={2.2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder='Tìm theo tên, email, công ty...'
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.clearBtn}>
              <X size={16} color={colors.muted} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>

        {selectedIds.length > 1 ? (
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder='Tên nhóm (không bắt buộc)'
            placeholderTextColor={colors.muted}
            maxLength={80}
            style={styles.groupInput}
          />
        ) : null}

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.uid}
            keyboardShouldPersistTaps='handled'
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy thành viên phù hợp.</Text>}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.uid);
              return (
                <Pressable
                  accessibilityRole='checkbox'
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggle(item.uid)}
                  style={({ pressed }) => [styles.member, pressed && styles.pressed]}
                >
                  <Avatar initials={initials(item.displayName)} url={item.photoURL} />
                  <View style={styles.memberCopy}>
                    <Text numberOfLines={1} style={styles.memberName}>{item.displayName}</Text>
                    <Text numberOfLines={1} style={styles.memberMeta}>{item.companyName || item.email}</Text>
                  </View>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected ? <Check color='#FFFFFF' size={15} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.footer}>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='Hủy'
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
          >
            <X color={colors.text} size={20} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={
              creating
                ? 'Đang tạo...'
                : selectedIds.length > 1
                ? `Tạo nhóm (${selectedIds.length})`
                : 'Bắt đầu trò chuyện'
            }
            disabled={!selectedIds.length || creating}
            onPress={create}
            style={({ pressed }) => [
              styles.submitBtn,
              (!selectedIds.length || creating) && styles.submitBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.submitBtnText}>
              {creating
                ? 'Đang tạo...'
                : selectedIds.length > 1
                ? `Tạo nhóm (${selectedIds.length})`
                : 'Bắt đầu trò chuyện'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
      </KeyboardResponsiveView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  title: {
    color: colors.text,
    fontSize: 16.5,
    fontWeight: '800',
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  search: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: spacing.xs,
  },
  groupInput: {
    height: 42,
    paddingHorizontal: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  list: {
    paddingBottom: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  member: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F6',
    paddingVertical: spacing.xs,
  },
  memberCopy: {
    flex: 1,
  },
  memberName: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '800',
  },
  memberMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    paddingVertical: spacing.xxl,
    color: colors.muted,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  cancelBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  submitBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.brandBlue,
    paddingHorizontal: spacing.lg,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
