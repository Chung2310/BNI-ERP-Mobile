import { Redirect, Tabs } from "expo-router";
import { CalendarDays, CircleUserRound, Home, MessageCircle, MoreHorizontal, Users, type LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
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
  const insets = useSafeAreaInsets();
  if (!isLoading && !token) return <Redirect href="/login" />;
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      initialRouteName="index"
      backBehavior="initialRoute"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
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
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "500" },
        tabBarIcon: ({ color, focused }) => {
          const Icon = icons[route.name] || MoreHorizontal;
          return (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <Icon
                color={focused ? colors.surface : color}
                size={focused ? 23 : 22}
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
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600" },
        }}
      />
      <Tabs.Screen name="chat" options={{ title: "Trò chuyện" }} />
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
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  iconWrapperActive: {
    transform: [{ translateY: -7 }],
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 7,
  },
});
