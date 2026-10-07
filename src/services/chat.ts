import { apiRequest } from "@/services/api";

export type ChatMessage = { _id: string; senderName: string; senderId: string | { _id: string }; content: string; createdAt: string };
export type ChatRoom = { _id: string; name?: string; isGroup: boolean; avatarURL?: string; unreadCount?: number; lastMessage?: ChatMessage; members: { userId: { _id: string; displayName: string; email: string; photoURL?: string } }[] };

export const chatService = {
  rooms: () => apiRequest<{ data: ChatRoom[] }>("/api/v1/chat/rooms").then((payload) => payload.data || []),
  messages: (roomId: string) => apiRequest<{ data: ChatMessage[] }>(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/messages?limit=50`).then((payload) => payload.data || []),
  send: (roomId: string, content: string) => apiRequest<{ data: ChatMessage }>(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/messages`, { method: "POST", body: JSON.stringify({ content }) }).then((payload) => payload.data),
  markRead: (roomId: string) => apiRequest(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/read`, { method: "POST" }),
};
