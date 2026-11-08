// components/invoices/composer/StepPartner.tsx
// "Kinek szól a bizonylat?" — the recipient section of the one-page composer
// (redesign 2026-11, SPEC §8.3): the partner field (the only required one,
// INV-4), "Vagy Másolás korábbi számlából", and the partner's details (tax
// number, address, e-mail — the buyer address is mandatory to finalize,
// Áfa tv. 169. § e). Choosing a saved partner fills exactly what
// applyClientToFormFields fills (handleSelectClient in the composer hook).
// The dates and payment block lives in StepDatesPayment.
import * as React from "react";
import { useCompanySearch } from "@/hooks/useCompanySearch";
import { usePartnerSuggestions } from "@/hooks/usePartnerSuggestions";
import { Box } from "@/components/ui/box";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { ComposerSection } from "@/components/invoices/composer/ComposerSection";
import { CopyFromInvoice } from "@/components/invoices/composer/CopyFromInvoice";
import { PartnerPicker } from "@/components/invoices/composer/PartnerPicker";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";
import type { Invoice } from "@/lib/invoices/types";

type RecipientProps = InvoiceComposerState & {
  /** Recent invoices for "Másolás korábbi számlából"; omit to hide the link (edit mode). */
  copyInvoices?: Invoice[];
};

export function StepPartner(composer: RecipientProps) {
  const {
    t,
    clients,
    clientId,
    clientName,
    clientTaxNumber,
    clientEmail,
    clientCountry,
    clientZip,
    clientCity,
    clientAddress,
    setClientName,
    setClientTaxNumber,
    setClientEmail,
    setClientCountry,
    setClientZip,
    setClientCity,
    setClientAddress,
    handleSelectClient,
    handleSelectSuggestion,
    clearClient,
    mode,
    showClientDetails,
    setShowClientDetails,
    errors,
    focusField,
    clearFocusField,
    copyInvoices,
  } = composer;

  const recentClients = React.useMemo(() => clients.slice(0, 4), [clients]);
  // `as never` at the ref sites below matches PartnerPicker's own inputRef
  // pattern — Gluestack's InputField forwards a ref typed against its own
  // props instead of the underlying TextInput instance, so a plain
  // { focus } ref type doesn't structurally match without the cast.
  const nameInputRef = React.useRef<{ focus: () => void } | null>(null);
  const clientZipInputRef = React.useRef<{ focus: () => void } | null>(null);

  React.useEffect(() => {
    if (focusField === "clientName") {
      nameInputRef.current?.focus?.();
      clearFocusField();
      return;
    }
    if (focusField === "clientZip") {
      // The buyer-address panel can be collapsed — same expand-then-focus
      // pattern as before (validateBuyerAddressStep, Áfa tv. 169. § e).
      if (!showClientDetails) {
        setShowClientDetails(true);
        return;
      }
      clientZipInputRef.current?.focus?.();
      clearFocusField();
    }
  }, [focusField, clearFocusField, showClientDetails, setShowClientDetails]);

  // Search among Hungarian companies while a partner is being typed — but not
  // once a saved partner has been picked (the field then holds its name).
  const companySearch = useCompanySearch(clientName, !clientId);

  // Partners already invoiced, with their usual settings. Only for a NEW
  // document (an edited one must not have its currency/terms swapped), and
  // not once a saved partner has been picked.
  const suggestionsEnabled = mode !== "edit" && !clientId;
  const partnerSuggestions = usePartnerSuggestions(clientName, suggestionsEnabled);

  async function handleCreateNewClient(input: {
    name: string;
    email: string;
    taxNumber: string;
    zip: string;
    city: string;
    address: string;
  }) {
    // Composer-local partner: not persisted to /api/clients from here —
    // keeps the composer independent of the clients CRUD surface. The
    // invoice still carries the typed name/e-mail/tax number/address as its
    // own buyer-address snapshot (Áfa tv. 169. § e — required to finalize).
    setClientName(input.name);
    setClientEmail(input.email);
    setClientTaxNumber(input.taxNumber);
    setClientZip(input.zip);
    setClientCity(input.city);
    setClientAddress(input.address);
  }

  const hasPartner = clientName.trim().length > 0;

  return (
    <ComposerSection title={t("invoices.sections.recipient")} first testID="composer-section-partner">
      <FormField label={t("invoices.fields.partnerNameOrTax")} required className="relative z-30">
        <PartnerPicker
          companyResults={companySearch.results}
          companyLoading={companySearch.loading}
          onSelectCompany={(company) =>
            void handleCreateNewClient({
              name: company.name,
              email: "",
              taxNumber: company.taxNumber ?? "",
              zip: company.zipCode ?? "",
              city: company.city ?? "",
              address: company.address ?? "",
            })
          }
          suggestions={partnerSuggestions.suggestions}
          onSelectSuggestion={suggestionsEnabled ? handleSelectSuggestion : undefined}
          inputRef={nameInputRef}
          clients={clients}
          recentClients={recentClients}
          value={clientName}
          onChangeText={setClientName}
          onSelect={handleSelectClient}
          onCreateNew={handleCreateNewClient}
          // Once a name has been typed, a lingering errors.partner can only
          // be the exchange-rate error (shown in the dates section) — never
          // the "client name required" message this picker renders itself.
          error={hasPartner ? undefined : errors.partner}
          t={t}
        />
      </FormField>

      {copyInvoices ? <CopyFromInvoice invoices={copyInvoices} t={t} /> : null}

      {hasPartner && !showClientDetails ? (
        // The only way back to the address fields once they are collapsed —
        // required to finalize, see validateBuyerAddressStep.
        <Pressable
          onPress={() => setShowClientDetails(true)}
          accessibilityRole="button"
          className="mt-2 min-h-10 justify-center self-start"
        >
          <Text className="text-sm font-semibold text-primary">{t("invoices.composer.editPartnerDetails")}</Text>
        </Pressable>
      ) : null}

      {hasPartner && showClientDetails ? (
        <Box
          className="mt-4 rounded-card border border-line-strong bg-surface p-[18px] phone:p-4"
          testID="composer-partner-details"
        >
          <Box className="mb-3 flex-row items-center justify-between gap-3">
            <Text accessibilityRole="header" className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">
              {t("composer.partnerDetailsTitle")}
            </Text>
            {clientId ? (
              <Pressable onPress={clearClient} accessibilityRole="button" className="min-h-10 justify-center">
                <Text className="text-[13px] font-semibold text-primary">{t("invoices.composer.changePartner")}</Text>
              </Pressable>
            ) : null}
          </Box>
          <Box className="flex-row flex-wrap gap-x-4 gap-y-4">
            <FormField label={t("invoices.fields.taxNumber")} className="min-w-[240px] flex-1">
              <Input>
                <InputField
                  value={clientTaxNumber}
                  onChangeText={setClientTaxNumber}
                  testID="composer-client-tax"
                  accessibilityLabel={t("invoices.fields.taxNumber")}
                />
              </Input>
            </FormField>
            <FormField label={t("invoices.fields.country")} className="min-w-[240px] flex-1">
              <Input>
                <InputField
                  value={clientCountry}
                  onChangeText={setClientCountry}
                  testID="composer-client-country"
                  accessibilityLabel={t("invoices.fields.country")}
                />
              </Input>
            </FormField>
            <FormField label={t("invoices.fields.zipCode")} required className="min-w-[140px] flex-1">
              <Input>
                <InputField
                  ref={clientZipInputRef as never}
                  value={clientZip}
                  onChangeText={setClientZip}
                  testID="composer-client-zip"
                  accessibilityLabel={t("invoices.fields.zipCode")}
                />
              </Input>
            </FormField>
            <FormField label={t("invoices.fields.city")} required className="min-w-[240px] flex-[2]">
              <Input>
                <InputField
                  value={clientCity}
                  onChangeText={setClientCity}
                  testID="composer-client-city"
                  accessibilityLabel={t("invoices.fields.city")}
                />
              </Input>
            </FormField>
            <FormField label={t("invoices.fields.address")} required className="w-full">
              <Input>
                <InputField
                  value={clientAddress}
                  onChangeText={setClientAddress}
                  testID="composer-client-address"
                  accessibilityLabel={t("invoices.fields.address")}
                />
              </Input>
            </FormField>
            {errors.buyerAddress ? (
              <Text accessibilityRole="alert" className="w-full text-[13px] font-semibold text-err" testID="composer-buyer-address-error">
                {errors.buyerAddress}
              </Text>
            ) : null}
            <FormField label={t("invoices.fields.email")} hint={t("invoices.fields.emailHint")} className="w-full">
              <Input>
                <InputField
                  value={clientEmail}
                  onChangeText={setClientEmail}
                  keyboardType="email-address"
                  testID="composer-client-email"
                  accessibilityLabel={t("invoices.fields.email")}
                />
              </Input>
            </FormField>
          </Box>
        </Box>
      ) : null}
    </ComposerSection>
  );
}
