import { Redirect, Tabs } from "expo-router";
import { useContext } from "react";
import { CalendarDays, CircleUserRound, Home, MessageCircle, Users, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { ChatUnreadCountContext } from "@/context/ChatUnreadCountContext";
import { colors } from "@/theme/tokens";

const icons: Record<string, LucideIcon> = {
  meetings: CalendarDays,
  members: Users,
  index: Home,
  chat: MessageCircle,
  more: CircleUserRound,
};

export default function TabsLayout() {
  const { isLoading, token } = useAuth();
  const chatUnreadCount = useContext(ChatUnreadCountContext);
  const insets = useSafeAreaInsets();
  if (!isLoading && !token) return <Redirect href="/login" />;
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      initialRouteName="index"
      backBehavior="initialRoute"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brandBlue,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: (props) => <Pressable {...props} ref={undefined} android_ripple={{ color: "transparent" }} style={({ pressed }) => [props.style, pressed && styles.tabPressed]} />,
        tabBarStyle: {
          height: 56 + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          overflow: "visible",
        },
        tabBarItemStyle: {
          overflow: "visible",
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: "600",
        },
        tabBarIcon: ({ focused }) => {
          const Icon = icons[route.name] || Home;
          const isHome = route.name === "index";
          return (
            <View style={[styles.iconWrapper, isHome && styles.homeIconWrapper]}>
              <Icon
                color={focused ? colors.brandBlue : colors.muted}
                size={isHome ? (focused ? 24 : 23) : (focused ? 23 : 22)}
                strokeWidth={focused ? 2.2 : 1.8}
              />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="meetings" options={{ title: "Cuộc họp" }} />
      <Tabs.Screen name="members" options={{ title: "Thành viên" }} />
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen name="chat" options={{
        title: "Trò chuyện",
        tabBarBadge: chatUnreadCount > 0 ? chatUnreadCount >= 100 ? "99+" : chatUnreadCount : undefined,
        tabBarBadgeStyle: styles.chatBadge,
      }} />
      <Tabs.Screen name="more" options={{ title: "Cá nhân" }} />
      <Tabs.Screen
        name="statistics"
        options={{
          href: null,
          title: "Thống kê",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  chatBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: "#E53935", color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  tabPressed: { opacity: 0.82 },
  iconWrapper: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  homeIconWrapper: {
    transform: [{ translateY: -4 }],
  },
});
