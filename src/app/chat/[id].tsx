import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { chatService } from "@/services/chat";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { data, setData, error, isLoading, reload } = useAsyncData(() => chatService.messages(id), id);
  useEffect(() => { void chatService.markRead(id).catch(() => undefined); }, [id]);
  const send = async () => { const content = message.trim(); if (!content || sending) return; setSending(true); try { const sent = await chatService.send(id, content); setData([...(data || []), sent]); setMessage(""); } finally { setSending(false); } };
  return (
    <Screen scroll={false}>
      <BackHeader title={name || "Trò chuyện"} />
      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <EmptyState title="Chưa có tin nhắn" message="Hãy bắt đầu cuộc trò chuyện." /> : <View style={styles.messages}>{data.map((item) => { const mine = (typeof item.senderId === "string" ? item.senderId : item.senderId._id) === user?.uid; return <View key={item._id} style={[styles.bubble, mine && styles.mine]}><Text style={[styles.sender, mine && styles.mineText]}>{mine ? "Bạn" : item.senderName}</Text><Text style={[styles.content, mine && styles.mineText]}>{item.content}</Text></View>; })}</View>}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.composer}><TextInput value={message} onChangeText={setMessage} onSubmitEditing={send} placeholder="Nhập tin nhắn..." placeholderTextColor={colors.muted} style={styles.input} /><Pressable accessibilityLabel="Gửi tin nhắn" onPress={send} disabled={sending} style={styles.send}>{sending ? <Text style={styles.sendText}>…</Text> : <Send color="#FFFFFF" size={20} />}</Pressable></KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ messages: { flex: 1, gap: spacing.sm }, bubble: { alignSelf: "flex-start", maxWidth: "84%", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, mine: { alignSelf: "flex-end", backgroundColor: colors.primary, borderColor: colors.primary }, sender: { color: colors.primaryDark, fontSize: 10, fontWeight: "800" }, content: { marginTop: 3, color: colors.text, fontSize: 13, lineHeight: 19 }, mineText: { color: "#FFFFFF" }, composer: { flexDirection: "row", gap: spacing.sm }, input: { flex: 1, minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md }, send: { minWidth: 64, minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primary }, sendText: { color: "#FFFFFF", fontWeight: "800" } });
