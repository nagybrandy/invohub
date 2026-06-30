// app/admin/_layout.tsx
// Auth gate for the admin area: shows a spinner while resolving, redirects unauthenticated users to /login.
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useSession } from "@/lib/auth-client";

export default function AdminLayout() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
