// components/settings/LogoutRow.tsx
// The "Kijelentkezés / Kilépés ezen az eszközön." row in its own card (red icon
// tile). Pressing it opens the foundation's LogoutConfirm ("Kijelentkezel?");
// Mégse closes it without signing out, Kijelentkezés signs out and returns to
// the login page.
import * as React from "react";
import { router } from "expo-router";
import { LogOut } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LogoutConfirm, useLogoutConfirm } from "@/components/navigation/LogoutConfirm";
import { SettingsRowCard, SettingsStartRow } from "@/components/settings/SettingsStartList";
import { signOut } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";

export function LogoutRow() {
  const { t } = useTranslation();
  const handleSignOut = React.useCallback(async () => {
    await signOut();
    router.replace(routes.login);
  }, []);
  const logout = useLogoutConfirm(handleSignOut);

  return (
    <>
      <SettingsRowCard testID="settings-logout-card">
        <SettingsStartRow
          testID="settings-logout"
          tone="danger"
          chevron={false}
          icon={LogOut}
          title={t("settingsPages.logout.title")}
          description={t("settingsPages.logout.description")}
          onPress={logout.request}
        />
      </SettingsRowCard>
      <LogoutConfirm
        open={logout.open}
        busy={logout.busy}
        onCancel={logout.cancel}
        onConfirm={() => void logout.confirm()}
      />
    </>
  );
}
