import { apiPostWithUploadProgress, apiRequest } from '@/services/api';
import * as FileSystem from 'expo-file-system/legacy';

export type ChatAttachment = { url: string; name: string; type: string; size?: number; uploadToken?: string };
export type ChatReaction = { emoji: string; userId: string | { _id: string } };
export type ChatLinkPreview = { url: string; title: string; description: string; image: string; siteName: string };

export type ChatMessage = {
  _id: string;
  senderName: string;
  senderId: string | { _id: string };
  content: string;
  createdAt: string;
  editedAt?: string;
  isDeleted?: boolean;
  attachments?: ChatAttachment[];
  reactions?: ChatReaction[];
  readBy?: string[];
  replyTo?: ChatMessage | string;
};

export type ChatRoomMember = {
  userId: { _id: string; displayName: string; email: string; photoURL?: string };
  role?: string;
  status?: string;
  isPinned?: boolean;
  canUploadDrive?: boolean;
};

export type ChatRoom = {
  _id: string;
  name?: string;
  isGroup: boolean;
  avatarURL?: string;
  onlyAdminsCanMessage?: boolean;
  pinnedMessageIds?: (string | ChatMessage)[];
  blockedBy?: string[];
  creatorId?: string;
  unreadCount?: number;
  lastMessage?: ChatMessage;
  members: ChatRoomMember[];
  createdAt?: string;
  updatedAt?: string;
};

type CreateRoomPayload = { isGroup: boolean; memberIds: string[]; name?: string };
const roomPath = (roomId: string) => '/api/v1/chat/rooms/' + encodeURIComponent(roomId);

export const chatService = {
  rooms: (): Promise<ChatRoom[]> =>
    apiRequest<{ data: ChatRoom[] } | ChatRoom[]>('/api/v1/chat/rooms').then((payload: any) => payload?.data || (Array.isArray(payload) ? payload : [])),
  createRoom: (body: CreateRoomPayload): Promise<ChatRoom> =>
    apiRequest<{ data: ChatRoom } | ChatRoom>('/api/v1/chat/rooms', { method: 'POST', body: JSON.stringify(body) }).then((payload: any) => payload?.data || payload),
  messages: (roomId: string) =>
    apiRequest<{ data: ChatMessage[] }>(roomPath(roomId) + '/messages?limit=50').then((payload) => payload.data || []),
  olderMessages: (roomId: string, beforeDate: string) =>
    apiRequest<{ data: ChatMessage[] }>(roomPath(roomId) + '/messages?limit=50&beforeDate=' + encodeURIComponent(beforeDate)).then((payload) => payload.data || []),
  room: (roomId: string) => apiRequest<{ data: ChatRoom }>(roomPath(roomId)).then((payload) => payload.data),
  send: (roomId: string, content: string, replyTo?: string, attachments: ChatAttachment[] = []) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages', {
      method: 'POST',
      body: JSON.stringify({ content, attachments, ...(replyTo ? { replyTo } : {}) }),
    }).then((payload) => payload.data),
  uploadAttachment: async (asset: { uri: string; name: string; mimeType?: string; size?: number; base64?: string }, onProgress: (fraction: number) => void = () => undefined): Promise<ChatAttachment> => {
    const type = asset.mimeType || 'application/octet-stream';
    onProgress(0);
    let base64 = asset.base64;
    let temporaryUri: string | null = null;
    if (!base64) try {
      let readableUri = asset.uri;
      if (asset.uri.startsWith('content://')) {
        if (!FileSystem.cacheDirectory) throw new Error('Không thể truy cập bộ nhớ tạm để tải tệp lên.');
        temporaryUri = `${FileSystem.cacheDirectory}chat-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await FileSystem.copyAsync({ from: asset.uri, to: temporaryUri });
        readableUri = temporaryUri;
      }
      try {
        base64 = await FileSystem.readAsStringAsync(readableUri, { encoding: FileSystem.EncodingType.Base64 });
      } catch (cause) {
        if (!FileSystem.cacheDirectory || temporaryUri) throw cause;
        temporaryUri = `${FileSystem.cacheDirectory}chat-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await FileSystem.copyAsync({ from: asset.uri, to: temporaryUri });
        base64 = await FileSystem.readAsStringAsync(temporaryUri, { encoding: FileSystem.EncodingType.Base64 });
      }
    } catch {
      throw new Error('Không đọc được tệp đã chọn. Hãy chọn lại tệp từ bộ nhớ thiết bị.');
    } finally {
      if (temporaryUri) await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    }
    if (!base64) throw new Error('Tệp đã chọn không có dữ liệu để gửi.');
    onProgress(0.05);
    const payload = await apiPostWithUploadProgress<{ url: string; uploadToken?: string }>(
      '/api/v1/media/upload',
      JSON.stringify({ file: `data:${type};base64,${base64}`, sourceType: 'chat.attachment', fileName: asset.name, mimeType: type, size: asset.size }),
      (fraction) => onProgress(0.05 + fraction * 0.9),
    );
    if (!payload.url) throw new Error('Máy chủ chưa trả về đường dẫn tệp. Vui lòng thử lại.');
    onProgress(0.95);
    return { url: payload.url, name: asset.name, type, size: asset.size, uploadToken: payload.uploadToken };
  },
  remove: (roomId: string, messageId: string) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages/' + encodeURIComponent(messageId), { method: 'DELETE' }).then((payload) => payload.data),
  react: (roomId: string, messageId: string, emoji: string) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages/' + encodeURIComponent(messageId) + '/react', {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }).then((payload) => payload.data),
  edit: (roomId: string, messageId: string, content: string) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages/' + encodeURIComponent(messageId), { method: 'PATCH', body: JSON.stringify({ content }) }).then((payload) => payload.data),
  pinMessage: (roomId: string, messageId: string, pinned: boolean) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + (pinned ? '/unpin' : '/pin'), { method: 'POST', body: JSON.stringify({ messageId }) }).then((payload) => payload.data),
  search: (roomId: string, query: string, type: 'all' | 'text' | 'link' | 'file' | 'media' = 'all') =>
    apiRequest<{ data: ChatMessage[] }>(roomPath(roomId) + '/search?type=' + type + '&query=' + encodeURIComponent(query)).then((payload) => payload.data || []),
  linkPreview: (url: string) =>
    apiRequest<{ data: ChatLinkPreview }>('/api/v1/chat/link-preview?url=' + encodeURIComponent(url)).then((payload) => payload.data),
  togglePinRoom: (roomId: string) => apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/toggle-pin', { method: 'POST' }).then((payload) => payload.data),
  updateRoom: (roomId: string, changes: { name?: string; avatarURL?: string; onlyAdminsCanMessage?: boolean }) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId), { method: 'PATCH', body: JSON.stringify(changes) }).then((payload) => payload.data),
  addMembers: (roomId: string, memberIds: string[]) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/members', { method: 'POST', body: JSON.stringify({ memberIds }) }).then((payload) => payload.data),
  removeMember: (roomId: string, userId: string) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/members/' + encodeURIComponent(userId), { method: 'DELETE' }).then((payload) => payload.data),
  updateMemberRole: (roomId: string, userId: string, role: 'admin' | 'deputy' | 'member') =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/members/' + encodeURIComponent(userId) + '/role', { method: 'POST', body: JSON.stringify({ role }) }).then((payload) => payload.data),
  transferAdmin: (roomId: string, newAdminId: string) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/transfer-admin', { method: 'POST', body: JSON.stringify({ newAdminId }) }).then((payload) => payload.data),
  leaveRoom: (roomId: string) => apiRequest(roomPath(roomId) + '/leave', { method: 'DELETE' }),
  deleteRoom: (roomId: string) => apiRequest(roomPath(roomId), { method: 'DELETE' }),
  setBlocked: (roomId: string, blocked: boolean) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/block', { method: 'PATCH', body: JSON.stringify({ blocked }) }).then((payload) => payload.data),
  markRead: (roomId: string) => apiRequest(roomPath(roomId) + '/read', { method: 'POST' }),
};
