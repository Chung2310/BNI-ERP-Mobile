import { router } from "expo-router";
import { Building2, Mail, Phone } from "lucide-react-native";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, Badge, Card } from "@/components/ui";
import { colors, radius, shadow, spacing } from "@/theme/tokens";
import type { MemberSummary } from "@/types";

export function MemberCard({ member }: { member: MemberSummary }) {
  const handleCall = (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (member.phone) {
      Linking.openURL(`tel:${member.phone}`);
    }
  };

  const handleEmail = (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (member.email) {
      Linking.openURL(`mailto:${member.email}`);
    }
  };

  return (
    <Pressable
      style={styles.wrapper}
      onPress={() => router.push({ pathname: "/member/[id]", params: { id: member.id } })}
    >
      <Card style={styles.card}>
        {/* Ảnh bìa */}
        <View style={styles.coverContainer}>
          {member.coverUrl ? (
            <Image source={{ uri: member.coverUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverBanner}>
              <View style={styles.coverPattern} />
            </View>
          )}
        </View>

        {/* Khối Header: Avatar + Tên & Vai trò & Lĩnh vực */}
        <View style={styles.headerRow}>
          <View style={styles.avatarWrapper}>
            <Avatar initials={member.initials} url={member.avatarUrl} size={64} />
          </View>
          <View style={styles.titleInfo}>
            <Text numberOfLines={1} style={styles.name}>
              {member.name}
            </Text>
            <View style={styles.badgeRow}>
              <Badge tone="primary">{member.industry || "Chưa cập nhật lĩnh vực"}</Badge>
            </View>
          </View>
        </View>

        {/* Danh sách thông tin chi tiết: Công ty, Email, SĐT */}
        <View style={styles.details}>
          <View style={styles.infoRow}>
            <Building2 size={16} color={colors.primary} />
            <Text numberOfLines={1} style={styles.infoText}>
              {member.company || "Chưa cập nhật công ty"}
            </Text>
          </View>

          {member.email ? (
            <Pressable onPress={handleEmail} style={styles.infoRow}>
              <Mail size={16} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.infoText, styles.linkText]}>
                {member.email}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.infoRow}>
              <Mail size={16} color={colors.muted} />
              <Text numberOfLines={1} style={styles.infoTextMuted}>
                Chưa cập nhật email
              </Text>
            </View>
          )}

          {member.phone ? (
            <Pressable onPress={handleCall} style={styles.infoRow}>
              <Phone size={16} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.infoText, styles.linkText]}>
                {member.phone}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.infoRow}>
              <Phone size={16} color={colors.muted} />
              <Text numberOfLines={1} style={styles.infoTextMuted}>
                Chưa cập nhật số điện thoại
              </Text>
            </View>
          )}
        </View>

        {/* Nút thao tác nhanh liên hệ */}
        {(member.phone || member.email) && (
          <View style={styles.actionRow}>
            {member.phone ? (
              <Pressable onPress={handleCall} style={[styles.actionBtn, styles.callBtn]}>
                <Phone size={14} color="#FFFFFF" />
                <Text style={styles.callBtnText}>Gọi điện</Text>
              </Pressable>
            ) : null}
            {member.email ? (
              <Pressable onPress={handleEmail} style={[styles.actionBtn, styles.emailBtn]}>
                <Mail size={14} color={colors.text} />
                <Text style={styles.emailBtnText}>Gửi email</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  card: { padding: 0, overflow: "hidden" },
  coverContainer: {
    width: "100%",
    height: 72,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverBanner: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primarySoft,
    justifyContent: "space-between",
  },
  coverPattern: {
    width: "100%",
    height: 4,
    backgroundColor: colors.primary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    marginTop: -32,
    gap: spacing.md,
  },
  avatarWrapper: {
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    ...shadow,
  },
  titleInfo: {
    flex: 1,
    paddingTop: 36,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  badgeRow: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
  },
  details: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  infoText: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },
  linkText: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
  infoTextMuted: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic",
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  callBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  callBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  emailBtn: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  emailBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
});
