import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Building2, Check, ChevronDown, MapPin, Search, UsersRound, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "@/components/AppAlert";
import { BackHeader } from "@/components/BackHeader";
import { Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { chapterService, type OpenChapter } from "@/services/chapters";
import { colors, radius, spacing } from "@/theme/tokens";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { isChapterGuest } from "@/utils/guest";
import { VIETNAM_PROVINCES } from "@/data/vietnamProvinces";

function normalizeRegion(value: string) {
  return value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
    .replace(/^(tinh|thanh pho|tp\.?)[\s.]+/, "").trim();
}

export default function ChaptersScreen() {
  const { user, refreshProfile } = useAuth();
  const { refreshChapterNotifications } = useNotifications();
  const userId = user?.uid;
  const guest = isChapterGuest(user);
  const insets = useSafeAreaInsets();
  const [nameQuery, setNameQuery] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [provinceSheetOpen, setProvinceSheetOpen] = useState(false);
  const [provinceQuery, setProvinceQuery] = useState("");
  const [submittingCode, setSubmittingCode] = useState("");
  const { data: chapters, error, isLoading, reload } = useAsyncData(chapterService.openChapters, "open-chapters");
  const chapterCodes = chapters?.map((chapter) => chapter.code).join("|") || "";
  const { data: overviews, isLoading: countsLoading } = useAsyncData(async () => {
    if (!chapters?.length) return {} as Record<string, Awaited<ReturnType<typeof chapterService.overview>> | null>;
    const entries = await Promise.all(chapters.map(async (chapter) => {
      try { return [chapter.code, await chapterService.overview(chapter.code)] as const; }
      catch { return [chapter.code, null] as const; }
    }));
    return Object.fromEntries(entries) as Record<string, Awaited<ReturnType<typeof chapterService.overview>> | null>;
  }, chapterCodes);
  const { data: applications, isLoading: applicationsLoading, setData: setApplications, reload: reloadApplications } = useAsyncData(
    () => guest ? chapterService.myApplications() : Promise.resolve([]),
    `${userId || "none"}-${guest}`,
  );

  useFocusEffect(useCallback(() => {
    if (userId) void refreshProfile().catch(() => undefined);
    void reload();
    if (guest) void reloadApplications();
  }, [userId, guest, refreshProfile, reload, reloadApplications]));

  const pending = applications?.find((application) => application.status === "pending");
  const filtered = useMemo(() => (chapters || []).filter((chapter) =>
    chapter.name.toLocaleLowerCase("vi").includes(nameQuery.trim().toLocaleLowerCase("vi")) &&
    (!selectedProvince || normalizeRegion(chapter.chapterRegion || "") === normalizeRegion(selectedProvince)),
  ), [chapters, nameQuery, selectedProvince]);
  const provinceOptions = useMemo(() => VIETNAM_PROVINCES.filter((province) =>
    normalizeRegion(province).includes(normalizeRegion(provinceQuery)),
  ), [provinceQuery]);

  const submit = (chapter: OpenChapter) => {
    if (!isChapterGuest(user) || submittingCode || applicationsLoading) return;
    if (pending?.chapterCode === chapter.code) return;
    Alert.alert(pending ? "Đổi Chapter đăng ký?" : "Nộp đơn gia nhập?", pending
      ? `Đơn đang chờ của bạn sẽ chuyển sang:\n${chapter.name}.`
      : `Gửi đơn xin gia nhập:\n${chapter.name}?`, [
      { text: "Hủy", style: "cancel" },
      { text: "Xác nhận", onPress: () => {
        setSubmittingCode(chapter.code);
        void (pending ? chapterService.changeApplication(pending._id, chapter.code) : chapterService.apply(chapter.code))
          .then((application) => {
            setApplications((current) => [
              ...(current || []).filter((item) => item.status !== "pending"),
              { ...application, chapterCode: chapter.code, status: "pending" },
            ]);
            Alert.alert(pending ? "Chuyển đơn thành công" : "Nộp đơn thành công", `Đơn gia nhập ${chapter.name} đang được duyệt.`);
            void reloadApplications();
          })
          .catch((cause) => Alert.alert("Không thể nộp đơn", friendlyErrorMessage(cause, "Vui lòng thử lại.")))
          .finally(() => setSubmittingCode(""));
      } },
    ]);
  };

  const cancel = (chapter: OpenChapter) => {
    if (!pending || pending.chapterCode !== chapter.code || submittingCode || applicationsLoading) return;
    Alert.alert("Hủy đơn gia nhập?", `Bạn muốn hủy đơn gia nhập ${chapter.name}?`, [
      { text: "Giữ đơn", style: "cancel" },
      { text: "Hủy đơn", style: "destructive", onPress: () => {
        setSubmittingCode(chapter.code);
        void chapterService.cancelApplication(pending._id)
          .then((application) => {
            setApplications((current) => (current || []).map((item) => item._id === pending._id ? application : item));
            Alert.alert("Đã hủy đơn", `Đơn gia nhập ${chapter.name} đã được hủy.`);
            void reloadApplications();
            void refreshChapterNotifications().catch(() => undefined);
          })
          .catch((cause) => Alert.alert("Không thể hủy đơn", friendlyErrorMessage(cause, "Vui lòng thử lại.")))
          .finally(() => setSubmittingCode(""));
      } },
    ]);
  };

  return <Screen style={styles.screen}>
    <BackHeader title="Chapter" subtitle="Các Chapter đang nhận đơn gia nhập" compact onBack={() => router.navigate("/(tabs)")} />
    <View style={styles.filters}>
      <View style={[styles.searchBox, styles.nameSearch]}><Search size={17} color={colors.muted} /><TextInput style={styles.searchInput} value={nameQuery} onChangeText={setNameQuery} placeholder="Tìm Chapter" placeholderTextColor={colors.muted} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Lọc theo tỉnh thành${selectedProvince ? `: ${selectedProvince}` : ""}`} style={[styles.searchBox, styles.regionFilter]} onPress={() => setProvinceSheetOpen(true)}><MapPin size={16} color={colors.muted} /><Text numberOfLines={1} style={[styles.provinceLabel, selectedProvince && styles.provinceSelected]}>{selectedProvince || "Khu vực"}</Text><ChevronDown size={14} color={colors.muted} /></Pressable>
    </View>
    {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : filtered.length === 0 ? <EmptyState title="Không tìm thấy Chapter" message="Thử tên hoặc khu vực khác." /> : filtered.map((chapter) => <Card key={chapter.code} style={styles.card}>
      <View style={styles.heading}><Building2 size={20} color={colors.brandBlue} /><Text style={styles.chapterName} numberOfLines={2}>{chapter.name}</Text></View>
      <View style={styles.metaRow}>
        <MapPin size={15} color={colors.muted} />
        <Text style={styles.metaText} numberOfLines={1}>{chapter.chapterRegion || "Chưa cập nhật khu vực"}</Text>
        <View style={styles.memberPill}><UsersRound size={14} color={colors.brandBlue} /><Text style={styles.memberText}>{overviews?.[chapter.code] ? overviews[chapter.code]?.memberCount : countsLoading ? "..." : "–"} thành viên</Text></View>
      </View>
      {chapter.chapterAddress ? <Text style={styles.detailText} numberOfLines={1}>Địa chỉ: {chapter.chapterAddress}</Text> : null}
      <View style={styles.detailRow}><Text style={styles.detailText} numberOfLines={1}>Chủ tịch: {chapter.chairpersonName || "Chưa cập nhật"}</Text><Text style={styles.codeText} numberOfLines={1}>{chapter.code}</Text></View>
      {isChapterGuest(user) ? pending?.chapterCode === chapter.code ? <View style={styles.actionRow}><Text style={styles.reviewStatus}>Đang chờ duyệt</Text><Pressable accessibilityRole="button" accessibilityLabel={`Hủy đơn gia nhập ${chapter.name}`} hitSlop={4} disabled={Boolean(submittingCode) || applicationsLoading} style={[styles.applyButton, styles.cancelButton, (Boolean(submittingCode) || applicationsLoading) && styles.disabled]} onPress={() => cancel(chapter)}><X size={20} color="#FFFFFF" strokeWidth={2.5} /></Pressable></View> : <Pressable accessibilityRole="button" hitSlop={4} disabled={Boolean(submittingCode) || applicationsLoading} style={[styles.applyButton, (Boolean(submittingCode) || applicationsLoading) && styles.disabled]} onPress={() => submit(chapter)}><Text style={styles.applyText}>{submittingCode === chapter.code ? "Đang gửi..." : pending ? "Chuyển đơn sang Chapter này" : "Nộp đơn gia nhập"}</Text></Pressable> : <Pressable accessibilityRole="button" hitSlop={4} style={styles.applyButton} onPress={() => router.push("/chapter")}><Text style={styles.applyText}>Chapter của tôi</Text></Pressable>}
    </Card>)}
    <Modal visible={provinceSheetOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setProvinceSheetOpen(false)}>
      <View style={styles.sheetOverlay}>
        <Pressable accessibilityLabel="Đóng bộ lọc tỉnh thành" style={styles.sheetBackdrop} onPress={() => setProvinceSheetOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Lọc theo tỉnh / thành phố</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setProvinceSheetOpen(false)}><X size={21} color={colors.muted} /></Pressable></View>
          <View style={styles.sheetSearch}><Search size={18} color={colors.muted} /><TextInput value={provinceQuery} onChangeText={setProvinceQuery} placeholder="Tìm tỉnh / thành phố" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!provinceQuery ? <Pressable accessibilityRole="button" style={styles.provinceOption} onPress={() => { setSelectedProvince(""); setProvinceSheetOpen(false); }}><Text style={styles.optionText}>Tất cả tỉnh / thành phố</Text>{!selectedProvince ? <Check size={18} color={colors.brandBlue} /> : null}</Pressable> : null}
            {provinceOptions.map((province) => <Pressable key={province} accessibilityRole="button" style={styles.provinceOption} onPress={() => { setSelectedProvince(province); setProvinceSheetOpen(false); setProvinceQuery(""); }}><Text style={styles.optionText}>{province}</Text>{selectedProvince === province ? <Check size={18} color={colors.brandBlue} /> : null}</Pressable>)}
            {provinceOptions.length === 0 ? <Text style={styles.noProvince}>Không tìm thấy tỉnh / thành phố</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.lg },
  filters: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  nameSearch: { flex: 1, minWidth: 0 },
  regionFilter: { width: 120 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 42, color: colors.text, fontSize: 13 },
  provinceLabel: { flex: 1, color: colors.muted, fontSize: 14 },
  provinceSelected: { color: colors.text },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheetBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { maxHeight: "75%", backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  sheetSearch: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.background, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  provinceOption: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  optionText: { flex: 1, color: colors.text, fontSize: 14 },
  noProvince: { textAlign: "center", color: colors.muted, padding: spacing.lg },
  card: { padding: spacing.md, gap: 7, marginTop: spacing.sm, borderRadius: radius.lg },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  chapterName: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "800", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 12 },
  memberPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, minHeight: 26, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  memberText: { color: colors.primaryDark, fontSize: 11, fontWeight: "700" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  detailText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  codeText: { maxWidth: 85, color: colors.muted, fontSize: 11 },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  reviewStatus: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  applyButton: { alignSelf: "flex-end", maxWidth: "100%", minHeight: 36, paddingHorizontal: spacing.md, backgroundColor: colors.brandBlue, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: 2 },
  applyText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  cancelButton: { width: 36, paddingHorizontal: 0, backgroundColor: "#DC2626" },
  disabled: { opacity: 0.55 },
});
