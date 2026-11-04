// app/(app)/settings/api-keys.tsx
// Manage public/secret API keys for external invoice issuance. Only needed to
// connect an external system, so the page opens with a "skip it if you do not
// know what this is" note.
import * as React from "react";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { CopyableCredential } from "@/components/settings/CopyableCredential";
import {
  SettingsNote,
  SettingsPage,
  SettingsSection,
  SettingsSheet,
} from "@/components/settings/SettingsSheet";
import { useApiKeys } from "@/hooks/useApiKeys";
import type { CreatedApiKey } from "@/lib/api-keys/service";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";

export default function ApiKeysSettingsScreen() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const keys = settingsItemKeys("apiKeys");
  const { keys: apiKeys, loading, error, create, revoke } = useApiKeys();
  const [name, setName] = React.useState(t("settings.apiKeysScreen.defaultKeyName"));
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [createdKey, setCreatedKey] = React.useState<CreatedApiKey | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [exampleOpen, setExampleOpen] = React.useState(false);

  async function handleCreate() {
    setCreating(true);
    setMessage(null);
    setCreatedKey(null);
    try {
      const created = await create(name.trim() || t("settings.apiKeysScreen.defaultKeyName"));
      setCreatedKey(created);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("settings.apiKeysScreen.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmRevoke() {
    if (!revokeTarget) return;

    setRevokingId(revokeTarget.id);
    setMessage(null);
    try {
      await revoke(revokeTarget.id);
      if (createdKey?.id === revokeTarget.id) {
        setCreatedKey(null);
      }
      setRevokeTarget(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("settings.apiKeysScreen.revokeFailed"));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-api-keys">
      <SettingsNote tone="warn" testID="api-keys-warning">
        {t("settingsPages.apiKeys.warning")}
      </SettingsNote>

      {createdKey ? (
        <Box testID="api-key-created" className="gap-4 rounded-card border border-primary-line bg-primary-wash p-4">
          <Box className="gap-1">
            <Text className={`${type.itemTitle} text-primary-ink`}>{t("settings.apiKeysScreen.newKeyTitle")}</Text>
            <Text className="text-sm text-primary-ink">{t("settings.apiKeysScreen.newKeyHint")}</Text>
          </Box>
          <CopyableCredential
            label={t("settings.apiKeysScreen.publicKeyLabel")}
            value={createdKey.publicKey}
          />
          <CopyableCredential
            label={t("settings.apiKeysScreen.secretKeyLabel")}
            value={createdKey.secretKey}
            hint={t("settings.apiKeysScreen.secretKeyHint")}
          />
          <Box className="flex-row">
            <Button variant="secondary" onPress={() => setCreatedKey(null)}>
              <ButtonText>{t("settings.apiKeysScreen.savedSecretButton")}</ButtonText>
            </Button>
          </Box>
        </Box>
      ) : null}

      <SettingsSheet>
        <SettingsSection
          title={t("settingsPages.apiKeys.newTitle")}
          hint={t("settingsPages.apiKeys.newHint")}
          testID="api-keys-new"
        >
          <FormField label={t("settings.apiKeysScreen.keyNameLabel")}>
            <Box className="flex-row flex-wrap gap-2">
              <Input className="min-w-[180px] flex-1">
                <InputField
                  testID="api-key-name"
                  accessibilityLabel={t("settings.apiKeysScreen.keyNameLabel")}
                  value={name}
                  onChangeText={setName}
                  placeholder={t("settings.apiKeysScreen.keyNamePlaceholder")}
                />
              </Input>
              <Button
                size="form"
                onPress={() => void handleCreate()}
                disabled={creating}
                testID="api-key-generate"
              >
                {creating ? <ButtonSpinner /> : <ButtonText>{t("settings.apiKeysScreen.generateButton")}</ButtonText>}
              </Button>
            </Box>
          </FormField>
          {error ? <Text className="text-sm text-err">{error}</Text> : null}
          {message ? <Text className="text-sm text-err">{message}</Text> : null}
        </SettingsSection>

        <SettingsSection title={t("settings.apiKeysScreen.activeKeysTitle")} testID="api-keys-active">
          {revokeTarget ? (
            <Box testID="api-key-revoke-confirm" className="gap-3 rounded-control border border-err-line bg-err-wash p-4">
              <Text className={type.itemTitle}>
                {t("settings.apiKeysScreen.revokeConfirmTitle", { name: revokeTarget.name })}
              </Text>
              <Text className="text-sm text-ink">{t("settings.apiKeysScreen.revokeConfirmHint")}</Text>
              <Box className="flex-row gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onPress={() => setRevokeTarget(null)}
                  disabled={revokingId === revokeTarget.id}
                >
                  <ButtonText>{t("common.cancel")}</ButtonText>
                </Button>
                <Button
                  variant="dangerSolid"
                  className="flex-1"
                  onPress={() => void handleConfirmRevoke()}
                  disabled={revokingId === revokeTarget.id}
                >
                  {revokingId === revokeTarget.id ? (
                    <ButtonSpinner />
                  ) : (
                    <ButtonText>{t("settings.apiKeysScreen.revokeConfirmButton")}</ButtonText>
                  )}
                </Button>
              </Box>
            </Box>
          ) : null}
          {loading ? <Text className={type.meta}>{t("common.loading")}</Text> : null}
          {!loading && apiKeys.length === 0 ? (
            <Text className={type.meta}>{t("settings.apiKeysScreen.noKeysYet")}</Text>
          ) : null}
          {apiKeys.map((key) => (
            <Box key={key.id} className="gap-3 rounded-control border border-line p-3.5">
              <Box className="flex-row items-start justify-between gap-2">
                <Text className={`${type.itemTitle} min-w-0 flex-1`}>{key.name}</Text>
                <Button
                  size="sm"
                  variant="danger"
                  onPress={() => setRevokeTarget({ id: key.id, name: key.name })}
                  disabled={revokingId === key.id}
                >
                  <ButtonText>{t("settings.apiKeysScreen.revokeButton")}</ButtonText>
                </Button>
              </Box>
              <CopyableCredential label={t("settings.apiKeysScreen.publicKeyLabel")} value={key.publicKey} />
              <Text className={type.meta}>{t("settings.apiKeysScreen.secretHiddenNote")}</Text>
              <Text className={type.meta}>
                {key.lastUsedAt
                  ? t("settings.apiKeysScreen.lastUsed", { date: new Date(key.lastUsedAt).toLocaleString() })
                  : t("settings.apiKeysScreen.neverUsed")}
              </Text>
            </Box>
          ))}
        </SettingsSection>
      </SettingsSheet>

      <Box className="overflow-hidden rounded-card bg-surface shadow-card" testID="api-keys-example">
        <Pressable
          testID="api-keys-example-toggle"
          accessibilityRole="button"
          accessibilityState={{ expanded: exampleOpen }}
          onPress={() => setExampleOpen((open) => !open)}
          className="min-h-[52px] flex-row items-center gap-2 px-4 data-[hover=true]:bg-wash2"
        >
          <Box className={exampleOpen ? "rotate-90" : ""}>
            <ChevronRight size={16} color={icons.accentForeground} />
          </Box>
          <Text className="text-sm font-semibold text-primary-ink">{t("settingsPages.apiKeys.developerTitle")}</Text>
        </Pressable>
        {exampleOpen ? (
          <Box className="gap-3 border-t border-line p-4">
            <Text className="font-mono text-xs text-muted-ink">
              POST /api/v1/invoices{"\n"}
              Authorization: Bearer {"<publicKey>:<secretKey>"}
            </Text>
            <Text className="font-mono text-xs text-muted-ink">
              {`{ "clientName": "Client Kft.", "lineItems": [{ "description": "Service", "quantity": 1, "unitPrice": 10000, "vatRate": 27 }], "submitToNav": true }`}
            </Text>
          </Box>
        ) : null}
      </Box>
    </SettingsPage>
  );
}
