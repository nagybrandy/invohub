// app/(app)/settings/company.tsx
// Company profile with billing email, tax lookup, and NAV credentials.
import * as React from "react";
import { Platform } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
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
import { useCompany } from "@/hooks/useCompany";

export default function CompanySettingsScreen() {
  const { company, loading, save, lookup } = useCompany();
  const [name, setName] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [zipCode, setZipCode] = React.useState("");
  const [bankAccount, setBankAccount] = React.useState("");
  const [invoiceEmailTo, setInvoiceEmailTo] = React.useState("");
  const [invoiceEmailCc, setInvoiceEmailCc] = React.useState("");
  const [navTechnicalUser, setNavTechnicalUser] = React.useState("");
  const [navTechnicalPassword, setNavTechnicalPassword] = React.useState("");
  const [navXmlSignKey, setNavXmlSignKey] = React.useState("");
  const [showNavSecrets, setShowNavSecrets] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);

  React.useEffect(() => {
    if (company) {
      setName(company.name);
      setTaxNumber(company.taxNumber ?? "");
      setAddress(company.address ?? "");
      setCity(company.city ?? "");
      setZipCode(company.zipCode ?? "");
      setBankAccount(company.bankAccount ?? "");
      setInvoiceEmailTo(company.invoiceEmailTo ?? "");
      setInvoiceEmailCc(company.invoiceEmailCc ?? "");
      setNavTechnicalUser(company.navTechnicalUser ?? "");
      setNavTechnicalPassword(company.navTechnicalPassword ?? "");
      setNavXmlSignKey(company.navXmlSignKey ?? "");
    }
  }, [company]);

  async function handleLookup() {
    if (!taxNumber.trim()) return;
    setLookingUp(true);
    setError(null);
    try {
      const result = await lookup(taxNumber.trim());
      const data = result.company;
      if (data) {
        if (data.name) setName(data.name);
        if (data.address) setAddress(data.address);
        if (data.city) setCity(data.city);
        if (data.zipCode) setZipCode(data.zipCode);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await save({
        name: name.trim(),
        taxNumber: taxNumber.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        invoiceEmailTo: invoiceEmailTo.trim() || undefined,
        invoiceEmailCc: invoiceEmailCc.trim() || undefined,
        navTechnicalUser: navTechnicalUser.trim() || undefined,
        navTechnicalPassword: navTechnicalPassword.trim() || undefined,
        navXmlSignKey: navXmlSignKey.trim() || undefined,
      });
      setSuccess("Company profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const maskSecrets = Platform.OS === "web" ? false : !showNavSecrets;

  if (loading && !company) {
    return (
      <FormScreen header={<Heading size="2xl">Company profile</Heading>}>
        <Text>Loading…</Text>
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<Heading size="2xl">Company profile</Heading>}>
      <VStack space="lg">
        <Text size="sm" className="text-muted-foreground">
          Company details, default invoice email recipients, and NAV API credentials.
        </Text>

        <VStack space="md">
          <Text className="font-semibold text-foreground">Company details</Text>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Tax number</FormControlLabelText>
            </FormControlLabel>
            <HStack space="sm">
              <Input className="flex-1">
                <InputField
                  value={taxNumber}
                  onChangeText={setTaxNumber}
                  placeholder="12345678-1-23"
                />
              </Input>
              <Button variant="outline" onPress={handleLookup} disabled={lookingUp}>
                <ButtonText>Lookup</ButtonText>
              </Button>
            </HStack>
          </FormControl>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Company name</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField value={name} onChangeText={setName} />
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
          <HStack space="sm">
            <FormControl className="flex-1">
              <FormControlLabel>
                <FormControlLabelText>City</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField value={city} onChangeText={setCity} />
              </Input>
            </FormControl>
            <FormControl className="w-28">
              <FormControlLabel>
                <FormControlLabelText>ZIP</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField value={zipCode} onChangeText={setZipCode} />
              </Input>
            </FormControl>
          </HStack>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Bank account</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField value={bankAccount} onChangeText={setBankAccount} />
            </Input>
          </FormControl>
        </VStack>

        <VStack space="md">
          <Text className="font-semibold text-foreground">Invoice emails</Text>
          <Text size="sm" className="text-muted-foreground">
            Default recipient when sending invoices from the app or external API. Separate multiple CC
            addresses with commas.
          </Text>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Send invoices to</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                value={invoiceEmailTo}
                onChangeText={setInvoiceEmailTo}
                placeholder="billing@client.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </Input>
          </FormControl>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>CC (optional)</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                value={invoiceEmailCc}
                onChangeText={setInvoiceEmailCc}
                placeholder="accounting@client.com, ceo@client.com"
                autoCapitalize="none"
              />
            </Input>
          </FormControl>
        </VStack>

        <VStack space="md">
          <HStack className="items-center justify-between">
            <Text className="font-semibold text-foreground">NAV Online Számla</Text>
            {Platform.OS !== "web" ? (
              <Button
                size="sm"
                variant="outline"
                onPress={() => setShowNavSecrets((v) => !v)}
              >
                <ButtonText>{showNavSecrets ? "Hide secrets" : "Show secrets"}</ButtonText>
              </Button>
            ) : null}
          </HStack>
          <Text size="sm" className="text-muted-foreground">
            Technical user credentials for NAV API integration (backend only, not shown in the app UI).
          </Text>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>NAV technical user</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                value={navTechnicalUser}
                onChangeText={setNavTechnicalUser}
                placeholder="nav_technical_user"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Input>
          </FormControl>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Technical user password</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                value={navTechnicalPassword}
                onChangeText={setNavTechnicalPassword}
                placeholder="••••••••"
                secureTextEntry={maskSecrets}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Input>
          </FormControl>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>XML sign key</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                value={navXmlSignKey}
                onChangeText={setNavXmlSignKey}
                placeholder="••••••••"
                secureTextEntry={maskSecrets}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Input>
          </FormControl>
        </VStack>

        {success ? <Text className="text-primary">{success}</Text> : null}
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={handleSave} disabled={saving}>
          <ButtonText>{saving ? "Saving…" : "Save company"}</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
