// app/index.tsx
// Landing page introducing InvoHub with feature highlights and auth CTAs.
import { router } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Center } from "@/components/ui/center";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

const FEATURES = [
  "NAV-compatible invoicing for Hungary",
  "Multi-currency support (EUR & HUF)",
  "Works on iOS, Android, and web",
];

export default function Landing() {
  const { data: session } = useSession();
  const icons = useIconColors();
  const isSignedIn = Boolean(session);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Center className="flex-1 px-6">
        <VStack space="2xl" className="w-full max-w-lg items-center">
          <VStack space="md" className="items-center">
            <Box className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Text className="text-2xl font-bold text-primary-foreground">
                IH
              </Text>
            </Box>
            <Heading size="3xl" className="text-center text-foreground">
              InvoHub
            </Heading>
            <Text size="md" className="max-w-md text-center text-muted-foreground">
              The bridge between you and Hungarian invoicing. NAV-compatible
              billing for foreign entrepreneurs in Hungary.
            </Text>
          </VStack>

          <VStack space="sm" className="w-full">
            {FEATURES.map((feature) => (
              <HStack key={feature} space="sm" className="items-center">
                <CheckCircle2 size={18} color={icons.muted} />
                <Text size="sm" className="text-foreground">
                  {feature}
                </Text>
              </HStack>
            ))}
          </VStack>

          <VStack space="sm" className="w-full">
            <Button
              onPress={() =>
                router.push(isSignedIn ? routes.invoices : routes.login)
              }
            >
              <ButtonText>{isSignedIn ? "Go to invoices" : "Get started"}</ButtonText>
            </Button>
            {!isSignedIn ? (
              <Button variant="outline" onPress={() => router.push(routes.login)}>
                <ButtonText>Sign in</ButtonText>
              </Button>
            ) : null}
          </VStack>

          <Text size="xs" className="text-muted-foreground">
            iOS · Android · Web — one codebase
          </Text>
        </VStack>
      </Center>
    </SafeAreaView>
  );
}
