import { friendlyErrorMessage } from "@/utils/userFacingError";
import { Alert } from "@/components/AppAlert";
import { useState } from "react";
import { router } from "expo-router";
import { MessageCircle, Phone } from "lucide-react-native";
import { ActivityIndicator,  Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui";
import { chatService, type ChatRoom } from "@/services/chat";
import { colors, radius, spacing } from "@/theme/tokens";
import type { MemberSummary } from "@/types";

export function MemberCard({ member }: { member: MemberSummary }) {
  const [isStartingChat, setIsStartingChat] = useState(false);

  const handleCall = () => {
    if (member.phone) {
      Linking.openURL(`tel:${member.phone}`);
    }
  };

  const handleMessage = async () => {
    if (isStartingChat) return;
    setIsStartingChat(true);
    try {
      // 1. Kiểm tra xem đã có phòng chat 1-1 với thành viên này chưa để mở thẳng
      const rooms = await chatService.rooms();
      const existing = rooms.find((r: ChatRoom) =>
        !r.isGroup &&
        r.members?.some((m: any) => {
          const uid = typeof m.userId === "string" ? m.userId : (m.userId?._id || m.userId?.uid);
          return uid === member.id;
        })
      );

      if (existing) {
        const roomId = existing._id || (existing as any).id;
        router.push({
          pathname: "/chat/[id]",
          params: { id: roomId, name: member.name },
        });
        return;
      }

      // 2. Nếu chưa có thì tạo phòng chat mới
      const result: any = await chatService.createRoom({
        isGroup: false,
        memberIds: [member.id],
      });
      const room = result?.data || result;
      const roomId = room?._id || room?.id;

      if (!roomId) {
        throw new Error("Không thể khởi tạo cuộc trò chuyện.");
      }

      router.push({
        pathname: "/chat/[id]",
        params: { id: roomId, name: member.name },
      });
    } catch (err) {
      Alert.alert("Lỗi", friendlyErrorMessage(err, "Không thể mở tin nhắn với thành viên này."));
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <View style={styles.item}>
      {/* Vùng thông tin thành viên (bấm vào để xem hồ sơ) */}
      <Pressable
        style={({ pressed }) => [styles.mainPressable, pressed && styles.mainPressed]}
        onPress={() => router.push({ pathname: "/member/[id]", params: { id: member.id } })}
      >
        <Avatar initials={member.initials} url={member.avatarUrl} size={38} />

        <View style={styles.infoCol}>
          <Text numberOfLines={1} style={styles.name}>
            {member.name}
          </Text>

          {member.company ? (
            <Text numberOfLines={1} style={styles.company}>
              {member.company}
            </Text>
          ) : null}

          {member.industry ? (
            <Text numberOfLines={1} style={styles.industry}>
              {member.industry}
            </Text>
          ) : null}

          {member.phone ? (
            <Pressable onPress={handleCall} hitSlop={6} style={styles.phoneRow}>
              <Phone size={11} color={colors.primaryDark} strokeWidth={2.2} />
              <Text numberOfLines={1} style={styles.phone}>
                {member.phone}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>

      {/* Nút mở tin nhắn độc lập (bấm vào mở thẳng hội thoại chat) */}
      <View style={styles.actionCol}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Nhắn tin với ${member.name}`}
          onPress={handleMessage}
          disabled={isStartingChat}
          hitSlop={8}
          style={({ pressed }) => [styles.chatBtn, pressed && styles.chatBtnPressed]}
        >
          {isStartingChat ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MessageCircle size={17} color={colors.primaryDark} strokeWidth={2.2} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
    flexDirection: "row",
    alignItems: "center",
  },
  mainPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  mainPressed: {
    opacity: 0.7,
  },
  infoCol: {
    flex: 1,
    gap: 1.5,
    justifyContent: "center",
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  company: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "500",
  },
  industry: {
    color: colors.primaryDark,
    fontSize: 11.5,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 1,
  },
  phone: {
    color: colors.primaryDark,
    fontSize: 11.5,
    fontWeight: "600",
  },
  actionCol: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: spacing.xs,
  },
  chatBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CDEEF5",
  },
  chatBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
});
