// app/(app)/settings/api-keys.tsx
// Manage public/secret API keys for external invoice issuance.
import * as React from "react";
import { Alert, Platform } from "react-native";
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
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { useApiKeys } from "@/hooks/useApiKeys";

function copyHint(label: string, value: string) {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(value);
    Alert.alert("Copied", `${label} copied to clipboard.`);
  } else {
    Alert.alert(label, value);
  }
}

export default function ApiKeysSettingsScreen() {
  const { keys, loading, error, create, revoke } = useApiKeys();
  const [name, setName] = React.useState("External integration");
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setMessage(null);
    try {
      const created = await create(name.trim() || "External integration");
      Alert.alert(
        "API key created",
        `Public key:\n${created.publicKey}\n\nSecret key (save now — shown once):\n${created.secretKey}`,
        [
          {
            text: "Copy secret",
            onPress: () => copyHint("Secret key", created.secretKey),
          },
          { text: "OK" },
        ]
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to create key.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, label: string) {
    Alert.alert("Revoke API key", `Revoke "${label}"? External systems using it will stop working.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: () =>
          void revoke(id).catch((e) =>
            setMessage(e instanceof Error ? e.message : "Revoke failed.")
          ),
      },
    ]);
  }

  return (
    <FormScreen header={<Heading size="2xl">API keys</Heading>}>
      <VStack space="lg">
        <Text size="sm" className="text-muted-foreground">
          Create a public key + secret key pair to issue invoices from external systems
          (ERP, scripts, integrations).
        </Text>

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
                  <VStack className="flex-1">
                    <Text className="font-medium text-foreground">{key.name}</Text>
                    <Pressable onPress={() => copyHint("Public key", key.publicKey)}>
                      <Text size="xs" className="font-mono text-primary">
                        {key.publicKey}
                      </Text>
                    </Pressable>
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
                    onPress={() => void handleRevoke(key.id, key.name)}
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
