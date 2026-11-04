// app/(app)/settings/nav.tsx
// NAV: the NAV Online Számla connection (mode, technical user, keys, test
// connection) moved here unchanged from the company page, and the tax-audit
// XML export ("NAV: adatok letöltése"). Same state, same calls
// (GET /api/nav/config, POST /api/nav/check, POST /api/companies), same copy.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { NavEnvironmentPicker } from "@/components/settings/NavEnvironmentPicker";
import { SaveBar } from "@/components/settings/SaveBar";
import {
  SettingsNote,
  SettingsPage,
  SettingsSection,
  SettingsSheet,
} from "@/components/settings/SettingsSheet";
import { TaxAuditExportCard } from "@/components/settings/TaxAuditExportCard";
import { useCompany } from "@/hooks/useCompany";
import { apiFetch, ApiError } from "@/lib/api/client";
import { navResultI18nKey } from "@/lib/nav/nav-error-i18n";
import { NAV_API_BASE_URL, type NavEnvironment } from "@/lib/nav/environment";
import { routes } from "@/lib/navigation";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { type } from "@/lib/ui/type";

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

export default function NavSettingsScreen() {
  const { t } = useTranslation();
  const { company, loading, save } = useCompany();
  const keys = settingsItemKeys("nav");
  const [navTechnicalUser, setNavTechnicalUser] = React.useState("");
  const [navTechnicalPassword, setNavTechnicalPassword] = React.useState("");
  const [navXmlSignKey, setNavXmlSignKey] = React.useState("");
  const [navXmlChangeKey, setNavXmlChangeKey] = React.useState("");
  const [navEnvironment, setNavEnvironment] = React.useState<NavEnvironment>("demo");
  const [showNavSecrets, setShowNavSecrets] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
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
          taxNumber: company?.taxNumber?.trim() || undefined,
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

  const savedEnvironment: NavEnvironment = company?.navEnvironment ?? "demo";
  const savedUser = company?.navTechnicalUser ?? "";

  React.useEffect(() => {
    if (company) {
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

  const dirty =
    Boolean(company) &&
    (navEnvironment !== savedEnvironment ||
      navTechnicalUser !== savedUser ||
      Boolean(navTechnicalPassword.trim() || navXmlSignKey.trim() || navXmlChangeKey.trim()));

  async function handleSave() {
    if (!company) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await save({
        name: company.name,
        navTechnicalUser: navTechnicalUser.trim() || undefined,
        navTechnicalPassword: navTechnicalPassword.trim() || undefined,
        navXmlSignKey: navXmlSignKey.trim() || undefined,
        navXmlChangeKey: navXmlChangeKey.trim() || undefined,
        navEnvironment,
      });
      // What was typed is stored now (and never echoed back): start blank again.
      setNavTechnicalPassword("");
      setNavXmlSignKey("");
      setNavXmlChangeKey("");
      setSuccess(t("settingsPages.nav.saved"));
      setNavCheckResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.companySettings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setNavTechnicalUser(savedUser);
    setNavEnvironment(savedEnvironment);
    setNavTechnicalPassword("");
    setNavXmlSignKey("");
    setNavXmlChangeKey("");
    setError(null);
  }

  // Nothing decrypted is ever pre-filled into these fields anymore (see
  // the company-load effect above), so masking by default and letting the
  // toggle reveal what's currently being *typed* is safe on every
  // platform — there's no longer a web-only "never masked" branch here.
  const maskSecrets = !showNavSecrets;

  if (loading && !company) {
    return (
      <SettingsPage title={t(keys.title)} lead={t(keys.lead)}>
        <Text className={type.meta}>{t("common.loading")}</Text>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-nav-page">
      {!company ? (
        <SettingsNote tone="warn" testID="nav-needs-company">
          {t("billing.needCompany")}{" "}
          <Text
            accessibilityRole="link"
            onPress={() => router.push(routes.settingsCompany)}
            className="font-semibold text-primary"
          >
            {t("billing.openCompany")}
          </Text>
        </SettingsNote>
      ) : null}

      <SettingsSheet>
        <SettingsSection
          title={t("company.navTestSection.title")}
          hint={t("company.navTestSection.description")}
          testID="nav-connection"
        >
          {navEnvironment === "demo" ? (
            <SettingsNote tone="info" testID="nav-demo-badge">
              {t("company.navTestSection.demoBadge")}
            </SettingsNote>
          ) : null}

          <FormField label={t("company.navEnvironment")}>
            <NavEnvironmentPicker
              value={navEnvironment}
              onChange={setNavEnvironment}
              productionEnabled={navConfig?.productionEnabled ?? false}
            />
            {navEnvironment !== "demo" ? (
              <Text className={`${type.meta} mt-2`}>API: {NAV_API_BASE_URL[navEnvironment]}</Text>
            ) : null}
          </FormField>

          {navEnvironment === "test" && navConfig?.sharedTestAvailable && !navTechnicalUser.trim() ? (
            <Text className={type.meta}>
              {t("company.navTestSection.sharedAccount")} — {t("company.navTestSection.sharedAccountHint")}
            </Text>
          ) : null}

          {navEnvironment !== "demo" ? (
            <>
              <Box className="flex-row items-center justify-between gap-3">
                <Text className={type.itemTitle}>{t("company.navTestSection.ownAccount")}</Text>
                <Button
                  size="sm"
                  variant="tertiary"
                  testID="nav-toggle-secrets"
                  onPress={() => setShowNavSecrets((v) => !v)}
                >
                  <ButtonText>
                    {showNavSecrets ? t("settings.companySettings.hideSecrets") : t("settings.companySettings.showSecrets")}
                  </ButtonText>
                </Button>
              </Box>
              <FormField label={t("company.navTechnicalUser")}>
                <Input>
                  <InputField
                    testID="nav-technical-user"
                    accessibilityLabel={t("company.navTechnicalUser")}
                    value={navTechnicalUser}
                    onChangeText={setNavTechnicalUser}
                    placeholder="nav_technical_user"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Input>
              </FormField>
              <FormField
                label={t("company.navTechnicalPassword")}
                hint={company?.navTechnicalPasswordSet ? t("settings.companySettings.secretAlreadySet") : undefined}
              >
                <Input>
                  <InputField
                    testID="nav-technical-password"
                    accessibilityLabel={t("company.navTechnicalPassword")}
                    value={navTechnicalPassword}
                    onChangeText={setNavTechnicalPassword}
                    placeholder="••••••••"
                    secureTextEntry={maskSecrets}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Input>
              </FormField>
              <FormField
                label={t("company.navXmlSignKey")}
                hint={company?.navXmlSignKeySet ? t("settings.companySettings.secretAlreadySet") : undefined}
              >
                <Input>
                  <InputField
                    testID="nav-xml-sign-key"
                    accessibilityLabel={t("company.navXmlSignKey")}
                    value={navXmlSignKey}
                    onChangeText={setNavXmlSignKey}
                    placeholder="••••••••"
                    secureTextEntry={maskSecrets}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Input>
              </FormField>
              <FormField
                label={t("company.navXmlChangeKey")}
                hint={company?.navXmlChangeKeySet ? t("settings.companySettings.secretAlreadySet") : undefined}
              >
                <Input>
                  <InputField
                    testID="nav-xml-change-key"
                    accessibilityLabel={t("company.navXmlChangeKey")}
                    value={navXmlChangeKey}
                    onChangeText={setNavXmlChangeKey}
                    placeholder="••••••••"
                    secureTextEntry={maskSecrets}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Input>
              </FormField>

              <Box className="flex-row flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  testID="nav-check-connection"
                  onPress={() => void handleCheckNavConnection()}
                  disabled={checkingNav}
                >
                  <ButtonText>
                    {checkingNav ? t("company.navTestSection.checking") : t("company.navTestSection.checkConnection")}
                  </ButtonText>
                </Button>
                {navCheckResult ? (
                  <Text
                    testID="nav-check-result"
                    className={`text-sm font-semibold ${navCheckResult.ok ? "text-ok" : "text-err"}`}
                  >
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
              </Box>
            </>
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={t("settingsPages.nav.exportTitle")}
          hint={t("settings.taxAudit.hint")}
          testID="nav-export"
        >
          <TaxAuditExportCard />
        </SettingsSection>
      </SettingsSheet>

      {success ? <SettingsNote tone="ok" testID="nav-success">{success}</SettingsNote> : null}
      {error ? <SettingsNote tone="err" testID="nav-error">{error}</SettingsNote> : null}

      <SaveBar
        visible={dirty || saving}
        saving={saving}
        onSave={() => void handleSave()}
        onDiscard={handleDiscard}
        saveLabel={t("settingsPages.nav.save")}
        saveTestID="nav-save"
      />
    </SettingsPage>
  );
}
