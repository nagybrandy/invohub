// app/(app)/settings/index.tsx
// Settings hub: profile, templates, reminders, theme, adóhatósági ellenőrzési
// adatszolgáltatás (tax-audit XML export), demo data, sign out.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Building2,
  ChevronRight,
  Database,
  FileText,
  Languages,
  LogOut,
  Mail,
  Moon,
  KeyRound,
  Shield,
} from "lucide-react-native";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { TaxAuditExportCard } from "@/components/settings/TaxAuditExportCard";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FeatureLinkCard } from "@/components/layout/FeatureLinkCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";
import { signOut, useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { useColorScheme } from "@/lib/useColorScheme";
import { useIconColors } from "@/lib/theme/icon-colors";
import { canAccessAdminPanel } from "@/lib/user-roles";

const SETTINGS_LINKS = [
  {
    href: routes.settingsCompany,
    labelKey: "settings.company",
    descKey: "settings.companyHint",
    icon: Building2,
  },
  {
    href: routes.settingsTemplates,
    labelKey: "settings.templates",
    descKey: "settings.templatesHint",
    icon: Mail,
  },
  {
    href: routes.settingsPdf,
    labelKey: "settings.pdf",
    descKey: "settings.pdfHint",
    icon: FileText,
  },
  {
    href: routes.settingsReminders,
    labelKey: "settings.reminders",
    descKey: "settings.remindersHint",
    icon: Mail,
  },
  {
    href: routes.settingsApiKeys,
    labelKey: "settings.apiKeys",
    descKey: "settings.apiKeysHint",
    icon: KeyRound,
  },
] as const;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { isDarkColorScheme, toggleTheme } = useColorScheme();
  const icons = useIconColors();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = canAccessAdminPanel(userRole);
  // The demo-seed route is a dev/demo-only tool (server-gated in lib/dev/seed-guard.ts);
  // only show the button when the deploy explicitly opts in.
  const seedEnabled = process.env.EXPO_PUBLIC_ALLOW_DEV_SEED === "true";
  const [seeding, setSeeding] = React.useState(false);
  const [seedMessage, setSeedMessage] = React.useState<string | null>(null);

  async function handleSeed() {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const result = await apiFetch<{
        clients: number;
        products: number;
        invoices: number;
        receipts: number;
        incoming: number;
        receiptLineItems: number;
        navReceiptSubmissions: number;
      }>("/api/dev/seed", { method: "POST" });
      setSeedMessage(
        t("settings.seedResult", {
          invoices: result.invoices,
          clients: result.clients,
          products: result.products,
          receipts: result.receipts,
        })
      );
    } catch (e) {
      setSeedMessage(e instanceof Error ? e.message : t("settings.seedFailed"));
    } finally {
      setSeeding(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace(routes.login);
  }

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("settings.title")}
          subtitle={t("settings.subtitle")}
        />
      }
    >
      <VStack space="lg">
        <Card className="p-4">
          <HStack className="items-center justify-between gap-4">
            <HStack space="sm" className="flex-1 items-center">
              <Languages size={20} color={icons.accent} />
              <VStack className="flex-1">
                <Text className="font-semibold text-foreground">
                  {t("language.title")}
                </Text>
                <Text size="xs" className="text-muted-foreground">
                  {t("language.hint")}
                </Text>
              </VStack>
            </HStack>
            <LanguageSwitcher />
          </HStack>
        </Card>

        <VStack space="sm">
          <Text className="font-semibold text-foreground">{t("settings.account")}</Text>
          <HStack space="sm" className="flex-wrap">
            {SETTINGS_LINKS.map((link) => (
              <FeatureLinkCard
                key={link.href as string}
                icon={link.icon}
                title={t(link.labelKey)}
                description={t(link.descKey)}
                onPress={() => router.push(link.href)}
              />
            ))}
          </HStack>
        </VStack>

        <VStack space="sm">
          <Text className="font-semibold text-foreground">{t("settings.tools")}</Text>
          <TaxAuditExportCard />
          <HStack space="sm" className="flex-wrap">
            <Pressable onPress={() => void toggleTheme()} className="flex-1 min-w-[45%]">
              <Card className="h-full p-4 active:opacity-80">
                <HStack className="items-start justify-between">
                  <VStack space="xs" className="flex-1">
                    <HStack space="sm" className="items-center">
                      <Moon size={20} color={icons.accent} />
                      <Text className="font-semibold text-foreground">
                        {t("settings.darkMode")}
                      </Text>
                    </HStack>
                    <Text size="xs" className="text-muted-foreground">
                      {isDarkColorScheme ? t("settings.darkModeOn") : t("settings.darkModeOff")}
                    </Text>
                  </VStack>
                  <ChevronRight size={16} color={icons.muted} />
                </HStack>
              </Card>
            </Pressable>
          </HStack>
        </VStack>

        {isAdmin ? (
          <VStack space="sm">
            <Text className="font-semibold text-foreground">{t("admin.title")}</Text>
            <FeatureLinkCard
              icon={Shield}
              title={t("admin.title")}
              description={t("admin.subtitle")}
              onPress={() => router.push(routes.admin)}
            />
          </VStack>
        ) : null}

        <Button variant="outline" onPress={() => void handleSignOut()}>
          <HStack space="sm" className="items-center">
            <LogOut size={18} color={icons.muted} />
            <ButtonText>{t("nav.signOut")}</ButtonText>
          </HStack>
        </Button>

        {seedEnabled ? (
          // Demoted to an outline button at the bottom (S1) — this is a
          // dev/demo-only tool, not the primary action of the settings hub,
          // and previously outranked every other button on the page.
          <Card className="p-4">
            <VStack space="md">
              <HStack space="sm" className="items-center">
                <Database size={20} color={icons.muted} />
                <VStack className="flex-1">
                  <Text className="font-medium">{t("settings.demoData")}</Text>
                  <Text size="sm" className="text-muted-foreground">
                    {t("settings.demoDataHint")}
                  </Text>
                </VStack>
              </HStack>
              <Button
                testID="settings-seed-demo-button"
                variant="outline"
                onPress={() => void handleSeed()}
                disabled={seeding}
              >
                {seeding ? <ButtonSpinner /> : <ButtonText>{t("common.seedDemo")}</ButtonText>}
              </Button>
              {seedMessage ? <Text size="sm">{seedMessage}</Text> : null}
            </VStack>
          </Card>
        ) : null}
      </VStack>
    </ScreenLayout>
  );
}
