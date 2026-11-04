// app/+not-found.tsx
// Fallback screen for unmatched routes: landing header and footer around a
// centred message (redesign 2026-11, SPEC §10.6).
import { Link, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { PublicPage, proseStyles } from "@/components/marketing/PublicPage";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { routes } from "@/lib/navigation";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("publicSite.notFound.title") }} />
      <PublicPage testID="not-found-page">
        <Box className="mx-auto w-full max-w-[680px] items-center px-4 py-16 tab:py-24">
          <VStack className="items-center gap-6">
            <Heading className={`text-center ${proseStyles.h1}`}>
              {t("publicSite.notFound.title")}
            </Heading>
            <VStack className="w-full items-center gap-3 tab:w-auto tab:flex-row">
              <Link href={routes.home} asChild>
                <Button size="lg" className="w-full tab:w-auto">
                  <ButtonText>{t("publicSite.notFound.home")}</ButtonText>
                </Button>
              </Link>
              <Link href={routes.invoices} asChild>
                <Button size="lg" variant="tertiary" className="w-full tab:w-auto">
                  <ButtonText className="text-primary">{t("publicSite.notFound.invoices")}</ButtonText>
                </Button>
              </Link>
            </VStack>
          </VStack>
        </Box>
      </PublicPage>
    </>
  );
}
