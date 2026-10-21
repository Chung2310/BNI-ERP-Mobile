import type { DrawFilter, Meeting } from "@/services/meeting";
import type { UserProfile } from "@/types";
import { checkedInBeforeSeven } from "@/utils/earlyCheckIn";

export type DrawParticipant = {
  id: string;
  name: string;
  photoURL?: string;
  kind: "member_present" | "member_absent" | "guest";
};

export function drawParticipants(meeting: Meeting, users: UserProfile[]): DrawParticipant[] {
  const onTimeIds = new Set(meeting.speakers
    .filter((speaker) => !speaker.deletedAccount && checkedInBeforeSeven(speaker.checkedInAt))
    .map((speaker) => speaker.id));
  const matched = new Set<string>();
  const members: DrawParticipant[] = users
    .filter((user) => user.uid && user.isActive !== false && (!meeting.companyCode || !user.companyCode || user.companyCode === meeting.companyCode))
    .map((user) => {
      const name = user.displayName?.trim() || user.email?.split("@")[0] || "Thành viên";
      const speaker = meeting.speakers.find(
        (item) =>
          item.userId === user.uid ||
          (user.email && item.email?.toLowerCase() === user.email.toLowerCase()) ||
          item.name.trim().toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi")
      );
      if (speaker) matched.add(speaker.id);
      return {
        id: speaker?.id || user.uid,
        name,
        photoURL: user.photoURL || speaker?.photoURL,
        kind: speaker ? "member_present" : "member_absent",
      };
    });
  const others: DrawParticipant[] = meeting.speakers
    .filter((speaker) => !speaker.deletedAccount && !matched.has(speaker.id))
    .map((speaker) => ({
      id: speaker.id,
      name: speaker.name,
      photoURL: speaker.photoURL,
      kind: speaker.userId ? "member_present" : "guest",
    }));
  return [...members, ...others].filter((person) => onTimeIds.has(person.id));
}

export function matchesDrawFilter(person: DrawParticipant, filter: DrawFilter) {
  if (filter === "all") return true;
  if (filter === "all_members") return person.kind !== "guest";
  if (filter === "present_members") return person.kind !== "member_absent";
  if (filter === "absent_members") return person.kind === "member_absent";
  return person.kind === "guest";
}

export function excludedDrawWinnerIds(meeting: Meeting) {
  return new Set(
    meeting.luckyDraw?.prizes.flatMap((prize) =>
      prize.winners.flatMap((item) =>
        item.repeatEligible === true ||
        (item.repeatEligible == null && meeting.luckyDraw?.allowRepeatWinners)
          ? []
          : [item.winnerId, item.userId].filter((value): value is string => Boolean(value))
      )
    ) || []
  );
}

export function projectedDrawParticipants(meeting: Meeting, users: UserProfile[]) {
  const filter = meeting.presentation?.drawFilter || "all";
  const projectedIds = meeting.presentation?.drawParticipantIds;
  const excluded = excludedDrawWinnerIds(meeting);
  const visibleWinner = meeting.presentation?.drawResultVisible !== false
    ? meeting.luckyDraw?.prizes.flatMap((prize) => prize.winners)
        .find((winner) => winner.id === meeting.presentation?.drawWinnerId)
    : undefined;
  return drawParticipants(meeting, users).filter(
    (person) =>
      matchesDrawFilter(person, filter) &&
      (!excluded.has(person.id) || person.id === visibleWinner?.winnerId || person.id === visibleWinner?.userId) &&
      (projectedIds == null || projectedIds.includes(person.id))
  );
}
