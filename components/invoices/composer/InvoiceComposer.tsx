// components/invoices/composer/InvoiceComposer.tsx
// The full 3-step composer flow — new.tsx and edit.tsx both render this
// (docs/design/app-ux-spec-2026-09-14.md §2, §2.7). Desktop: 2 columns,
// form max 720px, sticky 400px summary. Mobile: one step at a time, a 48px
// sticky total bar, and a single-row footer (spec §2.2, INV-19/M1).
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ComposerStepper } from "@/components/invoices/composer/ComposerStepper";
import { ComposerSummary } from "@/components/invoices/composer/ComposerSummary";
import { StepPartner } from "@/components/invoices/composer/StepPartner";
import { StepLineItems } from "@/components/invoices/composer/StepLineItems";
import { StepReview } from "@/components/invoices/composer/StepReview";
import {
  COMPOSER_STEP_ORDER,
  type ComposerStepId,
} from "@/components/invoices/composer/composer-logic";
import {
  useInvoiceComposer,
  type UseInvoiceComposerOptions,
} from "@/components/invoices/composer/useInvoiceComposer";
import { DocumentTypeTabs } from "@/components/invoices/DocumentTypeTabs";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import { routes } from "@/lib/navigation";
import { useIsDesktop } from "@/lib/useIsDesktop";

const STEP_LABEL_KEYS: Record<ComposerStepId, string> = {
  partner: "invoices.composer.steps.partner",
  items: "invoices.composer.steps.items",
  review: "invoices.composer.steps.review",
};

export function InvoiceComposer(props: UseInvoiceComposerOptions) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const { invoice = null } = props;
  const composer = useInvoiceComposer(props);
  const {
    mode,
    step,
    setStep,
    documentType,
    setDocumentType,
    documentTabsDisabled,
    draftInvoice,
    totals,
    currency,
    lineItems,
    errors,
    invalidSteps,
    isDirty,
    saving,
    savedAt,
    saveError,
    save,
  } = composer;

  const [finalizeMenuOpen, setFinalizeMenuOpen] = React.useState(false);
  const [mobileTotalsExpanded, setMobileTotalsExpanded] = React.useState(false);

  // INV-1: a real "you'll lose this" warning instead of a fake auto-save —
  // web only, no native equivalent for tab-close.
  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    function handler(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // A minimal local toast — deliberately not components/ui/toast, which
  // pulls in react-native-reanimated and (in this environment) breaks the
  // Jest worklets mock for every test that imports this screen.
  React.useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  function showToast(message: string) {
    setToastMessage(message);
  }

  async function handleSave(action: "draft" | "finalize" | "finalizeAndSend") {
    setFinalizeMenuOpen(false);
    const saved = await save(action);
    if (!saved) return;
    if (action === "draft") {
      showToast(t("invoices.success.draftSaved"));
    } else if (mode === "edit") {
      showToast(t("invoices.success.updated"));
    } else {
      showToast(t("invoices.success.created", { number: saved.invoiceNumber || saved.id }));
    }
  }

  const readOnly = mode === "edit" && invoice != null && invoice.status !== "draft";

  const stepIndex = COMPOSER_STEP_ORDER.indexOf(step);
  const mobileStepLabel = `${stepIndex + 1}/${COMPOSER_STEP_ORDER.length} · ${t(STEP_LABEL_KEYS[step])}`;

  const stepErrorMessage =
    step === "partner"
      ? errors.partner || errors.dueDate
      : step === "items"
        ? errors.lineItems
        : step === "review"
          ? errors.partner
          : undefined;

  const title = mode === "edit" ? t("invoices.edit.title") : t("invoices.newDocument");
  const breadcrumbItems =
    mode === "edit" && invoice
      ? [
          { label: t("invoices.breadcrumbs.invoices"), href: routes.invoices },
          {
            label: invoice.invoiceNumber || t("invoices.composer.breadcrumbDraft"),
            href: routes.invoiceDetail(invoice.id),
          },
          { label: t("invoices.edit.title") },
        ]
      : [
          { label: t("invoices.breadcrumbs.home"), href: routes.dashboard },
          { label: t("invoices.breadcrumbs.invoices"), href: routes.invoices },
          { label: t("invoices.composer.breadcrumbNew") },
        ];

  const dirtyIndicator = saving ? (
    <Text size="xs" className="text-muted-foreground">
      {t("invoices.composer.saving")}
    </Text>
  ) : isDirty ? (
    <Text size="xs" className="text-muted-foreground" testID="composer-unsaved-indicator">
      {t("invoices.composer.unsavedChanges")}
    </Text>
  ) : savedAt ? (
    <Text size="xs" className="text-muted-foreground" testID="composer-saved-indicator">
      {t("invoices.composer.draftSavedAt", { time: savedAt })}
    </Text>
  ) : null;

  const toastOverlay = toastMessage ? (
    <Box className="absolute left-0 right-0 top-4 z-50 items-center px-4" testID="composer-toast">
      <Box className="rounded-lg bg-foreground px-4 py-2.5 shadow-lg">
        <Text className="text-sm font-medium text-background">{toastMessage}</Text>
      </Box>
    </Box>
  ) : null;

  if (readOnly && invoice) {
    return (
      <Box className="flex-1 bg-background">
        {toastOverlay}
        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-[1200px] gap-5 p-4 pb-16 md:gap-6 md:px-10 md:py-6"
        >
          <Breadcrumb items={breadcrumbItems} />
          <Heading size="2xl" className="text-foreground">
            {title}
          </Heading>
          <Box className="rounded-lg border border-primary/30 bg-accent p-4">
            <VStack space="xs">
              <Text className="font-semibold text-foreground">
                {t("invoices.edit.readOnlyTitle")}
              </Text>
              <Text size="sm" className="text-muted-foreground">
                {t("invoices.edit.readOnlyHint")}
              </Text>
            </VStack>
          </Box>
          <DocumentTypeTabs selected="invoice" onChange={() => {}} disabled />
          <StepReview {...composer} readOnly />
          <InvoiceDocumentPreview invoice={invoice} invoiceId={invoice.id} />
        </ScrollView>
      </Box>
    );
  }

  return (
    <Box className="flex-1 bg-background">
      {toastOverlay}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName={
            isDesktop
              ? "mx-auto w-full max-w-[1200px] gap-5 p-4 pb-10 md:gap-6 md:px-10 md:py-6"
              : "gap-4 p-4 pb-32"
          }
          keyboardShouldPersistTaps="handled"
        >
          <Breadcrumb items={breadcrumbItems} />

          {/* Every nested NativeWind View gets an explicit z-0 (not "auto"),
              so each is its own stacking context — the finalize dropdown's
              z-20 only wins WITHIN this header row unless the row itself
              also outranks its sibling (DocumentTypeTabs, later in the DOM)
              at the parent level. relative z-30 here does that. */}
          <Box className="relative z-30 gap-3 md:flex-row md:items-start md:justify-between">
            <VStack space="xs">
              <Heading size="2xl" className="text-foreground">
                {title}
              </Heading>
              {dirtyIndicator}
            </VStack>

            {isDesktop ? (
              <HStack space="sm" className="items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => void handleSave("draft")}
                  disabled={saving}
                  testID="composer-save-draft"
                >
                  <ButtonText>{t("invoices.actions.saveDraft")}</ButtonText>
                </Button>
                {mode === "edit" ? (
                  <Button
                    size="sm"
                    onPress={() => void handleSave("draft")}
                    disabled={saving}
                    testID="composer-save-changes"
                  >
                    <ButtonText>{t("invoices.edit.saveChanges")}</ButtonText>
                  </Button>
                ) : (
                  <Box className="relative">
                    <Button
                      size="sm"
                      onPress={() => setFinalizeMenuOpen((v) => !v)}
                      disabled={saving}
                      testID="composer-finalize-menu-trigger"
                    >
                      <ButtonText>{t("invoices.actions.finalize")}</ButtonText>
                      {finalizeMenuOpen ? <ChevronUp size={14} color="white" /> : <ChevronDown size={14} color="white" />}
                    </Button>
                    {finalizeMenuOpen ? (
                      <VStack className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-border bg-card shadow-sm">
                        <Pressable
                          onPress={() => void handleSave("finalize")}
                          className="border-b border-subtle px-3 py-2.5"
                          testID="composer-action-finalize"
                        >
                          <Text size="sm" className="text-foreground">
                            {t("invoices.actions.finalize")}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void handleSave("finalizeAndSend")}
                          className="px-3 py-2.5"
                          testID="composer-action-finalize-send"
                        >
                          <Text size="sm" className="text-foreground">
                            {t("invoices.actions.finalizeAndSend")}
                          </Text>
                        </Pressable>
                      </VStack>
                    ) : null}
                  </Box>
                )}
              </HStack>
            ) : null}
          </Box>

          <DocumentTypeTabs
            selected={documentType}
            onChange={setDocumentType}
            disabled={documentTabsDisabled}
          />

          <ComposerStepper current={step} invalidSteps={invalidSteps} onSelect={setStep} t={t} />
          {!isDesktop ? (
            <Text size="xs" className="text-muted-foreground" testID="composer-mobile-step-label">
              {mobileStepLabel}
            </Text>
          ) : null}

          {stepErrorMessage ? (
            <Box className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
              <Text size="sm" className="text-destructive">
                {stepErrorMessage}
              </Text>
            </Box>
          ) : null}
          {saveError ? (
            <Box className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
              <Text size="sm" className="text-destructive">
                {saveError}
              </Text>
            </Box>
          ) : null}

          <Box className={isDesktop ? "flex-row items-start gap-8" : "gap-4"}>
            {/* The line-item grid is a table, not a stack of fields — it
                legitimately needs more than 720px of row width (spec §2.4);
                the 720px cap (spec §2.2, INV-3/E3) applies to individual
                form fields on the Partner and Review steps, not to the
                grid's overall width. */}
            <Box
              className="min-w-0 flex-1"
              style={isDesktop && step !== "items" ? { maxWidth: 720 } : undefined}
            >
              {step === "partner" ? <StepPartner {...composer} /> : null}
              {step === "items" ? (
                <StepLineItems
                  lineItems={composer.lineItems}
                  currency={composer.currency}
                  products={composer.products}
                  onUpdate={composer.updateLineItem}
                  onAdd={composer.addLineItem}
                  onAddFromProduct={composer.addLineItemFromProduct}
                  onRemove={composer.removeLineItem}
                  t={t}
                />
              ) : null}
              {step === "review" ? <StepReview {...composer} /> : null}

              {isDesktop ? (
                <HStack space="sm" className="mt-6 justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setStep(COMPOSER_STEP_ORDER[Math.max(0, stepIndex - 1)])}
                    disabled={stepIndex === 0}
                  >
                    <ButtonText>{t("invoices.composer.back")}</ButtonText>
                  </Button>
                  {stepIndex < COMPOSER_STEP_ORDER.length - 1 ? (
                    <Button
                      size="sm"
                      onPress={() => setStep(COMPOSER_STEP_ORDER[stepIndex + 1])}
                    >
                      <ButtonText>{t("invoices.composer.next")}</ButtonText>
                    </Button>
                  ) : null}
                </HStack>
              ) : null}
            </Box>

            {isDesktop ? (
              <ComposerSummary
                invoice={draftInvoice}
                invoiceId={mode === "edit" ? invoice?.id : undefined}
                totals={totals}
                currency={currency}
                lineItems={lineItems}
                t={t}
              />
            ) : null}
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>

      {!isDesktop ? (
        <Box className="border-t border-border bg-card shadow-lg" testID="composer-mobile-footer">
          <Pressable
            onPress={() => setMobileTotalsExpanded((v) => !v)}
            className="h-12 flex-row items-center justify-between px-4"
            testID="composer-mobile-totals-bar"
          >
            <Text size="sm" className="font-semibold text-foreground">
              {t("invoices.totals.grossTotal")}:{" "}
              <Text size="sm" className="tabular-nums font-semibold text-foreground">
                {new Intl.NumberFormat("hu-HU").format(totals.totalAmount)}{" "}
                {currency === "EUR" ? "€" : "Ft"}
              </Text>
            </Text>
            {mobileTotalsExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </Pressable>
          {mobileTotalsExpanded ? (
            <VStack space="xs" className="border-t border-subtle px-4 py-2">
              <HStack className="justify-between">
                <Text size="xs" className="text-muted-foreground">
                  {t("invoices.totals.netTotal")}
                </Text>
                <Text size="xs" className="tabular-nums text-foreground">
                  {new Intl.NumberFormat("hu-HU").format(totals.subtotal)}
                </Text>
              </HStack>
              <HStack className="justify-between">
                <Text size="xs" className="text-muted-foreground">
                  {t("invoices.fields.vat")}
                </Text>
                <Text size="xs" className="tabular-nums text-foreground">
                  {new Intl.NumberFormat("hu-HU").format(totals.vatTotal)}
                </Text>
              </HStack>
            </VStack>
          ) : null}
          <HStack space="sm" className="items-center px-4 py-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onPress={() =>
                stepIndex === 0
                  ? void handleSave("draft")
                  : setStep(COMPOSER_STEP_ORDER[stepIndex - 1])
              }
            >
              <ButtonText>
                {stepIndex === 0 ? t("invoices.actions.saveDraft") : t("invoices.composer.back")}
              </ButtonText>
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={saving}
              onPress={() =>
                stepIndex < COMPOSER_STEP_ORDER.length - 1
                  ? setStep(COMPOSER_STEP_ORDER[stepIndex + 1])
                  : void handleSave(mode === "edit" ? "draft" : "finalize")
              }
            >
              <ButtonText>
                {stepIndex < COMPOSER_STEP_ORDER.length - 1
                  ? t("invoices.composer.next")
                  : mode === "edit"
                    ? t("invoices.edit.saveChanges")
                    : t("invoices.actions.finalize")}
              </ButtonText>
            </Button>
          </HStack>
        </Box>
      ) : null}
    </Box>
  );
}
