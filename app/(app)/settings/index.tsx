// app/(app)/settings/index.tsx
// The Beállítások start page for narrow screens (the frame redirects wide ones
// to Céges profil, where the left nav is the start list): a search field, the
// grouped list of pages (title + one-line description), a separate card with
// the logout row, then the admin link and the dev-only demo seed.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Database, Shield, UserX } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { LogoutRow } from "@/components/settings/LogoutRow";
import { SettingsPage } from "@/components/settings/SettingsSheet";
import { SettingsSearchField } from "@/components/settings/SettingsSearchField";
import {
  SettingsRowCard,
  SettingsStartList,
  SettingsStartRow,
} from "@/components/settings/SettingsStartList";
import { isAccountDeletionUiVisible } from "@/lib/account/deletion-flag";
import { apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { SETTINGS_NAV_ITEMS, filterSettingsNav } from "@/lib/settings-navigation";
import { useIconColors } from "@/lib/theme/icon-colors";
import { canAccessAdminPanel } from "@/lib/user-roles";
import { isDevSeedButtonVisible } from "@/lib/dev/seed-visible";
import { type } from "@/lib/ui/type";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = canAccessAdminPanel(userRole);
  // The demo-seed route is a dev/demo-only tool (server-gated in lib/dev/seed-guard.ts);
  // only show the button when the deploy explicitly opts in.
  const seedEnabled = isDevSeedButtonVisible();
  const [seeding, setSeeding] = React.useState(false);
  const [seedMessage, setSeedMessage] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

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

  const items = filterSettingsNav(SETTINGS_NAV_ITEMS, query, t);

  return (
    <SettingsPage title={t("settings.title")} lead={t("settingsPages.startLead")} testID="settings-start">
      <SettingsSearchField value={query} onChange={setQuery} />

      {items.length === 0 ? (
        <Text testID="settings-search-empty" className={`${type.meta} px-1`}>
          {t("settingsPages.noResults", { query: query.trim() })}
        </Text>
      ) : (
        <SettingsStartList items={items} onOpen={(item) => router.push(item.href)} />
      )}

      {isAdmin ? (
        <SettingsRowCard testID="settings-admin-card">
          <SettingsStartRow
            testID="settings-admin"
            icon={Shield}
            title={t("admin.title")}
            description={t("admin.subtitle")}
            onPress={() => router.push(routes.admin)}
          />
        </SettingsRowCard>
      ) : null}

      {isAccountDeletionUiVisible() ? (
        // Feature flag EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED, default OFF: the row does not exist otherwise.
        <SettingsRowCard testID="settings-account-card">
          <SettingsStartRow
            testID="settings-account"
            icon={UserX}
            title={t("accountDeletion.title")}
            description={t("accountDeletion.navHint")}
            onPress={() => router.push(routes.settingsAccount)}
          />
        </SettingsRowCard>
      ) : null}

      <LogoutRow />

      {seedEnabled ? (
        // A dev/demo-only tool, not part of the settings: last on the page and
        // an outline button, never the primary action.
        <Box testID="settings-demo-card" className="gap-3 rounded-card bg-surface p-4 shadow-card">
          <Box className="flex-row items-center gap-3">
            <Database size={20} color={icons.muted} />
            <Box className="min-w-0 flex-1">
              <Text className={type.itemTitle}>{t("settings.demoData")}</Text>
              <Text className={`${type.meta} mt-0.5`}>{t("settings.demoDataHint")}</Text>
            </Box>
          </Box>
          <Button
            testID="settings-seed-demo-button"
            variant="outline"
            onPress={() => void handleSeed()}
            disabled={seeding}
          >
            {seeding ? <ButtonSpinner /> : <ButtonText>{t("common.seedDemo")}</ButtonText>}
          </Button>
          {seedMessage ? <Text className={type.meta}>{seedMessage}</Text> : null}
        </Box>
      ) : null}
    </SettingsPage>
  );
}
