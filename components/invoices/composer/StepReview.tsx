// components/invoices/composer/StepReview.tsx
// Step 3: read-back summary + explicit, default-OFF e-mail and NAV toggles
// that spell out their consequence (fixes INV-2's silent e-mail arm and
// INV-12's notes-field soup — spec §2.5).
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { groupVatRows } from "@/components/invoices/composer/composer-logic";
import { formatCurrency, lineItemGrossTotal } from "@/lib/invoices/calculations";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";

export function StepReview(
  composer: InvoiceComposerState & { readOnly?: boolean }
) {
  const {
    t,
    documentType,
    clientName,
    clientTaxNumber,
    clientEmail,
    clientCountry,
    clientZip,
    clientCity,
    clientAddress,
    fulfillmentDate,
    issueDate,
    dueDate,
    paymentMethod,
    bankAccount,
    currency,
    exchangeRate,
    lineItems,
    notes,
    setNotes,
    emailOnSend,
    setEmailOnSend,
    canEnableEmailOnSend,
    setStep,
    totals,
    readOnly,
  } = composer;

  const vatRows = groupVatRows(lineItems);
  const address = [clientZip, clientCity, clientAddress].filter(Boolean).join(" ");

  return (
    <VStack space="lg">
      <ReviewSection title={t("invoices.composer.reviewPartner")} onEdit={readOnly ? undefined : () => setStep("partner")} t={t}>
        <Text className="font-medium text-foreground">{clientName || "—"}</Text>
        {clientTaxNumber ? <Text size="sm" className="text-muted-foreground">{clientTaxNumber}</Text> : null}
        {address ? <Text size="sm" className="text-muted-foreground">{address}</Text> : null}
        {clientCountry && clientCountry !== "Magyarország" ? (
          <Text size="sm" className="text-muted-foreground">{clientCountry}</Text>
        ) : null}
        {clientEmail ? <Text size="sm" className="text-muted-foreground">{clientEmail}</Text> : null}
      </ReviewSection>

      <ReviewSection title={t("invoices.sections.datesPayment")} onEdit={readOnly ? undefined : () => setStep("partner")} t={t}>
        <Text size="sm" className="text-foreground">
          {t("invoices.fields.fulfillmentDate")}: {fulfillmentDate}
        </Text>
        <Text size="sm" className="text-foreground">
          {t("invoices.fields.issueDate")}: {issueDate} · {t("invoices.fields.paymentDeadline")}: {dueDate}
        </Text>
        <Text size="sm" className="text-foreground">
          {t(`invoices.paymentMethods.${paymentMethod}`)}
          {bankAccount ? ` · ${bankAccount}` : ""}
        </Text>
        <Text size="sm" className="text-foreground">
          {currency}
          {currency !== "HUF" && exchangeRate ? ` · ${exchangeRate}` : ""}
        </Text>
      </ReviewSection>

      <ReviewSection title={t("invoices.sections.lineItems")} onEdit={readOnly ? undefined : () => setStep("items")} t={t}>
        <VStack space="xs">
          {lineItems
            .filter((item) => item.description.trim())
            .map((item) => (
              <HStack key={item.id} className="justify-between">
                <Text size="sm" className="flex-1 text-foreground">
                  {item.description} × {item.quantity} {item.unit || "db"}
                </Text>
                <Text size="sm" className="tabular-nums text-foreground">
                  {formatCurrency(lineItemGrossTotal(item), currency)}
                </Text>
              </HStack>
            ))}
          <VStack className="mt-2 items-end gap-1 border-t border-subtle pt-2">
            <Text size="sm" className="text-muted-foreground">
              {t("invoices.totals.netTotal")}: {formatCurrency(totals.subtotal, currency)}
            </Text>
            {vatRows.map((row) => (
              <Text key={row.key} size="sm" className="text-muted-foreground">
                {t("invoices.composer.vatRowLabel", { label: row.label })}: {formatCurrency(row.vat, currency)}
              </Text>
            ))}
            <Text className="font-semibold text-foreground">
              {t("invoices.totals.grossTotal")}: {formatCurrency(totals.totalAmount, currency)}
            </Text>
          </VStack>
        </VStack>
      </ReviewSection>

      {!readOnly ? (
        <ReviewSection title={t("invoices.composer.dispatchTitle")} t={t}>
          <VStack space="md">
            <HStack className="items-start justify-between gap-3">
              <VStack className="flex-1">
                <Text size="sm" className="font-medium text-foreground">
                  {clientEmail
                    ? t("invoices.composer.sendEmailLabel", { email: clientEmail })
                    : t("invoices.fields.sendEmail")}
                </Text>
                {!clientEmail ? (
                  <Text size="xs" className="text-muted-foreground">
                    {t("invoices.composer.sendEmailDisabledHint")}
                  </Text>
                ) : null}
              </VStack>
              <Switch
                value={emailOnSend}
                onValueChange={setEmailOnSend}
                disabled={!canEnableEmailOnSend}
                accessibilityLabel={t("invoices.fields.sendEmail")}
              />
            </HStack>

            {/* No toggle: every finalized számla goes to NAV automatically
                (server-side) when NAV is configured; a díjbekérő never does. */}
            {documentType === "invoice" || documentType === "advance" ? (
              <VStack testID="composer-nav-auto-note">
                <Text size="sm" className="font-medium text-foreground">
                  {t("invoices.fields.navSubmit")}
                </Text>
                <Text size="xs" className="text-muted-foreground">
                  {t("invoices.fields.navSubmitHint")}
                </Text>
              </VStack>
            ) : null}
          </VStack>
        </ReviewSection>
      ) : null}

      <ReviewSection title={t("invoices.fields.notes")} t={t}>
        {readOnly ? (
          <Text size="sm" className="text-foreground">{notes || "—"}</Text>
        ) : (
          <Textarea>
            <TextareaInput
              placeholder={t("invoices.placeholders.notes")}
              value={notes}
              onChangeText={setNotes}
            />
          </Textarea>
        )}
      </ReviewSection>
    </VStack>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
  t,
}: {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <VStack space="sm" className="rounded-lg border border-border bg-card p-4">
      <HStack className="items-center justify-between">
        <Text size="sm" className="font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
        {onEdit ? (
          <Pressable onPress={onEdit}>
            <Text size="sm" className="font-medium text-primary">
              {t("invoices.composer.editSection")}
            </Text>
          </Pressable>
        ) : null}
      </HStack>
      {children}
    </VStack>
  );
}
