// components/marketing/LegalPage.tsx
// Shared accessible layout for public legal drafts.
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  getLegalDocument,
  type LegalDocumentId,
} from "@/lib/legal-content";

export function LegalPage({ documentId }: { documentId: LegalDocumentId }) {
  const { i18n, t } = useTranslation();
  const document = getLegalDocument(documentId, i18n.language);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-[860px] px-4 py-8 md:px-8 md:py-16"
      >
        <VStack space="xl">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/")}
            className="self-start rounded-lg p-2 data-[focus-visible=true]:web:ring-2 data-[focus-visible=true]:web:ring-primary"
          >
            <HStack space="sm" className="items-center">
              <ArrowLeft size={18} color="#4675ca" />
              <Text className="font-medium text-primary">
                {t("legal.back")}
              </Text>
            </HStack>
          </Pressable>

          <Box className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <Text className="font-semibold text-amber-950">
              {t("legal.draftBadge")}
            </Text>
          </Box>

          <VStack space="xs">
            <Heading size="3xl">{document.title}</Heading>
            <Text size="sm" className="font-light text-muted-foreground">
              {document.updated}
            </Text>
          </VStack>

          {document.sections.map((section) => (
            <VStack key={section.heading} space="sm">
              <Heading size="lg">{section.heading}</Heading>
              <Text className="font-light leading-7 text-muted-foreground">
                {section.body}
              </Text>
            </VStack>
          ))}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
