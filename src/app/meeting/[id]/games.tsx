import { useLocalSearchParams } from "expo-router";
import { MeetingGamePanel } from "@/components/meetings/MeetingGamePanel";

export default function MeetingGamesScreen() {
  const { id, game } = useLocalSearchParams<{ id: string; game?: string }>();
  return <MeetingGamePanel id={id} initialGame={game} />;
}
