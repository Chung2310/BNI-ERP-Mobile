import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  AlertTriangle,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react-native";
import { Alert } from "@/components/AppAlert";
import { BackHeader } from "@/components/BackHeader";
import { EditMemberModal } from "@/components/EditMemberModal";
import { Avatar, Button, Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { userService } from "@/services/users";
import { chatService } from "@/services/chat";
import { colors, radius, spacing } from "@/theme/tokens";

const genderLabels = { male: "Nam", female: "Nữ", other: "Khác" } as const;

function formatBirthDate(value?: string) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  return Number.isNaN(+date)
    ? "Chưa cập nhật"
    : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: member, error, isLoading, reload } = useAsyncData(() => userService.get(id), id);

  const handleMessage = async () => {
    if (!member || isStartingChat) return;
    setIsStartingChat(true);
    try {
      const memberId = member.uid || id;
      const rooms = await chatService.rooms();
      const existing = rooms.find(
        (room) =>
          !room.isGroup &&
          room.members?.some((entry) => {
            const userId = entry.userId as string | { _id: string };
            return (typeof userId === "string" ? userId : userId?._id) === memberId;
          })
      );
      const room = existing || (await chatService.createRoom({ isGroup: false, memberIds: [memberId] }));
      if (!room?._id) throw new Error("Không thể mở cuộc trò chuyện.");
      router.push({ pathname: "/chat/[id]", params: { id: room._id, name: member.displayName } });
    } catch (cause) {
      Alert.alert("Không thể mở tin nhắn", friendlyErrorMessage(cause, "Vui lòng thử lại."));
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!member || isDeleting) return;
    setIsDeleting(true);
    try {
      const memberId = member.uid || id;
      await userService.delete(memberId);
      setShowDeleteModal(false);
      Alert.alert("Thành công", "Đã xóa thành viên khỏi hệ thống.");
      router.back();
    } catch (err) {
      Alert.alert("Lỗi", friendlyErrorMessage(err, "Không thể xóa thành viên."));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading)
    return (
      <Screen>
        <BackHeader title="Hồ sơ thành viên" compact />
        <LoadingState />
      </Screen>
    );
  if (error || !member)
    return (
      <Screen>
        <BackHeader title="Hồ sơ thành viên" compact />
        <ErrorState message={error || "Không tìm thấy thành viên."} onRetry={reload} />
      </Screen>
    );

  const initials = member.displayName
    .split(" ")
    .map((part: string) => part[0])
    .slice(-2)
    .join("")
    .toUpperCase();
  const raw = member as Record<string, unknown>;
  const company =
    (typeof raw.company === "string" ? raw.company : "") ||
    member.companyName ||
    (typeof raw.businessName === "string" ? raw.businessName : "") ||
    (typeof raw.tenDoanhNghiep === "string" ? raw.tenDoanhNghiep : "") ||
    member.companyCode ||
    member.branchName ||
    "Chưa cập nhật";
  const phone =
    member.phone ||
    (typeof raw.phoneNumber === "string" ? raw.phoneNumber : "") ||
    (typeof raw.phone_number === "string" ? raw.phone_number : "") ||
    (typeof raw.mobile === "string" ? raw.mobile : "") ||
    (typeof raw.sdt === "string" ? raw.sdt : "") ||
    "";
  const coverImage = member.coverImage || member.coverUrl;
  const galleryImages = (member.galleryImages || []).filter((url) => typeof url === "string" && url.trim());
  const gender = member.gender ? genderLabels[member.gender] : "Chưa cập nhật";

  const headerActions = (
    <View style={styles.headerActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Chỉnh sửa hồ sơ"
        hitSlop={8}
        onPress={() => setShowEditModal(true)}
        style={styles.headerActionBtn}
      >
        <Pencil size={18} color={colors.primaryDark} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xóa thành viên"
        hitSlop={8}
        onPress={() => setShowDeleteModal(true)}
        style={[styles.headerActionBtn, styles.headerDeleteBtn]}
      >
        <Trash2 size={18} color={colors.danger} />
      </Pressable>
    </View>
  );

  return (
    <Screen>
      <BackHeader title="Hồ sơ thành viên" compact action={headerActions} />

      <Card style={styles.profile}>
        {coverImage ? (
          <ImageBackground source={{ uri: coverImage }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.cover} />
        )}
        <Avatar initials={initials} url={member.photoURL} size={88} />
        <Text style={styles.name}>{member.displayName}</Text>
        <Text style={styles.role}>{company}</Text>
        <View style={styles.industryBadge}>
          <Text style={styles.industryText}>{member.industry || "Chưa cập nhật lĩnh vực"}</Text>
        </View>
      </Card>

      <View style={styles.actions}>
        {phone ? (
          <Button
            icon={Phone}
            iconColor={colors.primaryDark}
            tone="secondary"
            style={styles.actionButton}
            textStyle={styles.actionText}
            hitSlop={4}
            onPress={() => Linking.openURL("tel:" + phone)}
          >
            Gọi điện
          </Button>
        ) : null}
        <Button
          icon={Mail}
          iconColor={colors.primaryDark}
          tone="secondary"
          style={styles.actionButton}
          textStyle={styles.actionText}
          hitSlop={4}
          onPress={() => Linking.openURL("mailto:" + member.email)}
        >
          Email
        </Button>
        <Button
          icon={MessageCircle}
          iconColor={colors.primaryDark}
          tone="secondary"
          style={styles.actionButton}
          textStyle={styles.actionText}
          hitSlop={4}
          disabled={isStartingChat}
          onPress={() => void handleMessage()}
        >
          {isStartingChat ? "Đang mở" : "Nhắn tin"}
        </Button>
      </View>

      <Card style={styles.info}>
        <Info label="Công ty" value={company} />
        <Info label="Lĩnh vực" value={member.industry || "Chưa cập nhật"} />
        <Info label="Giới tính" value={gender} />
        <Info label="Ngày sinh" value={formatBirthDate(member.birthDate)} />
        <Info label="Email" value={member.email || "Chưa cập nhật"} />
        <Info label="Số điện thoại" value={phone || "Chưa cập nhật"} />
        <Info label="Địa chỉ" value={member.address || "Chưa cập nhật"} />
        <Info label="Thị trường mục tiêu" value={member.targetMarket || "Chưa cập nhật"} />
      </Card>

      <Card style={styles.galleryCard}>
        <Text style={styles.galleryTitle}>Ảnh sản phẩm hoặc hoạt động</Text>
        {galleryImages.length ? (
          <View style={styles.gallery}>
            {galleryImages.map((url, index) => (
              <Pressable
                key={url + index}
                accessibilityRole="imagebutton"
                accessibilityLabel={"Xem ảnh " + (index + 1)}
                style={styles.galleryItem}
                onPress={() => Linking.openURL(url)}
              >
                <Image source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.galleryEmpty}>Chưa cập nhật hình ảnh.</Text>
        )}
      </Card>

      {/* Modal chỉnh sửa thông tin */}
      <EditMemberModal
        visible={showEditModal}
        member={member}
        onClose={() => setShowEditModal(false)}
        onUpdated={() => reload()}
      />

      {/* Popup cảnh báo xóa thành viên */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !isDeleting && setShowDeleteModal(false)}
      >
        <View style={styles.deleteOverlay}>
          <Pressable
            accessibilityLabel="Đóng cảnh báo"
            style={styles.deleteBackdrop}
            onPress={() => !isDeleting && setShowDeleteModal(false)}
          />
          <View style={styles.deleteDialog}>
            <View style={styles.deleteIconWrap}>
              <AlertTriangle color={colors.danger} size={30} strokeWidth={2.2} />
            </View>
            <Text style={styles.deleteTitle}>Xác nhận xóa thành viên</Text>
            <Text style={styles.deleteDesc}>
              Bạn có chắc chắn muốn xóa thành viên{" "}
              <Text style={styles.deleteTargetName}>{member.displayName}</Text> khỏi hệ thống?{"\n"}
              Hành động này <Text style={styles.deleteHighlight}>không thể hoàn tác</Text>.
            </Text>
            <View style={styles.deleteActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isDeleting}
                onPress={() => setShowDeleteModal(false)}
                style={styles.deleteCancelBtn}
              >
                <Text style={styles.deleteCancelText}>Hủy bỏ</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isDeleting}
                onPress={handleDeleteMember}
                style={styles.deleteConfirmBtn}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Xác nhận xóa</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerDeleteBtn: {
    backgroundColor: "#FEE2E2",
  },
  profile: { alignItems: "center", overflow: "hidden", paddingTop: 0 },
  cover: { width: "130%", height: 86, marginBottom: -45, backgroundColor: colors.primarySoft },
  name: { marginTop: spacing.md, color: colors.text, fontSize: 19, fontWeight: "700", textAlign: "center" },
  role: { marginTop: spacing.xs, marginBottom: spacing.sm, color: colors.muted, fontSize: 12, textAlign: "center" },
  industryBadge: {
    alignSelf: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  industryText: { color: colors.primaryDark, fontSize: 12, fontWeight: "500", textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.xs },
  actionButton: { flex: 1, minHeight: 40, paddingHorizontal: spacing.xs },
  actionText: { fontSize: 12.5, fontWeight: "600" },
  info: { gap: spacing.sm },
  infoRow: {
    gap: 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 11.5, fontWeight: "400" },
  value: { color: colors.text, fontSize: 13, fontWeight: "400", lineHeight: 18 },
  galleryCard: { gap: spacing.md },
  galleryTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  galleryItem: {
    width: "48.5%",
    aspectRatio: 1.2,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  galleryImage: { width: "100%", height: "100%" },
  galleryEmpty: { color: colors.muted, fontSize: 12, textAlign: "center", paddingVertical: spacing.xl },
  deleteOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.lg,
  },
  deleteBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  deleteDialog: {
    width: "100%",
    maxWidth: 350,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  deleteIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  deleteTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  deleteDesc: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  deleteTargetName: {
    fontWeight: "700",
    color: colors.text,
  },
  deleteHighlight: {
    fontWeight: "700",
    color: colors.danger,
  },
  deleteActions: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  deleteCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  deleteConfirmBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
