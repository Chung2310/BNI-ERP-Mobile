import { chapterService, type ChapterApplication } from "@/services/chapters";
import type { NotificationItem } from "@/services/notifications";
import type { UserProfile } from "@/types";

export type ChapterNotification = NotificationItem & { destination: "/chapter" | "/(tabs)/chapters" };

function applicationTime(application: ChapterApplication) {
  return application.createdAt || new Date(0).toISOString();
}

export async function getChapterNotifications(user: UserProfile): Promise<ChapterNotification[]> {
  if (user.role === "admin" && user.companyCode) {
    const [applications, leaves] = await Promise.all([
      chapterService.pendingApplications(),
      chapterService.pendingLeaveRequests(),
    ]);
    const joinNotices: ChapterNotification[] = applications.map((application) => ({
      _id: `chapter-application:${application._id}`,
      title: "Đơn xin gia nhập Chapter",
      body: `${application.profileSnapshot?.displayName?.trim() || "Một người dùng"} đã nộp đơn xin gia nhập Chapter của bạn.`,
      type: "he-thong",
      read: false,
      createdAt: applicationTime(application),
      destination: "/chapter",
    }));
    const leaveNotices: ChapterNotification[] = leaves.map((request) => ({
      _id: `chapter-leave-pending:${request._id}`,
      title: "Đơn xin rời Chapter",
      body: `${typeof request.userId === "object" ? request.userId.displayName?.trim() || "Một thành viên" : "Một thành viên"} đã gửi đơn xin rời Chapter của bạn.`,
      type: "he-thong",
      read: false,
      createdAt: request.createdAt,
      destination: "/chapter",
    }));
    return [...joinNotices, ...leaveNotices];
  }

  const [applications, leaves] = await Promise.all([
    chapterService.myApplications(),
    chapterService.leaveRequests(),
  ]);
  const resolved = applications.filter((application) =>
    application.status === "approved" || application.status === "rejected" || application.status === "withdrawn",
  );
  const approvedLeaves = leaves.filter((request) => request.status === "approved");
  if (!resolved.length && !approvedLeaves.length) return [];
  const chapterNames = await chapterService.openChapters()
    .then((chapters) => new Map(chapters.map((chapter) => [chapter.code, chapter.name])))
    .catch(() => new Map<string, string>());

  const applicationNotices: ChapterNotification[] = resolved.map((application) => {
    const chapterName = chapterNames.get(application.chapterCode || "") || application.chapterCode || "này";
    const status = application.status;
    return {
      _id: `chapter-${status}:${application._id}`,
      title: status === "approved" ? "Đơn gia nhập Chapter đã được duyệt"
        : status === "rejected" ? "Đơn gia nhập Chapter bị từ chối" : "Đơn gia nhập Chapter đã hủy",
      body: status === "approved"
        ? `Bạn đã được duyệt trở thành thành viên Chapter ${chapterName}. Chúc bạn có những kết nối tuyệt vời!`
        : status === "rejected" ? `Đơn gia nhập Chapter ${chapterName} của bạn đã bị từ chối.`
          : `Đơn gia nhập Chapter ${chapterName} của bạn đã được hủy.`,
      type: "he-thong" as const,
      read: false,
      createdAt: application.decidedAt || applicationTime(application),
      destination: status === "approved" ? "/chapter" as const : "/(tabs)/chapters" as const,
    };
  });
  const leaveNotices: ChapterNotification[] = approvedLeaves.map((request) => ({
    _id: `chapter-leave-approved:${request._id}`,
    title: "Đơn rời Chapter đã được duyệt",
    body: `Yêu cầu rời Chapter ${chapterNames.get(request.chapterCode) || request.chapterCode} của bạn đã được duyệt. Bạn có thể xem các Chapter đang mở để tiếp tục kết nối.`,
    type: "he-thong",
    read: false,
    createdAt: request.decidedAt || request.createdAt,
    destination: "/(tabs)/chapters",
  }));
  return [...applicationNotices, ...leaveNotices];
}
