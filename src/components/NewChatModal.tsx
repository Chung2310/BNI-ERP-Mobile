import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button } from '@/components/ui';
import { chatService, type ChatRoom } from '@/services/chat';
import { userService } from '@/services/users';
import { colors, radius, spacing, touchTarget } from '@/theme/tokens';
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
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách thành viên.'))
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
      setError(cause instanceof Error ? cause.message : 'Không thể tạo cuộc trò chuyện.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible animationType='slide' onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Cuộc trò chuyện mới</Text>
            <Text style={styles.subtitle}>Chọn một người để nhắn riêng hoặc nhiều người để tạo nhóm.</Text>
          </View>
          <Pressable accessibilityLabel='Đóng' onPress={onClose} style={styles.close}>
            <X color={colors.text} size={22} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Search color={colors.muted} size={19} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder='Tìm theo tên, email, công ty...'
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
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
          <Button tone='secondary' onPress={onClose}>Hủy</Button>
          <Button disabled={!selectedIds.length || creating} onPress={create}>
            {creating ? 'Đang tạo...' : selectedIds.length > 1 ? 'Tạo nhóm (' + selectedIds.length + ')' : 'Bắt đầu trò chuyện'}
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 21, fontWeight: '900' },
  subtitle: { marginTop: spacing.xs, color: colors.muted, fontSize: 12, lineHeight: 18 },
  close: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface },
  search: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  groupInput: { minHeight: touchTarget, paddingHorizontal: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  list: { paddingBottom: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  member: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  memberCopy: { flex: 1 },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  memberMeta: { marginTop: 3, color: colors.muted, fontSize: 12 },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  pressed: { opacity: 0.7 },
  empty: { paddingVertical: spacing.xxl, color: colors.muted, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
