// app/(app)/settings/company.tsx
// Céges profil: the company data that appears on every invoice, the bank
// account and the AAM (alanyi adómentes) switch. The NAV connection moved to
// /settings/nav and the invoice e-mail recipients to /settings/reminders;
// every API call here is unchanged (POST /api/companies via useCompany).
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { SaveBar } from "@/components/settings/SaveBar";
import {
  SettingsNote,
  SettingsPage,
  SettingsSection,
  SettingsSheet,
} from "@/components/settings/SettingsSheet";
import { useCompany } from "@/hooks/useCompany";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { type } from "@/lib/ui/type";

type CompanyForm = {
  name: string;
  taxNumber: string;
  address: string;
  city: string;
  zipCode: string;
  bankAccount: string;
  vatExempt: boolean;
};

const EMPTY_FORM: CompanyForm = {
  name: "",
  taxNumber: "",
  address: "",
  city: "",
  zipCode: "",
  bankAccount: "",
  vatExempt: false,
};

export default function CompanySettingsScreen() {
  const { t } = useTranslation();
  const { company, loading, save, lookup } = useCompany();
  const keys = settingsItemKeys("company");

  const saved = React.useMemo<CompanyForm>(
    () =>
      company
        ? {
            name: company.name,
            taxNumber: company.taxNumber ?? "",
            address: company.address ?? "",
            city: company.city ?? "",
            zipCode: company.zipCode ?? "",
            bankAccount: company.bankAccount ?? "",
            vatExempt: company.vatExempt ?? false,
          }
        : EMPTY_FORM,
    [company]
  );
  const [form, setForm] = React.useState<CompanyForm>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);

  React.useEffect(() => {
    setForm(saved);
  }, [saved]);

  const set = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => {
    setSuccess(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const dirty = (Object.keys(saved) as Array<keyof CompanyForm>).some((key) => form[key] !== saved[key]);

  async function handleLookup() {
    if (!form.taxNumber.trim()) return;
    setLookingUp(true);
    setError(null);
    try {
      const result = await lookup(form.taxNumber.trim());
      const data = result.company;
      if (data) {
        setForm((prev) => ({
          ...prev,
          name: data.name || prev.name,
          address: data.address || prev.address,
          city: data.city || prev.city,
          zipCode: data.zipCode || prev.zipCode,
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.companySettings.lookupFailed"));
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError(t("settings.companySettings.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await save({
        name: form.name.trim(),
        taxNumber: form.taxNumber.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
        bankAccount: form.bankAccount.trim() || undefined,
        vatExempt: form.vatExempt,
      });
      setSuccess(t("settings.companySettings.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.companySettings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !company) {
    return (
      <SettingsPage title={t(keys.title)} lead={t(keys.lead)}>
        <Text className={type.meta}>{t("common.loading")}</Text>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-company">
      <SettingsSheet>
        <SettingsSection title={t("settingsPages.company.detailsTitle")} hint={t("settingsPages.company.detailsHint")}>
          <FormField label={t("company.taxNumber")} hint={t("settingsPages.company.taxNumberHint")}>
            <Box className="flex-row gap-2">
              <Input className="min-w-0 flex-1">
                <InputField
                  testID="company-tax-number"
                  accessibilityLabel={t("company.taxNumber")}
                  value={form.taxNumber}
                  onChangeText={(v) => set("taxNumber", v)}
                  placeholder="12345678-1-23"
                />
              </Input>
              <Button
                variant="secondary"
                size="form"
                onPress={() => void handleLookup()}
                disabled={lookingUp}
                testID="company-lookup"
              >
                <ButtonText>{t("settings.companySettings.lookup")}</ButtonText>
              </Button>
            </Box>
          </FormField>
          <FormField label={t("company.name")}>
            <Input>
              <InputField
                testID="company-name"
                accessibilityLabel={t("company.name")}
                value={form.name}
                onChangeText={(v) => set("name", v)}
              />
            </Input>
          </FormField>
          <FormField label={t("company.address")}>
            <Input>
              <InputField
                testID="company-address"
                accessibilityLabel={t("company.address")}
                value={form.address}
                onChangeText={(v) => set("address", v)}
              />
            </Input>
          </FormField>
          <Box className="flex-row gap-3">
            <FormField label={t("company.city")} className="min-w-0 flex-1">
              <Input>
                <InputField
                  testID="company-city"
                  accessibilityLabel={t("company.city")}
                  value={form.city}
                  onChangeText={(v) => set("city", v)}
                />
              </Input>
            </FormField>
            <FormField label={t("company.zip")} className="w-[120px]">
              <Input>
                <InputField
                  testID="company-zip"
                  accessibilityLabel={t("company.zip")}
                  value={form.zipCode}
                  onChangeText={(v) => set("zipCode", v)}
                />
              </Input>
            </FormField>
          </Box>
        </SettingsSection>

        <SettingsSection title={t("settingsPages.company.bankTitle")} hint={t("settingsPages.company.bankHint")}>
          <FormField label={t("company.bankAccount")}>
            <Input>
              <InputField
                testID="company-bank-account"
                accessibilityLabel={t("company.bankAccount")}
                value={form.bankAccount}
                onChangeText={(v) => set("bankAccount", v)}
              />
            </Input>
          </FormField>
        </SettingsSection>

        <SettingsSection title={t("settingsPages.company.vatTitle")}>
          <Box className="flex-row items-center justify-between gap-3">
            <Box className="min-w-0 flex-1">
              <Text className={type.itemTitle}>{t("company.vatExempt")}</Text>
              <Text className={`${type.meta} mt-0.5`}>{t("company.vatExemptHint")}</Text>
            </Box>
            <Switch
              testID="company-vat-exempt"
              value={form.vatExempt}
              onValueChange={(v) => set("vatExempt", v)}
              accessibilityLabel={t("company.vatExempt")}
            />
          </Box>
        </SettingsSection>
      </SettingsSheet>

      {success ? <SettingsNote tone="ok" testID="company-success">{success}</SettingsNote> : null}
      {error ? <SettingsNote tone="err" testID="company-error">{error}</SettingsNote> : null}

      <SaveBar
        visible={dirty || saving}
        saving={saving}
        onSave={() => void handleSave()}
        onDiscard={() => {
          setForm(saved);
          setError(null);
        }}
        saveLabel={t("settings.companySettings.save")}
        saveTestID="company-save"
      />
    </SettingsPage>
  );
}
