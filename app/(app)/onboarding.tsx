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
import { useCompany } from "@/hooks/useCompany";
import { routes } from "@/lib/navigation";

type Step = "company" | "nav";

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { company, save } = useCompany();
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

  const [navTechUser, setNavTechUser] = React.useState("");
  const [navTechPass, setNavTechPass] = React.useState("");
  const [navSignKey, setNavSignKey] = React.useState("");
  const [navEnv, setNavEnv] = React.useState<"test" | "production">("test");

  React.useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setTaxNumber(company.taxNumber ?? "");
      setAddress(company.address ?? "");
      setCity(company.city ?? "");
      setZipCode(company.zipCode ?? "");
      setCountry(company.country ?? "HU");
      setBankAccount(company.bankAccount ?? "");
      setNavTechUser(company.navTechnicalUser ?? "");
      setNavTechPass(company.navTechnicalPassword ?? "");
      setNavSignKey(company.navXmlSignKey ?? "");
      setNavEnv((company.navEnvironment as "test" | "production") ?? "test");
    }
  }, [company]);

  async function handleSaveCompany() {
    if (!name.trim()) {
      setError(t("company.onboarding.companyName") + " required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await save({
        name: name.trim(),
        taxNumber: taxNumber.trim() || undefined,
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
                  placeholder="Példa Kft."
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
              <Input>
                <InputField
                  placeholder="12345678-1-12"
                  value={taxNumber}
                  onChangeText={setTaxNumber}
                  className="font-light"
                />
              </Input>
              <Text size="xs" className="mt-1 font-light text-muted-foreground">
                {t("company.onboarding.taxNumberHint")}
              </Text>
            </FormControl>

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
                  placeholder="utca, házszám"
                  value={address}
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
                  {t("company.onboarding.navTechUser")}
                </FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={navTechUser}
                  onChangeText={setNavTechUser}
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
                  className="font-light"
                />
              </Input>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>
                  {t("company.onboarding.navEnvironment")}
                </FormControlLabelText>
              </FormControlLabel>
              <HStack space="sm">
                {(["test", "production"] as const).map((env) => (
                  <Pressable key={env} onPress={() => setNavEnv(env)}>
                    <Button
                      size="sm"
                      variant={navEnv === env ? "default" : "outline"}
                    >
                      <ButtonText>
                        {env === "test"
                          ? t("company.onboarding.navTest")
                          : t("company.onboarding.navProduction")}
                      </ButtonText>
                    </Button>
                  </Pressable>
                ))}
              </HStack>
            </FormControl>

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
