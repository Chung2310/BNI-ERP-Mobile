import { useLocalSearchParams } from "expo-router";
import { BackHeader } from "@/components/BackHeader";
import { ErrorState, LoadingState, Screen } from "@/components/ui";
import { InteractionManager } from "@/components/meetings/InteractionManager";
import { LuckyDrawManager } from "../../../components/meetings/LuckyDrawManager";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type LuckyDraw, type MeetingInteraction } from "@/services/meeting";
import { hasPermission } from "@/utils/permissions";

export default function InteractionScreen() {
  const { id, section, readOnly } = useLocalSearchParams<{ id: string; section?: string; readOnly?: string }>();
  const { user } = useAuth();
  const drawMode = section === "luckyDraw";
  const title = drawMode ? "Vòng quay may mắn" : "Thu ý kiến";
  const { data, error, isLoading, reload } = useAsyncData<
    { kind: "luckyDraw"; draw: LuckyDraw } | { kind: "interaction"; interaction: MeetingInteraction }
  >(
    () => drawMode
      ? meetingService.luckyDraw(id).then((draw) => ({ kind: "luckyDraw" as const, draw }))
      : meetingService.interaction(id).then((interaction) => ({ kind: "interaction" as const, interaction })),
    `${id}:${section || "interaction"}`,
  );

  if (isLoading) return <Screen><BackHeader title={title} /><LoadingState /></Screen>;
  if (error || !data) return <Screen><BackHeader title={title} /><ErrorState message={error || "Không tải được dữ liệu."} onRetry={reload} /></Screen>;

  const canManage = readOnly !== "1" && hasPermission(user, "meetings:manage", "access:manage");
  return data.kind === "luckyDraw"
    ? <LuckyDrawManager key={JSON.stringify(data.draw)} meetingId={id} initial={data.draw} canManage={canManage} reload={reload} />
    : <InteractionManager key={JSON.stringify(data.interaction)} meetingId={id} initial={data.interaction} canManage={canManage} reload={reload} />;
}
