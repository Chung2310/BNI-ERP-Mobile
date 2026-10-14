import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Alert } from "@/components/AppAlert";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { accountDeletion, type DeletionOptions } from "@/services/accountDeletion";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

export default function DeleteAccountScreen() {
  const { user, deleteAccount } = useAuth();
  const [options, setOptions] = useState<DeletionOptions | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [successorId, setSuccessorId] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => {
    setError("");
    void accountDeletion.options().then(setOptions).catch((cause) => setError(friendlyErrorMessage(cause, "Không thể tải thông tin. Vui lòng thử lại.")));
  };
  useEffect(() => {
    if (!user) return;
    let active = true;
    accountDeletion.options().then((value) => { if (active) setOptions(value); }).catch((cause) => { if (active) setError(friendlyErrorMessage(cause, "Không thể tải thông tin. Vui lòng thử lại.")); });
    return () => { active = false; };
  }, [user]);
  const submit = async () => {
    if (!options || busy || !password || (options.requiresTransfer && !successorId)) return;
    setBusy(true);
    try {
      await deleteAccount(password, successorId || undefined);
      setPassword("");
      router.replace("/account-deletion");
    } catch (cause) { Alert.alert("Không thể xóa tài khoản", friendlyErrorMessage(cause, "Vui lòng thử lại.")); }
    finally { setBusy(false); }
  };
  return <Screen scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}>
    <BackHeader title="Xóa tài khoản" />
    {!user ? <Card><Text style={styles.body}>Đăng nhập để xác nhận xóa tài khoản của bạn.</Text><Button onPress={() => router.replace("/login")}>Đăng nhập</Button></Card> : <>
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Xóa vĩnh viễn tài khoản</Text>
        <Text style={styles.body}>Tài khoản: {user.email}</Text>
        <Text style={styles.body}>Hồ sơ, ảnh cá nhân, tin nhắn và tệp bạn gửi/tải lên, đăng ký thông báo, đơn gia nhập/rời Chapter và lịch sử hoạt động gắn với tài khoản sẽ được xóa. Thông tin cá nhân trong cuộc họp và kết quả trò chơi sẽ được gỡ bỏ.</Text>
        <Text style={styles.body}>Cuộc họp, tin nhắn của người khác và số liệu thu chi đã loại bỏ danh tính vẫn được giữ. Các bản sao đã được người nhận tải xuống hoặc xuất khỏi ứng dụng không thể thu hồi.</Text>
        <Text style={styles.body}>Bạn sẽ đăng xuất ngay khi yêu cầu được tiếp nhận. Thao tác không thể hủy. Việc xử lý thông thường mất vài phút; khi dịch vụ lưu trữ gặp lỗi, hệ thống sẽ tự thử lại. Bạn có thể xem trạng thái sau khi đăng xuất.</Text>
      </Card>
      {error ? <Card><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button tone="secondary" onPress={load}>Thử lại</Button></Card> : !options ? <ActivityIndicator color={colors.primaryDark} /> : <Card style={styles.card}>
        {options.requiresTransfer ? <>
          <Text accessibilityRole="header" style={styles.title}>Chuyển quyền quản trị Chapter</Text>
          <Text style={styles.body}>Chọn người nhận quyền trước khi xóa tài khoản. Người được chọn sẽ trở thành quản trị viên Chapter.</Text>
          {options.successors.map((person) => <Pressable key={person.id} accessibilityRole="radio" accessibilityState={{ checked: successorId === person.id, disabled: busy }} disabled={busy} onPress={() => setSuccessorId(person.id)} style={[styles.option, successorId === person.id && styles.selected]}><Text style={styles.body}>{successorId === person.id ? "●" : "○"} {person.name}</Text></Pressable>)}
        </> : null}
        {options.archivesChapter ? <Text style={styles.body}>Chapter không còn thành viên đang hoạt động khác và sẽ được lưu trữ khi tài khoản của bạn được xóa.</Text> : null}
        <Text style={styles.body}>Nhập mật khẩu hiện tại để xác nhận</Text>
        <TextInput accessibilityLabel="Mật khẩu hiện tại" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} placeholder="Mật khẩu hiện tại" />
        <View style={styles.actions}><Button tone="secondary" disabled={busy} onPress={() => router.back()}>Hủy</Button><Button tone="danger" disabled={busy || !password || (options.requiresTransfer && !successorId)} onPress={() => void submit()}>{busy ? "Đang gửi..." : "Xóa tài khoản"}</Button></View>
      </Card>}
    </>}
  </Screen>;
}
const styles = StyleSheet.create({
  card: { gap: spacing.md }, title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  body: { color: colors.text, fontSize: 14, lineHeight: 22 }, error: { color: colors.danger },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: touchTarget, padding: spacing.md, color: colors.text },
  option: { minHeight: touchTarget, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }, selected: { borderColor: colors.primaryDark, backgroundColor: colors.primarySoft },
  actions: { gap: spacing.sm },
});
