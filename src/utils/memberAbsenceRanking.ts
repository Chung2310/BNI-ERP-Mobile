import type { Meeting } from "@/services/meeting";
import type { UserProfile } from "@/types";

export type MemberAbsenceEntry = {
  id: string;
  name: string;
  photoURL?: string;
  eligibleCount: number;
  attendedCount: number;
  absentCount: number;
  absentRate: number;
  lateCount: number;
  totalLateMinutes: number;
};

export function buildMemberAbsenceRanking(members: UserProfile[], meetings: Meeting[]): MemberAbsenceEntry[] {
  const now = Date.now();
  const completed = [...new Map(meetings
    .filter((meeting) => meeting.status === "ended" && Date.parse(meeting.startsAt) <= now)
    .map((meeting) => [meeting._id, meeting])).values()];

  const roster = [...new Map(members
    .filter((member) => member.uid && member.role !== "admin" && member.isActive !== false)
    .map((member) => [member.uid, member])).values()];

  return roster
    .map((member) => {
      const joinedAt = member.createdAt ? Date.parse(member.createdAt) : NaN;
      let eligibleCount = 0;
      let attendedCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let totalLateMinutes = 0;
      let photoURL = member.photoURL;

      for (const meeting of completed) {
        const startsAt = Date.parse(meeting.startsAt);
        if (Number.isFinite(joinedAt) && joinedAt > startsAt) continue;
        eligibleCount += 1;
        const visits = meeting.speakers.filter((speaker) => speaker.userId === member.uid);
        if (!visits.length) {
          absentCount += 1;
          continue;
        }
        attendedCount += 1;
        if (!photoURL) photoURL = visits.find((speaker) => speaker.photoURL)?.photoURL;
        const arrivals = visits.map((speaker) => Date.parse(speaker.checkedInAt)).filter(Number.isFinite);
        const firstArrival = arrivals.length ? Math.min(...arrivals) : NaN;
        if (firstArrival > startsAt) {
          lateCount += 1;
          totalLateMinutes += (firstArrival - startsAt) / 60000;
        }
      }

      return {
        id: member.uid,
        name: member.displayName || member.email || "Thành viên",
        photoURL,
        eligibleCount,
        attendedCount,
        absentCount,
        absentRate: eligibleCount ? Math.round(absentCount * 100 / eligibleCount) : 0,
        lateCount,
        totalLateMinutes,
      };
    })
    .filter((member) => member.eligibleCount > 0)
    .sort((a, b) => b.absentCount - a.absentCount || b.lateCount - a.lateCount ||
      b.totalLateMinutes - a.totalLateMinutes || a.name.localeCompare(b.name, "vi") || a.id.localeCompare(b.id));
}
