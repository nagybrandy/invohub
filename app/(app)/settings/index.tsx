// app/(app)/settings/index.tsx
// Settings hub: profile, templates, reminders, theme, export, demo data, sign out.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Building2,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileText,
  Languages,
  LogOut,
  Mail,
  Moon,
  KeyRound,
  Shield,
} from "lucide-react-native";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
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
  const [seeding, setSeeding] = React.useState(false);
  const [promoting, setPromoting] = React.useState(false);
  const [seedMessage, setSeedMessage] = React.useState<string | null>(null);

  async function handlePromoteAdmin() {
    setPromoting(true);
    setSeedMessage(null);
    try {
      await apiFetch("/api/dev/seed", {
        method: "POST",
        body: JSON.stringify({ promoteAdmin: true }),
      });
      setSeedMessage(t("settings.promoteSuccess"));
    } catch (e) {
      setSeedMessage(e instanceof Error ? e.message : t("settings.promoteFailed"));
    } finally {
      setPromoting(false);
    }
  }

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

  function handleExport() {
    const from = "2026-01-01";
    const to = new Date().toISOString().slice(0, 10);
    if (typeof window !== "undefined") {
      window.open(`/api/export/tax-audit?from=${from}&to=${to}`, "_blank");
    }
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
          <HStack space="sm" className="flex-wrap">
            <FeatureLinkCard
              icon={FileSpreadsheet}
              title={t("settings.export")}
              description={t("settings.exportHint")}
              onPress={handleExport}
            />
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

        <Card className="p-4">
          <VStack space="md">
            <HStack space="sm" className="items-center">
              <Database size={20} color={icons.accent} />
              <VStack className="flex-1">
                <Text className="font-medium">{t("settings.demoData")}</Text>
                <Text size="sm" className="text-muted-foreground">
                  {t("settings.demoDataHint")}
                </Text>
              </VStack>
            </HStack>
            <Button onPress={() => void handleSeed()} disabled={seeding}>
              {seeding ? <ButtonSpinner /> : <ButtonText>{t("common.seedDemo")}</ButtonText>}
            </Button>
            {!isAdmin ? (
              <Button variant="outline" onPress={() => void handlePromoteAdmin()} disabled={promoting}>
                {promoting ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>{t("settings.promoteAdmin")}</ButtonText>
                )}
              </Button>
            ) : null}
            {seedMessage ? <Text size="sm">{seedMessage}</Text> : null}
          </VStack>
        </Card>

        <Button variant="outline" onPress={() => void handleSignOut()}>
          <HStack space="sm" className="items-center">
            <LogOut size={18} color={icons.muted} />
            <ButtonText>{t("nav.signOut")}</ButtonText>
          </HStack>
        </Button>
      </VStack>
    </ScreenLayout>
  );
}
