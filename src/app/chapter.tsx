import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Building2, Check, ChevronDown, Mail, MapPin, Phone, RotateCw, UserRound, UsersRound, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "@/components/AppAlert";
import { friendlyErrorMessage } from "@/utils/userFacingError";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { chapterService, type ChapterApplication } from "@/services/chapters";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import { mediaUrl } from "@/utils/media";

function initials(name?: string) {
  return (name || "TV").split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

type ApplicationDecision = "approved" | "rejected";

function ApplicationCard({ application, busy, onDecision }: {
  application: ChapterApplication;
  busy: boolean;
  onDecision: (application: ChapterApplication, decision: ApplicationDecision) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const profile = application.profileSnapshot;
  const submittedAt = new Date(application.createdAt);
  const date = Number.isNaN(submittedAt.getTime()) ? "Chưa rõ" : submittedAt.toLocaleDateString("vi-VN");
  return (
    <Card style={[styles.applicationCard, styles.applicationCompactCard]}>
      <View style={styles.applicationHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Ẩn" : "Xem"} thông tin đơn của ${profile?.displayName || "người đăng ký"}`} onPress={() => setExpanded((current) => !current)} style={styles.applicationSummary}>
          <Avatar initials={initials(profile?.displayName)} url={profile?.photoURL} size={38} />
          <Text style={styles.applicantName} numberOfLines={1}>{profile?.displayName || "Người đăng ký"}</Text>
          <ChevronDown size={17} color={colors.muted} style={expanded && styles.expandedChevron} />
        </Pressable>
        <View style={styles.applicationActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Duyệt đơn của ${profile?.displayName || "người đăng ký"}`} hitSlop={7} disabled={busy} onPress={() => onDecision(application, "approved")} style={[styles.decisionButton, styles.approveButton, busy && styles.disabled]}><Check size={15} color="#FFFFFF" strokeWidth={2.5} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Từ chối đơn của ${profile?.displayName || "người đăng ký"}`} hitSlop={7} disabled={busy} onPress={() => onDecision(application, "rejected")} style={[styles.decisionButton, styles.rejectButton, busy && styles.disabled]}><X size={15} color="#FFFFFF" strokeWidth={2.5} /></Pressable>
        </View>
      </View>
      {expanded ? <View style={styles.applicationDetails}>
        <Text style={styles.applicantDetail}>Họ tên: {profile?.displayName || "Chưa cập nhật"}</Text>
        <Text style={styles.applicationDate}>Ngày nộp đơn: {date}</Text>
        <Text style={styles.applicantDetail}>Công ty: {profile?.companyName || "Chưa cập nhật"}</Text>
        <Text style={styles.applicantDetail}>Lĩnh vực: {profile?.industry || "Chưa cập nhật"}</Text>
        <View style={styles.contactRow}><Mail size={15} color={colors.muted} /><Text selectable style={styles.contactText}>{profile?.email || "Chưa cập nhật email"}</Text></View>
        <View style={styles.contactRow}><Phone size={15} color={colors.muted} /><Text selectable style={styles.contactText}>{profile?.phone || "Chưa cập nhật số điện thoại"}</Text></View>
      </View> : null}
    </Card>
  );
}

export default function ChapterScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { refreshChapterNotifications } = useNotifications();
  const [decidingId, setDecidingId] = useState("");
  const code = user?.companyCode || "";
  const isAdmin = user?.role === "admin";
  const overview = useAsyncData(
    () => code ? chapterService.overview(code) : Promise.resolve(null),
    code,
  );
  const applications = useAsyncData(
    () => isAdmin && code ? chapterService.pendingApplications() : Promise.resolve([]),
    `${code}:${isAdmin}`,
  );
  const pendingAdminLeaves = useAsyncData(
    () => isAdmin && code ? chapterService.pendingLeaveRequests() : Promise.resolve([]),
    `${code}:${isAdmin}`,
  );
  const leaveRequests = useAsyncData(
    () => !isAdmin && code ? chapterService.leaveRequests() : Promise.resolve([]),
    `${code}:${isAdmin}`,
  );
  const pendingLeave = leaveRequests.data?.find((request) => request.status === "pending" && request.chapterCode === code);
  const chairpersonName = overview.data?.chairpersonName || "";
  const chairperson = useAsyncData(
    () => !isAdmin && code && chairpersonName ? chapterService.chairperson(chairpersonName) : Promise.resolve(null),
    `${code}:${chairpersonName}:${isAdmin}`,
  );

  if (isAuthLoading) return null;
  if (!user || !code) return <Redirect href="/(tabs)" />;

  const refresh = () => {
    void overview.reload();
    if (!isAdmin) void chairperson.reload();
    if (isAdmin) {
      void applications.reload();
      void pendingAdminLeaves.reload();
    }
    else void leaveRequests.reload();
  };

  const confirmLeave = () => Alert.alert(
    "Rời Chapter?",
    "Yêu cầu rời Chapter sẽ được gửi đến quản trị Chapter để duyệt. Bạn vẫn là thành viên cho đến khi yêu cầu được duyệt.",
    [
      { text: "Hủy", style: "cancel" },
      { text: "Gửi yêu cầu", style: "destructive", onPress: () => {
        void chapterService.requestLeave().then(() => {
          void leaveRequests.reload();
          Alert.alert("Đã gửi yêu cầu", "Bạn sẽ được thông báo khi yêu cầu rời Chapter được duyệt.");
        }).catch((cause) => Alert.alert("Không thể gửi yêu cầu", friendlyErrorMessage(cause, "Vui lòng thử lại.")));
      } },
    ],
  );

  const confirmDecision = (application: ChapterApplication, decision: ApplicationDecision) => {
    if (!isAdmin || decidingId) return;
    const name = application.profileSnapshot?.displayName || "người đăng ký";
    const approving = decision === "approved";
    Alert.alert(approving ? "Duyệt đơn gia nhập?" : "Từ chối đơn gia nhập?", `${approving ? "Duyệt" : "Từ chối"} đơn của ${name}?`, [
      { text: "Quay lại", style: "cancel" },
      { text: approving ? "Duyệt đơn" : "Từ chối", style: approving ? "default" : "destructive", onPress: () => {
        setDecidingId(application._id);
        void chapterService.decideApplication(application._id, decision)
          .then(() => {
            applications.setData((current) => (current || []).filter((item) => item._id !== application._id));
            Alert.alert(approving ? "Đã duyệt đơn" : "Đã từ chối đơn", `Đơn của ${name} đã được ${approving ? "duyệt" : "từ chối"}.`);
            void applications.reload();
            void refreshChapterNotifications().catch(() => undefined);
            if (approving) void overview.reload();
          })
          .catch((cause) => Alert.alert("Không thể xử lý đơn", friendlyErrorMessage(cause, "Vui lòng thử lại.")))
          .finally(() => setDecidingId(""));
      } },
    ]);
  };

  return (
    <Screen style={styles.screen}>
      <BackHeader
        title="Chapter"
        subtitle="Thông tin Chapter của bạn"
        action={
          <Pressable accessibilityRole="button" accessibilityLabel="Tải lại thông tin Chapter" onPress={refresh} style={styles.refreshButton}>
            <RotateCw size={19} color={colors.primaryDark} />
          </Pressable>
        }
      />

      {overview.isLoading ? <LoadingState /> : overview.error ? (
        <ErrorState message={overview.error} onRetry={() => void overview.reload()} />
      ) : overview.data ? (
        <Card style={styles.overviewCard}>
          <View style={styles.chapterHeading}>
            <View style={styles.chapterIcon}><Building2 size={24} color={colors.primaryDark} /></View>
            <View style={styles.chapterTitleWrap}>
              <Text style={styles.chapterName}>{overview.data.name}</Text>
              <Text style={styles.chapterCode}>Mã Chapter: {overview.data.code}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}><UsersRound size={18} color={colors.primaryDark} /><Text style={styles.infoLabel}>Số thành viên</Text><Text style={styles.infoValue}>{overview.data.memberCount}</Text></View>
          <View style={styles.infoRow}><MapPin size={18} color={colors.primaryDark} /><Text style={styles.infoLabel}>Địa chỉ</Text><Text style={styles.infoValue}>{overview.data.chapterAddress || "Chưa cập nhật"}</Text></View>
          {overview.data.chapterRegion ? <View style={styles.infoRow}><MapPin size={18} color={colors.primaryDark} /><Text style={styles.infoLabel}>Khu vực</Text><Text style={styles.infoValue}>{overview.data.chapterRegion}</Text></View> : null}
        </Card>
      ) : null}

      {!isAdmin && overview.data ? (
        <View style={styles.chairpersonSection}>
          <Text style={styles.sectionTitle}>Chủ tịch Chapter</Text>
          {chairperson.isLoading ? <LoadingState /> : chairperson.error ? (
            <ErrorState message={chairperson.error} onRetry={() => void chairperson.reload()} />
          ) : (
            <Card style={styles.chairpersonCard}>
              <View style={styles.applicantHeader}>
                {chairperson.data ? (
                  <Avatar initials={initials(chairperson.data.displayName)} url={mediaUrl(chairperson.data.photoURL)} size={52} />
                ) : (
                  <View style={styles.chapterIcon}><UserRound size={24} color={colors.primaryDark} /></View>
                )}
                <View style={styles.applicantNameWrap}>
                  <Text style={styles.chairpersonName}>{chairperson.data?.displayName || chairpersonName || "Chưa cập nhật"}</Text>
                  <Text style={styles.chairpersonRole}>Chủ tịch Chapter</Text>
                </View>
              </View>
              {chairperson.data ? (
                <>
                  {chairperson.data.phone || chairperson.data.phoneNumber ? <View style={styles.contactRow}><Phone size={17} color={colors.primaryDark} /><Text selectable style={styles.contactText}>{chairperson.data.phone || chairperson.data.phoneNumber}</Text></View> : null}
                  {chairperson.data.email ? <View style={styles.contactRow}><Mail size={17} color={colors.primaryDark} /><Text selectable style={styles.contactText}>{chairperson.data.email}</Text></View> : null}
                  {chairperson.data.companyName ? <View style={styles.contactRow}><Building2 size={17} color={colors.primaryDark} /><Text style={styles.contactText}>{chairperson.data.companyName}</Text></View> : null}
                  {chairperson.data.industry ? <Text style={styles.applicantDetail}>Lĩnh vực: {chairperson.data.industry}</Text> : null}
                  {chairperson.data.address ? <View style={styles.contactRow}><MapPin size={17} color={colors.primaryDark} /><Text style={styles.contactText}>{chairperson.data.address}</Text></View> : null}
                  {chairperson.data.targetMarket ? <Text style={styles.applicantDetail}>Thị trường mục tiêu: {chairperson.data.targetMarket}</Text> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xem hồ sơ và liên hệ Chủ tịch Chapter"
                    style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}
                    onPress={() => router.push({ pathname: "/member/[id]", params: { id: chairperson.data!.uid } })}
                  >
                    <Text style={styles.profileLinkText}>Xem đầy đủ hồ sơ và liên hệ</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.noContact}>Chưa tìm thấy thông tin liên hệ của Chủ tịch Chapter.</Text>
              )}
            </Card>
          )}
        </View>
      ) : null}

      {!isAdmin ? (
        <View style={styles.leaveSection}>
          <Text style={styles.sectionTitle}>Tư cách thành viên</Text>
          {leaveRequests.isLoading ? <LoadingState /> : leaveRequests.error ? (
            <ErrorState message={leaveRequests.error} onRetry={() => void leaveRequests.reload()} />
          ) : pendingLeave ? (
            <Card><Text style={styles.leavePending}>Yêu cầu rời Chapter đang chờ duyệt.</Text></Card>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Rời Chapter" onPress={confirmLeave} style={({ pressed }) => [styles.leaveButton, pressed && styles.pressed]}>
              <Text style={styles.leaveButtonText}>Rời Chapter</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {isAdmin ? (
        <View style={styles.applicationsSection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Đơn xin gia nhập</Text>
              <Text style={styles.sectionSubtitle}>Các đơn đang chờ duyệt của Chapter</Text>
            </View>
            {applications.data ? <Text style={styles.count}>{applications.data.length}</Text> : null}
          </View>
          {applications.isLoading ? <LoadingState /> : applications.error ? (
            <ErrorState message={applications.error} onRetry={() => void applications.reload()} />
          ) : applications.data?.length ? (
            applications.data.map((application) => <ApplicationCard key={application._id} application={application} busy={Boolean(decidingId)} onDecision={confirmDecision} />)
          ) : (
            <EmptyState title="Chưa có đơn mới" message="Không có đơn xin gia nhập nào đang chờ duyệt." />
          )}
        </View>
      ) : null}
      {isAdmin && (pendingAdminLeaves.isLoading || pendingAdminLeaves.error || pendingAdminLeaves.data?.length) ? (
        <View style={styles.applicationsSection}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Đơn xin rời Chapter</Text>
            {pendingAdminLeaves.data ? <Text style={styles.count}>{pendingAdminLeaves.data.length}</Text> : null}
          </View>
          {pendingAdminLeaves.isLoading ? <LoadingState /> : pendingAdminLeaves.error ? (
            <ErrorState message={pendingAdminLeaves.error} onRetry={() => void pendingAdminLeaves.reload()} />
          ) : pendingAdminLeaves.data?.length ? (
            pendingAdminLeaves.data.map((request) => {
              const member = typeof request.userId === "object" ? request.userId : null;
              return <Card key={request._id} style={styles.applicationCard}>
                <Text style={styles.applicantName}>{member?.displayName || "Thành viên Chapter"}</Text>
                {member?.email ? <Text selectable style={styles.contactText}>{member.email}</Text> : null}
                <Text style={styles.applicationDate}>Gửi ngày {new Date(request.createdAt).toLocaleDateString("vi-VN")}</Text>
              </Card>;
            })
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.lg, gap: spacing.md },
  refreshButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  overviewCard: { gap: spacing.md },
  chairpersonSection: { gap: spacing.md },
  chairpersonCard: { gap: spacing.md },
  chairpersonName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  chairpersonRole: { color: colors.primaryDark, fontSize: 12, fontWeight: "700", marginTop: 3 },
  profileLink: { minHeight: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primarySoft, marginTop: spacing.xs },
  profileLinkText: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
  noContact: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.7 },
  chapterHeading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  chapterIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  chapterTitleWrap: { flex: 1 },
  chapterName: { color: colors.text, fontSize: 18, fontWeight: "800" },
  chapterCode: { color: colors.muted, marginTop: 3, fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  infoLabel: { width: 105, color: colors.muted, fontSize: 13, lineHeight: 20 },
  infoValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600", lineHeight: 20 },
  applicationsSection: { gap: spacing.md, marginTop: spacing.sm },
  leaveSection: { gap: spacing.md, marginTop: spacing.sm, marginBottom: spacing.xl },
  leaveButton: { minHeight: touchTarget, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger, alignItems: "center", justifyContent: "center" },
  leaveButtonText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  leavePending: { color: colors.muted, fontSize: 13 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  count: { minWidth: 28, textAlign: "center", overflow: "hidden", backgroundColor: colors.primarySoft, color: colors.primaryDark, fontWeight: "800", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  applicationCard: { gap: spacing.sm },
  applicationCompactCard: { paddingVertical: spacing.sm },
  applicationHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  applicationSummary: { flex: 1, minWidth: 0, minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  expandedChevron: { transform: [{ rotate: "180deg" }] },
  applicationDetails: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  applicationActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  decisionButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  approveButton: { backgroundColor: "#16A34A" },
  rejectButton: { backgroundColor: "#DC2626" },
  disabled: { opacity: 0.5 },
  applicantHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  applicantNameWrap: { flex: 1 },
  applicantName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  applicationDate: { color: colors.muted, fontSize: 11, marginTop: 3 },
  applicantDetail: { color: colors.text, fontSize: 12, lineHeight: 18 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  contactText: { flex: 1, color: colors.text, fontSize: 12 },
});
