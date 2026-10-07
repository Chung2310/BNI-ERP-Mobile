import { Image, ImageBackground, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Mail, Phone } from "lucide-react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Badge, Button, Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";

const genderLabels = { male: 'Nam', female: 'Nữ', other: 'Khác' } as const;

function formatBirthDate(value?: string) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(+date) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: member, error, isLoading, reload } = useAsyncData(() => userService.get(id), id);
  if (isLoading) return <Screen><BackHeader title="Hồ sơ thành viên" /><LoadingState /></Screen>;
  if (error || !member) return <Screen><BackHeader title="Hồ sơ thành viên" /><ErrorState message={error || "Không tìm thấy thành viên."} onRetry={reload} /></Screen>;
  const initials = member.displayName.split(" ").map((part: string) => part[0]).slice(-2).join("").toUpperCase();
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
  const galleryImages = (member.galleryImages || []).filter((url) => typeof url === 'string' && url.trim());
  const gender = member.gender ? genderLabels[member.gender] : 'Chưa cập nhật';

  return <Screen>
    <BackHeader title='Hồ sơ thành viên' />
    <Card style={styles.profile}>
      {coverImage ? <ImageBackground source={{ uri: coverImage }} style={styles.cover} resizeMode='cover' /> : <View style={styles.cover} />}
      <Avatar initials={initials} url={member.photoURL} size={88} />
      <Text style={styles.name}>{member.displayName}</Text>
      <Text style={styles.role}>{company}</Text>
      <Badge tone='primary'>{member.industry || 'Chưa cập nhật lĩnh vực'}</Badge>
    </Card>
    <View style={styles.actions}>
      {phone ? <Button icon={Phone} tone='secondary' onPress={() => Linking.openURL('tel:' + phone)}>Gọi điện</Button> : null}
      <Button icon={Mail} tone='secondary' onPress={() => Linking.openURL('mailto:' + member.email)}>Gửi email</Button>
    </View>
    <Card style={styles.info}>
      <Info label='CÔNG TY' value={company} />
      <Info label='LĨNH VỰC' value={member.industry || 'Chưa cập nhật'} />
      <Info label='GIỚI TÍNH' value={gender} />
      <Info label='NGÀY SINH' value={formatBirthDate(member.birthDate)} />
      <Info label='EMAIL' value={member.email || 'Chưa cập nhật'} />
      <Info label='SỐ ĐIỆN THOẠI' value={phone || 'Chưa cập nhật'} />
      <Info label='ĐỊA CHỈ' value={member.address || 'Chưa cập nhật'} />
      <Info label='THỊ TRƯỜNG MỤC TIÊU' value={member.targetMarket || 'Chưa cập nhật'} />
    </Card>
    <Card style={styles.galleryCard}>
      <Text style={styles.galleryTitle}>Ảnh sản phẩm hoặc hoạt động</Text>
      {galleryImages.length ? <View style={styles.gallery}>
        {galleryImages.map((url, index) => <Pressable key={url + index} accessibilityRole='imagebutton' accessibilityLabel={'Xem ảnh ' + (index + 1)} style={styles.galleryItem} onPress={() => Linking.openURL(url)}>
          <Image source={{ uri: url }} style={styles.galleryImage} resizeMode='cover' />
        </Pressable>)}
      </View> : <Text style={styles.galleryEmpty}>Chưa cập nhật hình ảnh.</Text>}
    </Card>
  </Screen>;
}
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
const styles = StyleSheet.create({
  profile: { alignItems: 'center', overflow: 'hidden', paddingTop: 0 },
  cover: { width: '130%', height: 86, marginBottom: -45, backgroundColor: colors.primarySoft },
  name: { marginTop: spacing.md, color: colors.text, fontSize: 19, fontWeight: '900' },
  role: { marginVertical: spacing.sm, color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  info: { gap: spacing.md },
  infoRow: { gap: 3, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  value: { color: colors.text, fontSize: 14, fontWeight: '700' },
  galleryCard: { gap: spacing.md },
  galleryTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  galleryItem: { width: '48.5%', aspectRatio: 1.2, overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.primarySoft },
  galleryImage: { width: '100%', height: '100%' },
  galleryEmpty: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: spacing.xl },
});
