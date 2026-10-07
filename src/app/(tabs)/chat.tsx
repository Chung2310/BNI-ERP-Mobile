import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { MessageCircleMore, Plus, Search, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NewChatModal } from '@/components/NewChatModal';
import { BackHeader } from '@/components/BackHeader';
import { Avatar, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { chatService, type ChatRoom } from '@/services/chat';
import { colors, radius, spacing, touchTarget } from '@/theme/tokens';

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).slice(-2).join('').toUpperCase();

const formatTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function ChatScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const { data, error, isLoading, reload } = useAsyncData(chatService.rooms);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  const roomName = useCallback((room: ChatRoom) =>
    room.name ||
    room.members.find((member) => member.userId._id !== user?.uid)?.userId.displayName ||
    'Cuộc trò chuyện',
  [user?.uid]);

  const rooms = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    return [...(data || [])]
      .filter((room) => !keyword || [roomName(room), ...room.members.map((member) => member.userId.displayName)]
        .some((value) => value.toLocaleLowerCase('vi').includes(keyword)))
      .sort((a, b) => {
        const unreadDifference = Number(Boolean(b.unreadCount)) - Number(Boolean(a.unreadCount));
        if (unreadDifference) return unreadDifference;
        const bTime = new Date(b.lastMessage?.createdAt || b.updatedAt || 0).getTime();
        const aTime = new Date(a.lastMessage?.createdAt || a.updatedAt || 0).getTime();
        return bTime - aTime;
      });
  }, [data, query, roomName]);

  const openRoom = (room: ChatRoom) => {
    const name = roomName(room);
    router.push({ pathname: '/chat/[id]', params: { id: room._id, name } });
  };

  const handleCreated = (room: ChatRoom) => {
    setShowNewChat(false);
    void reload();
    openRoom(room);
  };

  const unreadTotal = (data || []).reduce((sum, room) => sum + (room.unreadCount || 0), 0);

  return (
    <>
      <Screen>
        <BackHeader
          title='Trò chuyện'
          subtitle={unreadTotal ? `${unreadTotal} tin chưa đọc` : 'Tất cả tin nhắn đã đọc'}
          onBack={() => router.navigate('/(tabs)')}
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel='Tạo cuộc trò chuyện mới'
              hitSlop={6}
              onPress={() => setShowNewChat(true)}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Plus color='#FFFFFF' size={20} strokeWidth={2.5} />
            </Pressable>
          }
        />

        <View style={styles.search}>
          <Search color={colors.muted} size={19} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder='Tìm cuộc trò chuyện...'
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>

        {isLoading && !data ? (
          <LoadingState />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rooms.length === 0 ? (
          <EmptyState
            title={query ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện'}
            message={query ? 'Thử tìm kiếm bằng tên khác.' : 'Nhấn nút + để bắt đầu trò chuyện với thành viên.'}
          />
        ) : (
          <Card style={styles.list}>
            {rooms.map((room) => {
              const name = roomName(room);
              const other = room.members.find((member) => member.userId._id !== user?.uid)?.userId;
              const last = room.lastMessage;
              const preview = last?.isDeleted
                ? 'Tin nhắn đã được thu hồi'
                : last?.content || (last?.attachments?.length ? 'Đã gửi một tệp đính kèm' : 'Chưa có tin nhắn');
              return (
                <Pressable
                  key={room._id}
                  accessibilityRole='button'
                  onPress={() => openRoom(room)}
                  style={({ pressed }) => [styles.room, pressed && styles.pressed]}
                >
                  <View>
                    <Avatar initials={initials(name)} url={room.avatarURL || (!room.isGroup ? other?.photoURL : undefined)} size={48} />
                    {room.isGroup ? <View style={styles.groupIcon}><Users color='#FFFFFF' size={11} strokeWidth={2.5} /></View> : null}
                  </View>
                  <View style={styles.grow}>
                    <View style={styles.roomHeading}>
                      <Text numberOfLines={1} style={[styles.name, room.unreadCount ? styles.unreadName : null]}>{name}</Text>
                      <Text style={styles.time}>{formatTime(last?.createdAt || room.updatedAt)}</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text numberOfLines={1} style={[styles.message, room.unreadCount ? styles.unreadMessage : null]}>
                        {room.isGroup && last?.senderName ? last.senderName + ': ' : ''}{preview}
                      </Text>
                      {room.unreadCount ? (
                        <View style={styles.unread}>
                          <Text style={styles.unreadText}>{room.unreadCount > 99 ? '99+' : room.unreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        )}

        {!isLoading && rooms.length > 0 ? (
          <View style={styles.hint}>
            <MessageCircleMore color={colors.primaryDark} size={17} />
            <Text style={styles.hintText}>Chạm vào một cuộc trò chuyện để xem và trả lời tin nhắn.</Text>
          </View>
        ) : null}
      </Screen>

      {showNewChat ? (
        <NewChatModal
          currentUserId={user?.uid}
          onClose={() => setShowNewChat(false)}
          onCreated={handleCreated}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  search: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  list: { paddingVertical: 0, paddingHorizontal: spacing.md },
  room: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { opacity: 0.7 },
  grow: { flex: 1 },
  roomHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  unreadName: { fontWeight: '900' },
  time: { color: colors.muted, fontSize: 10 },
  previewRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  message: { flex: 1, color: colors.muted, fontSize: 12 },
  unreadMessage: { color: colors.text, fontWeight: '700' },
  unread: { minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.primary },
  unreadText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  groupIcon: { position: 'absolute', right: -2, bottom: -2, width: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.primaryDark },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  hintText: { color: colors.muted, fontSize: 11 },
});
