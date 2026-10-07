export type UserRole = "user" | "teacher" | "manager" | "branch_owner" | "admin";

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  permissions?: string[];
  companyCode?: string;
  companyName?: string;
  branchId?: string;
  branchName?: string;
  industry?: string;
  phone?: string;
  parentId?: string;
  isActive?: boolean;
};

export type MeetingStatus = "scheduled" | "live" | "paused" | "ended" | "cancelled";

export type MeetingSummary = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  status: MeetingStatus;
  checkInCount: number;
  speakerCount: number;
};

export type MemberSummary = {
  id: string;
  initials: string;
  name: string;
  role: string;
  industry: string;
  company: string;
  online?: boolean;
};
