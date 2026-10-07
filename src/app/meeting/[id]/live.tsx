import { useLocalSearchParams } from "expo-router";
import { MeetingRemoteControl } from "@/components/meetings/MeetingRemoteControl";

export default function LiveMeetingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MeetingRemoteControl id={id} />;
}
