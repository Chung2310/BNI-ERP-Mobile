import { useLocalSearchParams } from "expo-router";
import { MeetingGamePanel } from "@/components/meetings/MeetingGamePanel";

export default function MeetingGamesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MeetingGamePanel id={id} />;
}
