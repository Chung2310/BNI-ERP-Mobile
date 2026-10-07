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
  company?: string | { name?: string; code?: string; title?: string };
  branchId?: string;
  branchName?: string;
  industry?: string;
  phone?: string;
  phoneNumber?: string;
  coverUrl?: string;
  coverImage?: string;
  galleryImages?: string[];
  birthDate?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  targetMarket?: string;
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
  role?: string;
  industry: string;
  company: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  coverUrl?: string;
  online?: boolean;
};
