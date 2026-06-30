// app/admin/index.tsx
// Protected admin dashboard: greets the signed-in user, shows summary stat cards, and signs out.
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useSession, signOut } from "@/lib/auth-client";

const STATS = [
  { label: "Invoices issued", value: "0", hint: "This month" },
  { label: "Outstanding", value: "€0", hint: "Awaiting payment" },
  { label: "Clients", value: "0", hint: "Active" },
  { label: "NAV reports", value: "0", hint: "Submitted" },
];

export default function AdminDashboard() {
  const { data: session } = useSession();
  const user = session?.user;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
            <Text className="text-sm text-muted-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ""}.
            </Text>
          </View>
          <Button variant="outline" size="sm" onPress={handleSignOut}>
            <Text>Sign out</Text>
          </Button>
        </View>

        <View className="flex-row flex-wrap gap-4">
          {STATS.map((stat) => (
            <Card key={stat.label} className="min-w-[150px] flex-1">
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <Text className="text-xs text-muted-foreground">{stat.hint}</Text>
              </CardContent>
            </Card>
          ))}
        </View>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
            <CardDescription>Signed-in session details.</CardDescription>
          </CardHeader>
          <CardContent className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted-foreground">Email</Text>
              <Text className="text-sm text-foreground">{user?.email ?? "—"}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted-foreground">Role</Text>
              <Text className="text-sm text-foreground">
                {(user as { role?: string } | undefined)?.role ?? "user"}
              </Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
