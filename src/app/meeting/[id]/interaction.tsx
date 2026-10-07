import { useLocalSearchParams } from "expo-router";
import { BackHeader } from "@/components/BackHeader";
import { ErrorState, LoadingState, Screen } from "@/components/ui";
import { InteractionManager } from "@/components/meetings/InteractionManager";
import { LuckyDrawManager } from "../../../components/meetings/LuckyDrawManager";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { hasPermission } from "@/utils/permissions";

export default function InteractionScreen() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const { user } = useAuth();
  const drawMode = section === "luckyDraw";
  const title = drawMode ? "Quay thưởng" : "Tương tác";
  const { data, error, isLoading, reload } = useAsyncData(
    () => Promise.all([meetingService.interaction(id), meetingService.luckyDraw(id)]),
    `${id}:${section || "interaction"}`,
  );

  if (isLoading) return <Screen><BackHeader title={title} /><LoadingState /></Screen>;
  if (error || !data) return <Screen><BackHeader title={title} /><ErrorState message={error || "Không tải được dữ liệu."} onRetry={reload} /></Screen>;

  const canManage = hasPermission(user, "meetings:manage", "access:manage");
  return drawMode
    ? <LuckyDrawManager key={JSON.stringify(data[1])} meetingId={id} initial={data[1]} canManage={canManage} reload={reload} />
    : <InteractionManager key={JSON.stringify(data[0])} meetingId={id} initial={data[0]} canManage={canManage} reload={reload} />;
}
