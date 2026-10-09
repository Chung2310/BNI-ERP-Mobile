import type { PropsWithChildren } from 'react';
import { ChatUnreadCountContext } from '@/context/ChatUnreadCountContext';
import { useAuth } from '@/context/AuthContext';
import { useChatUnreadCount } from '@/hooks/useChatUnreadCount';

export function ChatUnreadCountProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const unreadCount = useChatUnreadCount(token);

  return <ChatUnreadCountContext.Provider value={unreadCount}>{children}</ChatUnreadCountContext.Provider>;
}
