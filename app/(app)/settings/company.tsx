// app/(app)/settings/company.tsx
import * as React from "react";
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
import { Badge, BadgeText } from "@/components/ui/badge";
import { FormScreen } from "@/components/layout/FormScreen";
import { NavEnvironmentPicker } from "@/components/settings/NavEnvironmentPicker";
import { useCompany } from "@/hooks/useCompany";
import { apiFetch, ApiError } from "@/lib/api/client";
import { navResultI18nKey } from "@/lib/nav/nav-error-i18n";
import { NAV_API_BASE_URL, type NavEnvironment } from "@/lib/nav/environment";

type NavConfig = { sharedTestAvailable: boolean; productionEnabled: boolean; encryptionConfigured: boolean };
type NavCheckResult = {
  ok: boolean;
  /** Machine-readable outcome; what the UI translates (lib/nav/nav-error-i18n.ts). */
  code?: string;
  /** English, for logs and the public API — never rendered here. */
  message?: string;
  error?: string;
  source?: "own" | "shared";
};

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
  const [navXmlChangeKey, setNavXmlChangeKey] = React.useState("");
  const [navEnvironment, setNavEnvironment] = React.useState<NavEnvironment>("demo");
  const [showNavSecrets, setShowNavSecrets] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);
  const [navConfig, setNavConfig] = React.useState<NavConfig | null>(null);
  const [checkingNav, setCheckingNav] = React.useState(false);
  const [navCheckResult, setNavCheckResult] = React.useState<NavCheckResult | null>(null);

  React.useEffect(() => {
    apiFetch<NavConfig>("/api/nav/config")
      .then(setNavConfig)
      .catch(() => setNavConfig(null));
  }, []);

  async function handleCheckNavConnection() {
    setCheckingNav(true);
    setNavCheckResult(null);
    try {
      // Tests the values currently typed into the form, not (only) whatever
      // was last saved — otherwise editing credentials and hitting "Test
      // connection" silently re-checks the old saved ones.
      const result = await apiFetch<NavCheckResult>("/api/nav/check", {
        method: "POST",
        body: JSON.stringify({
          navEnvironment,
          navTechnicalUser: navTechnicalUser.trim() || undefined,
          navTechnicalPassword: navTechnicalPassword.trim() || undefined,
          navXmlSignKey: navXmlSignKey.trim() || undefined,
          navXmlChangeKey: navXmlChangeKey.trim() || undefined,
          taxNumber: taxNumber.trim() || undefined,
        }),
      });
      setNavCheckResult(result);
    } catch (e) {
      setNavCheckResult({ ok: false, code: e instanceof ApiError ? e.code : undefined });
    } finally {
      setCheckingNav(false);
    }
  }

  // A stale ok/fail result from a previous check must not linger once the
  // user edits environment or credentials again — otherwise a still-shown
  // "connection successful" can silently describe values that no longer
  // match what's in the form.
  React.useEffect(() => {
    setNavCheckResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navEnvironment, navTechnicalUser, navTechnicalPassword, navXmlSignKey, navXmlChangeKey]);

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
      // Secret fields are never pre-filled from the server response — GET
      // /api/companies only ever returns navTechnicalPasswordSet/
      // navXmlSignKeySet/navXmlChangeKeySet booleans, never the decrypted
      // value, so the form starts blank and shows an "already set" hint
      // instead (see the isSet indicators below). Leaving a field blank on
      // save keeps whatever secret is already stored — see
      // lib/companies/service.ts's patchSecretField.
      setNavEnvironment(company.navEnvironment ?? "demo");
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
        navXmlChangeKey: navXmlChangeKey.trim() || undefined,
        navEnvironment,
      });
      setSuccess(t("settings.companySettings.saved"));
      setNavCheckResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.companySettings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  // Nothing decrypted is ever pre-filled into these fields anymore (see
  // the company-load effect above), so masking by default and letting the
  // toggle reveal what's currently being *typed* is safe on every
  // platform — there's no longer a web-only "never masked" branch here.
  const maskSecrets = !showNavSecrets;

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
            <HStack space="xs" className="items-center flex-wrap">
              <Text className="font-semibold text-foreground">{t("company.navTestSection.title")}</Text>
              {navEnvironment === "demo" ? (
                <Badge variant="outline" className="border-primary/40">
                  <BadgeText className="text-[10px] text-primary">
                    {t("company.navTestSection.demoBadge")}
                  </BadgeText>
                </Badge>
              ) : null}
            </HStack>
            {navEnvironment !== "demo" ? (
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
            {t("company.navTestSection.description")}
          </Text>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("company.navEnvironment")}</FormControlLabelText>
            </FormControlLabel>
            <NavEnvironmentPicker value={navEnvironment} onChange={setNavEnvironment} />
            {navEnvironment !== "demo" ? (
              <Text size="xs" className="mt-2 text-muted-foreground">
                API: {NAV_API_BASE_URL[navEnvironment]}
              </Text>
            ) : null}
          </FormControl>

          {navEnvironment === "test" && navConfig?.sharedTestAvailable && !navTechnicalUser.trim() ? (
            <Text size="sm" className="text-muted-foreground">
              {t("company.navTestSection.sharedAccount")} — {t("company.navTestSection.sharedAccountHint")}
            </Text>
          ) : null}

          {navEnvironment !== "demo" ? (
            <>
              <Text size="sm" className="font-medium text-foreground">
                {t("company.navTestSection.ownAccount")}
              </Text>
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
                {company?.navTechnicalPasswordSet ? (
                  <Text size="xs" className="mt-1 text-muted-foreground">
                    {t("settings.companySettings.secretAlreadySet")}
                  </Text>
                ) : null}
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
                {company?.navXmlSignKeySet ? (
                  <Text size="xs" className="mt-1 text-muted-foreground">
                    {t("settings.companySettings.secretAlreadySet")}
                  </Text>
                ) : null}
              </FormControl>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("company.navXmlChangeKey")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    value={navXmlChangeKey}
                    onChangeText={setNavXmlChangeKey}
                    placeholder="••••••••"
                    secureTextEntry={maskSecrets}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Input>
                {company?.navXmlChangeKeySet ? (
                  <Text size="xs" className="mt-1 text-muted-foreground">
                    {t("settings.companySettings.secretAlreadySet")}
                  </Text>
                ) : null}
              </FormControl>

              <HStack space="sm" className="items-center flex-wrap">
                <Button size="sm" variant="outline" onPress={handleCheckNavConnection} disabled={checkingNav}>
                  <ButtonText>
                    {checkingNav ? t("company.navTestSection.checking") : t("company.navTestSection.checkConnection")}
                  </ButtonText>
                </Button>
                {navCheckResult ? (
                  <Text size="sm" className={navCheckResult.ok ? "text-green-600" : "text-destructive"}>
                    {t(
                      navResultI18nKey(
                        navCheckResult.code,
                        navCheckResult.ok
                          ? "company.navTestSection.checkSuccess"
                          : "company.navTestSection.checkFailed"
                      )
                    )}
                  </Text>
                ) : null}
              </HStack>
            </>
          ) : null}
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
