import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  CalendarDays,
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert } from "@/components/AppAlert";
import { RoundedDateTimePicker } from "@/components/RoundedDateTimePicker";
import { apiRequest } from "@/services/api";
import { userService } from "@/services/users";
import { galleryImagesFrom, mediaUrl } from "@/utils/media";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";

type Props = {
  visible: boolean;
  member: UserProfile;
  onClose: () => void;
  onUpdated: (updatedUser: UserProfile) => void;
};

const GENDER_OPTIONS = [
  { key: "", label: "Chưa cập nhật" },
  { key: "male", label: "Nam" },
  { key: "female", label: "Nữ" },
  { key: "other", label: "Khác" },
] as const;

type ImageSource = "camera" | "library";
const MAX_GALLERY_IMAGES = 5;

export function EditMemberModal({ visible, member, onClose, onUpdated }: Props) {
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <EditMemberContent
        key={`${member.uid || "member"}-${visible ? "1" : "0"}`}
        member={member}
        onClose={onClose}
        onUpdated={onUpdated}
      />
    </Modal>
  );
}

function EditMemberContent({ member, onClose, onUpdated }: Omit<Props, "visible">) {
  const raw = member as Record<string, unknown>;
  const initialCompany =
    (typeof raw.company === "string" ? raw.company : "") ||
    member.companyName ||
    (typeof raw.businessName === "string" ? raw.businessName : "") ||
    (typeof raw.tenDoanhNghiep === "string" ? raw.tenDoanhNghiep : "") ||
    "";
  const initialPhone =
    member.phone ||
    (typeof raw.phoneNumber === "string" ? raw.phoneNumber : "") ||
    (typeof raw.mobile === "string" ? raw.mobile : "") ||
    "";

  const [coverUrl, setCoverUrl] = useState(mediaUrl(member.coverImage || member.coverUrl || ""));
  const [avatarUrl, setAvatarUrl] = useState(mediaUrl(member.photoURL || ""));
  const [galleryImages, setGalleryImages] = useState<string[]>(() =>
    galleryImagesFrom(member)
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [imageSourceTarget, setImageSourceTarget] = useState<"avatar" | "gallery" | null>(null);

  const [name, setName] = useState(member.displayName || "");
  const [company, setCompany] = useState(initialCompany);
  const [industry, setIndustry] = useState(member.industry || "");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">((member.gender as any) || "");
  const [targetMarket, setTargetMarket] = useState(member.targetMarket || "");
  const [address, setAddress] = useState(member.address || "");
  const [email, setEmail] = useState(member.email || "");
  const [phone, setPhone] = useState(initialPhone);
  const [birthDate, setBirthDate] = useState<Date | null>(() => (member.birthDate ? new Date(member.birthDate) : null));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [loading, setLoading] = useState(false);

  const uploadImage = async (base64: string, folder: string): Promise<string> => {
    try {
      const res = await apiRequest<{ url: string }>("/api/v1/media/upload", {
        method: "POST",
        body: JSON.stringify({ file: `data:image/jpeg;base64,${base64}`, folder }),
      });
      return res.url;
    } catch {
      return `data:image/jpeg;base64,${base64}`;
    }
  };

  const pickCover = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Quyền truy cập", "Vui lòng cấp quyền thư viện ảnh để chọn ảnh bìa.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
        base64: true,
      });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      setUploadingCover(true);
      const url = asset.base64 ? await uploadImage(asset.base64, "igen_erp/members/covers") : asset.uri;
      setCoverUrl(url);
    } catch (err) {
      Alert.alert("Lỗi", friendlyErrorMessage(err, "Không thể tải ảnh bìa."));
    } finally {
      setUploadingCover(false);
    }
  };

  const pickAvatar = async (source: ImageSource) => {
    setUploadingAvatar(true);
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Quyền truy cập", `Vui lòng cấp quyền ${source === "camera" ? "camera" : "thư viện ảnh"} để thêm ảnh đại diện.`);
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      const url = asset.base64 ? await uploadImage(asset.base64, "igen_erp/members/avatars") : asset.uri;
      setAvatarUrl(url);
    } catch (err) {
      Alert.alert("Lỗi", friendlyErrorMessage(err, "Không thể tải ảnh đại diện."));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickGallery = async (source: ImageSource) => {
    const remaining = MAX_GALLERY_IMAGES - galleryImages.length;
    if (remaining <= 0) {
      Alert.alert("Giới hạn ảnh", "Bạn chỉ có thể tải lên tối đa 5 ảnh hoạt động/sản phẩm.");
      return;
    }
    setUploadingGallery(true);
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Quyền truy cập", `Vui lòng cấp quyền ${source === "camera" ? "camera" : "thư viện ảnh"} để thêm ảnh sản phẩm.`);
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsMultipleSelection: source === "library",
        selectionLimit: remaining,
        quality: 0.85,
        base64: true,
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets.length) return;
      if (res.assets.length > remaining) {
        Alert.alert("Giới hạn ảnh", `Bạn chỉ có thể chọn thêm ${remaining} ảnh.`);
        return;
      }
      const urls: string[] = [];
      for (const asset of res.assets) {
        urls.push(asset.base64 ? await uploadImage(asset.base64, "igen_erp/members/gallery") : asset.uri);
      }
      setGalleryImages((prev) => [...prev, ...urls].slice(0, MAX_GALLERY_IMAGES));
    } catch (err) {
      Alert.alert("Lỗi", friendlyErrorMessage(err, "Không thể tải ảnh sản phẩm."));
    } finally {
      setUploadingGallery(false);
    }
  };

  const chooseImageSource = (target: "avatar" | "gallery") => {
    setImageSourceTarget(target);
  };

  const selectImageSource = (source: ImageSource) => {
    const target = imageSourceTarget;
    setImageSourceTarget(null);
    if (target === "avatar") void pickAvatar(source);
    if (target === "gallery") void pickGallery(source);
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập họ tên thành viên.");
      return;
    }

    setLoading(true);
    try {
      const memberId = member.uid || (member as any)._id;
      const updated = await userService.update(memberId, {
        displayName: trimmedName,
        companyName: company.trim() || undefined,
        company: company.trim() || undefined,
        industry: industry.trim() || undefined,
        gender: gender || undefined,
        targetMarket: targetMarket.trim() || undefined,
        address: address.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        birthDate: birthDate ? birthDate.toISOString() : undefined,
        photoURL: avatarUrl || undefined,
        coverUrl: coverUrl || undefined,
        coverImage: coverUrl || undefined,
        galleryImages,
      });

      Alert.alert("Thành công", "Đã cập nhật hồ sơ thành viên.");
      onUpdated(updated);
      onClose();
    } catch (err) {
      Alert.alert("Lỗi lưu thông tin", friendlyErrorMessage(err, "Không thể cập nhật thành viên."));
    } finally {
      setLoading(false);
    }
  };

  const initialLetter = (name.trim() || "T")[0].toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Chỉnh sửa hồ sơ thành viên</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={onClose}
              hitSlop={8}
              style={styles.closeBtn}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Banner ảnh bìa */}
            <View style={styles.bannerContainer}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.bannerImage} resizeMode="cover" />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <ImageIcon size={28} color="#FFFFFF" strokeWidth={1.8} />
                  <Text style={styles.bannerPlaceholderText}>Ảnh bìa thành viên</Text>
                </View>
              )}

              {/* Nút tải ảnh bìa */}
              <Pressable
                accessibilityRole="button"
                onPress={pickCover}
                disabled={uploadingCover}
                style={styles.uploadCoverBtn}
              >
                {uploadingCover ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Camera size={14} color="#FFFFFF" />
                    <Text style={styles.uploadCoverText}>Đổi ảnh bìa</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Avatar - Chạm vào avatar để chọn/chụp ảnh */}
            <View style={styles.avatarSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đổi ảnh đại diện"
                onPress={() => chooseImageSource("avatar")}
                disabled={uploadingAvatar}
                hitSlop={6}
                style={({ pressed }) => [styles.avatarWrapper, pressed && styles.avatarPressed]}
              >
                <View style={styles.avatarCircle}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarLetter}>{initialLetter}</Text>
                  )}
                  {uploadingAvatar ? (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
                <View style={styles.avatarBadge}>
                  <Camera size={13} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>

            {/* Họ tên thành viên * */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Họ tên thành viên <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ví dụ: Nguyễn Văn A"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            {/* Công ty / Doanh nghiệp */}
            <View style={styles.field}>
              <Text style={styles.label}>Công ty / Doanh nghiệp</Text>
              <TextInput
                value={company}
                onChangeText={setCompany}
                placeholder="Ví dụ: Công ty TNHH ABC"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            {/* Lĩnh vực hoạt động */}
            <View style={styles.field}>
              <Text style={styles.label}>Lĩnh vực hoạt động</Text>
              <TextInput
                value={industry}
                onChangeText={setIndustry}
                placeholder="Ví dụ: Bất động sản, Thiết kế nội thất"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            {/* Ảnh sản phẩm hoặc hoạt động (Tối đa 5 ảnh) */}
            <View style={styles.field}>
              <View style={styles.galleryHeader}>
                <Text style={styles.label}>Ảnh sản phẩm hoặc hoạt động</Text>
                <Text style={styles.galleryCounter}>
                  {galleryImages.length}/{MAX_GALLERY_IMAGES}
                </Text>
              </View>

              <View style={styles.galleryGrid}>
                {galleryImages.map((img, index) => (
                  <View key={`${img}-${index}`} style={styles.galleryItem}>
                    <Image source={{ uri: mediaUrl(img) }} style={styles.galleryThumb} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xóa ảnh"
                      onPress={() => removeGalleryImage(index)}
                      style={styles.removeImageBtn}
                    >
                      <Trash2 size={12} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}

                {galleryImages.length < MAX_GALLERY_IMAGES ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Thêm ảnh hoạt động"
                    onPress={() => chooseImageSource("gallery")}
                    disabled={uploadingGallery}
                    style={styles.addGalleryBtn}
                  >
                    {uploadingGallery ? (
                      <ActivityIndicator size="small" color={colors.primaryDark} />
                    ) : (
                      <>
                        <Plus size={20} color={colors.primaryDark} />
                        <Text style={styles.addGalleryText}>Thêm ảnh</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Giới tính */}
            <View style={styles.field}>
              <Text style={styles.label}>Giới tính</Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map((opt) => {
                  const isSelected = gender === opt.key;
                  return (
                    <Pressable
                      key={opt.key || "default"}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setGender(opt.key)}
                      style={[
                        styles.genderOption,
                        isSelected && styles.genderOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          isSelected && styles.genderOptionTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Thị trường mục tiêu */}
            <View style={styles.field}>
              <Text style={styles.label}>Thị trường mục tiêu</Text>
              <TextInput
                value={targetMarket}
                onChangeText={setTargetMarket}
                placeholder="Ví dụ: Doanh nghiệp B2B, Khách hàng cá nhân"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            {/* Địa chỉ */}
            <View style={styles.field}>
              <Text style={styles.label}>Địa chỉ</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Nhập địa chỉ"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea]}
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="admin@bni.vn"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            {/* Số điện thoại */}
            <View style={styles.field}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="09XXXXXXXX"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>

            {/* Ngày sinh */}
            <View style={styles.field}>
              <Text style={styles.label}>Ngày sinh</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={[styles.input, styles.dateInput]}
              >
                <CalendarDays size={18} color={colors.muted} />
                <Text style={birthDate ? styles.dateText : styles.datePlaceholder}>
                  {birthDate
                    ? `${String(birthDate.getDate()).padStart(2, "0")}/${String(birthDate.getMonth() + 1).padStart(2, "0")}/${birthDate.getFullYear()}`
                    : "Chọn ngày sinh..."}
                </Text>
              </Pressable>

              {showDatePicker ? (
                <RoundedDateTimePicker
                  visible
                  variant="bottomSheet"
                  title="Chọn ngày sinh"
                  value={birthDate || new Date(1990, 0, 1)}
                  mode="date"
                  maximumDate={new Date()}
                  onCancel={() => setShowDatePicker(false)}
                  onConfirm={(selectedDate) => {
                    setBirthDate(selectedDate);
                    setShowDatePicker(false);
                  }}
                />
              ) : null}
            </View>

            {/* Nút hành động */}
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                disabled={loading || uploadingAvatar || uploadingGallery || uploadingCover}
                style={[styles.btn, styles.cancelBtn]}
              >
                <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleSubmit}
                disabled={loading || uploadingAvatar || uploadingGallery || uploadingCover}
                style={[
                  styles.btn,
                  styles.submitBtn,
                  (loading || uploadingAvatar || uploadingGallery || uploadingCover) && styles.disabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Lưu thay đổi</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal nguồn ảnh */}
        {imageSourceTarget ? (
          <View style={styles.imageSourceOverlay}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng chọn nguồn ảnh"
              onPress={() => setImageSourceTarget(null)}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.imageSourcePopup}>
              <Text style={styles.imageSourceTitle}>Thêm ảnh</Text>
              <Text style={styles.imageSourceDescription}>Chọn nguồn ảnh</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => selectImageSource("camera")}
                style={styles.imageSourceOption}
              >
                <Camera color={colors.primaryDark} size={20} />
                <Text style={styles.imageSourceOptionText}>Chụp ảnh</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => selectImageSource("library")}
                style={styles.imageSourceOption}
              >
                <ImageIcon color={colors.primaryDark} size={20} />
                <Text style={styles.imageSourceOptionText}>Chọn từ thư viện</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setImageSourceTarget(null)}
                style={styles.imageSourceCancel}
              >
                <Text style={styles.imageSourceCancelText}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  keyboardView: {
    flex: 1,
  },
  imageSourceOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay,
  },
  imageSourcePopup: {
    width: "88%",
    maxWidth: 360,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  imageSourceTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  imageSourceDescription: { color: colors.muted, fontSize: 12, marginBottom: spacing.xs },
  imageSourceOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  imageSourceOptionText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  imageSourceCancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  imageSourceCancelText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
  },
  title: {
    fontSize: 16.5,
    fontWeight: "800",
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F6F8",
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  bannerContainer: {
    width: "100%",
    height: 120,
    backgroundColor: "#00ADFC",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bannerPlaceholderText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  uploadCoverBtn: {
    position: "absolute",
    top: 10,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  uploadCoverText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "600",
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    marginTop: -30,
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarPressed: {
    opacity: 0.85,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  required: {
    color: colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: "#F8FAFC",
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  galleryCounter: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  galleryItem: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 3,
    right: 3,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addGalleryBtn: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addGalleryText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primaryDark,
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
  },
  genderOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  genderOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
  },
  genderOptionTextSelected: {
    fontWeight: "700",
    color: colors.primaryDark,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: colors.text,
  },
  datePlaceholder: {
    fontSize: 14,
    color: colors.muted,
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#F1F5F9",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  submitBtn: {
    backgroundColor: colors.brandBlue,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.6,
  },
});
