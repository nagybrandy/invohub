// app/(app)/clients/new.tsx
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { create } = useClients();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setError(t("clients.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      await create({ name: name.trim(), email: email.trim() || undefined, taxNumber: taxNumber.trim() || undefined });
      router.replace(routes.clients);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("clients.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScreen header={<Heading size="2xl">{t("clients.new")}</Heading>}>
      <VStack space="md">
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("clients.name")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={name} onChangeText={setName} placeholder="Acme Kft." />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("auth.email")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={email} onChangeText={setEmail} placeholder="billing@acme.hu" />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("company.taxNumber")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={taxNumber} onChangeText={setTaxNumber} placeholder="12345678-1-23" />
          </Input>
        </FormControl>
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={handleSave} disabled={saving}>
          <ButtonText>{saving ? t("common.saving") : t("clients.save")}</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
