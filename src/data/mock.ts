import type { MeetingSummary, MemberSummary } from "@/types";

export const mockMeetings: MeetingSummary[] = [
  {
    id: "chapter-october",
    title: "Họp Chapter tháng 10",
    startsAt: "2026-10-07T07:00:00+07:00",
    endsAt: "2026-10-07T09:00:00+07:00",
    location: "Riverside Palace",
    status: "live",
    checkInCount: 48,
    speakerCount: 17,
  },
  {
    id: "business-week-2",
    title: "Business Meeting tuần 2",
    startsAt: "2026-10-14T07:00:00+07:00",
    endsAt: "2026-10-14T09:00:00+07:00",
    location: "Riverside Palace",
    status: "scheduled",
    checkInCount: 0,
    speakerCount: 0,
  },
  {
    id: "new-member-training",
    title: "Đào tạo thành viên mới",
    startsAt: "2026-10-20T14:00:00+07:00",
    endsAt: "2026-10-20T16:00:00+07:00",
    location: "Phòng họp trực tuyến",
    status: "scheduled",
    checkInCount: 0,
    speakerCount: 0,
  },
];

export const mockMembers: MemberSummary[] = [
  { id: "nguyen-thanh", initials: "NT", name: "Nguyễn Thành", role: "Giám đốc Chapter", industry: "Công nghệ", company: "iGen Technology", email: "thanh.nguyen@igen.vn", phone: "0901234567", online: true },
  { id: "le-huong", initials: "LH", name: "Lê Hương", role: "Phó giám đốc", industry: "Tài chính", company: "FinPlus", email: "huong.le@finplus.vn", phone: "0912345678", online: true },
  { id: "tran-vu", initials: "TV", name: "Trần Vũ", role: "Thư ký", industry: "Sự kiện", company: "V Event", email: "vu.tran@vevent.com", phone: "0987654321" },
  { id: "pham-minh", initials: "PM", name: "Phạm Minh", role: "Thành viên", industry: "Xây dựng", company: "Minh Build", email: "minh.pham@minhbuild.vn", phone: "0934567890" },
  { id: "hoang-anh", initials: "HA", name: "Hoàng Anh", role: "Thành viên", industry: "Marketing", company: "HA Media", email: "anh.hoang@hamedia.vn", phone: "0945678901", online: true },
  { id: "do-nam", initials: "DN", name: "Đỗ Nam", role: "Thành viên", industry: "Logistics", company: "Nam Logistics", email: "nam.do@namlogistics.vn", phone: "0956789012" },
];
