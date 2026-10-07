import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Building2, Camera, ImagePlus, Mail, MapPin, Pencil, Phone, Save, Trash2, UserRound, X } from "lucide-react-native";
import { Alert, Image, ImageBackground, Linking, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { DateTimeField } from "@/components/DateTimeField";
import { Avatar, Badge, Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService, type ProfileUpdateInput } from "@/services/auth";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { UserProfile } from "@/types";

type ProfileForm = {
  displayName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: "" | "male" | "female" | "other";
  companyName: string;
  industry: string;
  address: string;
  targetMarket: string;
  photoURL: string;
  coverImage: string;
  galleryImages: string[];
};

const genderLabels = { male: "Nam", female: "Nữ", other: "Khác" } as const;
const genderOptions: { value: ProfileForm["gender"]; label: string }[] = [
  { value: "", label: "Không khai báo" },
  { value: "male", label: genderLabels.male },
  { value: "female", label: genderLabels.female },
  { value: "other", label: genderLabels.other },
];
const roleLabels: Record<string, string> = {
  admin: "Quản trị viên",
  branch_owner: "Chủ tịch / Trưởng Chapter",
  manager: "Ban điều hành / Quản lý",
  teacher: "Điều phối viên",
  user: "Thành viên BNI",
};

function valuesFrom(user: UserProfile): ProfileForm {
  return {
    displayName: user.displayName || "",
    email: user.email || "",
    phone: user.phone || user.phoneNumber || "",
    birthDate: user.birthDate?.slice(0, 10) || "",
    gender: user.gender || "",
    companyName: user.companyName || (typeof user.company === "string" ? user.company : user.company?.name) || "",
    industry: user.industry || "",
    address: user.address || "",
    targetMarket: user.targetMarket || "",
    photoURL: user.photoURL || "",
    coverImage: user.coverImage || user.coverUrl || "",
    galleryImages: (user.galleryImages || []).filter((url) => typeof url === "string" && url.trim()).slice(0, 5),
  };
}

function displayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Chưa cập nhật";
}

export default function ProfileScreen() {
  const { user, refreshProfile, updateProfile, deleteAccount } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingImage, setLoadingImage] = useState<"avatar" | "cover" | "gallery" | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(() => user ? valuesFrom(user) : null);
  const [photoUploadToken, setPhotoUploadToken] = useState<string>();
  const [coverUploadToken, setCoverUploadToken] = useState<string>();
  const [galleryUploadTokens, setGalleryUploadTokens] = useState<Record<string, string>>({});
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void refreshProfile().then((profile) => setForm(valuesFrom(profile))).catch(() => undefined);
  }, [refreshProfile]);

  const initials = useMemo(() => (user?.displayName || "BN").trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase(), [user?.displayName]);

  if (!user || !form) return <Screen><BackHeader title="Thông tin tài khoản" /><Text style={styles.muted}>Đang tải hồ sơ...</Text></Screen>;

  const setValue = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setForm((current) => current ? { ...current, [key]: value } : current);

  const cancelEdit = () => {
    setForm(valuesFrom(user));
    setPhotoUploadToken(undefined);
    setCoverUploadToken(undefined);
    setGalleryUploadTokens({});
    setEditing(false);
  };

  const chooseImage = async (kind: "avatar" | "cover") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Chưa có quyền thư viện ảnh", "Hãy cấp quyền thư viện ảnh để chọn hình cho hồ sơ.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: kind === "avatar",
      aspect: kind === "avatar" ? [1, 1] : [16, 9],
      quality: 0.82,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Không thể đọc ảnh", "Vui lòng chọn một ảnh khác.");
      return;
    }
    setLoadingImage(kind);
    try {
      const mimeType = asset.mimeType || "image/jpeg";
      const uploaded = await authService.uploadProfileImage({
        base64: asset.base64,
        fileName: asset.fileName || `${kind}-${Date.now()}.jpg`,
        mimeType,
        size: asset.fileSize,
        sourceType: kind === "avatar" ? "profile.avatar" : "profile.cover",
      });
      if (kind === "avatar") {
        setValue("photoURL", uploaded.url);
        setPhotoUploadToken(uploaded.uploadToken);
      } else {
        setValue("coverImage", uploaded.url);
        setCoverUploadToken(uploaded.uploadToken);
      }
    } catch (cause) {
      Alert.alert("Tải ảnh thất bại", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      setLoadingImage(null);
    }
  };

  const chooseGalleryImages = async () => {
    const remaining = 5 - form.galleryImages.length;
    if (remaining <= 0) return Alert.alert("Đã đủ ảnh", "Hồ sơ cho phép tối đa 5 ảnh sản phẩm hoặc hoạt động.");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Chưa có quyền thư viện ảnh", "Hãy cấp quyền thư viện ảnh để chọn hình cho hồ sơ.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.82,
      base64: true,
    });
    if (result.canceled) return;
    const assets = result.assets.slice(0, remaining);
    if (assets.some((asset) => !asset.base64)) {
      Alert.alert("Không thể đọc ảnh", "Vui lòng chọn lại các ảnh sản phẩm hoặc hoạt động.");
      return;
    }
    setLoadingImage("gallery");
    try {
      const uploaded = await Promise.all(assets.map((asset, index) => authService.uploadProfileImage({
        base64: asset.base64!,
        fileName: asset.fileName || `gallery-${Date.now()}-${index}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
        sourceType: "profile.gallery",
      })));
      setForm((current) => current ? { ...current, galleryImages: [...current.galleryImages, ...uploaded.map((item) => item.url)].slice(0, 5) } : current);
      setGalleryUploadTokens((current) => ({ ...current, ...Object.fromEntries(uploaded.map((item) => [item.url, item.uploadToken])) }));
    } catch (cause) {
      Alert.alert("Tải ảnh thất bại", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      setLoadingImage(null);
    }
  };

  const removeGalleryImage = (url: string) => {
    setValue("galleryImages", form.galleryImages.filter((item) => item !== url));
    setGalleryUploadTokens((current) => {
      const next = { ...current };
      delete next[url];
      return next;
    });
  };

  const save = async () => {
    if (!form.displayName.trim()) return Alert.alert("Thiếu họ tên", "Họ và tên không được để trống.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return Alert.alert("Email không hợp lệ", "Vui lòng kiểm tra lại địa chỉ email.");
    setSaving(true);
    try {
      const input: ProfileUpdateInput = {
        displayName: form.displayName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        birthDate: form.birthDate || "",
        gender: form.gender,
        companyName: form.companyName.trim(),
        industry: form.industry.trim(),
        address: form.address.trim(),
        targetMarket: form.targetMarket.trim(),
        photoURL: form.photoURL,
        coverImage: form.coverImage,
        galleryImages: form.galleryImages,
        ...(photoUploadToken ? { photoUploadToken } : {}),
        ...(coverUploadToken ? { coverUploadToken } : {}),
        galleryUploadTokens: form.galleryImages.flatMap((url, index) => galleryUploadTokens[url] ? [{ index, uploadToken: galleryUploadTokens[url] }] : []),
      };
      await updateProfile(input);
      setPhotoUploadToken(undefined);
      setCoverUploadToken(undefined);
      setGalleryUploadTokens({});
      setEditing(false);
      Alert.alert("Đã lưu", "Thông tin tài khoản đã được cập nhật.");
    } catch (cause) {
      Alert.alert("Không thể cập nhật", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!password) return Alert.alert("Thiếu mật khẩu", "Nhập mật khẩu hiện tại để xác nhận.");
    if (confirmation.trim() !== "XÓA TÀI KHOẢN") return Alert.alert("Cụm xác nhận chưa đúng", "Vui lòng nhập chính xác: XÓA TÀI KHOẢN");
    setDeleting(true);
    try {
      await deleteAccount(password);
      router.replace("/login");
    } catch (cause) {
      Alert.alert("Không thể xóa tài khoản", cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  };

  return <Screen scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}>
    <BackHeader title="Thông tin tài khoản" subtitle={editing ? "Chỉnh sửa hồ sơ cá nhân" : "Chi tiết hồ sơ cá nhân"} />

    <Card style={styles.hero}>
      {form.coverImage ? <ImageBackground source={{ uri: form.coverImage }} style={styles.cover} resizeMode="cover" /> : <View style={styles.cover} />}
      <Avatar initials={initials} url={form.photoURL} size={88} style={styles.avatar} />
      <Text style={styles.name}>{form.displayName || user.displayName}</Text>
      <Text style={styles.muted}>{form.companyName || user.branchName || user.companyCode || "Chưa cập nhật doanh nghiệp"}</Text>
      <Badge tone="primary">{roleLabels[user.role] || user.role}</Badge>
      {editing ? <View style={styles.imageActions}>
        <Button tone="secondary" icon={Camera} disabled={Boolean(loadingImage)} onPress={() => void chooseImage("avatar")}>{loadingImage === "avatar" ? "Đang tải..." : "Đổi ảnh đại diện"}</Button>
        <Button tone="secondary" icon={Camera} disabled={Boolean(loadingImage)} onPress={() => void chooseImage("cover")}>{loadingImage === "cover" ? "Đang tải..." : "Đổi ảnh bìa"}</Button>
      </View> : null}
      {editing && (form.photoURL || form.coverImage) ? <View style={styles.imageActions}>
        {form.photoURL ? <Button tone="secondary" icon={Trash2} onPress={() => { setValue("photoURL", ""); setPhotoUploadToken(undefined); }}>Xóa ảnh đại diện</Button> : null}
        {form.coverImage ? <Button tone="secondary" icon={Trash2} onPress={() => { setValue("coverImage", ""); setCoverUploadToken(undefined); }}>Xóa ảnh bìa</Button> : null}
      </View> : null}
    </Card>

    <Card style={styles.galleryCard}>
      <View style={styles.galleryHeading}><View style={styles.galleryTitleRow}><ImagePlus color={colors.primaryDark} size={21} /><Text style={styles.sectionTitlePlain}>Ảnh sản phẩm & hoạt động</Text></View><Badge tone="primary">{form.galleryImages.length}/5</Badge></View>
      <Text style={styles.galleryHelp}>Các ảnh này được hiển thị trong hồ sơ thành viên và phần giới thiệu tại cuộc họp.</Text>
      {form.galleryImages.length ? <View style={styles.gallery}>
        {form.galleryImages.map((url, index) => <View key={`${url}-${index}`} style={styles.galleryItem}>
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Xem ảnh ${index + 1}`} onPress={() => void Linking.openURL(url)} style={styles.galleryImageButton}><Image source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" /></Pressable>
          {editing ? <Pressable accessibilityRole="button" accessibilityLabel={`Xóa ảnh ${index + 1}`} onPress={() => removeGalleryImage(url)} style={styles.galleryDelete}><Trash2 color="#FFFFFF" size={17} /></Pressable> : null}
        </View>)}
      </View> : <Text style={styles.galleryEmpty}>Chưa có ảnh sản phẩm hoặc hoạt động.</Text>}
      {editing && form.galleryImages.length < 5 ? <Button tone="secondary" fullWidth icon={ImagePlus} disabled={Boolean(loadingImage)} onPress={() => void chooseGalleryImages()}>{loadingImage === "gallery" ? "Đang tải ảnh..." : "Thêm ảnh sản phẩm / hoạt động"}</Button> : null}
    </Card>

    {editing ? <>
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
        <Field label="Họ và tên *" icon={UserRound} value={form.displayName} onChangeText={(value) => setValue("displayName", value)} autoCapitalize="words" />
        <DateTimeField label="Ngày sinh" mode="date" value={form.birthDate} onChange={(value) => setValue("birthDate", value)} />
        {form.birthDate ? <Pressable onPress={() => setValue("birthDate", "")}><Text style={styles.clearText}>Xóa ngày sinh</Text></Pressable> : null}
        <Text style={styles.label}>GIỚI TÍNH</Text>
        <View style={styles.chips}>{genderOptions.map((option) => <Pressable key={option.value || "empty"} onPress={() => setValue("gender", option.value)} style={[styles.chip, form.gender === option.value && styles.chipActive]}><Text style={[styles.chipText, form.gender === option.value && styles.chipTextActive]}>{option.label}</Text></Pressable>)}</View>
        <Field label="Địa chỉ" icon={MapPin} value={form.address} onChangeText={(value) => setValue("address", value)} multiline />
      </Card>
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Doanh nghiệp & nghề nghiệp</Text>
        <Field label="Tên doanh nghiệp" icon={Building2} value={form.companyName} onChangeText={(value) => setValue("companyName", value)} />
        <Field label="Ngành nghề" value={form.industry} onChangeText={(value) => setValue("industry", value)} />
        <Field label="Thị trường mục tiêu" value={form.targetMarket} onChangeText={(value) => setValue("targetMarket", value)} multiline />
      </Card>
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Tài khoản & liên hệ</Text>
        <Field label="Email *" icon={Mail} value={form.email} onChangeText={(value) => setValue("email", value)} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Số điện thoại" icon={Phone} value={form.phone} onChangeText={(value) => setValue("phone", value)} keyboardType="phone-pad" />
        <Info label="Vai trò" value={roleLabels[user.role] || user.role} />
        <Info label="Đơn vị / Chi nhánh" value={user.branchName || user.companyCode || "Chưa cập nhật"} />
      </Card>
      <View style={styles.actions}><Button tone="secondary" icon={X} disabled={saving} onPress={cancelEdit}>Hủy</Button><Button icon={Save} disabled={saving || Boolean(loadingImage)} onPress={() => void save()}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</Button></View>
    </> : <>
      <Card style={styles.infoCard}>
        <Info label="Họ và tên" value={user.displayName || "Chưa cập nhật"} />
        <Info label="Ngày sinh" value={displayDate(user.birthDate || "")} />
        <Info label="Giới tính" value={user.gender ? genderLabels[user.gender] : "Chưa cập nhật"} />
        <Info label="Email" value={user.email || "Chưa cập nhật"} />
        <Info label="Số điện thoại" value={user.phone || user.phoneNumber || "Chưa cập nhật"} />
        <Info label="Địa chỉ" value={user.address || "Chưa cập nhật"} />
        <Info label="Doanh nghiệp" value={form.companyName || "Chưa cập nhật"} />
        <Info label="Ngành nghề" value={user.industry || "Chưa cập nhật"} />
        <Info label="Thị trường mục tiêu" value={user.targetMarket || "Chưa cập nhật"} />
        <Info label="Vai trò" value={roleLabels[user.role] || user.role} />
        <Info label="Đơn vị / Chi nhánh" value={user.branchName || user.companyCode || "Chưa cập nhật"} />
      </Card>
      <Button fullWidth icon={Pencil} onPress={() => setEditing(true)}>Sửa thông tin cá nhân</Button>
    </>}

    {!editing ? <Card style={styles.dangerCard}>
      <View style={styles.dangerTitleRow}><Trash2 color={colors.danger} size={21} /><Text style={styles.dangerTitle}>Xóa tài khoản</Text></View>
      <Text style={styles.dangerHelp}>Tài khoản và phiên đăng nhập sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.</Text>
      {!showDelete ? <Button tone="danger" fullWidth icon={Trash2} onPress={() => setShowDelete(true)}>Bắt đầu xóa tài khoản</Button> : <View style={styles.deleteForm}>
        <Field label="Mật khẩu hiện tại" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label='Nhập "XÓA TÀI KHOẢN" để xác nhận' value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" />
        <View style={styles.actions}><Button tone="secondary" icon={X} disabled={deleting} onPress={() => { setShowDelete(false); setPassword(""); setConfirmation(""); }}>Hủy</Button><Button tone="danger" icon={Trash2} disabled={deleting || !password || confirmation.trim() !== "XÓA TÀI KHOẢN"} onPress={() => void confirmDelete()}>{deleting ? "Đang xóa..." : "Xóa vĩnh viễn"}</Button></View>
      </View>}
    </Card> : null}
  </Screen>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label.toUpperCase()}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function Field({ label, icon: Icon, multiline, ...props }: TextInputProps & { label: string; icon?: typeof UserRound }) {
  return <View style={styles.field}><Text style={styles.label}>{label.toUpperCase()}</Text><View style={[styles.inputWrap, multiline && styles.inputWrapMultiline]}>{Icon ? <Icon color={colors.muted} size={18} /> : null}<TextInput {...props} multiline={multiline} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.textarea]} /></View></View>;
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", overflow: "hidden", paddingTop: 0, gap: spacing.sm },
  cover: { width: "130%", height: 100, marginBottom: -52, backgroundColor: colors.primarySoft },
  avatar: { borderWidth: 4, borderColor: colors.surface },
  name: { marginTop: spacing.xs, color: colors.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  imageActions: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xs },
  infoCard: { gap: spacing.md },
  infoRow: { gap: 4, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  infoValue: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  formCard: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "900", paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  field: { gap: spacing.xs },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  inputWrap: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  inputWrapMultiline: { alignItems: "flex-start", paddingTop: spacing.md },
  input: { flex: 1, minHeight: touchTarget, color: colors.text, fontSize: 14, paddingVertical: 0 },
  textarea: { minHeight: 84, textAlignVertical: "top", paddingTop: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 40, minWidth: 78, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.primaryDark },
  clearText: { color: colors.danger, fontSize: 12, fontWeight: "700", alignSelf: "flex-end" },
  actions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: spacing.sm },
  dangerCard: { gap: spacing.md, borderColor: "#F4C6CD", backgroundColor: "#FFF9FA" },
  dangerTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dangerTitle: { color: colors.danger, fontSize: 16, fontWeight: "900" },
  dangerHelp: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  deleteForm: { gap: spacing.md },
  galleryCard: { gap: spacing.md },
  galleryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  galleryTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitlePlain: { color: colors.text, fontSize: 16, fontWeight: "900" },
  galleryHelp: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  galleryItem: { width: "48.5%", aspectRatio: 1.2, overflow: "hidden", borderRadius: radius.md, backgroundColor: colors.primarySoft },
  galleryImageButton: { width: "100%", height: "100%" },
  galleryImage: { width: "100%", height: "100%" },
  galleryDelete: { position: "absolute", top: spacing.xs, right: spacing.xs, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(217,72,95,0.92)" },
  galleryEmpty: { color: colors.muted, fontSize: 12, textAlign: "center", paddingVertical: spacing.lg },
});
