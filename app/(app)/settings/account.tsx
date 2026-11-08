// app/(app)/settings/account.tsx
// Fiók törlésének kérése — a flag-gated, reversible request screen. With the
// UI flag off (default) the route redirects back to the settings start and
// renders nothing. See docs/decisions/2026-11-08-self-serve-account-deletion.md.
import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/components/settings/SettingsSheet";
import { AccountDeletionSection } from "@/components/settings/AccountDeletionSection";
import { isAccountDeletionUiVisible } from "@/lib/account/deletion-flag";
import { routes } from "@/lib/navigation";

export default function AccountSettingsScreen() {
  const { t } = useTranslation();
  if (!isAccountDeletionUiVisible()) return <Redirect href={routes.settings} />;
  return (
    <SettingsPage title={t("accountDeletion.title")} lead={t("accountDeletion.lead")} testID="settings-account">
      <AccountDeletionSection />
    </SettingsPage>
  );
}
