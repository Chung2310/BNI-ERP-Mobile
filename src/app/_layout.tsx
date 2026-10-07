import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/AuthContext";
import { colors } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="meeting/[id]/index" />
          <Stack.Screen name="meeting/[id]/edit" />
          <Stack.Screen name="meeting/create" />
          <Stack.Screen name="meeting/[id]/check-in" />
          <Stack.Screen name="meeting/[id]/control" />
          <Stack.Screen name="meeting/[id]/live" />
          <Stack.Screen name="meeting/[id]/interaction" />
          <Stack.Screen name="member/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="fees" />
          <Stack.Screen name="rankings" />
          <Stack.Screen name="resources" />
          <Stack.Screen name="org-chart" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="admin/users" />
          <Stack.Screen name="admin/roles" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
