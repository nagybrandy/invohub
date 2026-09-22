// app/(app)/clients/[id]/edit.tsx
// Edit an existing client.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
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
import { useRouteParam } from "@/lib/routing/route-param";
import { useClients } from "@/hooks/useClients";
import { ClientPartyTypeSwitch } from "@/components/clients/ClientPartyTypeSwitch";
import type { ClientPartyType } from "@/lib/clients/party-type";

export default function EditClientScreen() {
  const id = useRouteParam("id");
  const { t } = useTranslation();
  const { update, getById } = useClients();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [zipCode, setZipCode] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [euVatNumber, setEuVatNumber] = React.useState("");
  const [partyType, setPartyType] = React.useState<ClientPartyType | undefined>(undefined);
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
        setZipCode(client.zipCode ?? "");
        setCountry(client.country ?? "");
        setEuVatNumber(client.euVatNumber ?? "");
        setPartyType(client.partyType);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("clients.loadFailed")))
      .finally(() => setLoading(false));
  }, [id, getById, t]);

  async function handleSave() {
    if (!id || !name.trim()) {
      setError(t("clients.nameRequired"));
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
        zipCode: zipCode.trim() || undefined,
        country: country.trim() || undefined,
        euVatNumber: euVatNumber.trim() || undefined,
        partyType,
      });
      router.replace(routes.clients);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("clients.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <FormScreen header={<PageHeader title={t("partners.editTitle")} />}>
        <ActivityIndicator />
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<PageHeader title={t("partners.editTitle")} subtitle={name} />}>
      <VStack space="md">
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("clients.name")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={name} onChangeText={setName} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("auth.email")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={email} onChangeText={setEmail} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("company.taxNumber")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={taxNumber} onChangeText={setTaxNumber} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("clients.euVatNumber")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={euVatNumber} onChangeText={setEuVatNumber} placeholder="DE123456789" />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("invoices.fields.zipCode")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={zipCode} onChangeText={setZipCode} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("company.city")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={city} onChangeText={setCity} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("company.address")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={address} onChangeText={setAddress} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("invoices.fields.country")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={country} onChangeText={setCountry} placeholder="HU" />
          </Input>
        </FormControl>
        <ClientPartyTypeSwitch value={partyType} onChange={setPartyType} />
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={handleSave} disabled={saving}>
          <ButtonText>{t("clients.saveChanges")}</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
