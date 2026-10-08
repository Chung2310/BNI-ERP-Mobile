import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/AuthContext";
import { AppAlertHost } from "@/components/AppAlert";
import { colors } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, orientation: "portrait", contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="meeting/[id]/index" />
          <Stack.Screen name="meeting/[id]/attendees" />
          <Stack.Screen name="meeting/[id]/game-results" />
          <Stack.Screen name="meeting/[id]/games" />
          <Stack.Screen name="meeting/[id]/slides" />
          <Stack.Screen name="meeting/[id]/edit" />
          <Stack.Screen name="meeting/create" />
          <Stack.Screen name="meeting/[id]/check-in" />
          <Stack.Screen name="meeting/[id]/control" />
          <Stack.Screen name="meeting/[id]/live" />
          <Stack.Screen name="meeting/[id]/watch" />
          <Stack.Screen name="meeting/[id]/interaction" />
          <Stack.Screen name="meeting/[id]/respond" />
          <Stack.Screen name="member/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="rankings" />
          <Stack.Screen name="statistics" />
          <Stack.Screen name="resources" />
          <Stack.Screen name="org-chart" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="admin/users" />
          <Stack.Screen name="admin/roles" />
        </Stack>
        <AppAlertHost />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
