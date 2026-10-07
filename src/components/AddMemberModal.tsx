import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  CalendarDays,
  Camera,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  Upload,
  X,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
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
import { apiRequest } from "@/services/api";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";
import type { UserProfile } from "@/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (newUser: UserProfile) => void;
};

const GENDER_OPTIONS = [
  { key: "", label: "Chưa cập nhật" },
  { key: "male", label: "Nam" },
  { key: "female", label: "Nữ" },
  { key: "other", label: "Khác" },
] as const;

type ImageSource = "camera" | "library";
const MAX_GALLERY_IMAGES = 5;

export function AddMemberModal({ visible, onClose, onCreated }: Props) {
  // Ảnh bìa & avatar
  const [coverUrl, setCoverUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Thông tin văn bản
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [targetMarket, setTargetMarket] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Ngày sinh
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setCoverUrl("");
    setAvatarUrl("");
    setGalleryImages([]);
    setName("");
    setCompany("");
    setIndustry("");
    setGender("");
    setTargetMarket("");
    setAddress("");
    setEmail("");
    setPhone("");
    setPassword("");
    setBirthDate(null);
    setShowPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Upload helper
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

  // Chọn ảnh bìa
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
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể tải ảnh bìa.");
    } finally {
      setUploadingCover(false);
    }
  };

  // Chụp hoặc chọn ảnh đại diện
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
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể tải ảnh đại diện.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Chụp hoặc chọn nhiều ảnh sản phẩm / hoạt động
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
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể tải ảnh sản phẩm.");
    } finally {
      setUploadingGallery(false);
    }
  };

  const chooseImageSource = (target: "avatar" | "gallery") => {
    const pick = target === "avatar" ? pickAvatar : pickGallery;
    Alert.alert("Thêm ảnh", "Chọn nguồn ảnh", [
      { text: "Chụp ảnh", onPress: () => void pick("camera") },
      { text: "Chọn từ thư viện", onPress: () => void pick("library") },
      { text: "Hủy", style: "cancel" },
    ]);
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit form
  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedCompany = company.trim();
    const trimmedIndustry = industry.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập họ tên thành viên.");
      return;
    }
    if (!trimmedCompany) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên công ty / doanh nghiệp.");
      return;
    }
    if (!trimmedIndustry) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập lĩnh vực hoạt động.");
      return;
    }
    if (!trimmedEmail) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email đăng nhập.");
      return;
    }
    if (!trimmedPhone) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập số điện thoại.");
      return;
    }

    setLoading(true);
    try {
      const formattedBirthDate = birthDate ? birthDate.toISOString().split("T")[0] : undefined;

      const newUser = await userService.create({
        displayName: trimmedName,
        email: trimmedEmail,
        companyName: trimmedCompany,
        company: trimmedCompany,
        industry: trimmedIndustry,
        phone: trimmedPhone,
        password: password.trim() || undefined,
        gender: gender || "",
        targetMarket: targetMarket.trim() || undefined,
        address: address.trim() || undefined,
        birthDate: formattedBirthDate,
        photoURL: avatarUrl || undefined,
        coverUrl: coverUrl || undefined,
        coverImage: coverUrl || undefined,
        galleryImages: galleryImages.length > 0 ? galleryImages : undefined,
      });

      Alert.alert("Thành công", `Đã lưu thành viên "${trimmedName}".`);
      resetForm();
      onCreated(newUser);
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể lưu thành viên. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const initialLetter = (name.trim() || "T")[0].toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Thêm thành viên mới</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={handleClose}
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
                    <Text style={styles.uploadCoverText}>Tải ảnh bìa</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Avatar & Nút tải ảnh đại diện */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarLetter}>{initialLetter}</Text>
                )}
              </View>

              <View style={styles.avatarActionCol}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => chooseImageSource("avatar")}
                  disabled={uploadingAvatar}
                  style={styles.uploadAvatarBtn}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <>
                      <Upload size={13} color={colors.text} />
                      <Text style={styles.uploadAvatarText}>Tải ảnh đại diện</Text>
                    </>
                  )}
                </Pressable>
              </View>
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

            {/* Công ty / Doanh nghiệp * */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Công ty / Doanh nghiệp <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={company}
                onChangeText={setCompany}
                placeholder="Ví dụ: Công ty TNHH ABC"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            {/* Lĩnh vực hoạt động * */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Lĩnh vực hoạt động <Text style={styles.required}>*</Text>
              </Text>
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
                <View>
                  <Text style={styles.label}>Ảnh sản phẩm hoặc hoạt động</Text>
                  <Text style={styles.sublabel}>Tối đa {MAX_GALLERY_IMAGES} ảnh ({galleryImages.length}/{MAX_GALLERY_IMAGES})</Text>
                </View>
                {galleryImages.length < MAX_GALLERY_IMAGES ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => chooseImageSource("gallery")}
                    disabled={uploadingGallery}
                    style={styles.addPhotoBtn}
                  >
                    {uploadingGallery ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Plus size={14} color={colors.primary} />
                        <Text style={styles.addPhotoText}>Thêm ảnh</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>

              {galleryImages.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryList}>
                  {galleryImages.map((uri, index) => (
                    <View key={uri + index} style={styles.galleryItem}>
                      <Image source={{ uri }} style={styles.galleryImg} />
                      <Pressable
                        onPress={() => removeGalleryImage(index)}
                        style={styles.removeImgBtn}
                        hitSlop={6}
                      >
                        <X size={12} color="#FFFFFF" strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            {/* Giới tính */}
            <View style={styles.field}>
              <Text style={styles.label}>Giới tính</Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map((opt) => {
                  const active = gender === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setGender(opt.key as any)}
                      style={[styles.genderBtn, active && styles.genderBtnActive]}
                    >
                      <Text style={[styles.genderBtnText, active && styles.genderBtnTextActive]}>
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
                placeholder="Ví dụ: Doanh nghiệp vừa và nhỏ"
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

            {/* Email đăng nhập * */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Email đăng nhập <Text style={styles.required}>*</Text>
              </Text>
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

            {/* Số điện thoại * */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Số điện thoại <Text style={styles.required}>*</Text>
              </Text>
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
                <DateTimePicker
                  value={birthDate || new Date(1990, 0, 1)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  onChange={(_, selectedDate) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (selectedDate) setBirthDate(selectedDate);
                  }}
                />
              ) : null}
            </View>

            {/* Mật khẩu khởi tạo * */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Mật khẩu khởi tạo <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.muted} />
                  ) : (
                    <Eye size={18} color={colors.muted} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Nút hành động */}
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleClose}
                disabled={loading || uploadingAvatar || uploadingGallery || uploadingCover}
                style={[styles.btn, styles.cancelBtn]}
              >
                <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleSubmit}
                disabled={loading || uploadingAvatar || uploadingGallery || uploadingCover}
                style={[styles.btn, styles.submitBtn, (loading || uploadingAvatar || uploadingGallery || uploadingCover) && styles.disabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Lưu thành viên</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
    backgroundColor: "#0097B2",
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
    gap: spacing.md,
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
  avatarActionCol: {
    paddingBottom: 4,
    gap: 6,
    flex: 1,
  },
  uploadAvatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D9DF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  uploadAvatarText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.text,
  },
  field: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  sublabel: {
    fontSize: 11.5,
    color: colors.muted,
  },
  required: {
    color: colors.danger,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    fontSize: 13.5,
    color: colors.text,
  },
  textArea: {
    minHeight: 70,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  datePlaceholder: {
    color: colors.muted,
    fontSize: 13.5,
  },
  dateText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "500",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    minHeight: 42,
  },
  passwordInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.text,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  addPhotoText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "600",
  },
  galleryList: {
    gap: 8,
    paddingTop: 6,
  },
  galleryItem: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  galleryImg: {
    width: "100%",
    height: "100%",
  },
  removeImgBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  genderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: "#F2F5F8",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  genderBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  genderBtnText: {
    fontSize: 12.5,
    color: colors.muted,
    fontWeight: "500",
  },
  genderBtnTextActive: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D9DF",
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: colors.primary,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.6,
  },
});
