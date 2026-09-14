// app/(app)/settings/company.tsx
import * as React from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { NavEnvironmentPicker } from "@/components/settings/NavEnvironmentPicker";
import { useCompany } from "@/hooks/useCompany";
import { NAV_API_BASE_URL, type NavEnvironment } from "@/lib/nav/environment";

export default function CompanySettingsScreen() {
  const { t } = useTranslation();
  const { company, loading, save, lookup } = useCompany();
  const [name, setName] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [zipCode, setZipCode] = React.useState("");
  const [bankAccount, setBankAccount] = React.useState("");
  const [vatExempt, setVatExempt] = React.useState(false);
  const [invoiceEmailTo, setInvoiceEmailTo] = React.useState("");
  const [invoiceEmailCc, setInvoiceEmailCc] = React.useState("");
  const [navTechnicalUser, setNavTechnicalUser] = React.useState("");
  const [navTechnicalPassword, setNavTechnicalPassword] = React.useState("");
  const [navXmlSignKey, setNavXmlSignKey] = React.useState("");
  const [navEnvironment, setNavEnvironment] = React.useState<NavEnvironment>("test");
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
      setVatExempt(company.vatExempt ?? false);
      setInvoiceEmailTo(company.invoiceEmailTo ?? "");
      setInvoiceEmailCc(company.invoiceEmailCc ?? "");
      setNavTechnicalUser(company.navTechnicalUser ?? "");
      setNavTechnicalPassword(company.navTechnicalPassword ?? "");
      setNavXmlSignKey(company.navXmlSignKey ?? "");
      setNavEnvironment(company.navEnvironment ?? "test");
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
      setError(e instanceof Error ? e.message : t("settings.companySettings.lookupFailed"));
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t("settings.companySettings.nameRequired"));
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
        vatExempt,
        invoiceEmailTo: invoiceEmailTo.trim() || undefined,
        invoiceEmailCc: invoiceEmailCc.trim() || undefined,
        navTechnicalUser: navTechnicalUser.trim() || undefined,
        navTechnicalPassword: navTechnicalPassword.trim() || undefined,
        navXmlSignKey: navXmlSignKey.trim() || undefined,
        navEnvironment,
      });
      setSuccess(t("settings.companySettings.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.companySettings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const maskSecrets = Platform.OS === "web" ? false : !showNavSecrets;

  if (loading && !company) {
    return (
      <FormScreen header={<Heading size="2xl">{t("settings.companySettings.title")}</Heading>}>
        <Text>{t("common.loading")}</Text>
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<Heading size="2xl">{t("settings.companySettings.title")}</Heading>}>
      <VStack space="lg">
        <Text size="sm" className="text-muted-foreground">
          {t("settings.companySettings.subtitle")}
        </Text>

        <VStack space="md">
          <Text className="font-semibold text-foreground">{t("settings.companySettings.companyDetails")}</Text>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("company.taxNumber")}</FormControlLabelText>
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
                <ButtonText>{t("settings.companySettings.lookup")}</ButtonText>
              </Button>
            </HStack>
          </FormControl>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("company.name")}</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField value={name} onChangeText={setName} />
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
          <HStack space="sm">
            <FormControl className="flex-1">
              <FormControlLabel>
                <FormControlLabelText>{t("company.city")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField value={city} onChangeText={setCity} />
              </Input>
            </FormControl>
            <FormControl className="w-28">
              <FormControlLabel>
                <FormControlLabelText>{t("company.zip")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField value={zipCode} onChangeText={setZipCode} />
              </Input>
            </FormControl>
          </HStack>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("company.bankAccount")}</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField value={bankAccount} onChangeText={setBankAccount} />
            </Input>
          </FormControl>
          <HStack className="items-center justify-between">
            <VStack className="flex-1 pr-3">
              <Text size="sm" className="font-medium text-foreground">
                {t("company.vatExempt")}
              </Text>
              <Text size="xs" className="font-light text-muted-foreground">
                {t("company.vatExemptHint")}
              </Text>
            </VStack>
            <Switch value={vatExempt} onValueChange={setVatExempt} />
          </HStack>
        </VStack>

        <VStack space="md">
          <Text className="font-semibold text-foreground">{t("settings.companySettings.invoiceEmails")}</Text>
          <Text size="sm" className="text-muted-foreground">
            {t("settings.companySettings.invoiceEmailsDesc")}
          </Text>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("settings.companySettings.sendTo")}</FormControlLabelText>
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
              <FormControlLabelText>{t("settings.companySettings.cc")}</FormControlLabelText>
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
            <Text className="font-semibold text-foreground">{t("settings.companySettings.navSection")}</Text>
            {Platform.OS !== "web" ? (
              <Button
                size="sm"
                variant="outline"
                onPress={() => setShowNavSecrets((v) => !v)}
              >
                <ButtonText>{showNavSecrets ? t("settings.companySettings.hideSecrets") : t("settings.companySettings.showSecrets")}</ButtonText>
              </Button>
            ) : null}
          </HStack>
          <Text size="sm" className="text-muted-foreground">
            {t("settings.companySettings.navDesc")}
          </Text>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("company.navEnvironment")}</FormControlLabelText>
            </FormControlLabel>
            <NavEnvironmentPicker value={navEnvironment} onChange={setNavEnvironment} />
            <Text size="xs" className="mt-2 text-muted-foreground">
              API: {NAV_API_BASE_URL[navEnvironment]}
            </Text>
          </FormControl>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("company.navTechnicalUser")}</FormControlLabelText>
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
              <FormControlLabelText>{t("company.navTechnicalPassword")}</FormControlLabelText>
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
              <FormControlLabelText>{t("company.navXmlSignKey")}</FormControlLabelText>
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
          <ButtonText>{saving ? t("common.saving") : t("settings.companySettings.save")}</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
