import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput } from 'react-native';
import { BackHeader } from '@/components/BackHeader';
import { Button, Card, Screen } from '@/components/ui';
import { chatService } from '@/services/chat';
import { colors } from '@/theme/tokens';
import { friendlyErrorMessage } from '@/utils/userFacingError';

const reasons = [{ id: 'harassment', label: 'Quấy rối hoặc thù ghét' }, { id: 'sexual', label: 'Nội dung tình dục' }, { id: 'violence', label: 'Bạo lực hoặc đe dọa' }, { id: 'spam', label: 'Spam hoặc lừa đảo' }, { id: 'other', label: 'Vi phạm khác' }];

export default function ChatReportScreen() {
  const { roomId, messageId } = useLocalSearchParams<{ roomId: string; messageId: string }>();
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await chatService.report(roomId, messageId, reason, details.trim()); setSent(true); }
    catch (cause) { setError(friendlyErrorMessage(cause, 'Chưa gửi được báo cáo. Vui lòng thử lại.')); }
    finally { setBusy(false); }
  };
  return <Screen><BackHeader title="Báo cáo tin nhắn" /><Card>
    {sent ? <><Text>Báo cáo đã được lưu và chuyển đến quản trị viên Chapter. Bạn có thể chặn người gửi nếu không muốn nhận nội dung từ họ.</Text><Button onPress={() => router.back()}>Hoàn tất</Button></> : <>
      <Text>Chọn lý do. Quản trị viên sẽ xem tin nhắn được báo cáo; danh tính người báo cáo không được gửi cho người bị báo cáo.</Text>
      {reasons.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: reason === item.id }} onPress={() => setReason(item.id)} style={{ paddingVertical: 12 }}><Text style={{ color: reason === item.id ? colors.primaryDark : colors.text }}>{reason === item.id ? '● ' : '○ '}{item.label}</Text></Pressable>)}
      <TextInput accessibilityLabel="Mô tả báo cáo" placeholder="Thông tin thêm (tùy chọn)" multiline maxLength={2000} value={details} onChangeText={setDetails} style={{ minHeight: 100, color: colors.text }} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      <Button disabled={busy || !roomId || !messageId} onPress={() => void submit()}>{busy ? 'Đang gửi...' : 'Gửi báo cáo'}</Button>
    </>}
  </Card></Screen>;
}
