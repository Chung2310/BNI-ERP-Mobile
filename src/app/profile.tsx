import { friendlyErrorMessage } from "@/utils/userFacingError";
import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Camera, LogOut, Pencil, Trash2, X } from "lucide-react-native";
import { ImageBackground, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Alert } from "@/components/AppAlert";
import { BackHeader } from "@/components/BackHeader";
import { BirthDateField } from "@/components/BirthDateField";
import { Avatar, Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";
import { authService } from "@/services/auth";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { UserProfile } from "@/types";

type Form = {
  displayName: string; email: string; phone: string; companyName: string; industry: string;
  address: string; targetMarket: string; birthDate: string; gender: "" | "male" | "female" | "other";
};

const toForm = (profile: UserProfile): Form => ({
  displayName: profile.displayName || "", email: profile.email || "", phone: profile.phone || "",
  companyName: profile.companyName || "", industry: profile.industry || "",
  address: profile.address || "", targetMarket: profile.targetMarket || "",
  birthDate: profile.birthDate?.slice(0, 10) || "", gender: profile.gender || "",
});

function Field({ label, value, onChangeText, keyboardType, multiline = false }: {
  label: string; value: string; onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad"; multiline?: boolean;
}) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput
    value={value} onChangeText={onChangeText} keyboardType={keyboardType} multiline={multiline}
    autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
    style={[styles.input, multiline && styles.multiline]} placeholder={`Nhập ${label.toLocaleLowerCase("vi")}`}
  /></View>;
}

function Info({ label, value }: { label: string; value?: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || "Chưa cập nhật"}</Text></View>;
}

export default function ProfileScreen() {
  const { user, refreshProfile, applyProfile, signOut, deleteAccount } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(user);
  const [form, setForm] = useState<Form | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [coverBase64, setCoverBase64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");

  useEffect(() => {
    void refreshProfile().then(setProfile).catch(() => undefined);
  }, [refreshProfile]);

  const startEdit = () => {
    if (!profile) return;
    setForm(toForm(profile));
    setAvatarBase64(null);
    setCoverBase64(null);
  };

  const cancelEdit = () => { setForm(null); setAvatarBase64(null); setCoverBase64(null); };

  const pickPhoto = async (target: "avatar" | "cover") => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Cần quyền truy cập ảnh", "Hãy cấp quyền thư viện ảnh để đổi ảnh hồ sơ.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: true, aspect: target === "avatar" ? [1, 1] : [16, 9], quality: 0.8, base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        if (target === "avatar") setAvatarBase64(result.assets[0].base64);
        else setCoverBase64(result.assets[0].base64);
      }
    } catch (cause) {
      Alert.alert("Không thể chọn ảnh", friendlyErrorMessage(cause, "Vui lòng thử lại."));
    }
  };

  const save = async () => {
    if (!form || busy) return;
    if (!form.displayName.trim() || !form.email.trim()) {
      Alert.alert("Thiếu thông tin", "Họ tên và email không được để trống.");
      return;
    }
    if (form.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) {
      Alert.alert("Ngày sinh không hợp lệ", "Vui lòng chọn lại ngày sinh trên lịch.");
      return;
    }
    setBusy(true);
    try {
      let photo: { url: string; uploadToken?: string } | null = null;
      if (avatarBase64) photo = await apiRequest<{ url: string; uploadToken?: string }>("/api/v1/media/upload", {
        method: "POST",
        body: JSON.stringify({ file: `data:image/jpeg;base64,${avatarBase64}`, fileName: "avatar.jpg", mimeType: "image/jpeg", sourceType: "profile.avatar" }),
        timeoutMs: 120000,
      });
      let cover: { url: string; uploadToken?: string } | null = null;
      if (coverBase64) cover = await apiRequest<{ url: string; uploadToken?: string }>("/api/v1/media/upload", {
        method: "POST",
        body: JSON.stringify({ file: `data:image/jpeg;base64,${coverBase64}`, fileName: "cover.jpg", mimeType: "image/jpeg", sourceType: "profile.cover" }),
        timeoutMs: 120000,
      });
      const updated = await authService.updateProfile({
        ...form,
        displayName: form.displayName.trim(), email: form.email.trim(),
        phone: form.phone.trim(), companyName: form.companyName.trim(), industry: form.industry.trim(),
        address: form.address.trim(), targetMarket: form.targetMarket.trim(),
        ...(photo ? { photoURL: photo.url, photoUploadToken: photo.uploadToken } : {}),
        ...(cover ? { coverImage: cover.url, coverUploadToken: cover.uploadToken } : {}),
      });
      setProfile(updated);
      applyProfile(updated);
      cancelEdit();
      Alert.alert("Đã lưu", "Hồ sơ cá nhân đã được cập nhật.");
    } catch (cause) {
      Alert.alert("Không thể lưu hồ sơ", friendlyErrorMessage(cause, "Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  };

  const confirmSignOut = () => {
    if (busy) return;
    Alert.alert("Đăng xuất?", "Bạn có chắc muốn đăng xuất khỏi tài khoản này?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: () => {
        setBusy(true);
        void signOut().catch(() => undefined).finally(() => router.replace("/login"));
      } },
    ]);
  };

  const closeDelete = () => {
    if (busy) return;
    setDeleteOpen(false);
    setDeletePassword("");
    setDeletePhrase("");
  };

  const confirmDelete = async () => {
    if (busy || profile?.role === "admin" || user?.role === "admin") return;
    if (deletePhrase.trim() !== "XÓA TÀI KHOẢN" || !deletePassword) {
      Alert.alert("Chưa đủ xác nhận", "Nhập mật khẩu hiện tại và cụm XÓA TÀI KHOẢN để tiếp tục.");
      return;
    }
    setBusy(true);
    try {
      await deleteAccount(deletePassword);
      setDeleteOpen(false);
      setDeletePassword("");
      setDeletePhrase("");
      router.replace("/login");
    } catch (cause) {
      Alert.alert("Không thể xóa tài khoản", friendlyErrorMessage(cause, "Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return <Screen><BackHeader title="Hồ sơ cá nhân" compact /><Text style={styles.empty}>Không tìm thấy hồ sơ cá nhân.</Text></Screen>;

  const initials = profile.displayName.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
  const avatarUrl = avatarBase64 ? `data:image/jpeg;base64,${avatarBase64}` : profile.photoURL;
  const coverUrl = coverBase64 ? `data:image/jpeg;base64,${coverBase64}` : profile.coverImage || profile.coverUrl;

  return <Screen scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}>
    <BackHeader title={form ? "Chỉnh sửa hồ sơ" : "Hồ sơ cá nhân"} compact
      onBack={form ? cancelEdit : undefined}
      action={!form ? <Pressable accessibilityRole="button" accessibilityLabel="Chỉnh sửa hồ sơ cá nhân" onPress={startEdit} style={styles.editButton}><Pencil size={19} color={colors.primaryDark} /></Pressable> : null}
    />
    <Card style={styles.profileCard}>
      <Pressable disabled={!form || busy} accessibilityRole="button" accessibilityLabel="Đổi ảnh bìa" onPress={() => void pickPhoto("cover")} style={styles.coverPress}>
        {coverUrl ? <ImageBackground source={{ uri: coverUrl }} style={styles.cover} /> : <View style={styles.cover} />}
        {form ? <View style={styles.coverBadge}><Camera size={14} color="#FFFFFF" /><Text style={styles.coverBadgeText}>Đổi ảnh bìa</Text></View> : null}
      </Pressable>
      <Pressable disabled={!form || busy} accessibilityRole="button" accessibilityLabel="Đổi ảnh đại diện" onPress={() => void pickPhoto("avatar")} style={styles.avatarWrap}>
        <Avatar initials={initials} url={avatarUrl} size={84} />
        {form ? <View style={styles.cameraBadge}><Camera size={16} color="#FFFFFF" /></View> : null}
      </Pressable>
      <Text style={styles.name}>{profile.displayName}</Text>
      <Text style={styles.muted}>{profile.industry || profile.companyName || profile.role}</Text>
    </Card>
    {form ? <>
      <Card>
        <Field label="Họ tên" value={form.displayName} onChangeText={(displayName) => setForm({ ...form, displayName })} />
        <Field label="Email" value={form.email} keyboardType="email-address" onChangeText={(email) => setForm({ ...form, email })} />
        <Field label="Số điện thoại" value={form.phone} keyboardType="phone-pad" onChangeText={(phone) => setForm({ ...form, phone })} />
        <Field label="Công ty" value={form.companyName} onChangeText={(companyName) => setForm({ ...form, companyName })} />
        <Field label="Lĩnh vực" value={form.industry} onChangeText={(industry) => setForm({ ...form, industry })} />
        <BirthDateField value={form.birthDate} disabled={busy} onChange={(birthDate) => setForm({ ...form, birthDate })} />
        <Text style={styles.label}>Giới tính</Text>
        <View style={styles.genderRow}>{([ ["", "Chưa chọn"], ["male", "Nam"], ["female", "Nữ"], ["other", "Khác"] ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: form.gender === value }} onPress={() => setForm({ ...form, gender: value })} style={[styles.genderOption, form.gender === value && styles.genderActive]}><Text style={[styles.genderText, form.gender === value && styles.genderTextActive]}>{label}</Text></Pressable>)}</View>
        <Field label="Địa chỉ" value={form.address} onChangeText={(address) => setForm({ ...form, address })} />
        <Field label="Thị trường mục tiêu" value={form.targetMarket} multiline onChangeText={(targetMarket) => setForm({ ...form, targetMarket })} />
      </Card>
      <View style={styles.actions}><Button tone="secondary" style={styles.flex} disabled={busy} onPress={cancelEdit}>Hủy</Button><Button style={styles.flex} disabled={busy} onPress={() => void save()}>{busy ? "Đang lưu..." : "Lưu thay đổi"}</Button></View>
    </> : <Card>
      <Info label="Email" value={profile.email} /><Info label="Số điện thoại" value={profile.phone} />
      <Info label="Công ty" value={profile.companyName || profile.companyCode} /><Info label="Lĩnh vực" value={profile.industry} />
      <Info label="Ngày sinh" value={profile.birthDate ? new Date(profile.birthDate).toLocaleDateString("vi-VN") : undefined} />
      <Info label="Giới tính" value={profile.gender === "male" ? "Nam" : profile.gender === "female" ? "Nữ" : profile.gender === "other" ? "Khác" : undefined} />
      <Info label="Địa chỉ" value={profile.address} /><Info label="Thị trường mục tiêu" value={profile.targetMarket} />
    </Card>}
    {!form ? <Button icon={LogOut} tone="danger" fullWidth disabled={busy} onPress={confirmSignOut}>
      {busy ? "Đang đăng xuất..." : "Đăng xuất"}
    </Button> : null}
    {!form && profile.role !== "admin" && user?.role !== "admin" ? <Button icon={Trash2} tone="danger" fullWidth disabled={busy} onPress={() => setDeleteOpen(true)}>Xóa tài khoản</Button> : null}
    <Modal visible={deleteOpen && profile.role !== "admin" && user?.role !== "admin"} transparent animationType="fade" onRequestClose={closeDelete}>
      <View style={styles.deleteOverlay}>
        <Pressable accessibilityLabel="Đóng xác nhận xóa tài khoản" disabled={busy} onPress={closeDelete} style={styles.deleteBackdrop} />
        <View accessibilityViewIsModal style={styles.deleteDialog}>
          <View style={styles.deleteHeader}><Text style={styles.deleteTitle}>Xóa tài khoản?</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng" disabled={busy} onPress={closeDelete} style={styles.deleteClose}><X color={colors.muted} size={21} /></Pressable></View>
          <Text style={styles.deleteDescription}>Tài khoản của bạn sẽ bị xóa vĩnh viễn và bạn sẽ đăng xuất khỏi ứng dụng. Hành động này không thể hoàn tác.</Text>
          <Text style={styles.label}>Mật khẩu hiện tại</Text>
          <TextInput accessibilityLabel="Mật khẩu hiện tại" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder="Nhập mật khẩu" style={styles.input} />
          <Text style={styles.label}>Nhập XÓA TÀI KHOẢN để xác nhận</Text>
          <TextInput accessibilityLabel="Nhập XÓA TÀI KHOẢN để xác nhận" value={deletePhrase} onChangeText={setDeletePhrase} autoCapitalize="characters" autoCorrect={false} editable={!busy} placeholder="XÓA TÀI KHOẢN" style={styles.input} />
          <View style={styles.actions}><Button tone="secondary" style={styles.flex} disabled={busy} onPress={closeDelete}>Hủy</Button><Button tone="danger" style={styles.flex} disabled={busy || !deletePassword || deletePhrase.trim() !== "XÓA TÀI KHOẢN"} onPress={() => void confirmDelete()}>{busy ? "Đang xóa..." : "Xóa tài khoản"}</Button></View>
        </View>
      </View>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, empty: { color: colors.muted, padding: spacing.lg },
  editButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  profileCard: { alignItems: "center", overflow: "hidden", paddingTop: 0 },
  coverPress: { width: "120%" },
  cover: { width: "100%", height: 100, backgroundColor: colors.primarySoft },
  coverBadge: { position: "absolute", right: spacing.xl, bottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryDark, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  coverBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  avatarWrap: { marginTop: -40, borderRadius: radius.pill },
  cameraBadge: { position: "absolute", right: -2, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center" },
  name: { marginTop: spacing.sm, color: colors.text, fontSize: 19, fontWeight: "800" },
  muted: { marginTop: spacing.xs, color: colors.muted, fontSize: 12 },
  field: { marginBottom: spacing.md }, label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: spacing.xs },
  input: { minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface },
  multiline: { minHeight: 80, paddingTop: spacing.sm, textAlignVertical: "top" },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  genderOption: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.background },
  genderActive: { backgroundColor: colors.primarySoft }, genderText: { color: colors.muted, fontSize: 12 }, genderTextActive: { color: colors.primaryDark, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { flex: 1, color: colors.muted, fontSize: 12 }, infoValue: { flex: 1.5, color: colors.text, fontSize: 12, textAlign: "right" },
  deleteOverlay: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg, backgroundColor: colors.overlay },
  deleteBackdrop: { ...StyleSheet.absoluteFill },
  deleteDialog: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface },
  deleteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  deleteTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  deleteClose: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  deleteDescription: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
});
