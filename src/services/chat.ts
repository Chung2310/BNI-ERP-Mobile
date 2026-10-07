import { apiRequest } from '@/services/api';

export type ChatAttachment = { url: string; name?: string; type?: string };
export type ChatReaction = { emoji: string; userId: string | { _id: string } };

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
  replyTo?: ChatMessage | string;
};

export type ChatRoomMember = {
  userId: { _id: string; displayName: string; email: string; photoURL?: string };
  role?: string;
  status?: string;
  isPinned?: boolean;
};

export type ChatRoom = {
  _id: string;
  name?: string;
  isGroup: boolean;
  avatarURL?: string;
  unreadCount?: number;
  lastMessage?: ChatMessage;
  members: ChatRoomMember[];
  createdAt?: string;
  updatedAt?: string;
};

type CreateRoomPayload = { isGroup: boolean; memberIds: string[]; name?: string };
const roomPath = (roomId: string) => '/api/v1/chat/rooms/' + encodeURIComponent(roomId);

export const chatService = {
  rooms: () => apiRequest<{ data: ChatRoom[] }>('/api/v1/chat/rooms').then((payload) => payload.data || []),
  createRoom: (body: CreateRoomPayload) =>
    apiRequest<{ data: ChatRoom }>('/api/v1/chat/rooms', { method: 'POST', body: JSON.stringify(body) }).then((payload) => payload.data),
  messages: (roomId: string) =>
    apiRequest<{ data: ChatMessage[] }>(roomPath(roomId) + '/messages?limit=50').then((payload) => payload.data || []),
  send: (roomId: string, content: string, replyTo?: string) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages', {
      method: 'POST',
      body: JSON.stringify({ content, ...(replyTo ? { replyTo } : {}) }),
    }).then((payload) => payload.data),
  remove: (roomId: string, messageId: string) =>
    apiRequest<{ data?: ChatMessage }>(roomPath(roomId) + '/messages/' + encodeURIComponent(messageId), { method: 'DELETE' }),
  react: (roomId: string, messageId: string, emoji: string) =>
    apiRequest<{ data: ChatMessage }>(roomPath(roomId) + '/messages/' + encodeURIComponent(messageId) + '/react', {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }).then((payload) => payload.data),
  markRead: (roomId: string) => apiRequest(roomPath(roomId) + '/read', { method: 'POST' }),
};
