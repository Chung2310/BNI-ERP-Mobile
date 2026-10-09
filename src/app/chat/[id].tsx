import { friendlyErrorMessage } from "@/utils/userFacingError";
import { Alert } from "@/components/AppAlert";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useEvent } from 'expo';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { io, type Socket } from 'socket.io-client';
import { Check, ChevronRight, FileText, Mic, Paperclip, Pause, Pin, Play, RotateCw, Search, Send, Settings2, Smile, Reply, X } from 'lucide-react-native';
import {
  ActivityIndicator,

  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/BackHeader';
import { ChatRoomSettingsModal } from '@/components/ChatRoomSettingsModal';
import { KeyboardResponsiveView } from '@/components/KeyboardResponsiveView';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { ApiError, apiConfig } from '@/services/api';
import { chatService, type ChatAttachment, type ChatLinkPreview, type ChatMessage, type ChatRoom } from '@/services/chat';
import { cachePickedChatImage, chatMediaDimensions, chatMediaUri, rememberChatMedia } from '@/services/chatMediaCache';
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
const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const emojiCategories = [
  { label: 'Cảm xúc', icon: '😀', emojis: ['😀', '😃', '😄', '😁', '😆', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🥳', '🤩', '😮', '😢', '😭', '😡', '🤔', '🙏', '❤️', '💕'] },
  { label: 'Cử chỉ', icon: '👋', emojis: ['👋', '🤝', '👏', '👍', '👎', '👌', '✌️', '🤞', '🤟', '💪', '🫶', '🙌', '👐', '👀', '🧠', '💋', '👑', '🧑', '👩', '👨'] },
  { label: 'Đồ vật', icon: '🎁', emojis: ['🎁', '🎉', '🎊', '🎂', '🏆', '🥇', '💎', '💰', '📌', '📎', '💻', '📱', '📷', '🎤', '🎵', '📚', '✉️', '💡', '⏰', '🚀'] },
  { label: 'Thiên nhiên', icon: '🌿', emojis: ['🌿', '🌸', '🌹', '🌻', '🍀', '🌳', '☀️', '🌈', '⭐', '🌙', '🔥', '💧', '🐶', '🐱', '🦋', '🍎', '🍓', '☕', '🍰', '🍕'] },
];
const previewCache = new Map<string, ChatLinkPreview | null>();
const searchTypes = [
  { id: 'all', label: 'Tất cả' }, { id: 'text', label: 'Tin nhắn' }, { id: 'link', label: 'Liên kết' }, { id: 'file', label: 'Tệp' }, { id: 'media', label: 'Ảnh/video' },
] as const;

const chatUrlPattern = /(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"']*)?/gi;
const chatLinkParts = (content: string) => {
  const parts: { text: string; url?: string }[] = [];
  let end = 0;
  for (const match of content.matchAll(chatUrlPattern)) {
    const start = match.index;
    if (start > 0 && /[@\w.-]/.test(content[start - 1])) continue;
    const link = match[0].replace(/[.,!?;:)}\]]+$/, '');
    if (!link) continue;
    if (start > end) parts.push({ text: content.slice(end, start) });
    parts.push({ text: link, url: /^https?:\/\//i.test(link) ? link : `https://${link}` });
    end = start + link.length;
  }
  if (end < content.length) parts.push({ text: content.slice(end) });
  return parts;
};

const openChatLink = async (url: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Không mở được liên kết', 'Vui lòng kiểm tra liên kết rồi thử lại.');
  }
};

type UploadAsset = { uri: string; name: string; mimeType?: string; size?: number; width?: number; height?: number; base64?: string; staged?: boolean };
type PendingAttachment = {
  id: string;
  asset: UploadAsset;
  previewUri: string;
  createdAt: string;
  replyToId?: string;
  uploaded?: ChatAttachment;
  progress: number;
  status: 'sending' | 'failed';
  error?: string;
};
type DisplayMessage = ChatMessage & { pendingAttachment?: PendingAttachment };

const chatUploadTime = () => Date.now();
const chatUploadId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const imageMimeType = (asset: UploadAsset) => {
  if (asset.mimeType?.startsWith('image/')) return asset.mimeType;
  const extension = asset.name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png' || extension === 'gif' || extension === 'webp' || extension === 'heic' || extension === 'heif') return `image/${extension}`;
  return null;
};

const documentMimeTypes: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  zip: 'application/zip',
};

const attachmentMimeType = (asset: UploadAsset) => {
  const image = imageMimeType(asset);
  if (image) return image;
  const extension = asset.name.split('.').pop()?.toLowerCase();
  if (extension && documentMimeTypes[extension]) return documentMimeTypes[extension];
  if (asset.mimeType && asset.mimeType !== 'application/octet-stream') return asset.mimeType;
  if (extension === 'mp4' || extension === 'mov' || extension === 'webm') return `video/${extension === 'mov' ? 'quicktime' : extension}`;
  if (extension === 'm4a') return 'audio/mp4';
  if (extension === 'mp3') return 'audio/mpeg';
  return 'application/octet-stream';
};

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const listRef = useRef<FlatList<DisplayMessage>>(null);
  const scrollRetryRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [actionsMessage, setActionsMessage] = useState<ChatMessage | null>(null);
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);
  const [sharingMessage, setSharingMessage] = useState<ChatMessage | null>(null);
  const [shareRooms, setShareRooms] = useState<ChatRoom[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<(typeof searchTypes)[number]['id']>('all');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const [jumpTargetId, setJumpTargetId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const { data, setData, error, isLoading, reload } = useAsyncData(() => chatService.messages(id), id);
  const { data: room, setData: setRoom } = useAsyncData(() => chatService.room(id), id);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const shouldStickToBottom = useRef(true);

  const messages = useMemo(() => {
    const sentImages = new Set((data || []).flatMap((item) => item.attachments?.map((file) => file.url) || []));
    const localMessages: DisplayMessage[] = pendingAttachments
      .filter((pending) => !pending.uploaded || !sentImages.has(pending.uploaded.url))
      .map((pending) => ({
        _id: pending.id,
        senderId: user?.uid || '',
        senderName: user?.displayName || '',
        content: '',
        createdAt: pending.createdAt,
        attachments: [{ url: pending.previewUri, name: pending.asset.name, type: pending.asset.mimeType || 'image/jpeg' }],
        pendingAttachment: pending,
      }));
    return [...(data || []), ...localMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [data, pendingAttachments, user?.uid, user?.displayName]);

  useEffect(() => {
    if (!id) return;
    void chatService.markRead(id).catch(() => undefined);
  }, [id, messages.length]);

  useEffect(() => {
    if (!id) return;
    const timer = setInterval(() => {
      void chatService.messages(id).then((latest) => setData((current) => {
        const byId = new Map((current || []).map((item) => [item._id, item]));
        latest.forEach((item) => byId.set(item._id, item));
        return Array.from(byId.values());
      })).catch(() => undefined);
    }, 30000);
    return () => clearInterval(timer);
  }, [id, setData]);

  useEffect(() => {
    if (!id || !token) return;
    const socket = io(apiConfig.baseUrl, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join_chat_room', { roomId: id }));
    socket.on('internal_new_message', (event: { roomId: string; message: ChatMessage; roomUpdate: ChatRoom }) => {
      if (event.roomId !== id) return;
      setData((current) => {
        const existing = current || [];
        return existing.some((item) => item._id === event.message._id) ? existing : [event.message, ...existing];
      });
      setRoom(event.roomUpdate);
      void chatService.markRead(id).catch(() => undefined);
      if (shouldStickToBottom.current) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    socket.on('internal_room_updated', (updated: ChatRoom) => { if (updated._id === id) setRoom(updated); });
    socket.on('internal_room_deleted', (event: { roomId: string }) => { if (event.roomId === id) router.replace('/(tabs)/chat'); });
    socket.on('internal_message_deleted', (event: { roomId: string; messageId: string; message: ChatMessage; roomUpdate: ChatRoom }) => {
      if (event.roomId !== id) return;
      setData((current) => (current || []).map((item) => item._id === event.messageId ? event.message : item));
      setRoom(event.roomUpdate);
    });
    socket.on('internal_message_reaction', (event: { roomId: string; messageId: string; message: ChatMessage }) => {
      if (event.roomId === id) setData((current) => (current || []).map((item) => item._id === event.messageId ? { ...item, reactions: event.message.reactions } : item));
    });
    socket.on('internal_message_edited', (event: { roomId: string; messageId: string; message: ChatMessage }) => {
      if (event.roomId === id) setData((current) => (current || []).map((item) => item._id === event.messageId ? { ...item, content: event.message.content, editedAt: event.message.editedAt } : item));
    });
    socket.on('internal_messages_read', (event: { roomId: string; userId: string }) => {
      if (event.roomId === id) setData((current) => (current || []).map((item) => ({ ...item, readBy: item.readBy?.includes(event.userId) ? item.readBy : [...(item.readBy || []), event.userId] })));
    });
    socket.on('internal_typing_status', (event: { roomId: string; displayName: string; isTyping: boolean }) => {
      if (event.roomId !== id) return;
      setTypingNames((current) => event.isTyping ? [...new Set([...current, event.displayName])] : current.filter((name) => name !== event.displayName));
    });
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socket.emit('typing_status', { roomId: id, isTyping: false });
      socket.emit('leave_chat_room', { roomId: id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id, token, setData, setRoom]);

  const emitTyping = () => {
    socketRef.current?.emit('typing_status', { roomId: id, isTyping: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socketRef.current?.emit('typing_status', { roomId: id, isTyping: false }), 2000);
  };

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
    if (!content || sending || (!room?.isGroup && Boolean(room?.blockedBy?.length))) return;
    setSending(true);
    setSendError('');
    try {
      if (editingMessage) {
        if (!content) return;
        const updated = await chatService.edit(id, editingMessage._id, content);
        setData((current) => (current || []).map((entry) => entry._id === updated._id ? updated : entry));
        setEditingMessage(null);
      } else {
        const sent = await chatService.send(id, content, replyingTo?._id);
        setData((current) => {
          const existing = current || [];
          return existing.some((item) => item._id === sent._id) ? existing : [sent, ...existing];
        });
      }
      setMessage('');
      socketRef.current?.emit('typing_status', { roomId: id, isTyping: false });
      setReplyingTo(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (cause) {
      setSendError(friendlyErrorMessage(cause, 'Không thể gửi tin nhắn.'));
    } finally {
      setSending(false);
    }
  };

  const sendPendingAttachment = async (pending: PendingAttachment) => {
    setPendingAttachments((current) => current.map((item) => item.id === pending.id ? { ...item, status: 'sending', progress: item.uploaded ? 0.95 : 0, error: undefined } : item));
    let stage: 'upload' | 'send' = 'upload';
    try {
      if (pending.uploaded) {
        const latest = await chatService.messages(id);
        const alreadySent = latest.find((item) =>
          senderId(item) === user?.uid &&
          new Date(item.createdAt).getTime() >= new Date(pending.createdAt).getTime() - 1000 &&
          item.attachments?.some((file) => file.url === pending.uploaded?.url),
        );
        if (alreadySent) {
          setData((current) => (current || []).some((item) => item._id === alreadySent._id) ? current : [alreadySent, ...(current || [])]);
          setPendingAttachments((current) => current.filter((item) => item.id !== pending.id));
          if (pending.asset.staged && !pending.uploaded.type.startsWith('image/') && !pending.uploaded.type.startsWith('video/')) {
            void FileSystem.deleteAsync(pending.asset.uri, { idempotent: true }).catch(() => undefined);
          }
          return;
        }
      }
      const previewUri = pending.uploaded || !pending.asset.mimeType?.startsWith('image/')
        ? pending.previewUri
        : await cachePickedChatImage(pending.asset.uri, pending.asset.mimeType);
      setPendingAttachments((current) => current.map((item) => item.id === pending.id ? { ...item, previewUri, asset: { ...item.asset, uri: previewUri } } : item));
      const uploaded = pending.uploaded || await chatService.uploadAttachment({ ...pending.asset, uri: previewUri }, (progress) => {
        setPendingAttachments((current) => current.map((item) => item.id === pending.id ? { ...item, progress } : item));
      });
      if (uploaded.type.startsWith('image/') || uploaded.type.startsWith('video/')) rememberChatMedia(uploaded.url, previewUri, pending.asset);
      setPendingAttachments((current) => current.map((item) => item.id === pending.id ? { ...item, uploaded, progress: 0.95 } : item));
      stage = 'send';
      const sent = await chatService.send(id, '', pending.replyToId, [uploaded]);
      setData((current) => {
        const existing = current || [];
        return existing.some((item) => item._id === sent._id) ? existing : [sent, ...existing];
      });
      setPendingAttachments((current) => current.filter((item) => item.id !== pending.id));
      if (pending.asset.staged && !uploaded.type.startsWith('image/') && !uploaded.type.startsWith('video/')) {
        void FileSystem.deleteAsync(pending.asset.uri, { idempotent: true }).catch(() => undefined);
      }
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (cause) {
      const fallback = stage === 'upload'
        ? 'Không thể tải tệp lên. Hãy kiểm tra kết nối rồi thử lại.'
        : 'Tệp đã tải lên nhưng chưa gửi được tin nhắn. Hãy thử gửi lại.';
      const error = cause instanceof ApiError && cause.status === 413
        ? 'Tệp quá lớn để tải lên.'
        : friendlyErrorMessage(cause, fallback);
      setPendingAttachments((current) => current.map((item) => item.id === pending.id ? { ...item, status: 'failed', error } : item));
    }
  };

  const sendPickedAttachments = (assets: UploadAsset[]) => {
    if (!assets.length) return;
    const selectedAt = chatUploadTime();
    const next = assets.map((asset, index): PendingAttachment => ({
      id: `local-attachment-${selectedAt}-${index}-${chatUploadId()}`,
      asset: { ...asset, mimeType: attachmentMimeType(asset) },
      previewUri: asset.uri,
      createdAt: new Date(selectedAt + index).toISOString(),
      replyToId: replyingTo?._id,
      progress: 0,
      status: 'sending',
    }));
    setPendingAttachments((current) => [...current, ...next]);
    setReplyingTo(null);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    void (async () => {
      for (const pending of next) await sendPendingAttachment(pending);
    })();
  };

  const handlePickedAssets = (assets: UploadAsset[]) => sendPickedAttachments(assets);

  const pickFile = async (replacePending?: PendingAttachment) => {
    const stagedAssets: UploadAsset[] = [];
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: !replacePending, copyToCacheDirectory: true });
      if (result.canceled) return;
      const assets: UploadAsset[] = [];
      for (const asset of result.assets) {
        if (Platform.OS === 'web') {
          assets.push({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size, base64: asset.base64 });
          continue;
        }
        if (!FileSystem.cacheDirectory) throw new Error('Không thể truy cập bộ nhớ tạm để tải tệp lên.');
        const uri = `${FileSystem.cacheDirectory}chat-picked-${chatUploadId()}`;
        const stagedAsset = { uri, name: asset.name, mimeType: asset.mimeType, size: asset.size, staged: true };
        stagedAssets.push(stagedAsset);
        await FileSystem.copyAsync({ from: asset.uri, to: uri });
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || info.isDirectory || info.size === 0) throw new Error('Tệp đã chọn không có dữ liệu để gửi.');
        assets.push(stagedAsset);
      }
      if (replacePending && assets[0]) {
        const asset = { ...assets[0], mimeType: attachmentMimeType(assets[0]) };
        const next = { ...replacePending, asset, previewUri: asset.uri, uploaded: undefined, status: 'sending' as const, progress: 0, error: undefined };
        setPendingAttachments((current) => current.map((item) => item.id === replacePending.id ? next : item));
        if (replacePending.asset.staged) {
          void FileSystem.deleteAsync(replacePending.asset.uri, { idempotent: true }).catch(() => undefined);
        }
        void sendPendingAttachment(next);
      } else {
        handlePickedAssets(assets);
      }
    } catch (cause) {
      await Promise.all(stagedAssets.map((asset) => FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => undefined)));
      Alert.alert('Không thể chọn tệp', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const pickMedia = async () => {
    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { Alert.alert('Cần quyền thư viện', 'Vui lòng cho phép truy cập thư viện để chọn ảnh hoặc video.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.85 });
      if (!result.canceled) handlePickedAssets(result.assets.map((asset) => ({ uri: asset.uri, name: asset.fileName || `media-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`, mimeType: asset.mimeType || (asset.type === 'image' ? 'image/jpeg' : 'video/mp4'), size: asset.fileSize, width: asset.width, height: asset.height })));
    } catch (cause) {
      Alert.alert('Không thể chọn ảnh hoặc video', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const capturePhoto = async () => {
    try {
      const camera = await ImagePicker.requestCameraPermissionsAsync();
      if (!camera.granted) { Alert.alert('Cần quyền camera', 'Vui lòng cho phép sử dụng camera để chụp ảnh.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (!result.canceled) sendPickedAttachments(result.assets.map((asset) => ({ uri: asset.uri, name: asset.fileName || `photo-${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg', size: asset.fileSize, width: asset.width, height: asset.height })));
    } catch (cause) {
      Alert.alert('Không thể chụp ảnh', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const captureVideo = async () => {
    try {
      const camera = await ImagePicker.requestCameraPermissionsAsync();
      if (!camera.granted) { Alert.alert('Cần quyền camera', 'Vui lòng cho phép sử dụng camera để quay video.'); return; }
      const microphone = await AudioModule.requestRecordingPermissionsAsync();
      if (!microphone.granted) { Alert.alert('Cần quyền micro', 'Vui lòng cho phép sử dụng micro để quay video.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 300, quality: 0.7 });
      if (!result.canceled) handlePickedAssets(result.assets.map((asset) => ({ uri: asset.uri, name: asset.fileName || `video-${Date.now()}.mp4`, mimeType: asset.mimeType || 'video/mp4', size: asset.fileSize, width: asset.width, height: asset.height })));
    } catch (cause) {
      Alert.alert('Không thể quay video', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { Alert.alert('Cần quyền micro', 'Vui lòng cho phép sử dụng micro để ghi âm.'); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (cause) {
      Alert.alert('Không thể ghi âm', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const stopRecording = async (keep: boolean) => {
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (keep && audioRecorder.uri) handlePickedAssets([{ uri: audioRecorder.uri, name: `voice-${Date.now()}.m4a`, mimeType: 'audio/mp4' }]);
    } catch (cause) {
      Alert.alert('Không thể lưu ghi âm', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const chooseAttachment = (action: () => void) => {
    setShowAttachmentPicker(false);
    setTimeout(action, 250);
  };

  const searchMessages = async () => {
    setSearching(true);
    try {
      setSearchResults(await chatService.search(id, searchQuery, searchType));
    } catch (cause) {
      Alert.alert('Không thể tìm tin nhắn', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    } finally {
      setSearching(false);
    }
  };

  const loadOlder = async () => {
    if (loadingOlder || !hasOlder || !messages.length) return;
    setLoadingOlder(true);
    try {
      const older = await chatService.olderMessages(id, messages[0].createdAt);
      setHasOlder(older.length >= 50);
      setData((current) => {
        const byId = new Map((current || []).map((item) => [item._id, item]));
        older.forEach((item) => byId.set(item._id, item));
        return Array.from(byId.values());
      });
    } catch (cause) {
      Alert.alert('Không thể tải tin cũ', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    } finally {
      setLoadingOlder(false);
    }
  };

  const jumpToMessage = async (target: ChatMessage) => {
    setShowSearch(false);
    shouldStickToBottom.current = false;
    const byId = new Map(messages.map((item) => [item._id, item]));
    try {
      for (let page = 0; page < 10 && !byId.has(target._id); page += 1) {
        const oldest = [...byId.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
        if (!oldest) break;
        const older = await chatService.olderMessages(id, oldest.createdAt);
        older.forEach((item) => byId.set(item._id, item));
        if (older.length < 50) { setHasOlder(false); break; }
      }
      if (!byId.has(target._id)) byId.set(target._id, target);
      const next = [...byId.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setData(next);
      const index = next.findIndex((item) => item._id === target._id);
      setJumpTargetId(target._id);
      scrollRetryRef.current = 0;
      setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.35 }), 350);
      setTimeout(() => setJumpTargetId(null), 4000);
    } catch (cause) {
      Alert.alert('Không thể mở tin nhắn', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const shareMessage = async (targetId: string) => {
    if (!sharingMessage || shareBusy) return;
    setShareBusy(true);
    try {
      await chatService.send(targetId, sharingMessage.content, undefined, sharingMessage.attachments || []);
      setSharingMessage(null);
      Alert.alert('Đã chia sẻ tin nhắn');
    } catch (cause) {
      Alert.alert('Không thể chia sẻ', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    } finally {
      setShareBusy(false);
    }
  };

  const removeMessage = async (item: ChatMessage) => {
    try {
      const updated = await chatService.remove(id, item._id);
      setData((current) => (current || []).map((entry) =>
        entry._id === item._id ? updated : entry,
      ));
    } catch (cause) {
      Alert.alert('Không thể thu hồi', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const reactToMessage = async (item: ChatMessage, emoji: string) => {
    try {
      const updated = await chatService.react(id, item._id, emoji);
      setData((current) => (current || []).map((entry) => entry._id === item._id ? updated : entry));
    } catch (cause) {
      Alert.alert('Không thể thả cảm xúc', friendlyErrorMessage(cause, 'Vui lòng thử lại.'));
    }
  };

  const openActions = (item: ChatMessage) => {
    if (item.isDeleted) return;
    Keyboard.dismiss();
    setActionsMessage(item);
  };

  const reportMessage = () => {
    setActionsMessage(null);
    setTimeout(() => Alert.alert(
      'Báo cáo tin nhắn',
      'Ứng dụng sẽ mở email hỗ trợ. Hãy mô tả tin nhắn và lý do bạn muốn báo cáo trước khi gửi.',
      [
        { text: 'Bỏ qua', style: 'cancel' },
        { text: 'Mở email', onPress: () => {
          void Linking.openURL('mailto:igen.work99@gmail.com?subject=B%C3%A1o%20c%C3%A1o%20tin%20nh%E1%BA%AFn%20iGen%20Connect')
            .catch(() => Alert.alert('Không thể mở email', 'Vui lòng cài đặt ứng dụng email để gửi báo cáo.'));
        } },
      ],
    ), 250);
  };

  const renderMessage = ({ item, index }: { item: DisplayMessage; index: number }) => {
    const mine = senderId(item) === user?.uid;
    const quoted = replyMessage(item.replyTo);
    const linkParts = item.isDeleted ? [] : chatLinkParts(item.content);
    const previewUrl = linkParts.find((part) => part.url)?.url;
    const mediaOnly = !item.isDeleted && !item.content.trim() && !quoted && item.attachments?.length === 1 && /^(image|video)\//.test(item.attachments[0].type || '');
    const showDay = index === 0 || !sameDay(item.createdAt, messages[index - 1]?.createdAt);
    const reactionCounts = Object.entries((item.reactions || []).reduce<Record<string, number>>((counts, reaction) => {
      counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
      return counts;
    }, {})).sort((first, second) => second[1] - first[1]);

    return (
      <View>
        {showDay ? <Text style={styles.day}>{formatDay(item.createdAt)}</Text> : null}
        <View style={[styles.messageRow, mine && styles.myMessageRow]}>
          <Pressable
            accessibilityHint='Nhấn giữ để xem thao tác'
            delayLongPress={350}
            onLongPress={item.pendingAttachment ? undefined : () => openActions(item)}
            style={[styles.bubble, mine && styles.mine, mediaOnly && styles.mediaBubble, item.isDeleted && styles.deletedBubble, jumpTargetId === item._id && styles.highlightBubble]}
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
            {item.isDeleted || item.content ? <Text style={[styles.content, mine && styles.mineText, item.isDeleted && styles.deletedText]}>
              {item.isDeleted ? 'Tin nhắn đã được thu hồi' : linkParts.map((part, partIndex) => part.url ? (
                <Text key={partIndex} accessibilityRole='link' onPress={() => void openChatLink(part.url!)} style={[styles.contentLink, mine && styles.myContentLink]}>{part.text}</Text>
              ) : part.text)}
            </Text> : null}
            {previewUrl ? <ChatLinkPreviewCard url={previewUrl} mine={mine} /> : null}
            {!item.isDeleted ? item.attachments?.map((attachment, attachmentIndex) =>
              attachment.type?.startsWith('image/') ? (
                <ChatImageAttachment
                  key={attachment.url + attachmentIndex}
                  attachment={attachment}
                  mine={mine}
                  compact={Boolean(mediaOnly)}
                  sending={item.pendingAttachment?.status === 'sending'}
                  failed={item.pendingAttachment?.status === 'failed'}
                  onPress={() => setPreviewAttachment({ ...attachment, url: chatMediaUri(attachment.url) })}
                  onRetry={item.pendingAttachment ? () => void sendPendingAttachment(item.pendingAttachment!) : undefined}
                />
              ) : attachment.type?.startsWith('video/') ? <ChatVideoAttachment key={attachment.url + attachmentIndex} attachment={attachment} mine={mine} compact={Boolean(mediaOnly)} pending={item.pendingAttachment} onRetry={item.pendingAttachment ? () => void sendPendingAttachment(item.pendingAttachment!) : undefined} /> : item.pendingAttachment ? <PendingFileAttachment key={attachment.url + attachmentIndex} attachment={attachment} pending={item.pendingAttachment} onRetry={() => {
                if (item.pendingAttachment!.error?.startsWith('Không đọc được tệp đã chọn')) void pickFile(item.pendingAttachment!);
                else void sendPendingAttachment(item.pendingAttachment!);
              }} /> : attachment.type?.startsWith('audio/') ? <ChatAudioAttachment key={attachment.url + attachmentIndex} attachment={attachment} mine={mine} /> : (
                <Pressable key={attachment.url + attachmentIndex} onPress={() => void Linking.openURL(attachment.url)} style={[styles.file, mine && styles.myFile]}>
                  <Text numberOfLines={1} style={[styles.fileText, mine && styles.mineText]}>
                    {attachment.name || 'Mở tệp đính kèm'}
                  </Text>
                </Pressable>
              ),
            ) : null}
            {item.pendingAttachment?.status === 'failed' && item.pendingAttachment.error ? (
              <Text style={styles.attachmentError}>{item.pendingAttachment.error}</Text>
            ) : null}
            <View style={[styles.meta, mediaOnly && styles.mediaMeta]}>
              {item.editedAt ? <Text style={[styles.edited, mine && !mediaOnly && styles.mySecondaryText]}>đã sửa</Text> : null}
              {mine && !item.pendingAttachment && item.readBy && room && item.readBy.length >= room.members.length ? <Text style={[styles.edited, !mediaOnly && styles.mySecondaryText]}>Đã xem</Text> : null}
              <Text style={[styles.time, mine && !mediaOnly && styles.mySecondaryText]}>{item.pendingAttachment ? item.pendingAttachment.status === 'sending' ? 'Đang gửi' : 'Chưa gửi' : formatClock(item.createdAt)}</Text>
            </View>
            {reactionCounts.length ? (
              <Pressable accessibilityRole='button' accessibilityLabel={`${item.reactions?.length || 0} lượt thả cảm xúc, xem người đã thả`} onPress={() => setReactionMessageId(item._id)} style={[styles.reaction, mine && styles.reactionMine]}>
                <Text numberOfLines={1} style={styles.reactionText}>{reactionCounts.slice(0, 3).map(([emoji]) => emoji).join(' ')}{reactionCounts.length > 3 ? ' …' : ''}  {item.reactions?.length || 0}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </View>
      </View>
    );
  };

  const bottomInset = Platform.OS === 'android' ? insets.bottom || 48 : insets.bottom;
  const pinnedIds = (room?.pinnedMessageIds || []).map((entry) => typeof entry === 'string' ? entry : entry._id);
  const pinnedMessages = (room?.pinnedMessageIds || []).map((entry) => typeof entry === 'string' ? messages.find((item) => item._id === entry) : entry).filter((entry): entry is ChatMessage => Boolean(entry));
  const activePinned = pinnedMessages[pinnedIndex % Math.max(1, pinnedMessages.length)];
  const canManageMessages = room?.isGroup && room.members.some((member) => member.userId._id === user?.uid && member.role === 'admin');
  const canPin = !room?.isGroup || room.members.some((member) => member.userId._id === user?.uid && member.role === 'admin');
  const blocked = !room?.isGroup && Boolean(room?.blockedBy?.length);
  const blockedByMe = Boolean(user?.uid && room?.blockedBy?.includes(user.uid));
  const reactionMessage = messages.find((item) => item._id === reactionMessageId);
  const mentionMatch = room?.isGroup ? message.match(/(?:^|\s)@([^@\n]*)$/u) : null;
  const mentionNames = mentionMatch ? ['all', ...room!.members.filter((member) => member.userId._id !== user?.uid).map((member) => member.userId.displayName)].filter((candidate) => candidate.toLocaleLowerCase('vi').includes(mentionMatch[1].toLocaleLowerCase('vi'))).slice(0, 5) : [];

  return (
    <>
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View
        ref={rootRef}
        onLayout={() => { if (keyboardTopRef.current !== null) updateKeyboardInset(); }}
        style={[styles.rootContainer, { paddingBottom: Math.max(bottomInset, keyboardInset) + (isFocused ? spacing.md : 0) }]}
      >
        <View style={styles.headerContainer}>
          <BackHeader title={room?.name || name || 'Trò chuyện'} subtitle={typingNames.length ? `${typingNames.join(', ')} đang nhập...` : 'Tin nhắn nội bộ'} compact action={<View style={styles.headerActions}><Pressable accessibilityLabel='Tìm trong cuộc trò chuyện' onPress={() => { Keyboard.dismiss(); setShowSearch(true); }} style={styles.headerAction}><Search color={colors.primaryDark} size={21} /></Pressable><Pressable accessibilityLabel='Cài đặt cuộc trò chuyện' onPress={() => { Keyboard.dismiss(); setShowSettings(true); }} style={styles.headerAction}><Settings2 color={colors.primaryDark} size={21} /></Pressable></View>} />
        </View>
        {activePinned ? <View style={styles.pinnedBar}><Pin color={colors.primaryDark} size={16} /><Pressable onPress={() => void jumpToMessage(activePinned)} style={styles.pinnedCopy}><Text numberOfLines={1} style={styles.pinnedText}>{activePinned.content || activePinned.attachments?.[0]?.name || 'Tin nhắn được ghim'}</Text></Pressable><Text style={styles.pinnedCount}>{pinnedIndex % pinnedMessages.length + 1}/{pinnedMessages.length}</Text>{pinnedMessages.length > 1 ? <Pressable accessibilityLabel='Tin ghim tiếp theo' onPress={() => setPinnedIndex((index) => index + 1)} style={styles.headerAction}><ChevronRight color={colors.primaryDark} size={19} /></Pressable> : null}</View> : null}
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
              onLayout={() => messages.length > 0 && shouldStickToBottom.current && listRef.current?.scrollToEnd({ animated: false })}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                shouldStickToBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100;
              }}
              scrollEventThrottle={100}
              onScrollToIndexFailed={(info) => { if (scrollRetryRef.current++ > 2) return; listRef.current?.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index), animated: false }); setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.35 }), 250); }}
              ListHeaderComponent={hasOlder && messages.length >= 50 ? <Pressable onPress={() => void loadOlder()} style={styles.loadOlder}><Text style={styles.loadOlderText}>{loadingOlder ? 'Đang tải...' : 'Xem tin nhắn cũ'}</Text></Pressable> : null}
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

          {editingMessage ? <View style={styles.replying}><Text style={styles.replyingName}>Đang sửa tin nhắn</Text><Pressable accessibilityLabel='Hủy sửa' onPress={() => { setEditingMessage(null); setMessage(''); }}><X color={colors.muted} size={18} /></Pressable></View> : null}


          {recorderState.isRecording ? <View style={styles.recordingBar}><Mic color={colors.danger} size={18} /><Text style={styles.recordingText}>Đang ghi âm {Math.floor(recorderState.durationMillis / 1000)} giây</Text><Pressable accessibilityLabel='Hủy ghi âm' onPress={() => void stopRecording(false)} style={styles.recordingButton}><X color={colors.muted} size={20} /></Pressable><Pressable accessibilityLabel='Dừng và đính kèm ghi âm' onPress={() => void stopRecording(true)} style={styles.recordingButton}><Check color={colors.primaryDark} size={20} /></Pressable></View> : null}

          {showEmojis ? <View style={styles.emojiPicker}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiTabs}>{emojiCategories.map((category, index) => <Pressable key={category.label} accessibilityLabel={category.label} onPress={() => setEmojiCategory(index)} style={[styles.emojiTab, emojiCategory === index && styles.emojiTabSelected]}><Text style={styles.emojiTabText}>{category.icon}</Text><Text style={styles.emojiTabLabel}>{category.label}</Text></Pressable>)}</ScrollView><ScrollView style={styles.emojiGridScroll} contentContainerStyle={styles.emojiGrid}>{emojiCategories[emojiCategory].emojis.map((emoji, index) => <Pressable key={`${emoji}-${index}`} accessibilityLabel={`Chèn ${emoji}`} onPress={() => setMessage((current) => current + emoji)} style={styles.emojiButton}><Text style={styles.emojiText}>{emoji}</Text></Pressable>)}</ScrollView></View> : null}
          {mentionNames.length ? <View style={styles.mentions}>{mentionNames.map((candidate) => <Pressable key={candidate} onPress={() => setMessage((current) => `${current.slice(0, current.lastIndexOf('@'))}@${candidate} `)} style={styles.mention}><Text style={styles.mentionText}>@{candidate}</Text></Pressable>)}</View> : null}

          <View style={styles.composerContainer}>
            {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
            {blocked ? <Text style={styles.blockedHint}>{blockedByMe ? 'Cuộc trò chuyện đang bị chặn. Mở cài đặt để bỏ chặn.' : 'Người này hiện không muốn nhận tin'}</Text> : null}
            <View style={styles.composer}>
              <Pressable accessibilityLabel='Đính kèm ảnh, video hoặc tệp' disabled={blocked || sending || Boolean(editingMessage)} onPress={() => { Keyboard.dismiss(); setShowAttachmentPicker(true); }} style={styles.composerTool}><Paperclip color={colors.primaryDark} size={20} /></Pressable>
              <Pressable accessibilityLabel='Chèn emoji' disabled={blocked} onPress={() => { Keyboard.dismiss(); setShowEmojis((value) => !value); }} style={styles.composerTool}><Smile color={colors.primaryDark} size={20} /></Pressable>
              <TextInput
                value={message}
                editable={!blocked}
                onChangeText={(value) => { setMessage(value); setSendError(''); if (value.trim()) emitTyping(); else socketRef.current?.emit('typing_status', { roomId: id, isTyping: false }); }}
                placeholder='Nhập tin nhắn...'
                placeholderTextColor={colors.muted}
                multiline
                maxLength={4000}
                onFocus={() => {
                  setIsFocused(true);
                  setShowEmojis(false);
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
                disabled={blocked || !message.trim() || sending}
                style={({ pressed }) => [
                  styles.send,
                  (blocked || !message.trim() || sending) && styles.sendDisabled,
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
    <Modal visible={showAttachmentPicker} transparent animationType='slide' onRequestClose={() => setShowAttachmentPicker(false)}>
      <View style={styles.sheetOverlay}><Pressable style={styles.sheetBackdrop} onPress={() => setShowAttachmentPicker(false)} /><View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}><Text style={styles.sheetTitle}>Đính kèm</Text><SheetAction label='Chụp ảnh' onPress={() => chooseAttachment(() => void capturePhoto())} /><SheetAction label='Ảnh hoặc video từ thư viện' onPress={() => chooseAttachment(() => void pickMedia())} /><SheetAction label='Quay video' onPress={() => chooseAttachment(() => void captureVideo())} /><SheetAction label='Ghi âm' onPress={() => chooseAttachment(() => void startRecording())} /><SheetAction label='Tệp từ điện thoại' onPress={() => chooseAttachment(() => void pickFile())} /></View></View>
    </Modal>
    <Modal visible={Boolean(actionsMessage)} transparent animationType='slide' onRequestClose={() => setActionsMessage(null)}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionsMessage(null)} accessibilityLabel='Đóng thao tác' />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Text style={styles.sheetTitle}>Thao tác tin nhắn</Text>
          <Text numberOfLines={3} style={styles.sheetHint}>{actionsMessage?.content || actionsMessage?.attachments?.[0]?.name || 'Tệp đính kèm'}</Text>
          <View style={styles.emojiRow}>{quickReactions.map((emoji) => <Pressable key={emoji} accessibilityLabel={`Thả ${emoji}`} onPress={() => { const item = actionsMessage; setActionsMessage(null); if (item) void reactToMessage(item, emoji); }} style={styles.emojiButton}><Text style={styles.emojiText}>{emoji}</Text></Pressable>)}</View>
          {actionsMessage?.content ? <SheetAction label='Sao chép nội dung' onPress={() => { const content = actionsMessage.content; setActionsMessage(null); void Clipboard.setStringAsync(content); }} /> : null}
          <SheetAction label='Trả lời' onPress={() => { setReplyingTo(actionsMessage); setActionsMessage(null); }} />
          <SheetAction label='Chia sẻ / chuyển tiếp' onPress={() => { const item = actionsMessage; setActionsMessage(null); if (!item) return; setSharingMessage(item); void chatService.rooms().then(setShareRooms).catch((cause) => Alert.alert('Không thể tải cuộc trò chuyện', friendlyErrorMessage(cause, 'Vui lòng thử lại.'))); }} />
          {actionsMessage && senderId(actionsMessage) !== user?.uid ? <SheetAction label='Báo cáo' danger onPress={reportMessage} /> : null}
          {canPin ? <SheetAction label={actionsMessage && pinnedIds.includes(actionsMessage._id) ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'} onPress={() => { const item = actionsMessage; setActionsMessage(null); if (item) void chatService.pinMessage(id, item._id, pinnedIds.includes(item._id)).then(setRoom).catch((cause) => Alert.alert('Không thể ghim tin', friendlyErrorMessage(cause, 'Vui lòng thử lại.'))); }} /> : null}
          {actionsMessage && senderId(actionsMessage) === user?.uid && actionsMessage.content ? <SheetAction label='Sửa tin nhắn' onPress={() => { setEditingMessage(actionsMessage); setMessage(actionsMessage.content); setReplyingTo(null); setActionsMessage(null); }} /> : null}
          {actionsMessage && (senderId(actionsMessage) === user?.uid || canManageMessages) ? <SheetAction label='Thu hồi tin nhắn' danger onPress={() => { const item = actionsMessage; setActionsMessage(null); if (item) Alert.alert('Thu hồi tin nhắn?', 'Tin nhắn sẽ không còn hiển thị nội dung.', [{ text: 'Bỏ qua', style: 'cancel' }, { text: 'Thu hồi', style: 'destructive', onPress: () => void removeMessage(item) }]); }} /> : null}
        </View>
      </View>
    </Modal>
    <Modal visible={Boolean(reactionMessageId)} transparent animationType='slide' onRequestClose={() => setReactionMessageId(null)}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setReactionMessageId(null)} accessibilityLabel='Đóng danh sách cảm xúc' />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Text style={styles.sheetTitle}>Cảm xúc · {reactionMessage?.reactions?.length || 0}</Text>
          <ScrollView style={styles.sheetScroll}>
            {(reactionMessage?.reactions || []).map((reaction, index) => {
              const reactionUserId = typeof reaction.userId === 'string' ? reaction.userId : reaction.userId._id;
              const displayName = reactionUserId === user?.uid ? 'Bạn' : room?.members.find((member) => member.userId._id === reactionUserId)?.userId.displayName || 'Thành viên';
              return <View key={`${reactionUserId}-${reaction.emoji}-${index}`} style={styles.reactionPerson}>
                <Text style={styles.reactionPersonName}>{displayName}</Text>
                <Text style={styles.reactionPersonEmoji}>{reaction.emoji}</Text>
              </View>;
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
    <Modal visible={Boolean(sharingMessage)} transparent animationType='slide' onRequestClose={() => setSharingMessage(null)}>
      <View style={styles.sheetOverlay}><Pressable style={styles.sheetBackdrop} onPress={() => setSharingMessage(null)} /><View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}><Text style={styles.sheetTitle}>Chia sẻ tin nhắn</Text><Text numberOfLines={2} style={styles.sheetHint}>{sharingMessage?.content || 'Tệp đính kèm'}</Text><ScrollView style={styles.sheetScroll}>{shareRooms.map((target) => <SheetAction key={target._id} label={target.name || target.members.find((member) => member.userId._id !== user?.uid)?.userId.displayName || 'Cuộc trò chuyện'} disabled={shareBusy} onPress={() => void shareMessage(target._id)} />)}</ScrollView></View></View>
    </Modal>
    <Modal visible={showSearch} transparent animationType='slide' onRequestClose={() => setShowSearch(false)}>
      <KeyboardResponsiveView>
      <View style={styles.sheetOverlay}><Pressable style={styles.sheetBackdrop} onPress={() => setShowSearch(false)} /><View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}><Text style={styles.sheetTitle}>Tìm trong cuộc trò chuyện</Text><View style={styles.searchRow}><TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder='Từ khóa tin nhắn' style={styles.searchInput} returnKeyType='search' onSubmitEditing={() => void searchMessages()} /><Pressable accessibilityLabel='Tìm' onPress={() => void searchMessages()} style={styles.headerAction}><Search color={colors.primaryDark} size={20} /></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.searchTypes}>{searchTypes.map((type) => <Pressable key={type.id} onPress={() => setSearchType(type.id)} style={[styles.searchType, searchType === type.id && styles.searchTypeSelected]}><Text style={[styles.searchTypeText, searchType === type.id && styles.searchTypeTextSelected]}>{type.label}</Text></Pressable>)}</ScrollView>{searching ? <LoadingState /> : <ScrollView style={styles.sheetScroll}>{searchResults.map((item) => <Pressable key={item._id} onPress={() => void jumpToMessage(item)} style={styles.searchResult}><Text style={styles.searchResultTitle}>{item.senderName} · {formatDay(item.createdAt)}</Text><Text numberOfLines={3} style={styles.sheetHint}>{item.content || item.attachments?.[0]?.name || 'Tệp đính kèm'}</Text></Pressable>)}</ScrollView>}</View></View>
      </KeyboardResponsiveView>
    </Modal>
    {showSettings && room ? <ChatRoomSettingsModal room={room} currentUserId={user?.uid} onClose={() => setShowSettings(false)} onUpdated={setRoom} onExit={() => { setShowSettings(false); router.replace('/(tabs)/chat'); }} /> : null}
    <Modal visible={Boolean(previewAttachment)} transparent animationType='fade' onRequestClose={() => setPreviewAttachment(null)}><View style={styles.imagePreview}><Pressable accessibilityLabel='Đóng ảnh' onPress={() => setPreviewAttachment(null)} style={styles.imagePreviewClose}><X color='#FFFFFF' size={26} /></Pressable>{previewAttachment ? <Image source={{ uri: previewAttachment.url }} style={styles.imagePreviewContent} resizeMode='contain' /> : null}</View></Modal>
    </>
  );
}

function SheetAction({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole='button' disabled={disabled} onPress={onPress} style={styles.sheetAction}><Text style={[styles.sheetActionText, danger && styles.sheetDanger]}>{label}</Text></Pressable>;
}

function chatMediaSize(width: number | undefined, height: number | undefined, screenWidth: number, screenHeight: number) {
  if (!width || !height || width <= 0 || height <= 0) return { width: 220, height: 155 };
  const maxWidth = Math.min(220, screenWidth * 0.65);
  const maxHeight = Math.min(340, screenHeight * 0.42);
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function ChatImageAttachment({ attachment, mine, compact, sending, failed, onPress, onRetry }: {
  attachment: ChatAttachment;
  mine: boolean;
  compact?: boolean;
  sending?: boolean;
  failed?: boolean;
  onPress: () => void;
  onRetry?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const frameSize = chatMediaSize(sourceSize?.width, sourceSize?.height, screenWidth, screenHeight);
  const uri = chatMediaUri(attachment.url);

  return <View style={[styles.imageAttachment, compact && styles.mediaAttachmentCompact]}>
    <Pressable accessibilityRole='button' accessibilityLabel='Xem ảnh' onPress={onPress} style={[styles.imageFrame, frameSize]}>
      <Image
        key={`${uri}-${attempt}`}
        source={{ uri }}
        style={[styles.attachmentImage, frameSize]}
        resizeMode='contain'
        onLoadStart={() => { setLoading(true); setLoadFailed(false); }}
        onLoad={({ nativeEvent: { source } }) => setSourceSize({ width: source.width, height: source.height })}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoadFailed(true)}
      />
      {sending || loading ? <View pointerEvents='none' style={styles.imageLoading}><ActivityIndicator color='#FFFFFF' size='large' /></View> : null}
    </Pressable>
    {failed || loadFailed ? <Pressable accessibilityRole='button' onPress={failed ? onRetry : () => setAttempt((value) => value + 1)} style={styles.imageRetry}>
      <RotateCw color={mine ? '#FFFFFF' : colors.primaryDark} size={14} />
      <Text style={[styles.imageRetryText, !mine && styles.imageRetryOther]}>{failed ? 'Gửi lại ảnh' : 'Tải lại ảnh'}</Text>
    </Pressable> : null}
  </View>;
}

function ChatAudioAttachment({ attachment, mine }: { attachment: ChatAttachment; mine: boolean }) {
  const player = useAudioPlayer(attachment.url);
  const status = useAudioPlayerStatus(player);
  const time = Math.floor(status.currentTime || 0);
  return <Pressable accessibilityLabel={status.playing ? 'Tạm dừng ghi âm' : 'Phát ghi âm'} onPress={() => status.playing ? player.pause() : player.play()} style={[styles.mediaAudio, mine && styles.myFile]}>
    {status.playing ? <Pause color={mine ? '#FFFFFF' : colors.primaryDark} size={19} /> : <Play color={mine ? '#FFFFFF' : colors.primaryDark} size={19} />}
    <Text numberOfLines={1} style={[styles.fileText, mine && styles.mineText]}>{attachment.name} · {time}s</Text>
  </Pressable>;
}

function ChatVideoAttachment({ attachment, mine, compact, pending, onRetry }: { attachment: ChatAttachment; mine: boolean; compact?: boolean; pending?: PendingAttachment; onRetry?: () => void }) {
  const player = useVideoPlayer(chatMediaUri(attachment.url));
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const sourceLoad = useEvent(player, 'sourceLoad', null);
  const { videoTrack } = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack });
  const [thumbnailSize, setThumbnailSize] = useState<{ width: number; height: number } | null>(null);
  const pickedSize = pending?.asset.width && pending.asset.height ? pending.asset : chatMediaDimensions(attachment.url);
  useEffect(() => {
    if (Platform.OS === 'web' || status !== 'readyToPlay' || (pickedSize?.width && pickedSize.height)) return;
    let active = true;
    void player.generateThumbnailsAsync(0, { maxWidth: 220, maxHeight: 340 }).then(([thumbnail]) => {
      if (active && thumbnail?.width && thumbnail.height) setThumbnailSize({ width: thumbnail.width, height: thumbnail.height });
      thumbnail?.release();
    }).catch(() => undefined);
    return () => { active = false; };
  }, [player, status, pickedSize?.width, pickedSize?.height]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const sourceSize = pickedSize || thumbnailSize || (videoTrack || sourceLoad?.availableVideoTracks[0] || player.availableVideoTracks[0])?.size;
  const frameSize = chatMediaSize(sourceSize?.width, sourceSize?.height, screenWidth, screenHeight);
  const loading = pending?.status === 'sending' || (!pending && status !== 'readyToPlay' && status !== 'error');
  return <View style={[styles.videoAttachment, compact && styles.mediaAttachmentCompact, { width: frameSize.width }]}>
    <VideoView style={[styles.attachmentVideo, frameSize]} player={player} nativeControls={!pending} fullscreenOptions={{ enable: true }} contentFit='contain' />
    {loading ? <View pointerEvents='none' style={styles.imageLoading}><ActivityIndicator color='#FFFFFF' size='large' />{pending ? <Text style={styles.videoProgress}>{Math.round(pending.progress * 100)}%</Text> : null}</View> : null}
    {pending?.status === 'failed' ? <Pressable accessibilityRole='button' onPress={onRetry} style={styles.imageRetry}><RotateCw color={mine ? '#FFFFFF' : colors.primaryDark} size={14} /><Text style={[styles.imageRetryText, !mine && styles.imageRetryOther]}>Gửi lại video</Text></Pressable> : null}
    {!pending && status === 'error' ? <Text style={[styles.imageRetryText, !mine && styles.imageRetryOther]}>Không tải được video.</Text> : null}
  </View>;
}

function PendingFileAttachment({ attachment, pending, onRetry }: { attachment: ChatAttachment; pending: PendingAttachment; onRetry: () => void }) {
  const percent = Math.round(pending.progress * 100);
  return <View style={styles.pendingFile}>
    <View style={styles.pendingFileTitle}><FileText color='#FFFFFF' size={19} /><Text numberOfLines={2} style={styles.pendingFileName}>{attachment.name}</Text></View>
    {pending.status === 'sending' ? <>
      <View style={styles.uploadTrack}><View style={[styles.uploadFill, { width: `${percent}%` as `${number}%` }]} /></View>
      <Text style={styles.pendingFileStatus}>{percent <= 5 ? 'Đang chuẩn bị tệp...' : percent >= 95 ? 'Đang hoàn tất...' : `Đang tải lên ${percent}%`}</Text>
    </> : <Pressable accessibilityRole='button' onPress={onRetry} style={styles.imageRetry}><RotateCw color='#FFFFFF' size={14} /><Text style={styles.imageRetryText}>{pending.error?.startsWith('Không đọc được tệp đã chọn') ? 'Chọn lại tệp' : 'Gửi lại tệp'}</Text></Pressable>}
  </View>;
}

function ChatLinkPreviewCard({ url, mine }: { url: string; mine: boolean }) {
  const [preview, setPreview] = useState<ChatLinkPreview | null>(previewCache.get(url) || null);
  useEffect(() => {
    if (previewCache.has(url)) return;
    let active = true;
    void chatService.linkPreview(url).then((result) => { previewCache.set(url, result); if (active) setPreview(result); }).catch(() => previewCache.set(url, null));
    return () => { active = false; };
  }, [url]);
  if (!preview || (!preview.title && !preview.description && !preview.image)) return null;
  return <Pressable accessibilityLabel={`Mở liên kết ${preview.title || url}`} onPress={() => void openChatLink(url)} style={[styles.linkPreview, mine && styles.myLinkPreview]}>
    {preview.image ? <Image source={{ uri: preview.image }} style={styles.linkImage} /> : null}
    <View style={styles.linkCopy}><Text numberOfLines={1} style={[styles.linkTitle, mine && styles.mineText]}>{preview.title || preview.siteName}</Text><Text numberOfLines={2} style={[styles.sheetHint, mine && styles.mySecondaryText]}>{preview.description || url}</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row' },
  pinnedBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.primarySoft },
  pinnedCopy: { flex: 1, minHeight: 40, justifyContent: 'center' },
  pinnedText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  pinnedCount: { color: colors.muted, fontSize: 11 },
  composerTool: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  recordingBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surface },
  recordingText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  recordingButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6, backgroundColor: colors.surface },
  emojiPicker: { height: 210, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  emojiTabs: { gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  emojiTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  emojiTabSelected: { backgroundColor: colors.primarySoft },
  emojiTabText: { fontSize: 18 },
  emojiTabLabel: { color: colors.text, fontSize: 11 },
  emojiGridScroll: { flex: 1 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingHorizontal: spacing.sm },
  emojiButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 24 },
  imagePreview: { flex: 1, justifyContent: 'center', backgroundColor: '#050B12' },
  imagePreviewClose: { position: 'absolute', zIndex: 1, top: 48, right: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  imagePreviewContent: { width: '100%', height: '80%' },
  mentions: { maxHeight: 190, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  mention: { minHeight: 36, justifyContent: 'center' },
  mentionText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,37,51,0.35)' },
  loadOlder: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  loadOlderText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  sheet: { maxHeight: '75%', paddingHorizontal: spacing.md, paddingTop: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  sheetTitle: { marginBottom: spacing.sm, color: colors.text, fontSize: 17, fontWeight: '800' },
  sheetHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  sheetScroll: { maxHeight: 340 },
  sheetAction: { minHeight: 48, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sheetActionText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sheetDanger: { color: colors.danger },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  searchTypes: { gap: 6, paddingVertical: spacing.sm },
  searchType: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  searchTypeSelected: { backgroundColor: colors.primary },
  searchTypeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
  searchTypeTextSelected: { color: '#FFFFFF' },
  searchInput: { flex: 1, minHeight: 44, paddingHorizontal: spacing.sm, color: colors.text },
  searchResult: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  searchResultTitle: { marginBottom: 3, color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
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
  mediaBubble: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  deletedBubble: { backgroundColor: '#F2F5F6', borderColor: colors.border },
  sender: { marginBottom: 3, color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  content: { color: colors.text, fontSize: 14, lineHeight: 20 },
  contentLink: { color: colors.primaryDark, textDecorationLine: 'underline' },
  myContentLink: { color: '#FFFFFF' },
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
  mediaMeta: { marginTop: 3, paddingHorizontal: 2 },
  time: { color: colors.muted, fontSize: 9 },
  edited: { color: colors.muted, fontSize: 9, fontStyle: 'italic' },
  reaction: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reactionMine: { alignSelf: 'flex-end' },
  reactionText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  reactionPerson: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  reactionPersonName: { color: colors.text, fontSize: 14 },
  reactionPersonEmoji: { fontSize: 20 },
  attachmentImage: {
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  imageAttachment: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  mediaAttachmentCompact: { marginTop: 0 },
  imageFrame: { borderRadius: radius.md, overflow: 'hidden' },
  imageLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,37,51,0.35)' },
  imageRetry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  imageRetryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  imageRetryOther: { color: colors.primaryDark },
  attachmentError: { color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  highlightBubble: { borderWidth: 2, borderColor: '#F59E0B' },
  videoAttachment: { marginTop: spacing.sm, borderRadius: radius.md, overflow: 'hidden' },
  attachmentVideo: { backgroundColor: '#111827' },
  videoProgress: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  pendingFile: { minWidth: 210, maxWidth: 245, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  pendingFileTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pendingFileName: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  uploadTrack: { height: 5, marginTop: spacing.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  uploadFill: { height: '100%', borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  pendingFileStatus: { marginTop: spacing.xs, color: '#FFFFFF', fontSize: 10 },
  mediaAudio: { minWidth: 160, maxWidth: 220, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  linkPreview: { flexDirection: 'row', overflow: 'hidden', marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface },
  myLinkPreview: { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.15)' },
  linkImage: { width: 58, height: 58, backgroundColor: colors.border },
  linkCopy: { flex: 1, justifyContent: 'center', padding: spacing.xs },
  linkTitle: { color: colors.text, fontSize: 11, fontWeight: '700' },
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
  blockedHint: { paddingBottom: spacing.xs, color: colors.danger, fontSize: 11 },
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

