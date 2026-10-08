import { useLocalSearchParams } from "expo-router";
import { BackHeader } from "@/components/BackHeader";
import { ErrorState, LoadingState, Screen } from "@/components/ui";
import { InteractionManager } from "@/components/meetings/InteractionManager";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService } from "@/services/meeting";
import { hasPermission } from "@/utils/permissions";

export default function InteractionScreen() {
  const { id, readOnly } = useLocalSearchParams<{ id: string; readOnly?: string }>();
  const { user } = useAuth();
  const title = "Thu ý kiến";
  const { data, error, isLoading, reload } = useAsyncData(() => meetingService.interaction(id), id);

  if (isLoading) return <Screen><BackHeader title={title} compact /><LoadingState /></Screen>;
  if (error || !data) return <Screen><BackHeader title={title} compact /><ErrorState message={error || "Không tải được dữ liệu."} onRetry={reload} /></Screen>;

  const canManage = readOnly !== "1" && hasPermission(user, "meetings:manage", "access:manage");
  return <InteractionManager key={data.session?.id || id} meetingId={id} initial={data} canManage={canManage} canControl={false} />;
}
