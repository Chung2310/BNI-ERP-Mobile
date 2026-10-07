import { Redirect, Tabs } from "expo-router";
import { CalendarDays, Home, MessageCircle, MoreHorizontal, Users, type LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/tokens";

const icons: Record<string, LucideIcon> = { index: Home, meetings: CalendarDays, members: Users, chat: MessageCircle, more: MoreHorizontal };

export default function TabsLayout() {
  const { isLoading, token } = useAuth();
  const insets = useSafeAreaInsets();
  if (!isLoading && !token) return <Redirect href="/login" />;
  const bottomPadding = Math.max(insets.bottom, 10);
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 54 + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarIcon: ({ color, size }) => { const Icon = icons[route.name] || MoreHorizontal; return <Icon color={color} size={size} strokeWidth={2.1} />; },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Trang chủ" }} />
      <Tabs.Screen name="meetings" options={{ title: "Cuộc họp" }} />
      <Tabs.Screen name="members" options={{ title: "Thành viên" }} />
      <Tabs.Screen name="chat" options={{ title: "Trò chuyện" }} />
      <Tabs.Screen name="more" options={{ title: "Thêm" }} />
    </Tabs>
  );
}
