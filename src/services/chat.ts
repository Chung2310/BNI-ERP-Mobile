import { apiRequest } from '@/services/api';

export type ChatAttachment = {
  url: string;
  name?: string;
  type?: string;
  size?: number;
  uploadToken?: string;
};
export type ChatReaction = { emoji: string; userId: string | { _id: string } };

export type ChatMessage = {
  _id: string;
  senderName: string;
  senderId: string | { _id: string };
  content: string;
  createdAt: string;
  roomId?: string;
  senderPhoto?: string;
  readBy?: string[];
  editedAt?: string;
  isDeleted?: boolean;
  attachments?: ChatAttachment[];
  reactions?: ChatReaction[];
  replyTo?: ChatMessage | string;
};

export type ChatRoomMember = {
  userId: { _id: string; uid?: string; displayName: string; email: string; photoURL?: string; status?: 'online' | 'offline' };
  role?: 'admin' | 'deputy' | 'member';
  status?: string;
  isPinned?: boolean;
  joinedAt?: string;
};

export type ChatRoom = {
  _id: string;
  name?: string;
  isGroup: boolean;
  avatarURL?: string;
  unreadCount?: number;
  lastMessage?: ChatMessage;
  members: ChatRoomMember[];
  creatorId?: string;
  blockedBy?: string[];
  pinnedMessageIds?: (string | ChatMessage)[];
  onlyAdminsCanMessage?: boolean;
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
  send: (roomId: string, content: string, replyTo?: string, attachments: ChatAttachment[] = []) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages', {
      method: 'POST',
      body: JSON.stringify({ content, attachments, ...(replyTo ? { replyTo } : {}) }),
    }).then((payload) => payload.data),
  room: (roomId: string) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId)).then((payload) => payload.data),
  updateRoom: (roomId: string, body: { name?: string; avatarURL?: string; onlyAdminsCanMessage?: boolean }) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId), { method: 'PATCH', body: JSON.stringify(body) }).then((payload) => payload.data),
  addMembers: (roomId: string, memberIds: string[]) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/members', {
      method: 'POST',
      body: JSON.stringify({ memberIds }),
    }).then((payload) => payload.data),
  removeMember: (roomId: string, userId: string) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/members/' + encodeURIComponent(userId), { method: 'DELETE' }).then((payload) => payload.data),
  updateMemberRole: (roomId: string, userId: string, role: 'admin' | 'deputy' | 'member') =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/members/' + encodeURIComponent(userId) + '/role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }).then((payload) => payload.data),
  leaveRoom: (roomId: string) => apiRequest(roomPath(roomId) + '/leave', { method: 'DELETE' }),
  deleteRoom: (roomId: string) => apiRequest(roomPath(roomId), { method: 'DELETE' }),
  setBlocked: (roomId: string, blocked: boolean) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/block', {
      method: 'PATCH',
      body: JSON.stringify({ blocked }),
    }).then((payload) => payload.data),
  togglePinRoom: (roomId: string) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/toggle-pin', { method: 'POST' }).then((payload) => payload.data),
  uploadAttachment: (file: { base64: string; name: string; type: string; size?: number }) =>
    apiRequest<{ url: string; uploadToken?: string }>('/api/v1/media/upload', {
      method: 'POST',
      body: JSON.stringify({
        file: 'data:' + file.type + ';base64,' + file.base64,
        sourceType: 'chat.attachment',
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      }),
    }).then((payload) => ({
      url: payload.url,
      uploadToken: payload.uploadToken,
      name: file.name,
      type: file.type,
      size: file.size,
    })),
  remove: (roomId: string, messageId: string) =>
    apiRequest<{ data?: ChatMessage }>(roomPath(roomId) + '/messages/' + encodeURIComponent(messageId), { method: 'DELETE' }),
  react: (roomId: string, messageId: string, emoji: string) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages/' + encodeURIComponent(messageId) + '/react', {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }).then((payload) => payload.data),
  edit: (roomId: string, messageId: string, content: string) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages/' + encodeURIComponent(messageId), {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }).then((payload) => payload.data),
  pinMessage: (roomId: string, messageId: string) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/pin', {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    }).then((payload) => payload.data),
  unpinMessage: (roomId: string, messageId: string) =>
    apiRequest<{ data: ChatRoom }>(roomPath(roomId) + '/unpin', {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    }).then((payload) => payload.data),
  search: (roomId: string, query: string, type: 'text' | 'link' | 'file' | 'media' | 'all' = 'all') =>
    apiRequest<{ data: ChatMessage[] }>(
      roomPath(roomId) + '/search?type=' + encodeURIComponent(type) + '&query=' + encodeURIComponent(query),
    ).then((payload) => payload.data || []),
  markRead: (roomId: string) => apiRequest(roomPath(roomId) + '/read', { method: 'POST' }),
};
