// app/(app)/settings/api-keys.tsx
// Manage public/secret API keys for external invoice issuance.
import * as React from "react";
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
  const { keys, loading, error, create, revoke } = useApiKeys();
  const [name, setName] = React.useState("External integration");
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
      const created = await create(name.trim() || "External integration");
      setCreatedKey(created);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to create key.");
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
      setMessage(e instanceof Error ? e.message : "Revoke failed.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <FormScreen header={<Heading size="2xl">API keys</Heading>}>
      <VStack space="lg">
        <Text size="sm" className="text-muted-foreground">
          Create a public key + secret key pair to issue invoices from external systems
          (ERP, scripts, integrations).
        </Text>

        {createdKey ? (
          <Card className="border-primary/40 bg-primary/5 p-4">
            <VStack space="md">
              <VStack space="xs">
                <Text className="font-semibold text-foreground">New API key — save now</Text>
                <Text size="sm" className="text-muted-foreground">
                  The secret key is shown only once. Copy both values before leaving this page.
                </Text>
              </VStack>
              <CopyableCredential label="Public key" value={createdKey.publicKey} />
              <CopyableCredential
                label="Secret key"
                value={createdKey.secretKey}
                hint="Use with the public key as Bearer publicKey:secretKey"
              />
              <Button variant="outline" onPress={() => setCreatedKey(null)}>
                <ButtonText>I saved the secret key</ButtonText>
              </Button>
            </VStack>
          </Card>
        ) : null}

        <Card className="p-4">
          <VStack space="md">
            <Text className="font-semibold text-foreground">Example request</Text>
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
            <FormControlLabelText>Key name</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={name} onChangeText={setName} placeholder="ERP integration" />
          </Input>
        </FormControl>

        <Button onPress={() => void handleCreate()} disabled={creating}>
          {creating ? <ButtonSpinner /> : <ButtonText>Generate new key pair</ButtonText>}
        </Button>

        {error ? <Text className="text-destructive">{error}</Text> : null}
        {message ? <Text className="text-destructive">{message}</Text> : null}

        {revokeTarget ? (
          <Card className="border-destructive/40 bg-destructive/5 p-4">
            <VStack space="md">
              <Text className="font-medium text-foreground">
                Revoke &quot;{revokeTarget.name}&quot;?
              </Text>
              <Text size="sm" className="text-muted-foreground">
                External systems using this key will stop working immediately.
              </Text>
              <HStack space="sm">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => setRevokeTarget(null)}
                  disabled={revokingId === revokeTarget.id}
                >
                  <ButtonText>Cancel</ButtonText>
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
                    <ButtonText>Revoke key</ButtonText>
                  )}
                </Button>
              </HStack>
            </VStack>
          </Card>
        ) : null}

        <VStack space="sm">
          <Text className="font-semibold text-foreground">Active keys</Text>
          {loading ? <Text className="text-muted-foreground">Loading…</Text> : null}
          {!loading && keys.length === 0 ? (
            <Text size="sm" className="text-muted-foreground">
              No API keys yet.
            </Text>
          ) : null}
          {keys.map((key) => (
            <Card key={key.id} className="p-4">
              <VStack space="sm">
                <HStack className="items-start justify-between gap-2">
                  <VStack className="flex-1" space="sm">
                    <Text className="font-medium text-foreground">{key.name}</Text>
                    <CopyableCredential label="Public key" value={key.publicKey} />
                    <Text size="xs" className="text-muted-foreground">
                      Secret key hidden after creation
                    </Text>
                    {key.lastUsedAt ? (
                      <Text size="xs" className="text-muted-foreground">
                        Last used {new Date(key.lastUsedAt).toLocaleString()}
                      </Text>
                    ) : (
                      <Text size="xs" className="text-muted-foreground">
                        Never used
                      </Text>
                    )}
                  </VStack>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => setRevokeTarget({ id: key.id, name: key.name })}
                    disabled={revokingId === key.id}
                  >
                    <ButtonText>Revoke</ButtonText>
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
