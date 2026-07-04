// app/+not-found.tsx
// Fallback screen for unmatched routes.
import { View } from "react-native";
import { Link, Stack } from "expo-router";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/navigation";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
        <Text className="text-xl font-semibold text-foreground">
          This screen doesn&apos;t exist.
        </Text>
        <Link href={routes.home} asChild>
          <Button variant="outline">
            <ButtonText>Go home</ButtonText>
          </Button>
        </Link>
        <Link href={routes.invoices} asChild>
          <Button variant="ghost">
            <ButtonText>Go to invoices</ButtonText>
          </Button>
        </Link>
      </View>
    </>
  );
}
