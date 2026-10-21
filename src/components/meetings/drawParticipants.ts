import type { DrawFilter, Meeting } from "@/services/meeting";
import type { UserProfile } from "@/types";
import { checkedInByCutoff } from "@/utils/earlyCheckIn";

export type DrawParticipant = {
  id: string;
  name: string;
  photoURL?: string;
  kind: "member_present" | "member_absent" | "guest";
};

export function drawParticipants(meeting: Meeting, users: UserProfile[]): DrawParticipant[] {
  return meeting.speakers
    .filter((speaker) => !speaker.deletedAccount && !!speaker.userId && checkedInByCutoff(speaker.checkedInAt, meeting.luckyDraw?.checkInCutoffTime))
    .map((speaker) => {
      const member = users.find((user) => user.uid === speaker.userId && user.isActive !== false);
      return {
        id: speaker.id,
        name: member?.displayName?.trim() || speaker.name,
        photoURL: member?.photoURL || speaker.photoURL,
        kind: "member_present" as const,
      };
    });
}

export function matchesDrawFilter(person: DrawParticipant, _filter: DrawFilter) {
  return person.kind === "member_present";
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
  const projectedIds = meeting.presentation?.drawParticipantIds;
  const excluded = excludedDrawWinnerIds(meeting);
  const visibleWinner = meeting.presentation?.drawResultVisible !== false
    ? meeting.luckyDraw?.prizes.flatMap((prize) => prize.winners)
        .find((winner) => winner.id === meeting.presentation?.drawWinnerId)
    : undefined;
  return drawParticipants(meeting, users).filter(
    (person) =>
      matchesDrawFilter(person, "present_members") &&
      (!excluded.has(person.id) || person.id === visibleWinner?.winnerId || person.id === visibleWinner?.userId) &&
      (projectedIds == null || projectedIds.includes(person.id))
  );
}
