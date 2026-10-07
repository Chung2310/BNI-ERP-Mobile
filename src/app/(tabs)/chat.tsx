import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppHeader, Avatar, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { chatService } from "@/services/chat";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

export default function ChatScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const { data, error, isLoading, reload } = useAsyncData(chatService.rooms);
  const rooms = useMemo(() => (data || []).filter((room) => (room.name || room.members.map((member) => member.userId.displayName).join(" ")).toLowerCase().includes(query.toLowerCase())), [data, query]);
  const roomName = (room: typeof rooms[number]) => room.name || room.members.find((member) => member.userId._id !== user?.uid)?.userId.displayName || "Cuộc trò chuyện";
  return (
    <Screen>
      <AppHeader title="Trò chuyện" subtitle={`${(data || []).reduce((sum, room) => sum + (room.unreadCount || 0), 0)} tin chưa đọc`} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Tìm cuộc trò chuyện..." placeholderTextColor={colors.muted} style={styles.search} />
      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : rooms.length === 0 ? <EmptyState title="Chưa có cuộc trò chuyện" message="Các cuộc trò chuyện của bạn sẽ xuất hiện tại đây." /> : <Card style={styles.list}>{rooms.map((room) => { const name = roomName(room); return <Pressable key={room._id} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: room._id, name } })} style={styles.room}><Avatar initials={name.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase()} /><View style={styles.grow}><Text style={styles.name}>{name}</Text><Text numberOfLines={1} style={styles.message}>{room.lastMessage?.content || "Chưa có tin nhắn"}</Text></View>{room.unreadCount ? <View style={styles.unread}><Text style={styles.unreadText}>{room.unreadCount}</Text></View> : null}</Pressable>; })}</Card>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text },
  list: { paddingVertical: 0 }, room: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, grow: { flex: 1 }, name: { color: colors.text, fontSize: 14, fontWeight: "800" }, message: { marginTop: 3, color: colors.muted, fontSize: 12 }, unread: { minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.primary }, unreadText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
});
