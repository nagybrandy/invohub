// components/invoices/InvoicesEmptyState.tsx
// Empty invoice list placeholder — rendered outside FlatList to avoid web style injection bugs.
import { router } from "expo-router";
import { FileText } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Center } from "@/components/ui/center";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

export function InvoicesEmptyState() {
  const icons = useIconColors();
  return (
    <Center className="flex-1 py-16">
      <VStack space="md" className="items-center px-6">
        <FileText size={48} color={icons.muted} />
        <Heading size="lg" className="text-center">
          No invoices yet
        </Heading>
        <Text size="sm" className="text-center text-muted-foreground">
          Create your first NAV-ready invoice to get started.
        </Text>
        <Button onPress={() => router.push(routes.newInvoice)}>
          <ButtonText>Create your first invoice</ButtonText>
        </Button>
      </VStack>
    </Center>
  );
}
