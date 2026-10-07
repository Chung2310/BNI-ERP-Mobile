import { Redirect } from "expo-router";
import { Screen, LoadingState } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function IndexScreen() {
  const { isLoading, token } = useAuth();
  if (isLoading) return <Screen scroll={false}><LoadingState label="Đang khởi tạo iGen Connect..." /></Screen>;
  return <Redirect href={token ? "/(tabs)" : "/login"} />;
}
