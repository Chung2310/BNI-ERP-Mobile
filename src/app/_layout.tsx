import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ChatUnreadCountProvider } from "@/context/ChatUnreadCountProvider";
import { NotificationProvider } from "@/context/NotificationContext";
import { AppAlertHost } from "@/components/AppAlert";
import { PostLoginCheckInPrompt } from "@/components/PostLoginCheckInPrompt";
import { colors } from "@/theme/tokens";
import { isChapterGuest } from "@/utils/guest";

function AppNavigator() {
  const { user } = useAuth();
  const guest = isChapterGuest(user);
  return <Stack screenOptions={{ headerShown: false, orientation: "portrait", contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="login" />
    <Stack.Screen name="register" />
    <Stack.Screen name="wheel-rules" />
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="settings" />
    <Stack.Screen name="profile" />
    <Stack.Screen name="notifications" />
    <Stack.Protected guard={!guest}>
      <Stack.Screen name="meeting/[id]/index" />
      <Stack.Screen name="meeting/[id]/attendees" />
      <Stack.Screen name="meeting/[id]/game-results" />
      <Stack.Screen name="meeting/[id]/games" />
      <Stack.Screen name="meeting/[id]/slides" />
      <Stack.Screen name="meeting/[id]/reschedule" />
      <Stack.Screen name="meeting/[id]/edit" />
      <Stack.Screen name="meeting/create" />
      <Stack.Screen name="meeting/[id]/check-in" />
      <Stack.Screen name="meeting/[id]/control" />
      <Stack.Screen name="meeting/[id]/live" />
      <Stack.Screen name="meeting/[id]/interaction" />
      <Stack.Screen name="member/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="rankings" />
      <Stack.Screen name="statistics" />
      <Stack.Screen name="resources" />
      <Stack.Screen name="chapter" />
      <Stack.Screen name="org-chart" />
      <Stack.Screen name="admin/users" />
      <Stack.Screen name="admin/roles" />
    </Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <ChatUnreadCountProvider>
          <StatusBar style="dark" />
          <AppNavigator />
            <AppAlertHost />
            <PostLoginCheckInPrompt />
          </ChatUnreadCountProvider>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
