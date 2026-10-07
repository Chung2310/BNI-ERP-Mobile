import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Info, LoaderCircle, Mic, Paperclip, Pause, Pin, Play, Reply, Search, Send, Shield, Smile, X } from 'lucide-react-native';
import {
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
import { BackHeader } from '@/components/BackHeader';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { chatService, type ChatAttachment, type ChatMessage } from '@/services/chat';
import { colors, radius, spacing, touchTarget } from '@/theme/tokens';

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

const EMOJIS = ['😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '😢', '😭', '😡', '👍', '👏', '🙏', '💪', '🎉', '❤️', '🔥', '✅', '💯', '👋'];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return minutes.toString().padStart(2, '0') + ':' + (safeSeconds % 60).toString().padStart(2, '0');
};

function AudioMessageAttachment({ attachment, mine }: { attachment: ChatAttachment; mine: boolean }) {
  const player = useAudioPlayer(
    { uri: attachment.url },
    { downloadFirst: true, updateInterval: 200, keepAudioSessionActive: true },
  );
  const status = useAudioPlayerStatus(player);

  const togglePlayback = async () => {
    if (status.error) {
      Alert.alert('Không thể phát ghi âm', status.error);
      return;
    }
    if (!status.isLoaded) {
      Alert.alert('Đang tải ghi âm', 'Vui lòng chờ một chút rồi thử lại.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
      void player.seekTo(0);
    }
    player.play();
  };

  return (
    <Pressable onPress={() => void togglePlayback()} style={[styles.audioAttachment, mine && styles.myAudioAttachment]}>
      <View style={[styles.audioPlay, mine && styles.myAudioPlay]}>
        {!status.isLoaded || status.isBuffering ? (
          <LoaderCircle color={mine ? colors.primary : '#FFFFFF'} size={16} />
        ) : status.playing ? (
          <Pause color={mine ? colors.primary : '#FFFFFF'} size={16} fill={mine ? colors.primary : '#FFFFFF'} />
        ) : (
          <Play color={mine ? colors.primary : '#FFFFFF'} size={16} fill={mine ? colors.primary : '#FFFFFF'} />
        )}
      </View>
      <View style={styles.audioCopy}>
        <Text style={[styles.audioTitle, mine && styles.mineText]}>Tin nhắn thoại</Text>
        <Text style={[styles.audioDuration, mine && styles.mySecondaryText]}>
          {formatDuration(status.currentTime)} / {formatDuration(status.duration)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 200);
  const [message, setMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [reactionMessage, setReactionMessage] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const { data, setData, error, isLoading, reload } = useAsyncData(() => chatService.messages(id), id);
  const { data: room, setData: setRoom } = useAsyncData(() => chatService.room(id), id);

  const messages = useMemo(
    () => [...(data || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [data],
  );
  const visibleMessages = searchResults || messages;
  const currentMember = room?.members.find((member) => member.userId._id === user?.uid || member.userId.uid === user?.uid);
  const isBlocked = Boolean(room?.blockedBy?.includes(user?.uid || ''));
  const cannotMessage = isBlocked || Boolean(room?.onlyAdminsCanMessage && currentMember?.role === 'member');

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

  const send = async () => {
    const content = message.trim();
    if (cannotMessage || ((!content && !attachments.length) || sending || uploadingFile)) return;
    setSending(true);
    setSendError('');
    try {
      if (editingMessage) {
        const updated = await chatService.edit(id, editingMessage._id, content);
        setData((current) => (current || []).map((entry) => entry._id === updated._id ? updated : entry));
        setMessage('');
        setEditingMessage(null);
        return;
      }
      const sent = await chatService.send(id, content, replyingTo?._id, attachments);
      setData((current) => [sent, ...(current || [])]);
      setMessage('');
      setAttachments([]);
      setReplyingTo(null);
      setShowEmoji(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  const searchMessages = async () => {
    const query = searchQuery.trim();
    if (!query || searching) return;
    setSearching(true);
    try {
      const results = await chatService.search(id, query);
      setSearchResults([...results].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (cause) {
      Alert.alert('Không thể tìm kiếm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  };

  const startEditing = (item: ChatMessage) => {
    setReplyingTo(null);
    setEditingMessage(item);
    setMessage(item.content);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const togglePinMessage = async (item: ChatMessage) => {
    try {
      const pinned = room?.pinnedMessageIds?.some((value) => (typeof value === 'string' ? value : value._id) === item._id);
      setRoom(pinned ? await chatService.unpinMessage(id, item._id) : await chatService.pinMessage(id, item._id));
    } catch (cause) {
      Alert.alert('Không thể cập nhật ghim', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  };

  const pickFiles = async () => {
    if (uploadingFile) return;
    Keyboard.dismiss();
    setShowEmoji(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const oversized = result.assets.find((asset) => (asset.size || 0) > MAX_ATTACHMENT_SIZE);
      if (oversized) {
        Alert.alert('Tệp quá lớn', 'Mỗi tệp đính kèm không được vượt quá 10 MB.');
        return;
      }
      setUploadingFile(true);
      setSendError('');
      const uploaded: ChatAttachment[] = [];
      for (const asset of result.assets) {
        const type = asset.mimeType || 'application/octet-stream';
        let readableUri = asset.uri;
        if (!readableUri.startsWith('file://') && FileSystem.cacheDirectory) {
          readableUri = FileSystem.cacheDirectory + 'chat-' + Date.now() + '-' + asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          await FileSystem.copyAsync({ from: asset.uri, to: readableUri });
        }
        const base64 = asset.base64 || await FileSystem.readAsStringAsync(readableUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uploaded.push(await chatService.uploadAttachment({
          base64,
          name: asset.name,
          type,
          size: asset.size,
        }));
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (cause) {
      Alert.alert('Không thể tải tệp', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setUploadingFile(false);
    }
  };

  const pickImages = async () => {
    if (uploadingFile) return;
    Keyboard.dismiss();
    setShowEmoji(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cần quyền truy cập ảnh', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh để gửi ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        base64: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const oversized = result.assets.find((asset) => (asset.fileSize || 0) > MAX_ATTACHMENT_SIZE);
      if (oversized) {
        Alert.alert('Ảnh quá lớn', 'Mỗi ảnh đính kèm không được vượt quá 10 MB.');
        return;
      }
      setUploadingFile(true);
      setSendError('');
      const uploaded: ChatAttachment[] = [];
      for (const asset of result.assets) {
        const type = asset.mimeType || 'image/jpeg';
        const base64 = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uploaded.push(await chatService.uploadAttachment({
          base64,
          name: asset.fileName || 'image.jpg',
          type,
          size: asset.fileSize,
        }));
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (cause) {
      Alert.alert('Không thể tải ảnh', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setUploadingFile(false);
    }
  };

  const openAttachmentMenu = () => {
    Keyboard.dismiss();
    setShowEmoji(false);
    Alert.alert('Gửi tệp đính kèm', 'Chọn loại nội dung muốn gửi.', [
      { text: 'Ảnh từ thư viện', onPress: () => void pickImages() },
      { text: 'Tệp tài liệu', onPress: () => void pickFiles() },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const startVoiceRecording = async () => {
    if (processingVoice || recorderState.isRecording) return;
    Keyboard.dismiss();
    setShowEmoji(false);
    setSendError('');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cần quyền micro', 'Vui lòng cho phép ứng dụng sử dụng micro để ghi tin nhắn thoại.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (cause) {
      Alert.alert('Không thể ghi âm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  };

  const cancelVoiceRecording = async () => {
    if (!recorderState.isRecording || processingVoice) return;
    try {
      await audioRecorder.stop();
      if (audioRecorder.uri) {
        await FileSystem.deleteAsync(audioRecorder.uri, { idempotent: true }).catch(() => undefined);
      }
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  };

  const stopAndSendVoice = async () => {
    if (!recorderState.isRecording || processingVoice) return;
    if (recorderState.durationMillis < 500) {
      await cancelVoiceRecording();
      Alert.alert('Bản ghi quá ngắn', 'Hãy giữ bản ghi ít nhất 1 giây.');
      return;
    }
    setProcessingVoice(true);
    setSendError('');
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('Không tìm thấy tệp ghi âm.');
      const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || (Platform.OS === 'web' ? 'webm' : 'm4a');
      const type = extension === 'webm' ? 'audio/webm' : extension === 'caf' ? 'audio/x-caf' : 'audio/mp4';
      const info = await FileSystem.getInfoAsync(uri);
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const attachment = await chatService.uploadAttachment({
        base64,
        name: 'voice-' + Date.now() + '.' + extension,
        type,
        size: info.exists && 'size' in info ? info.size : undefined,
      });
      const sent = await chatService.send(id, '', replyingTo?._id, [attachment]);
      setData((current) => [sent, ...(current || [])]);
      setReplyingTo(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    } catch (cause) {
      Alert.alert('Không thể gửi ghi âm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setProcessingVoice(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  };

  const chooseEmoji = (emoji: string) => {
    setMessage((current) => current + emoji);
    setShowEmoji(false);
    requestAnimationFrame(() => inputRef.current?.focus());
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

  const reactToMessage = async (item: ChatMessage, emoji: string) => {
    try {
      const updated = await chatService.react(id, item._id, emoji);
      setData((current) => (current || []).map((entry) => entry._id === item._id ? updated : entry));
      setReactionMessage(null);
    } catch (cause) {
      Alert.alert('Không thể thả cảm xúc', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  };

  const openActions = (item: ChatMessage) => {
    if (item.isDeleted) return;
    const mine = senderId(item) === user?.uid;
    const pinned = room?.pinnedMessageIds?.some((value) => (typeof value === 'string' ? value : value._id) === item._id);
    Alert.alert('Thao tác tin nhắn', undefined, [
      { text: 'Trả lời', onPress: () => setReplyingTo(item) },
      { text: 'Thả biểu cảm', onPress: () => setReactionMessage(item) },
      { text: pinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn', onPress: () => void togglePinMessage(item) },
      ...(mine && item.content ? [{ text: 'Chỉnh sửa', onPress: () => startEditing(item) }] : []),
      ...(mine ? [{ text: 'Thu hồi', style: 'destructive' as const, onPress: () => void removeMessage(item) }] : []),
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const mine = senderId(item) === user?.uid;
    const quoted = replyMessage(item.replyTo);
    const showDay = index === 0 || !sameDay(item.createdAt, visibleMessages[index - 1]?.createdAt);
    const reactions = Object.entries(
      (item.reactions || []).reduce<Record<string, number>>((counts, reaction) => {
        counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
        return counts;
      }, {}),
    );

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
              attachment.type?.startsWith('audio/') ? (
                <AudioMessageAttachment key={attachment.url + attachmentIndex} attachment={attachment} mine={mine} />
              ) : attachment.type?.startsWith('image/') ? (
                <Pressable key={attachment.url + attachmentIndex} onPress={() => void Linking.openURL(attachment.url)}>
                  <Image source={{ uri: attachment.url }} style={styles.attachmentImage} resizeMode='cover' />
                </Pressable>
              ) : (
                <Pressable key={attachment.url + attachmentIndex} onPress={() => void Linking.openURL(attachment.url)} style={styles.file}>
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
            {reactions.length ? (
              <View style={[styles.reaction, mine ? styles.reactionMine : styles.reactionOther]}>
                <Text style={styles.reactionText}>{reactions.map(([emoji, count]) => emoji + (count > 1 ? ' ' + count : '')).join('  ')}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={styles.keyboardRoot}
    >
      <Screen scroll={false} style={styles.screen}>
        <BackHeader
          title={name || 'Trò chuyện'}
          subtitle={room?.isGroup ? (room.members.length + ' thành viên') : 'Tin nhắn nội bộ'}
          action={
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel='Tìm kiếm tin nhắn'
                onPress={() => {
                  setSearchOpen((current) => !current);
                  setSearchResults(null);
                  setSearchQuery('');
                }}
                style={styles.headerButton}
              >
                <Search color={colors.primaryDark} size={20} />
              </Pressable>
              <Pressable
                accessibilityLabel='Thông tin cuộc trò chuyện'
                onPress={() => router.push({ pathname: '/chat-info/[id]', params: { id } })}
                style={styles.headerButton}
              >
                <Info color={colors.primaryDark} size={21} />
              </Pressable>
            </View>
          }
        />
        <View style={styles.flex}>
        {searchOpen ? (
          <View style={styles.messageSearch}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => void searchMessages()}
              returnKeyType='search'
              placeholder='Tìm tin nhắn, liên kết hoặc tệp...'
              placeholderTextColor={colors.muted}
              style={styles.messageSearchInput}
            />
            <Pressable onPress={() => void searchMessages()} style={styles.searchSubmit}>
              {searching ? <LoaderCircle color='#FFFFFF' size={18} /> : <Search color='#FFFFFF' size={18} />}
            </Pressable>
          </View>
        ) : null}
        {searchResults ? (
          <View style={styles.searchSummary}>
            <Text style={styles.searchSummaryText}>{searchResults.length} kết quả</Text>
            <Pressable onPress={() => setSearchResults(null)}><Text style={styles.clearSearch}>Xóa lọc</Text></Pressable>
          </View>
        ) : null}
        {room?.pinnedMessageIds?.length ? (
          <View style={styles.pinnedBanner}>
            <Pin color={colors.primaryDark} size={16} />
            <Text numberOfLines={1} style={styles.pinnedText}>
              {room.pinnedMessageIds.length + ' tin nhắn đã ghim'}
            </Text>
          </View>
        ) : null}
        {isLoading && !data ? (
          <LoadingState />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <FlatList
            ref={listRef}
            data={visibleMessages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessage}
            contentContainerStyle={[styles.messages, !visibleMessages.length && styles.emptyMessages]}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onContentSizeChange={() => visibleMessages.length && !searchResults && listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<EmptyState title='Chưa có tin nhắn' message='Hãy bắt đầu cuộc trò chuyện.' />}
          />
        )}

        {attachments.length || uploadingFile ? (
          <View style={styles.attachmentTray}>
            {attachments.map((attachment, index) => (
              <View key={attachment.url + index} style={styles.pendingFile}>
                <Paperclip color={colors.primaryDark} size={14} />
                <Text numberOfLines={1} style={styles.pendingFileName}>{attachment.name || 'Tệp đính kèm'}</Text>
                <Pressable
                  accessibilityLabel='Xóa tệp đính kèm'
                  onPress={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  style={styles.removeFile}
                >
                  <X color={colors.muted} size={15} />
                </Pressable>
              </View>
            ))}
            {uploadingFile ? (
              <View style={styles.uploadingFile}>
                <LoaderCircle color={colors.primary} size={15} />
                <Text style={styles.uploadingText}>Đang tải tệp...</Text>
              </View>
            ) : null}
          </View>
        ) : null}

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

        {editingMessage ? (
          <View style={styles.replying}>
            <Text style={styles.editingLabel}>Đang chỉnh sửa tin nhắn</Text>
            <Pressable
              accessibilityLabel='Hủy chỉnh sửa'
              onPress={() => { setEditingMessage(null); setMessage(''); }}
              style={styles.cancelReply}
            >
              <X color={colors.muted} size={18} />
            </Pressable>
          </View>
        ) : null}

        {reactionMessage ? (
          <View style={styles.reactionPicker}>
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
              <Pressable key={emoji} onPress={() => void reactToMessage(reactionMessage, emoji)} style={styles.reactionChoice}>
                <Text style={styles.reactionChoiceText}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setReactionMessage(null)} style={styles.reactionChoice}>
              <X color={colors.muted} size={18} />
            </Pressable>
          </View>
        ) : null}

        {showEmoji ? (
          <View style={styles.emojiPanel}>
            {EMOJIS.map((emoji) => (
              <Pressable key={emoji} accessibilityLabel={'Chèn emoji ' + emoji} onPress={() => chooseEmoji(emoji)} style={styles.emojiButton}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
        {cannotMessage ? (
          <View style={styles.blockedNotice}>
            <Shield color={colors.danger} size={18} />
            <Text style={styles.blockedNoticeText}>
              {isBlocked ? 'Bạn đã chặn cuộc trò chuyện này.' : 'Chỉ quản trị viên được phép gửi tin nhắn.'}
            </Text>
          </View>
        ) : recorderState.isRecording || processingVoice ? (
          <View style={styles.recordingBar}>
            <Pressable
              accessibilityLabel='Hủy ghi âm'
              onPress={() => void cancelVoiceRecording()}
              disabled={processingVoice}
              style={styles.recordingCancel}
            >
              <X color={colors.danger} size={21} />
            </Pressable>
            <View style={styles.recordingStatus}>
              <View style={styles.recordingDot} />
              <View style={styles.recordingCopy}>
                <Text style={styles.recordingTitle}>{processingVoice ? 'Đang gửi ghi âm...' : 'Đang ghi âm'}</Text>
                <Text style={styles.recordingTime}>{formatDuration(recorderState.durationMillis / 1000)}</Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel='Dừng và gửi ghi âm'
              onPress={() => void stopAndSendVoice()}
              disabled={processingVoice}
              style={[styles.voiceSend, processingVoice && styles.sendDisabled]}
            >
              {processingVoice ? <LoaderCircle color='#FFFFFF' size={20} /> : <Send color='#FFFFFF' size={20} />}
            </Pressable>
          </View>
        ) : (
        <View style={styles.composer}>
          <Pressable
            accessibilityLabel='Đính kèm tệp'
            onPress={openAttachmentMenu}
            disabled={uploadingFile}
            style={({ pressed }) => [styles.toolButton, uploadingFile && styles.toolDisabled, pressed && styles.pressed]}
          >
            {uploadingFile ? <LoaderCircle color={colors.primaryDark} size={20} /> : <Paperclip color={colors.primaryDark} size={20} />}
          </Pressable>
          <Pressable
            accessibilityLabel='Chọn emoji'
            onPress={() => {
              Keyboard.dismiss();
              setShowEmoji((current) => !current);
            }}
            style={({ pressed }) => [styles.toolButton, showEmoji && styles.toolButtonActive, pressed && styles.pressed]}
          >
            <Smile color={colors.primaryDark} size={21} />
          </Pressable>
          <Pressable
            accessibilityLabel='Ghi âm'
            onPress={() => void startVoiceRecording()}
            disabled={uploadingFile || sending}
            style={({ pressed }) => [styles.toolButton, (uploadingFile || sending) && styles.toolDisabled, pressed && styles.pressed]}
          >
            <Mic color={colors.primaryDark} size={21} />
          </Pressable>
          <TextInput
            ref={inputRef}
            value={message}
            onChangeText={(value) => { setMessage(value); setSendError(''); }}
            placeholder='Nhập tin nhắn...'
            placeholderTextColor={colors.muted}
            multiline
            maxLength={4000}
            onFocus={() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))}
            style={styles.input}
          />
          <Pressable
            accessibilityLabel='Gửi tin nhắn'
            onPress={() => void send()}
            disabled={(!message.trim() && !attachments.length) || sending || uploadingFile}
            style={({ pressed }) => [
              styles.send,
              ((!message.trim() && !attachments.length) || sending || uploadingFile) && styles.sendDisabled,
              pressed && styles.pressed,
            ]}
          >
            {sending ? <Text style={styles.sendText}>…</Text> : <Send color='#FFFFFF' size={20} />}
          </Pressable>
        </View>
        )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1, backgroundColor: colors.background },
  screen: { paddingBottom: spacing.md },
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surface },
  messageSearch: { minHeight: touchTarget, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  messageSearchInput: { flex: 1, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surface },
  searchSubmit: { width: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary },
  searchSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.sm },
  searchSummaryText: { color: colors.muted, fontSize: 11 },
  clearSearch: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  pinnedBanner: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  pinnedText: { flex: 1, color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  messages: { paddingVertical: spacing.sm, gap: spacing.sm },
  emptyMessages: { flexGrow: 1, justifyContent: 'center' },
  day: { alignSelf: 'center', marginVertical: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, overflow: 'hidden', color: colors.muted, backgroundColor: '#EAF0F3', fontSize: 10, fontWeight: '700' },
  messageRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  myMessageRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '84%', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 7, borderRadius: radius.lg, borderBottomLeftRadius: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  mine: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: 5, backgroundColor: colors.primary, borderColor: colors.primary },
  deletedBubble: { backgroundColor: '#F2F5F6', borderColor: colors.border },
  sender: { marginBottom: 3, color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  content: { color: colors.text, fontSize: 14, lineHeight: 20 },
  mineText: { color: '#FFFFFF' },
  deletedText: { color: colors.muted, fontStyle: 'italic' },
  quote: { marginBottom: spacing.sm, paddingLeft: spacing.sm, paddingVertical: 4, borderLeftWidth: 3, borderLeftColor: colors.primary, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  myQuote: { borderLeftColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.17)' },
  quoteName: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  quoteText: { marginTop: 2, color: colors.muted, fontSize: 11 },
  mySecondaryText: { color: 'rgba(255,255,255,0.78)' },
  meta: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  time: { color: colors.muted, fontSize: 9 },
  edited: { color: colors.muted, fontSize: 9, fontStyle: 'italic' },
  reaction: { position: 'absolute', bottom: -13, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  reactionMine: { left: 8 },
  reactionOther: { right: 8 },
  reactionText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  attachmentImage: { width: 210, height: 150, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.border },
  file: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: 'rgba(16,37,51,0.09)' },
  fileText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  audioAttachment: { minWidth: 190, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  myAudioAttachment: { backgroundColor: 'rgba(255,255,255,0.17)' },
  audioPlay: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.primary },
  myAudioPlay: { backgroundColor: '#FFFFFF' },
  audioCopy: { flex: 1 },
  audioTitle: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  audioDuration: { marginTop: 2, color: colors.muted, fontSize: 10 },
  attachmentTray: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm },
  pendingFile: { maxWidth: '100%', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: spacing.sm, borderWidth: 1, borderColor: '#B9E7EE', borderRadius: radius.md, backgroundColor: colors.primarySoft },
  pendingFileName: { maxWidth: 180, color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
  removeFile: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  uploadingFile: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  uploadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  replying: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.primarySoft },
  replyingCopy: { flex: 1 },
  replyingName: { color: colors.primaryDark, fontSize: 11, fontWeight: '900' },
  replyingText: { marginTop: 2, color: colors.muted, fontSize: 11 },
  editingLabel: { flex: 1, color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  cancelReply: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  reactionPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  reactionChoice: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  reactionChoiceText: { fontSize: 22 },
  emojiPanel: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  emojiButton: { width: '17%', minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  emojiText: { fontSize: 23 },
  sendError: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, color: colors.danger, fontSize: 11 },
  recordingBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#F5BCC5', borderRadius: radius.lg, backgroundColor: '#FFF3F5' },
  recordingCancel: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  recordingStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recordingCopy: { flex: 1 },
  recordingTitle: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  recordingTime: { marginTop: 2, color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  voiceSend: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primary },
  blockedNotice: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: '#F5BCC5', borderRadius: radius.md, backgroundColor: '#FFF3F5' },
  blockedNoticeText: { color: colors.danger, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm },
  toolButton: { width: 38, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  toolButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  toolDisabled: { opacity: 0.5 },
  input: { flex: 1, minHeight: touchTarget, maxHeight: 120, paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, color: colors.text, fontSize: 14, lineHeight: 20 },
  send: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primary },
  sendDisabled: { opacity: 0.42 },
  pressed: { opacity: 0.75 },
  sendText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
});
