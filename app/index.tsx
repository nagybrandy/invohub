// app/index.tsx
// Landing page — minimal hero introducing InvoHub with a CTA into the auth flow.
import { View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function Landing() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <View className="items-center gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Text className="text-2xl font-bold text-primary-foreground">
              IH
            </Text>
          </View>
          <Text className="text-4xl font-bold tracking-tight text-foreground">
            InvoHub
          </Text>
          <Text className="max-w-md text-center text-base text-muted-foreground">
            The bridge between you and Hungarian invoicing. NAV-compatible
            billing for foreign entrepreneurs in Hungary.
          </Text>
        </View>

        <View className="w-full max-w-sm gap-3">
          <Link href="/login" asChild>
            <Button>
              <Text>Get started</Text>
            </Button>
          </Link>
          <Link href="/admin" asChild>
            <Button variant="outline">
              <Text>Admin dashboard</Text>
            </Button>
          </Link>
        </View>

        <Text className="text-xs text-muted-foreground">
          iOS · Android · Web — one codebase
        </Text>
      </View>
    </SafeAreaView>
  );
}
