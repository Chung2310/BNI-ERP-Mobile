import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Reply, Send, X } from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/BackHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { chatService, type ChatMessage } from '@/services/chat';
import { colors, radius, spacing } from '@/theme/tokens';

const senderId = (message: ChatMessage) =>
  typeof message.senderId === 'string' ? message.senderId : message.senderId._id;

const formatClock = (value: string) =>
  new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const formatDay = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hôm nay';
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const sameDay = (first: string, second?: string) =>
  Boolean(second) && new Date(first).toDateString() === new Date(second!).toDateString();

const replyMessage = (value?: ChatMessage | string) =>
  value && typeof value !== 'string' ? value : undefined;

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [message, setMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const { data, setData, error, isLoading, reload } = useAsyncData(() => chatService.messages(id), id);

  const messages = useMemo(
    () => [...(data || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [data],
  );

  useEffect(() => {
    if (!id) return;
    void chatService.markRead(id).catch(() => undefined);
  }, [id, messages.length]);

  useEffect(() => {
    if (!id) return;
    const timer = setInterval(() => {
      void chatService.messages(id).then(setData).catch(() => undefined);
    }, 10000);
    return () => clearInterval(timer);
  }, [id, setData]);

  const updateKeyboardInset = useCallback(() => {
    if (Platform.OS !== 'android') return;
    requestAnimationFrame(() => {
      rootRef.current?.measureInWindow((_, y, __, height) => {
        const keyboardTop = keyboardTopRef.current;
        if (keyboardTop !== null) {
          setKeyboardInset(Math.max(0, Math.ceil(y + height - keyboardTop + spacing.xl)));
        }
      });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      if (Platform.OS === 'android') {
        keyboardTopRef.current = event.endCoordinates.screenY;
        updateKeyboardInset();
      }
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTopRef.current = null;
      setKeyboardInset(0);
    });

    return () => { showSub.remove(); hideSub.remove(); };
  }, [updateKeyboardInset]);

  const send = async () => {
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError('');
    try {
      const sent = await chatService.send(id, content, replyingTo?._id);
      setData((current) => [sent, ...(current || [])]);
      setMessage('');
      setReplyingTo(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (item: ChatMessage) => {
    try {
      await chatService.remove(id, item._id);
      setData((current) => (current || []).map((entry) =>
        entry._id === item._id ? { ...entry, content: '', isDeleted: true, attachments: [] } : entry,
      ));
    } catch (cause) {
      Alert.alert('Không thể thu hồi', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  };

  const reactToMessage = async (item: ChatMessage) => {
    try {
      const updated = await chatService.react(id, item._id, '👍');
      setData((current) => (current || []).map((entry) => entry._id === item._id ? updated : entry));
    } catch (cause) {
      Alert.alert('Không thể thả cảm xúc', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  };

  const openActions = (item: ChatMessage) => {
    if (item.isDeleted) return;
    const mine = senderId(item) === user?.uid;
    Alert.alert('Thao tác tin nhắn', undefined, [
      { text: 'Trả lời', onPress: () => setReplyingTo(item) },
      { text: 'Thích 👍', onPress: () => void reactToMessage(item) },
      ...(mine ? [{ text: 'Thu hồi', style: 'destructive' as const, onPress: () => void removeMessage(item) }] : []),
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const mine = senderId(item) === user?.uid;
    const quoted = replyMessage(item.replyTo);
    const showDay = index === 0 || !sameDay(item.createdAt, messages[index - 1]?.createdAt);
    const reactionCount = item.reactions?.filter((reaction) => reaction.emoji === '👍').length || 0;

    return (
      <View>
        {showDay ? <Text style={styles.day}>{formatDay(item.createdAt)}</Text> : null}
        <View style={[styles.messageRow, mine && styles.myMessageRow]}>
          <Pressable
            accessibilityHint='Nhấn giữ để xem thao tác'
            delayLongPress={350}
            onLongPress={() => openActions(item)}
            style={[styles.bubble, mine && styles.mine, item.isDeleted && styles.deletedBubble]}
          >
            {!mine ? <Text style={styles.sender}>{item.senderName}</Text> : null}
            {quoted ? (
              <View style={[styles.quote, mine && styles.myQuote]}>
                <Text numberOfLines={1} style={[styles.quoteName, mine && styles.mineText]}>{quoted.senderName}</Text>
                <Text numberOfLines={2} style={[styles.quoteText, mine && styles.mySecondaryText]}>
                  {quoted.isDeleted ? 'Tin nhắn đã được thu hồi' : quoted.content}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.content, mine && styles.mineText, item.isDeleted && styles.deletedText]}>
              {item.isDeleted ? 'Tin nhắn đã được thu hồi' : item.content}
            </Text>
            {!item.isDeleted ? item.attachments?.map((attachment, attachmentIndex) =>
              attachment.type?.startsWith('image/') ? (
                <Pressable key={attachment.url + attachmentIndex} onPress={() => void Linking.openURL(attachment.url)}>
                  <Image source={{ uri: attachment.url }} style={styles.attachmentImage} resizeMode='cover' />
                </Pressable>
              ) : (
                <Pressable key={attachment.url + attachmentIndex} onPress={() => void Linking.openURL(attachment.url)} style={[styles.file, mine && styles.myFile]}>
                  <Text numberOfLines={1} style={[styles.fileText, mine && styles.mineText]}>
                    {attachment.name || 'Mở tệp đính kèm'}
                  </Text>
                </Pressable>
              ),
            ) : null}
            <View style={styles.meta}>
              {item.editedAt ? <Text style={[styles.edited, mine && styles.mySecondaryText]}>đã sửa</Text> : null}
              <Text style={[styles.time, mine && styles.mySecondaryText]}>{formatClock(item.createdAt)}</Text>
            </View>
            {reactionCount ? (
              <View style={[styles.reaction, mine ? styles.reactionMine : styles.reactionOther]}>
                <Text style={styles.reactionText}>👍 {reactionCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    );
  };

  const bottomInset = Platform.OS === 'android' ? insets.bottom || 48 : insets.bottom;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View
        ref={rootRef}
        onLayout={() => { if (keyboardTopRef.current !== null) updateKeyboardInset(); }}
        style={[styles.rootContainer, { paddingBottom: Math.max(bottomInset, keyboardInset) }]}
      >
        <View style={styles.headerContainer}>
          <BackHeader title={name || 'Trò chuyện'} subtitle='Tin nhắn nội bộ' />
        </View>
        <KeyboardAvoidingView
          behavior='padding'
          enabled={Platform.OS === 'ios'}
          style={styles.keyboardArea}
        >
          {isLoading && !data ? (
            <LoadingState />
          ) : error && !data ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item._id}
              renderItem={renderMessage}
              style={styles.flex}
              contentContainerStyle={[styles.messages, !messages.length && styles.emptyMessages]}
              keyboardShouldPersistTaps='handled'
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              onScrollBeginDrag={() => {
                if (isFocused) {
                  Keyboard.dismiss();
                  setIsFocused(false);
                }
              }}
              onLayout={() => messages.length > 0 && listRef.current?.scrollToEnd({ animated: false })}
              onContentSizeChange={() => messages.length > 0 && listRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={<EmptyState title='Chưa có tin nhắn' message='Hãy bắt đầu cuộc trò chuyện.' />}
            />
          )}

          {replyingTo ? (
            <View style={styles.replying}>
              <Reply color={colors.primaryDark} size={17} />
              <View style={styles.replyingCopy}>
                <Text style={styles.replyingName}>Đang trả lời {replyingTo.senderName}</Text>
                <Text numberOfLines={1} style={styles.replyingText}>{replyingTo.content}</Text>
              </View>
              <Pressable accessibilityLabel='Hủy trả lời' onPress={() => setReplyingTo(null)} style={styles.cancelReply}>
                <X color={colors.muted} size={18} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composerContainer}>
            {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
            <View style={styles.composer}>
              <TextInput
                value={message}
                onChangeText={(value) => { setMessage(value); setSendError(''); }}
                placeholder='Nhập tin nhắn...'
                placeholderTextColor={colors.muted}
                multiline
                maxLength={4000}
                onFocus={() => {
                  setIsFocused(true);
                  setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
                }}
                onBlur={() => {
                  setIsFocused(false);
                }}
                style={styles.input}
              />
              <Pressable
                accessibilityLabel='Gửi tin nhắn'
                onPress={() => void send()}
                disabled={!message.trim() || sending}
                style={({ pressed }) => [
                  styles.send,
                  (!message.trim() || sending) && styles.sendDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size='small' color='#FFFFFF' />
                ) : (
                  <Send color='#FFFFFF' size={20} />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardArea: { flex: 1, paddingBottom: spacing.sm },
  rootContainer: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1 },
  messages: {
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  emptyMessages: { flexGrow: 1, justifyContent: 'center' },
  day: {
    alignSelf: 'center',
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.muted,
    backgroundColor: '#EAF0F3',
    fontSize: 10,
    fontWeight: '700',
  },
  messageRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  myMessageRow: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#102533',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mine: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  deletedBubble: { backgroundColor: '#F2F5F6', borderColor: colors.border },
  sender: { marginBottom: 3, color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  content: { color: colors.text, fontSize: 14, lineHeight: 20 },
  mineText: { color: '#FFFFFF' },
  deletedText: { color: colors.muted, fontStyle: 'italic' },
  quote: {
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
    paddingVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  myQuote: { borderLeftColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.17)' },
  quoteName: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  quoteText: { marginTop: 2, color: colors.muted, fontSize: 11 },
  mySecondaryText: { color: 'rgba(255,255,255,0.78)' },
  meta: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  time: { color: colors.muted, fontSize: 9 },
  edited: { color: colors.muted, fontSize: 9, fontStyle: 'italic' },
  reaction: {
    position: 'absolute',
    bottom: -13,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reactionMine: { left: 8 },
  reactionOther: { right: 8 },
  reactionText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  attachmentImage: {
    width: 220,
    height: 155,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  file: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(16,37,51,0.08)',
  },
  myFile: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  fileText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  replying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  replyingCopy: { flex: 1 },
  replyingName: { color: colors.primaryDark, fontSize: 11, fontWeight: '900' },
  replyingText: { marginTop: 2, color: colors.muted, fontSize: 11 },
  cancelReply: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  composerContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  sendError: {
    paddingHorizontal: 4,
    paddingBottom: spacing.xs,
    color: colors.danger,
    fontSize: 11,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 20,
  },
  send: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.primary,
  },
  sendDisabled: { opacity: 0.38 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  sendText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
});

