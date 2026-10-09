import { router, useFocusEffect } from "expo-router";
import {
  BriefcaseBusiness,
  Building2,
  Cake,
  LogOut,
  MapPin,
  Mail,
  Pencil,
  Phone,
  Settings,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Alert } from "@/components/AppAlert";
import { AppHeader, Avatar, Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { galleryImagesFrom, mediaUrl } from "@/utils/media";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";

const roleLabels: Record<UserProfile["role"], string> = {
  user: "Thành viên",
  teacher: "Giảng viên",
  manager: "Quản lý",
  branch_owner: "Chủ tịch Chapter",
  admin: "Quản trị viên",
};

function profileInitials(displayName?: string) {
  return (displayName || "Người dùng")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(-2)
    .join("")
    .toUpperCase();
}

function formatBirthDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
}

function genderLabel(gender?: UserProfile["gender"]) {
  if (gender === "male") return "Nam";
  if (gender === "female") return "Nữ";
  if (gender === "other") return "Khác";
  return undefined;
}

function companyLabel(user: UserProfile) {
  if (user.companyName) return user.companyName;
  if (typeof user.company === "string") return user.company;
  return user.company?.name;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon color={colors.primaryDark} size={18} strokeWidth={1.9} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text selectable style={[styles.infoValue, !value && styles.infoEmpty]}>
          {value || "Chưa cập nhật"}
        </Text>
      </View>
    </View>
  );
}

export default function PersonalScreen() {
  const { user, signOut, refreshProfile } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const userId = user?.uid;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      void refreshProfile().catch(() => undefined);
      return undefined;
    }, [refreshProfile, userId]),
  );

  const displayedProfile = user;
  if (!displayedProfile) return null;

  const role = roleLabels[displayedProfile.role];
  const branch = displayedProfile.branchName || displayedProfile.companyCode;
  const galleryImages = galleryImagesFrom(displayedProfile);

  const confirmSignOut = () => {
    if (isSigningOut) return;

    Alert.alert("Đăng xuất?", "Bạn có chắc muốn đăng xuất khỏi tài khoản này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: () => {
          setIsSigningOut(true);
          void signOut()
            .catch(() => undefined)
            .finally(() => router.replace("/login"));
        },
      },
    ]);
  };

  return (
    <Screen style={styles.screen}>
      <AppHeader title="Cá nhân" subtitle="Thông tin tài khoản của bạn" />

      <Card style={styles.heroCard}>
        <Avatar initials={profileInitials(displayedProfile.displayName)} url={displayedProfile.photoURL} size={78} />
        <Text numberOfLines={1} style={styles.name}>{displayedProfile.displayName}</Text>
        <Text numberOfLines={1} style={styles.role}>{role}</Text>
        {branch ? <Text numberOfLines={1} style={styles.branch}>{branch}</Text> : null}
      </Card>

      <View style={styles.actions}>
        <Button
          icon={Pencil}
          style={styles.actionButton}
          onPress={() => router.push({ pathname: "/profile", params: { edit: "profile" } })}
        >
          Chỉnh sửa hồ sơ
        </Button>
        <Button
          icon={Settings}
          tone="secondary"
          style={styles.actionButton}
          onPress={() => router.push("/settings")}
        >
          Cài đặt
        </Button>
      </View>

      <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
      <Card style={styles.infoCard}>
        <InfoRow icon={Mail} label="Email" value={displayedProfile.email} />
        <InfoRow icon={Phone} label="Số điện thoại" value={displayedProfile.phone || displayedProfile.phoneNumber} />
        <InfoRow icon={Cake} label="Ngày sinh" value={formatBirthDate(displayedProfile.birthDate)} />
        <InfoRow icon={UserRound} label="Giới tính" value={genderLabel(displayedProfile.gender)} />
        <InfoRow icon={MapPin} label="Địa chỉ" value={displayedProfile.address} />
      </Card>

      <Text style={styles.sectionTitle}>Thông tin công việc</Text>
      <Card style={styles.infoCard}>
        <InfoRow icon={Building2} label="Công ty" value={companyLabel(displayedProfile)} />
        <InfoRow icon={BriefcaseBusiness} label="Lĩnh vực" value={displayedProfile.industry} />
        <InfoRow icon={Target} label="Thị trường mục tiêu" value={displayedProfile.targetMarket} />
      </Card>

      <Text style={styles.sectionTitle}>Ảnh sản phẩm hoặc hoạt động</Text>
      <Card style={styles.galleryCard}>
        {galleryImages.length ? (
          <View style={styles.galleryGrid}>
            {galleryImages.map((image, index) => (
              <View key={`${image}-${index}`} style={styles.galleryItem}>
                <Image
                  accessibilityLabel={`Ảnh sản phẩm hoặc hoạt động ${index + 1}`}
                  source={{ uri: mediaUrl(image) }}
                  style={styles.galleryImage}
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.galleryEmpty}>Chưa cập nhật hình ảnh.</Text>
        )}
      </Card>

      <Button
        icon={LogOut}
        tone="danger"
        fullWidth
        disabled={isSigningOut}
        style={styles.signOutButton}
        onPress={confirmSignOut}
      >
        {isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.md,
  },
  heroCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    borderRadius: radius.xl,
  },
  name: {
    marginTop: spacing.md,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  role: {
    marginTop: spacing.xs,
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  branch: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  infoCard: {
    paddingVertical: spacing.xs,
  },
  infoRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 11.5,
  },
  infoValue: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 19,
  },
  infoEmpty: {
    color: colors.muted,
    fontWeight: "400",
  },
  galleryCard: {
    gap: spacing.md,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  galleryItem: {
    width: "31.5%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  galleryImage: {
    width: "100%",
    height: "100%",
  },
  galleryEmpty: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  signOutButton: {
    marginTop: spacing.md,
  },
});
