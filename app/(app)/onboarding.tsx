// app/(app)/onboarding.tsx
import * as React from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
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
import { NavEnvironmentPicker } from "@/components/settings/NavEnvironmentPicker";
import { Switch } from "@/components/ui/switch";
import { useCompany } from "@/hooks/useCompany";
import { parseHungarianTaxNumber } from "@/lib/nav/customer";
import { routes } from "@/lib/navigation";
import type { NavEnvironment } from "@/lib/nav/environment";

type Step = "company" | "nav";

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { company, save, lookup } = useCompany();
  const [step, setStep] = React.useState<Step>("company");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [zipCode, setZipCode] = React.useState("");
  const [country, setCountry] = React.useState("HU");
  const [bankAccount, setBankAccount] = React.useState("");
  // AAM decides the VAT default of every line on the first invoice — asked
  // here, not left for the user to find in settings after a wrong invoice.
  const [vatExempt, setVatExempt] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);
  const [taxNumberError, setTaxNumberError] = React.useState<string | null>(null);

  const [navTechUser, setNavTechUser] = React.useState("");
  const [navTechPass, setNavTechPass] = React.useState("");
  const [navSignKey, setNavSignKey] = React.useState("");
  const [navChangeKey, setNavChangeKey] = React.useState("");
  const [navEnv, setNavEnv] = React.useState<NavEnvironment>("demo");

  React.useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setTaxNumber(company.taxNumber ?? "");
      setVatExempt(company.vatExempt ?? false);
      setAddress(company.address ?? "");
      setCity(company.city ?? "");
      setZipCode(company.zipCode ?? "");
      setCountry(company.country ?? "HU");
      setBankAccount(company.bankAccount ?? "");
      setNavTechUser(company.navTechnicalUser ?? "");
      // Secret fields (password/sign key/change key) are never pre-filled —
      // GET /api/companies only returns whether one is already set, never
      // the decrypted value. Leaving these blank on save keeps whatever is
      // already stored (see lib/companies/service.ts's patchSecretField).
      setNavEnv(company.navEnvironment ?? "demo");
    }
  }, [company]);

  function taxNumberFormatError(value: string): string | null {
    // Optional here (the finalize gate owns "required"), but if present it
    // must be the full 12345678-1-12 form NAV and the invoice need.
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = parseHungarianTaxNumber(trimmed);
    return parsed?.vatCode ? null : t("company.onboarding.taxNumberInvalid");
  }

  async function handleLookup() {
    const value = taxNumber.trim();
    if (!value) return;
    setLookingUp(true);
    setError(null);
    try {
      const result = await lookup(value);
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

  async function handleSaveCompany() {
    if (!name.trim()) {
      setError(t("company.onboarding.companyNameRequired"));
      return;
    }
    const formatError = taxNumberFormatError(taxNumber);
    setTaxNumberError(formatError);
    if (formatError) return;
    setSaving(true);
    setError(null);
    try {
      await save({
        name: name.trim(),
        taxNumber: taxNumber.trim() || undefined,
        vatExempt,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        country,
        bankAccount: bankAccount.trim() || undefined,
      });
      setStep("nav");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNav() {
    setSaving(true);
    setError(null);
    try {
      await save({
        name: name.trim() || company?.name || "",
        navTechnicalUser: navTechUser.trim() || undefined,
        navTechnicalPassword: navTechPass.trim() || undefined,
        navXmlSignKey: navSignKey.trim() || undefined,
        navXmlChangeKey: navChangeKey.trim() || undefined,
        navEnvironment: navEnv,
      });
      router.replace(routes.dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    router.replace(routes.dashboard);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="items-center gap-6 p-6 pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <VStack space="xs" className="w-full max-w-lg">
        <Heading size="2xl">{t("company.onboarding.title")}</Heading>
        <Text className="font-light text-muted-foreground">
          {t("company.onboarding.subtitle")}
        </Text>
      </VStack>

      <HStack className="w-full max-w-lg gap-2">
        <Box
          className={`h-1 flex-1 rounded-full ${
            step === "company" ? "bg-primary" : "bg-muted"
          }`}
        />
        <Box
          className={`h-1 flex-1 rounded-full ${
            step === "nav" ? "bg-primary" : "bg-muted"
          }`}
        />
      </HStack>

      {step === "company" ? (
        <Card className="w-full max-w-lg p-6">
          <VStack space="md">
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>
                  {t("company.onboarding.companyName")} *
                </FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  testID="onboarding-company-name"
                  placeholder={t("company.onboarding.companyNamePlaceholder")}
                  value={name}
                  onChangeText={setName}
                  className="font-light"
                />
              </Input>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>
                  {t("company.onboarding.taxNumber")}
                </FormControlLabelText>
              </FormControlLabel>
              <HStack space="sm" className="items-start">
                <Input className="flex-1">
                  <InputField
                    testID="onboarding-tax-number"
                    placeholder="12345678-1-12"
                    value={taxNumber}
                    onChangeText={(v) => {
                      setTaxNumber(v);
                      if (taxNumberError) setTaxNumberError(null);
                    }}
                    className="font-light"
                  />
                </Input>
                <Button
                  variant="outline"
                  onPress={handleLookup}
                  disabled={lookingUp || !taxNumber.trim()}
                  testID="onboarding-lookup"
                >
                  <ButtonText>{t("settings.companySettings.lookup")}</ButtonText>
                </Button>
              </HStack>
              {taxNumberError ? (
                <Text size="xs" className="mt-1 text-destructive" testID="onboarding-tax-number-error">
                  {taxNumberError}
                </Text>
              ) : null}
              <Text size="xs" className="mt-1 font-light text-muted-foreground">
                {t("company.onboarding.taxNumberHint")}
              </Text>
            </FormControl>

            <HStack className="items-start justify-between gap-3">
              <VStack className="flex-1">
                <Text size="sm" className="font-medium text-foreground">
                  {t("company.vatExempt")}
                </Text>
                <Text size="xs" className="font-light text-muted-foreground">
                  {t("company.vatExemptHint")}
                </Text>
              </VStack>
              <Switch
                value={vatExempt}
                onValueChange={setVatExempt}
                accessibilityLabel={t("company.vatExempt")}
                testID="onboarding-vat-exempt"
              />
            </HStack>

            <HStack space="sm" className="flex-wrap">
              <FormControl className="min-w-[100px] flex-1">
                <FormControlLabel>
                  <FormControlLabelText>
                    {t("company.onboarding.zipCode")}
                  </FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="1234"
                    value={zipCode}
                    testID="onboarding-zip"
                  onChangeText={setZipCode}
                    className="font-light"
                  />
                </Input>
              </FormControl>

              <FormControl className="min-w-[140px] flex-1">
                <FormControlLabel>
                  <FormControlLabelText>
                    {t("company.onboarding.city")}
                  </FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="Budapest"
                    value={city}
                    testID="onboarding-city"
                  onChangeText={setCity}
                    className="font-light"
                  />
                </Input>
              </FormControl>
            </HStack>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>
                  {t("company.onboarding.address")}
                </FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  placeholder={t("company.onboarding.addressPlaceholder")}
                  value={address}
                  testID="onboarding-address"
                  onChangeText={setAddress}
                  className="font-light"
                />
              </Input>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>
                  {t("company.onboarding.bankAccount")}
                </FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  placeholder="12345678-12345678-12345678"
                  value={bankAccount}
                  onChangeText={setBankAccount}
                  className="font-light"
                />
              </Input>
              <Text size="xs" className="mt-1 font-light text-muted-foreground">
                {t("company.onboarding.bankAccountHint")}
              </Text>
            </FormControl>

            {error ? (
              <Text size="sm" className="text-destructive">
                {error}
              </Text>
            ) : null}

            <Button onPress={handleSaveCompany} disabled={saving}>
              {saving ? (
                <ButtonSpinner />
              ) : (
                <ButtonText>{t("company.onboarding.save")}</ButtonText>
              )}
            </Button>
          </VStack>
        </Card>
      ) : (
        <Card className="w-full max-w-lg p-6">
          <VStack space="md">
            <VStack space="xs">
              <Heading size="lg">{t("company.onboarding.navSetup")}</Heading>
              <Text size="sm" className="font-light text-muted-foreground">
                {t("company.onboarding.navSetupHint")}
              </Text>
            </VStack>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>
                  {t("company.onboarding.navEnvironment")}
                </FormControlLabelText>
              </FormControlLabel>
              <NavEnvironmentPicker value={navEnv} onChange={setNavEnv} />
            </FormControl>

            {navEnv === "demo" ? (
              <Text size="sm" className="font-light text-muted-foreground">
                {t("company.onboarding.navDemoHint")}
              </Text>
            ) : (
              <>
                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>
                      {t("company.onboarding.navTechUser")}
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={navTechUser}
                      onChangeText={setNavTechUser}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="font-light"
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>
                      {t("company.onboarding.navTechPassword")}
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={navTechPass}
                      onChangeText={setNavTechPass}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="font-light"
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>
                      {t("company.onboarding.navSignKey")}
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={navSignKey}
                      onChangeText={setNavSignKey}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="font-light"
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>
                      {t("company.onboarding.navChangeKey")}
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={navChangeKey}
                      onChangeText={setNavChangeKey}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="font-light"
                    />
                  </Input>
                </FormControl>

                <Text size="xs" className="font-light text-muted-foreground">
                  {t("company.onboarding.navOwnOrSharedHint")}
                </Text>
              </>
            )}

            {error ? (
              <Text size="sm" className="text-destructive">
                {error}
              </Text>
            ) : null}

            <Button onPress={handleSaveNav} disabled={saving}>
              {saving ? (
                <ButtonSpinner />
              ) : (
                <ButtonText>{t("company.onboarding.save")}</ButtonText>
              )}
            </Button>

            <Pressable onPress={handleSkip} className="items-center py-1">
              <Text size="sm" className="text-muted-foreground">
                {t("company.onboarding.skip")}
              </Text>
            </Pressable>
          </VStack>
        </Card>
      )}
    </ScrollView>
  );
}
