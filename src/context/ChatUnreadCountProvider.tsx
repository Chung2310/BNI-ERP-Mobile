import type { PropsWithChildren } from 'react';
import { ChatUnreadCountContext } from '@/context/ChatUnreadCountContext';
import { useAuth } from '@/context/AuthContext';
import { useChatUnreadCount } from '@/hooks/useChatUnreadCount';
import { isChapterGuest } from '@/utils/guest';

export function ChatUnreadCountProvider({ children }: PropsWithChildren) {
  const { token, user } = useAuth();
  const unreadCount = useChatUnreadCount(isChapterGuest(user) ? null : token);

  return <ChatUnreadCountContext.Provider value={unreadCount}>{children}</ChatUnreadCountContext.Provider>;
}
