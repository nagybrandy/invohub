// app/(app)/clients/[id]/edit.tsx
// Edit an existing client.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { routes } from "@/lib/navigation";
import { useClients } from "@/hooks/useClients";

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { update, getById } = useClients();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    void getById(id)
      .then((client) => {
        setName(client.name);
        setEmail(client.email ?? "");
        setTaxNumber(client.taxNumber ?? "");
        setAddress(client.address ?? "");
        setCity(client.city ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [id, getById]);

  async function handleSave() {
    if (!id || !name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await update(id, {
        name: name.trim(),
        email: email.trim() || undefined,
        taxNumber: taxNumber.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
      });
      router.replace(routes.clients);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <FormScreen header={<PageHeader title="Edit client" />}>
        <ActivityIndicator />
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<PageHeader title="Edit client" subtitle={name} />}>
      <VStack space="md">
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Name</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={name} onChangeText={setName} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Email</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={email} onChangeText={setEmail} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Tax number</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={taxNumber} onChangeText={setTaxNumber} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Address</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={address} onChangeText={setAddress} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>City</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={city} onChangeText={setCity} />
          </Input>
        </FormControl>
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={handleSave} disabled={saving}>
          <ButtonText>Save changes</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
