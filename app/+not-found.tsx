// app/+not-found.tsx
// Fallback screen for unmatched routes.
import { View } from "react-native";
import { Link, Stack } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
        <Text className="text-xl font-semibold text-foreground">
          This screen doesn&apos;t exist.
        </Text>
        <Link href="/" asChild>
          <Button variant="outline">
            <Text>Go home</Text>
          </Button>
        </Link>
      </View>
    </>
  );
}
