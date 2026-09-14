// app/(app)/settings/api-keys.tsx
// Manage public/secret API keys for external invoice issuance.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { CopyableCredential } from "@/components/settings/CopyableCredential";
import { useApiKeys } from "@/hooks/useApiKeys";
import type { CreatedApiKey } from "@/lib/api-keys/service";

export default function ApiKeysSettingsScreen() {
  const { t } = useTranslation();
  const { keys, loading, error, create, revoke } = useApiKeys();
  const [name, setName] = React.useState(t("settings.apiKeysScreen.defaultKeyName"));
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [createdKey, setCreatedKey] = React.useState<CreatedApiKey | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<{ id: string; name: string } | null>(
    null
  );
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

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
    <FormScreen header={<Heading size="2xl">{t("settings.apiKeysScreen.title")}</Heading>}>
      <VStack space="lg">
        <Text size="sm" className="text-muted-foreground">
          {t("settings.apiKeysScreen.description")}
        </Text>

        {createdKey ? (
          <Card className="border-primary/40 bg-primary/5 p-4">
            <VStack space="md">
              <VStack space="xs">
                <Text className="font-semibold text-foreground">
                  {t("settings.apiKeysScreen.newKeyTitle")}
                </Text>
                <Text size="sm" className="text-muted-foreground">
                  {t("settings.apiKeysScreen.newKeyHint")}
                </Text>
              </VStack>
              <CopyableCredential
                label={t("settings.apiKeysScreen.publicKeyLabel")}
                value={createdKey.publicKey}
              />
              <CopyableCredential
                label={t("settings.apiKeysScreen.secretKeyLabel")}
                value={createdKey.secretKey}
                hint={t("settings.apiKeysScreen.secretKeyHint")}
              />
              <Button variant="outline" onPress={() => setCreatedKey(null)}>
                <ButtonText>{t("settings.apiKeysScreen.savedSecretButton")}</ButtonText>
              </Button>
            </VStack>
          </Card>
        ) : null}

        <Card className="p-4">
          <VStack space="md">
            <Text className="font-semibold text-foreground">
              {t("settings.apiKeysScreen.exampleRequestTitle")}
            </Text>
            <Text size="xs" className="font-mono text-muted-foreground">
              POST /api/v1/invoices{"\n"}
              Authorization: Bearer {"<publicKey>:<secretKey>"}
            </Text>
            <Text size="xs" className="font-mono text-muted-foreground">
              {`{ "clientName": "Client Kft.", "lineItems": [{ "description": "Service", "quantity": 1, "unitPrice": 10000, "vatRate": 27 }], "submitToNav": true }`}
            </Text>
          </VStack>
        </Card>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("settings.apiKeysScreen.keyNameLabel")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField
              value={name}
              onChangeText={setName}
              placeholder={t("settings.apiKeysScreen.keyNamePlaceholder")}
            />
          </Input>
        </FormControl>

        <Button onPress={() => void handleCreate()} disabled={creating}>
          {creating ? <ButtonSpinner /> : <ButtonText>{t("settings.apiKeysScreen.generateButton")}</ButtonText>}
        </Button>

        {error ? <Text className="text-destructive">{error}</Text> : null}
        {message ? <Text className="text-destructive">{message}</Text> : null}

        {revokeTarget ? (
          <Card className="border-destructive/40 bg-destructive/5 p-4">
            <VStack space="md">
              <Text className="font-medium text-foreground">
                {t("settings.apiKeysScreen.revokeConfirmTitle", { name: revokeTarget.name })}
              </Text>
              <Text size="sm" className="text-muted-foreground">
                {t("settings.apiKeysScreen.revokeConfirmHint")}
              </Text>
              <HStack space="sm">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => setRevokeTarget(null)}
                  disabled={revokingId === revokeTarget.id}
                >
                  <ButtonText>{t("common.cancel")}</ButtonText>
                </Button>
                <Button
                  variant="destructive"
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
              </HStack>
            </VStack>
          </Card>
        ) : null}

        <VStack space="sm">
          <Text className="font-semibold text-foreground">
            {t("settings.apiKeysScreen.activeKeysTitle")}
          </Text>
          {loading ? <Text className="text-muted-foreground">{t("common.loading")}</Text> : null}
          {!loading && keys.length === 0 ? (
            <Text size="sm" className="text-muted-foreground">
              {t("settings.apiKeysScreen.noKeysYet")}
            </Text>
          ) : null}
          {keys.map((key) => (
            <Card key={key.id} className="p-4">
              <VStack space="sm">
                <HStack className="items-start justify-between gap-2">
                  <VStack className="flex-1" space="sm">
                    <Text className="font-medium text-foreground">{key.name}</Text>
                    <CopyableCredential
                      label={t("settings.apiKeysScreen.publicKeyLabel")}
                      value={key.publicKey}
                    />
                    <Text size="xs" className="text-muted-foreground">
                      {t("settings.apiKeysScreen.secretHiddenNote")}
                    </Text>
                    {key.lastUsedAt ? (
                      <Text size="xs" className="text-muted-foreground">
                        {t("settings.apiKeysScreen.lastUsed", {
                          date: new Date(key.lastUsedAt).toLocaleString(),
                        })}
                      </Text>
                    ) : (
                      <Text size="xs" className="text-muted-foreground">
                        {t("settings.apiKeysScreen.neverUsed")}
                      </Text>
                    )}
                  </VStack>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => setRevokeTarget({ id: key.id, name: key.name })}
                    disabled={revokingId === key.id}
                  >
                    <ButtonText>{t("settings.apiKeysScreen.revokeButton")}</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </Card>
          ))}
        </VStack>
      </VStack>
    </FormScreen>
  );
}
