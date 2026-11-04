// components/marketing/LegalPage.tsx
// Shared layout for the public legal pages: landing header and footer, prose
// column (max 680px, h1 32, h2 20, body 16/1.6). The text itself comes from
// lib/legal-content.ts and is not changed by the restyle.
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { PublicPage, proseStyles } from "@/components/marketing/PublicPage";
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
import { useIconColors } from "@/lib/theme/icon-colors";

export function LegalPage({ documentId }: { documentId: LegalDocumentId }) {
  const { i18n, t } = useTranslation();
  const icons = useIconColors();
  const document = getLegalDocument(documentId, i18n.language);

  return (
    <PublicPage testID={`legal-page-${documentId}`}>
      <VStack className={`${proseStyles.column} gap-8`}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/")}
          className="min-h-10 justify-center self-start rounded-control web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
          testID="legal-back"
        >
          <HStack className="items-center gap-2">
            <ArrowLeft size={18} color={icons.primary} />
            <Text className="text-sm font-medium text-primary">{t("legal.back")}</Text>
          </HStack>
        </Pressable>

        <Box className="rounded-card bg-warn-wash p-4" testID="legal-draft-badge">
          <Text className="text-sm font-semibold text-warn">{t("legal.draftBadge")}</Text>
        </Box>

        <VStack className="gap-1">
          <Heading size="3xl" className={proseStyles.h1}>
            {document.title}
          </Heading>
          <Text className={proseStyles.meta}>{document.updated}</Text>
        </VStack>

        {document.sections.map((section) => (
          <VStack key={section.heading} className="gap-2">
            <Heading size="xl" className={proseStyles.h2}>
              {section.heading}
            </Heading>
            <Text className={proseStyles.body}>{section.body}</Text>
          </VStack>
        ))}
      </VStack>
    </PublicPage>
  );
}
