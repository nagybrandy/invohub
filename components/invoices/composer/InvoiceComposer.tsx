// components/invoices/composer/InvoiceComposer.tsx
// The invoice composer — new.tsx and edit.tsx both render this. Redesign
// 2026-11 (SPEC §8): ONE scrolling page instead of the 3-step stepper —
// breadcrumb, a sticky action bar (h1 + Előnézet), the type switch, the
// recipient, the dates and payment summary, the line items with their totals,
// "Kiküldés és megfelelőség", the collapsed "További beállítások" and a sticky
// bottom bar (Nettó / Bruttó, Piszkozat mentése, Kiállítás). The preview is
// closed on load. useInvoiceComposer stays the engine: state, validation and
// the save / finalize calls and their payloads are unchanged.
import * as React from "react";
import { Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { ComposerBottomBar } from "@/components/invoices/composer/ComposerBottomBar";
import { ComposerPage } from "@/components/invoices/composer/ComposerPage";
import { DispatchCard } from "@/components/invoices/composer/DispatchCard";
import { MoreSettingsCard } from "@/components/invoices/composer/MoreSettingsCard";
import { StepDatesPayment } from "@/components/invoices/composer/StepDatesPayment";
import { StepLineItems } from "@/components/invoices/composer/StepLineItems";
import { StepPartner } from "@/components/invoices/composer/StepPartner";
import { StepReview } from "@/components/invoices/composer/StepReview";
import {
  useInvoiceComposer,
  type UseInvoiceComposerOptions,
} from "@/components/invoices/composer/useInvoiceComposer";
import type { DocumentType } from "@/components/invoices/DocumentTypeTabs";
import { InvoicePdfPreview } from "@/components/invoices/InvoicePdfPreview";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { Invoice } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { confirmAsync } from "@/lib/ui/confirm";
import { type } from "@/lib/ui/type";

const DOCUMENT_TYPES: { value: Exclude<DocumentType, "receipt">; i18nKey: string }[] = [
  { value: "invoice", i18nKey: "invoices.documentTypes.invoice" },
  { value: "proforma", i18nKey: "invoices.documentTypes.proforma" },
  { value: "advance", i18nKey: "invoices.documentTypes.advance" },
];

export function InvoiceComposer(props: UseInvoiceComposerOptions) {
  const { t } = useTranslation();
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const { invoice = null } = props;
  const composer = useInvoiceComposer(props);
  const {
    mode,
    documentType,
    setDocumentType,
    documentTabsDisabled,
    draftInvoice,
    companyProfileIncomplete,
    totals,
    currency,
    errors,
    isDirty,
    saving,
    savedAt,
    saveError,
    save,
    recentInvoices,
    focusField,
    clearFocusField,
  } = composer;

  const [finalizeMenuOpen, setFinalizeMenuOpen] = React.useState(false);

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

  async function handleSave(action: "draft" | "finalize" | "finalizeAndSend") {
    setFinalizeMenuOpen(false);
    const saved = await save(action);
    if (!saved) return;
    if (action === "draft") {
      setToastMessage(t("invoices.success.draftSaved"));
    } else if (mode === "edit") {
      setToastMessage(t("invoices.success.updated"));
    } else {
      setToastMessage(t("invoices.success.created", { number: saved.invoiceNumber || saved.id }));
    }
  }

  const readOnly = mode === "edit" && invoice != null && invoice.status !== "draft";

  // Only a NEW document's finalize buttons can hit the server-side
  // CompanyProfileIncompleteError — editing an existing (draft-only, see
  // `readOnly` above) invoice always saves back as "draft"
  // (composer-logic.ts's resolveStatusForAction("draft", …)), so it never
  // triggers number assignment and never needs this gate.
  const finalizeBlockedByProfile = companyProfileIncomplete;

  // A finalized invoice never gets its form back — the ONLY way to change
  // it is sztornó (full reversal) or helyesbítő (correction draft), the
  // same two actions the detail screen's DangerZone/overflow menu offer
  // (app/(app)/invoices/[id]/index.tsx's handleStorno/handleCorrection).
  const [readOnlyActionBusy, setReadOnlyActionBusy] = React.useState<"storno" | "correction" | null>(
    null
  );
  const [readOnlyActionError, setReadOnlyActionError] = React.useState<string | null>(null);
  const isReadOnlyProforma = readOnly && invoice?.documentType === "proforma";

  async function handleReadOnlyStorno() {
    if (!invoice) return;
    const confirmed = await confirmAsync({
      title: t("invoices.detail.stornoTitle"),
      message: t("invoices.detail.stornoMessage"),
      confirmLabel: t("invoices.detail.stornoConfirm"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!confirmed) return;

    setReadOnlyActionError(null);
    setReadOnlyActionBusy("storno");
    try {
      const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/storno`, {
        method: "POST",
      });
      router.replace(routes.invoiceDetail(data.invoice.id));
    } catch (e) {
      setReadOnlyActionError(
        e instanceof ApiError && e.code === "proformaNotStornoable"
          ? t("invoices.errors.proformaNotStornoable")
          : e instanceof Error
            ? e.message
            : t("invoices.detail.actionFailed")
      );
    } finally {
      setReadOnlyActionBusy(null);
    }
  }

  async function handleReadOnlyCorrection() {
    if (!invoice) return;
    const confirmed = await confirmAsync({
      title: t("invoices.correction.confirmTitle"),
      message: t("invoices.correction.confirmMessage"),
      confirmLabel: t("invoices.correction.confirm"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;

    setReadOnlyActionError(null);
    setReadOnlyActionBusy("correction");
    try {
      const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/modify`, {
        method: "POST",
      });
      router.push(routes.invoiceEdit(data.invoice.id));
    } catch (e) {
      setReadOnlyActionError(e instanceof Error ? e.message : t("invoices.detail.actionFailed"));
    } finally {
      setReadOnlyActionBusy(null);
    }
  }

  const title = mode === "edit" ? t(readOnly ? "invoices.edit.title" : "composer.editTitle") : t("invoices.newDocument");
  const breadcrumbItems: BreadcrumbItem[] =
    mode === "edit" && invoice
      ? [
          { label: t("invoices.breadcrumbs.invoices"), href: routes.invoices },
          {
            label: invoice.invoiceNumber || t("invoices.composer.breadcrumbDraft"),
            href: routes.invoiceDetail(invoice.id),
          },
          { label: title },
        ]
      : [
          { label: t("invoices.breadcrumbs.home"), href: routes.dashboard },
          { label: t("invoices.breadcrumbs.invoices"), href: routes.invoices },
          { label: t("invoices.composer.breadcrumbNew") },
        ];

  const dirtyIndicator = saving ? (
    <Text className="text-[13px] text-muted-ink">{t("invoices.composer.saving")}</Text>
  ) : isDirty ? (
    <Text className="text-[13px] text-muted-ink" testID="composer-unsaved-indicator">
      {t("invoices.composer.unsavedChanges")}
    </Text>
  ) : savedAt ? (
    <Text className="text-[13px] text-muted-ink" testID="composer-saved-indicator">
      {t("invoices.composer.draftSavedAt", { time: savedAt })}
    </Text>
  ) : null;

  const toastOverlay = toastMessage ? (
    <Box className="absolute left-0 right-0 top-4 z-50 items-center px-4" testID="composer-toast">
      <Box className="rounded-card bg-ink px-4 py-2.5 shadow-menu">
        <Text className="text-sm font-medium text-canvas">{toastMessage}</Text>
      </Box>
    </Box>
  ) : null;

  if (readOnly && invoice) {
    return (
      <Box className="flex-1 bg-canvas">
        {toastOverlay}
        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-[1240px] gap-5 px-4 pb-16 pt-4 tab:px-6"
        >
          <Breadcrumb items={breadcrumbItems} />
          <Heading className={type.pageTitle}>{title}</Heading>
          <Box className="rounded-card border border-primary-line bg-primary-wash p-4">
            <VStack space="sm">
              <VStack space="xs">
                <Text className="text-sm font-semibold text-primary-ink">{t("invoices.edit.readOnlyTitle")}</Text>
                <Text className="text-[13px] text-primary-ink">{t("invoices.edit.readOnlyHint")}</Text>
              </VStack>

              {readOnlyActionError ? (
                <Text accessibilityRole="alert" className="text-[13px] font-semibold text-err">
                  {readOnlyActionError}
                </Text>
              ) : null}

              <HStack space="sm" className="flex-wrap">
                {!isReadOnlyProforma ? (
                  <>
                    <Button
                      variant="danger"
                      disabled={readOnlyActionBusy === "storno"}
                      onPress={() => void handleReadOnlyStorno()}
                      testID="composer-readonly-storno"
                    >
                      <ButtonText>{t("invoices.storno")}</ButtonText>
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={readOnlyActionBusy === "correction"}
                      onPress={() => void handleReadOnlyCorrection()}
                      testID="composer-readonly-correction"
                    >
                      <ButtonText>{t("invoices.correction.action")}</ButtonText>
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="secondary"
                  onPress={() => router.push(routes.invoiceDetail(invoice.id))}
                  testID="composer-readonly-back"
                >
                  <ButtonText>{t("invoices.edit.backToInvoice")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Box>
          <StepReview {...composer} />
          <InvoicePdfPreview
            source={{ kind: "saved", invoiceId: invoice.id, version: invoice.updatedAt }}
            filename={`${invoice.invoiceNumber || "invoice"}.pdf`}
            openLabel={t("invoices.list.pdfAction")}
            height={900}
          />
        </ScrollView>
      </Box>
    );
  }

  // The first blocking message goes in the bottom bar too, so a failed save
  // is never silent when the offending field has scrolled out of view.
  const firstError =
    errors.partner || errors.dueDate || errors.buyerAddress || errors.lineItems || saveError || undefined;

  const notices = finalizeBlockedByProfile ? (
    <Box
      className="mb-2 rounded-card border border-err-line bg-err-wash px-4 py-3"
      testID="composer-company-profile-incomplete-notice"
    >
      <VStack space="xs">
        <Text className="text-sm text-err">{t("invoices.composer.companyProfileIncomplete")}</Text>
        <Pressable
          onPress={() => router.push(routes.settingsCompany)}
          accessibilityRole="link"
          testID="composer-company-profile-incomplete-link"
          className="min-h-10 justify-center self-start"
        >
          <Text className="text-sm font-semibold text-primary">
            {t("invoices.composer.companyProfileIncompleteLink")}
          </Text>
        </Pressable>
      </VStack>
    </Box>
  ) : null;

  return (
    <ComposerPage
      breadcrumb={breadcrumbItems}
      title={title}
      status={dirtyIndicator}
      overlay={toastOverlay}
      notices={notices}
      renderPreview={({ onClose, height }) => (
        <InvoicePdfPreview
          source={{ kind: "draft", invoice: draftInvoice }}
          filename="piszkozat-elonezet.pdf"
          height={height}
          testID="composer-live-preview"
          headerAction={
            <Button variant="tertiary" size="sm" onPress={onClose} testID="composer-preview-close">
              <ButtonText>{t("composer.previewClose")}</ButtonText>
            </Button>
          }
        />
      )}
      bottomBar={
        <ComposerBottomBar
          net={totals.subtotal}
          gross={totals.totalAmount}
          currency={currency}
          netLabel={t("invoices.totals.netTotal")}
          grossLabel={t("invoices.totals.grossTotal")}
          error={firstError}
        >
          <Button
            variant="secondary"
            size="form"
            className="phone:flex-1"
            onPress={() => void handleSave("draft")}
            disabled={saving}
            testID="composer-save-draft"
          >
            <ButtonText>{t("invoices.actions.saveDraft")}</ButtonText>
          </Button>
          {/* Split button: the label finalizes on the first click (the action
              all but a few invoices need), the chevron holds the variant that
              also e-mails the document. Also shown when editing a draft: that
              is how a díjbekérő's converted draft (or any saved draft) gets
              issued. */}
          <Box className="relative phone:flex-1">
            <HStack>
              <Button
                size="form"
                className="rounded-r-none phone:flex-1"
                onPress={() => void handleSave("finalize")}
                disabled={saving || finalizeBlockedByProfile}
                testID="composer-action-finalize"
              >
                <ButtonText>{t("invoices.actions.finalize")}</ButtonText>
              </Button>
              <Button
                size="form"
                className="rounded-l-none border-l border-white/30 px-3"
                onPress={() => setFinalizeMenuOpen((v) => !v)}
                disabled={saving || finalizeBlockedByProfile}
                accessibilityLabel={t("invoices.actions.finalizeOptions")}
                aria-expanded={finalizeMenuOpen}
                testID="composer-finalize-menu-trigger"
              >
                {finalizeMenuOpen ? <ChevronUp size={16} color="white" /> : <ChevronDown size={16} color="white" />}
              </Button>
            </HStack>
            {finalizeMenuOpen && !finalizeBlockedByProfile ? (
              <Box className="absolute bottom-[50px] right-0 z-30 w-56 rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu">
                <Pressable
                  onPress={() => void handleSave("finalizeAndSend")}
                  accessibilityRole="button"
                  className="min-h-11 justify-center rounded-control px-3 py-2 data-[hover=true]:bg-neutral-wash"
                  testID="composer-action-finalize-send"
                >
                  <Text className="text-sm text-ink">{t("invoices.actions.finalizeAndSend")}</Text>
                </Pressable>
              </Box>
            ) : null}
          </Box>
        </ComposerBottomBar>
      }
    >
      <Box className="pb-1" testID="composer-type-switch">
        <SegmentedControl
          fullWidth
          outlined
          value={documentType === "receipt" ? "invoice" : documentType}
          onChange={(value) => setDocumentType(value as DocumentType)}
          accessibilityLabel={title}
          options={DOCUMENT_TYPES.map((dt) => ({
            value: dt.value,
            label: t(dt.i18nKey),
            disabled: documentTabsDisabled,
            testID: `composer-type-${dt.value}`,
          }))}
          testID="composer-type-control"
        />
      </Box>

      <StepPartner {...composer} copyInvoices={mode === "create" ? recentInvoices : undefined} />
      <StepDatesPayment {...composer} />
      <StepLineItems
        lineItems={composer.lineItems}
        currency={composer.currency}
        products={composer.products}
        onUpdate={composer.updateLineItem}
        onAdd={composer.addLineItem}
        onAddFromProduct={composer.addLineItemFromProduct}
        onRemove={composer.removeLineItem}
        isModification={invoice?.documentType === "modify"}
        error={errors.lineItems}
        focusField={focusField}
        onFocusHandled={clearFocusField}
        t={t}
      />

      <Box className="gap-4 border-t border-line pt-[22px]">
        <DispatchCard {...composer} />
        <MoreSettingsCard {...composer} />
      </Box>
    </ComposerPage>
  );
}
