// app/(app)/clients/new.tsx
// Create a new client.
import * as React from "react";
import { router } from "expo-router";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { routes } from "@/lib/navigation";
import { useClients } from "@/hooks/useClients";

export default function NewClientScreen() {
  const { create } = useClients();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await create({ name: name.trim(), email: email.trim() || undefined, taxNumber: taxNumber.trim() || undefined });
      router.replace(routes.clients);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScreen header={<Heading size="2xl">New client</Heading>}>
      <VStack space="md">
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Name</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={name} onChangeText={setName} placeholder="Acme Kft." />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Email</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={email} onChangeText={setEmail} placeholder="billing@acme.hu" />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Tax number</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={taxNumber} onChangeText={setTaxNumber} placeholder="12345678-1-23" />
          </Input>
        </FormControl>
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={handleSave} disabled={saving}>
          <ButtonText>Save client</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
