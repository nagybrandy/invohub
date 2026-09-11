// components/marketing/CookieConsent.tsx
// Privacy-first cookie banner with persistent granular choices and reopening.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  createCookieConsent,
  loadCookieConsent,
  saveCookieConsent,
} from "@/lib/cookie-consent";

type CookieConsentProps = {
  onOpenPolicy: () => void;
  reopenRequest?: number;
};

export function CookieConsent({
  onOpenPolicy,
  reopenRequest = 0,
}: CookieConsentProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void loadCookieConsent().then((consent) => {
      if (cancelled) {
        return;
      }
      if (!consent) {
        setVisible(true);
      } else {
        setAnalytics(consent.analytics);
        setMarketing(consent.marketing);
        setVisible(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (reopenRequest > 0) {
      setVisible(true);
    }
  }, [reopenRequest]);

  async function persist(nextAnalytics: boolean, nextMarketing: boolean) {
    await saveCookieConsent(
      createCookieConsent(nextAnalytics, nextMarketing),
    );
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setVisible(false);
  }

  return (
    <Box testID="cookie-consent-root" style={{ pointerEvents: "box-none" }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        className="fixed bottom-3 left-3 z-40 rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
        testID="cookie-consent-reopen"
      >
        <Text size="xs" className="font-medium text-primary">
          {t("cookies.reopen")}
        </Text>
      </Pressable>

      {visible ? (
        <Box
          testID="cookie-consent-dialog"
          pointerEvents="auto"
          className="fixed inset-0 z-50 justify-end bg-secondary/40 p-3 md:items-center md:justify-center"
        >
          <Box
            accessibilityRole="alert"
            className="w-full max-w-[560px] rounded-2xl border border-border bg-card p-5 shadow-lg md:p-6"
          >
            <VStack space="lg">
              <VStack space="xs">
                <Heading size="lg">{t("cookies.title")}</Heading>
                <Text size="sm" className="font-light text-muted-foreground">
                  {t("cookies.description")}
                </Text>
                <Pressable accessibilityRole="link" onPress={onOpenPolicy}>
                  <Text size="sm" className="font-medium text-primary underline">
                    {t("cookies.policyLink")}
                  </Text>
                </Pressable>
              </VStack>

              <CookieCategory
                label={t("cookies.essential")}
                description={t("cookies.essentialDescription")}
                value
                disabled
              />
              <CookieCategory
                label={t("cookies.analytics")}
                description={t("cookies.analyticsDescription")}
                value={analytics}
                onValueChange={setAnalytics}
              />
              <CookieCategory
                label={t("cookies.marketing")}
                description={t("cookies.marketingDescription")}
                value={marketing}
                onValueChange={setMarketing}
              />

              <Box className="gap-2 md:flex-row md:justify-end">
                <Button
                  variant="outline"
                  onPress={() => void persist(false, false)}
                  testID="cookie-consent-essential"
                >
                  <ButtonText>{t("cookies.rejectOptional")}</ButtonText>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => void persist(analytics, marketing)}
                  testID="cookie-consent-save"
                >
                  <ButtonText>{t("cookies.save")}</ButtonText>
                </Button>
                <Button
                  onPress={() => void persist(true, true)}
                  testID="cookie-consent-accept-all"
                >
                  <ButtonText>{t("cookies.acceptAll")}</ButtonText>
                </Button>
              </Box>
            </VStack>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

function CookieCategory({
  label,
  description,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange?: (value: boolean) => void;
}) {
  return (
    <HStack className="items-center justify-between gap-4">
      <VStack className="flex-1">
        <Text size="sm" className="font-medium">
          {label}
        </Text>
        <Text size="xs" className="font-light text-muted-foreground">
          {description}
        </Text>
      </VStack>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
      />
    </HStack>
  );
}
