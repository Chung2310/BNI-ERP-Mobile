import { useLocalSearchParams } from "expo-router";
import { MeetingRemoteControl } from "@/components/meetings/MeetingRemoteControl";

export default function LiveMeetingScreen() {
  const { id, panel } = useLocalSearchParams<{ id: string; panel?: string }>();
  return <MeetingRemoteControl id={id} initialPanel={panel === "responses" ? "responses" : undefined} />;
}
