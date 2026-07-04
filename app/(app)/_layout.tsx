// app/(app)/_layout.tsx
// Auth gate for protected invoice screens; wraps content in AppShell navigation.
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { AppShell } from "@/components/navigation/AppShell";
import { useSession } from "@/lib/auth-client";

export default function AppLayout() {
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

  return <AppShell />;
}
