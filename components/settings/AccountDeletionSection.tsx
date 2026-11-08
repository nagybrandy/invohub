// components/settings/AccountDeletionSection.tsx
// Beállítások > Fiók törlésének kérése. A REVERSIBLE request only (30-day
// grace period, cancellable) — nothing is deleted from here. Rendered only
// when the UI flag is on (lib/account/deletion-flag.ts, default OFF); with the
// flag off this component returns null. Proposal + open legal questions:
// docs/decisions/2026-11-08-self-serve-account-deletion.md.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { SettingsNote, SettingsSection, SettingsSheet } from "@/components/settings/SettingsSheet";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";
import { isAccountDeletionUiVisible } from "@/lib/account/deletion-flag";
import { DELETION_GRACE_DAYS } from "@/lib/account/deletion-constants";
import { routes } from "@/lib/navigation";
import { type } from "@/lib/ui/type";

export function AccountDeletionSection({ enabled = isAccountDeletionUiVisible() }: { enabled?: boolean }) {
  if (!enabled) return null;
  return <AccountDeletionBody />;
}

function AccountDeletionBody() {
  const { t, i18n } = useTranslation();
  const { request, loading, error, requestDeletion, cancelRequest } = useAccountDeletion();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function run(action: () => Promise<void>, okText: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "ok", text: okText });
    } catch {
      setMessage({ tone: "err", text: t("accountDeletion.failed") });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  const days = String(DELETION_GRACE_DAYS);
  const scheduled = request ? new Date(request.scheduledFor).toLocaleDateString(i18n.language) : "";

  return (
    <SettingsSheet testID="account-deletion">
      <SettingsSection title={t("accountDeletion.exportTitle")} hint={t("accountDeletion.exportBody")}>
        <Button testID="account-deletion-export" variant="outline" onPress={() => router.push(routes.dataExport)}>
          <ButtonText>{t("accountDeletion.exportLink")}</ButtonText>
        </Button>
      </SettingsSection>

      <SettingsSection title={t("accountDeletion.keptTitle")}>
        <Text testID="account-deletion-kept" className={type.meta}>{t("accountDeletion.keptBody")}</Text>
      </SettingsSection>

      <SettingsSection title={t("accountDeletion.removedTitle")}>
        <Text testID="account-deletion-removed" className={type.meta}>{t("accountDeletion.removedBody")}</Text>
      </SettingsSection>

      {message ? (
        <SettingsNote tone={message.tone} testID="account-deletion-message">{message.text}</SettingsNote>
      ) : null}
      {error && !message ? <SettingsNote tone="err" testID="account-deletion-error">{t("accountDeletion.failed")}</SettingsNote> : null}

      {loading ? (
        <Text className={type.meta}>{t("accountDeletion.loading")}</Text>
      ) : request ? (
        <SettingsSection title={t("accountDeletion.pendingTitle")} hint={t("accountDeletion.pendingBody", { date: scheduled })}>
          <Button
            testID="account-deletion-cancel"
            variant="outline"
            isDisabled={busy}
            onPress={() => void run(cancelRequest, t("accountDeletion.cancelled"))}
          >
            {busy ? <ButtonSpinner /> : <ButtonText>{t("accountDeletion.cancelRequest")}</ButtonText>}
          </Button>
        </SettingsSection>
      ) : (
        <SettingsSection title={t("accountDeletion.title")} hint={t("accountDeletion.graceNote", { days })}>
          <Box className="gap-3">
            <FormField label={t("accountDeletion.reasonLabel")}>
              <Input>
                <InputField testID="account-deletion-reason" value={reason} onChangeText={setReason} maxLength={500} />
              </Input>
            </FormField>
            <Button testID="account-deletion-request" variant="dangerSolid" onPress={() => setConfirmOpen(true)}>
              <ButtonText>{t("accountDeletion.requestButton")}</ButtonText>
            </Button>
          </Box>
        </SettingsSection>
      )}

      <ConfirmDialog
        open={confirmOpen}
        destructive
        busy={busy}
        title={t("accountDeletion.confirmTitle")}
        message={t("accountDeletion.confirmMessage", { days })}
        confirmLabel={t("accountDeletion.confirmLabel")}
        cancelLabel={t("accountDeletion.cancelLabel")}
        onConfirm={() => void run(() => requestDeletion(reason), t("accountDeletion.requested"))}
        onCancel={() => setConfirmOpen(false)}
        testID="account-deletion-confirm"
      />
    </SettingsSheet>
  );
}
