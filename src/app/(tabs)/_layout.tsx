import { Redirect, Tabs } from "expo-router";
import { CalendarDays, Home, MessageCircle, MoreHorizontal, Users, type LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/tokens";

const icons: Record<string, LucideIcon> = {
  meetings: CalendarDays,
  members: Users,
  index: Home,
  chat: MessageCircle,
  more: MoreHorizontal,
};

export default function TabsLayout() {
  const { isLoading, token } = useAuth();
  const insets = useSafeAreaInsets();
  if (!isLoading && !token) return <Redirect href="/login" />;
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      initialRouteName="index"
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
          if (route.name === "index") {
            return (
              <View style={styles.centerIconWrapper}>
                <View
                  style={[
                    styles.centerCircle,
                    focused ? styles.centerCircleActive : styles.centerCircleInactive,
                  ]}
                >
                  <Home
                    color={focused ? "#FFFFFF" : colors.primaryDark}
                    size={22}
                    strokeWidth={1.8}
                  />
                </View>
              </View>
            );
          }
          const Icon = icons[route.name] || MoreHorizontal;
          return <Icon color={color} size={22} strokeWidth={1.8} />;
        },
      })}
    >
      <Tabs.Screen name="meetings" options={{ title: "Cuộc họp" }} />
      <Tabs.Screen name="members" options={{ title: "Thành viên" }} />
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600" },
        }}
      />
      <Tabs.Screen name="chat" options={{ title: "Trò chuyện" }} />
      <Tabs.Screen name="more" options={{ title: "Hệ thống" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerIconWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  centerCircle: {
    position: "absolute",
    top: -18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface,
  },
  centerCircleActive: {
    backgroundColor: colors.primary,
  },
  centerCircleInactive: {
    backgroundColor: colors.primarySoft,
  },
});
