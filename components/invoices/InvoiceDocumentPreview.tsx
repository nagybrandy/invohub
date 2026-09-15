// components/invoices/InvoiceDocumentPreview.tsx
// Inline HTML/PDF invoice preview — tabs on mobile, side-by-side on desktop
// for the composer ("auto"/"split"/"tabs", unchanged). The invoice DETAIL
// screen uses "single" instead (INV-11): one HTML view + a "Download PDF"
// button (the PDF is only fetched on demand, on press), and a 10s timeout
// on the HTML load flips to a StateView error with Retry instead of an
// infinite spinner.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PdfPreviewEmbed } from "@/components/invoices/PdfPreviewEmbed";
import { StateView } from "@/components/layout/StateView";
import { apiFetch, invoicePdfUrl } from "@/lib/api/client";
import { getAuthBaseUrl } from "@/lib/auth-url";
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";
import { sharePdfBlob } from "@/lib/pdf-preview";
import type { InvoicePdfCompany } from "@/lib/invoices/generate-pdf";
import type { Invoice } from "@/lib/invoices/types";
import { isWeb } from "@/lib/platform";
import { useIsDesktop } from "@/lib/useIsDesktop";

type PreviewTab = "html" | "pdf";
type PreviewLayout = "tabs" | "split" | "single" | "auto";
const PREVIEW_TIMEOUT_MS = 10_000;

function PreviewTabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 ${active ? "bg-primary" : "bg-muted"}`}
    >
      <Text
        size="xs"
        className={active ? "font-medium text-primary-foreground" : "text-muted-foreground"}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PreviewFrame({
  title,
  html,
  pdfSrc,
  loading,
  error,
  minHeight,
  onOpenPdf,
}: {
  title: string;
  html?: string | null;
  pdfSrc?: string | null;
  loading: boolean;
  error: string | null;
  minHeight: number;
  onOpenPdf?: () => void;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box className="items-center justify-center py-12" style={{ minHeight }}>
        <ActivityIndicator />
      </Box>
    );
  }

  if (error) {
    return (
      <VStack space="md" className="py-6" style={{ minHeight }}>
        <Text className="text-destructive">{error}</Text>
        {onOpenPdf ? (
          <Button variant="outline" onPress={() => void onOpenPdf()}>
            <ButtonText>{t("invoices.preview.openPdfInBrowser")}</ButtonText>
          </Button>
        ) : null}
      </VStack>
    );
  }

  if (html && isWeb()) {
    return React.createElement("iframe", {
      title,
      srcDoc: html,
      style: { width: "100%", height: minHeight, border: "none", background: "white" },
    });
  }

  if (pdfSrc && isWeb()) {
    return <PdfPreviewEmbed src={pdfSrc} title={title} minHeight={minHeight} />;
  }

  return (
    <VStack space="md" className="items-center py-8" style={{ minHeight }}>
      <Text className="text-center text-muted-foreground">
        {html ? t("invoices.preview.htmlWebOnly") : t("invoices.preview.pdfWebOnly")}
      </Text>
      {onOpenPdf ? (
        <Button onPress={() => void onOpenPdf()}>
          <ButtonText>{t("invoices.preview.openPdf")}</ButtonText>
        </Button>
      ) : null}
    </VStack>
  );
}

export function InvoiceDocumentPreview({
  invoice,
  invoiceId,
  company,
  layout = "auto",
  minHeight = 520,
}: {
  invoice: Invoice;
  /** Saved invoice id — fetches from API. Omit for draft preview. */
  invoiceId?: string;
  /** The signed-in user's own company, for the unsaved-draft path's issuer block. Ignored once invoiceId is set (the API route already loads it — see AC19). */
  company?: InvoicePdfCompany;
  layout?: PreviewLayout;
  minHeight?: number;
}) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const effectiveLayout: "tabs" | "split" | "single" =
    layout === "auto" ? (isDesktop ? "split" : "tabs") : layout;

  const [tab, setTab] = React.useState<PreviewTab>("html");
  const [html, setHtml] = React.useState<string | null>(null);
  const [draftPdfUrl, setDraftPdfUrl] = React.useState<string | null>(null);
  const [nativePdfBlob, setNativePdfBlob] = React.useState<Blob | null>(null);
  const [loadingHtml, setLoadingHtml] = React.useState(false);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [errorHtml, setErrorHtml] = React.useState<string | null>(null);
  const [errorPdf, setErrorPdf] = React.useState<string | null>(null);
  // Single-view mode only (the invoice detail screen, INV-11): if the HTML
  // preview is still loading after 10s, stop spinning forever and show a
  // retryable error instead.
  const [timedOut, setTimedOut] = React.useState(false);
  const [retryToken, setRetryToken] = React.useState(0);

  const web = isWeb();

  const invoiceKey = React.useMemo(() => {
    const lines = invoice.lineItems
      .map((l) => `${l.description}|${l.quantity}|${l.unitPrice}|${l.vatRate}`)
      .join(";");
    return [
      invoiceId ?? "draft",
      invoice.invoiceNumber,
      invoice.clientName,
      invoice.issueDate,
      invoice.dueDate,
      invoice.currency,
      invoice.notes ?? "",
      lines,
    ].join("::");
  }, [invoice, invoiceId]);

  React.useEffect(() => {
    if (draftPdfUrl?.startsWith("blob:")) URL.revokeObjectURL(draftPdfUrl);
    setHtml(null);
    setDraftPdfUrl(null);
    setNativePdfBlob(null);
    setErrorHtml(null);
    setErrorPdf(null);
    setTimedOut(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceKey]);

  React.useEffect(() => {
    if (effectiveLayout !== "single") return;
    if (html || errorHtml) return;
    setTimedOut(false);
    const handle = setTimeout(() => setTimedOut(true), PREVIEW_TIMEOUT_MS);
    return () => clearTimeout(handle);
  }, [effectiveLayout, html, errorHtml, invoiceKey, retryToken]);

  React.useEffect(() => {
    return () => {
      if (draftPdfUrl?.startsWith("blob:")) URL.revokeObjectURL(draftPdfUrl);
    };
  }, [draftPdfUrl]);

  const needsHtml = effectiveLayout === "split" || effectiveLayout === "single" || tab === "html";
  const needsPdf = effectiveLayout === "split" || (effectiveLayout === "tabs" && tab === "pdf");

  React.useEffect(() => {
    if (!needsHtml || html) return;

    if (!invoiceId) {
      setHtml(generateInvoicePreviewHtml(invoice, { company }));
      return;
    }

    setLoadingHtml(true);
    setErrorHtml(null);
    void apiFetch<{ html: string }>(`/api/invoices/${invoiceId}/preview`)
      .then((data) => setHtml(data.html))
      .catch((e) =>
        setErrorHtml(e instanceof Error ? e.message : t("invoices.preview.htmlLoadFailed"))
      )
      .finally(() => setLoadingHtml(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsHtml, html, invoice, invoiceId, invoiceKey, retryToken, company]);

  React.useEffect(() => {
    if (!needsPdf || draftPdfUrl || nativePdfBlob) {
      return;
    }

    setLoadingPdf(true);
    setErrorPdf(null);

    const endpoint = invoiceId
      ? `/api/invoices/${invoiceId}/pdf`
      : "/api/invoices/preview/pdf";
    const request: RequestInit = {
      method: invoiceId ? "GET" : "POST",
      credentials: "include",
      ...(invoiceId
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoice }),
          }),
    };

    void fetch(`${getAuthBaseUrl()}${endpoint}`, request)
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? response.statusText);
        }
        return response.blob();
      })
      .then((blob) => {
        if (web) {
          setDraftPdfUrl(URL.createObjectURL(blob));
        } else {
          setNativePdfBlob(blob);
        }
      })
      .catch((e) =>
        setErrorPdf(e instanceof Error ? e.message : t("invoices.preview.pdfLoadFailed"))
      )
      .finally(() => setLoadingPdf(false));
  }, [
    needsPdf,
    draftPdfUrl,
    nativePdfBlob,
    invoice,
    invoiceId,
    invoiceKey,
    web,
  ]);

  function handleRetryPreview() {
    setTimedOut(false);
    setErrorHtml(null);
    setHtml(null);
    setRetryToken((n) => n + 1);
  }

  async function handleOpenPdf() {
    const url = draftPdfUrl ?? (invoiceId && web ? invoicePdfUrl(invoiceId) : null);
    if (web && url && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (nativePdfBlob) {
      await sharePdfBlob(nativePdfBlob, `${invoice.invoiceNumber}.pdf`);
      return;
    }

    // Single-view mode never pre-fetches the PDF (that was the source of
    // the eternally-spinning panel, INV-11) — fetch it now, on demand, for
    // native platforms where there's no same-origin URL to just open.
    if (!web && invoiceId) {
      const response = await fetch(`${getAuthBaseUrl()}/api/invoices/${invoiceId}/pdf`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        setNativePdfBlob(blob);
        await sharePdfBlob(blob, `${invoice.invoiceNumber}.pdf`);
      }
    }
  }

  const pdfLoading = loadingPdf;
  const pdfSrc = draftPdfUrl;

  if (effectiveLayout === "single") {
    const showError = !!errorHtml || timedOut;
    return (
      <VStack space="sm">
        <HStack className="items-center justify-between">
          <Text size="sm" className="font-medium text-muted-foreground">
            {t("invoices.detail.previewTitle", { defaultValue: "Előnézet" })}
          </Text>
          <Button
            size="sm"
            variant="outline"
            onPress={() => void handleOpenPdf()}
            testID="invoice-preview-download-pdf"
          >
            <ButtonText>{t("invoices.list.pdfAction")}</ButtonText>
          </Button>
        </HStack>
        <Card className="overflow-hidden p-0">
          {showError ? (
            <Box className="p-6">
              <StateView
                kind="error"
                title={t("invoices.detail.previewErrorTitle")}
                description={t("invoices.detail.previewErrorDescription")}
                onRetry={handleRetryPreview}
                retryLabel={t("invoices.detail.previewRetry")}
              />
            </Box>
          ) : (
            <PreviewFrame
              title={`HTML ${invoice.invoiceNumber}`}
              html={html}
              loading={loadingHtml && !html}
              error={null}
              minHeight={minHeight}
            />
          )}
        </Card>
      </VStack>
    );
  }

  if (effectiveLayout === "split") {
    return (
      <VStack space="sm">
        <Text size="sm" className="font-medium text-muted-foreground">
          {t("invoices.preview.title")}
        </Text>
        <HStack space="md" className="items-start">
          <Card className="min-w-0 flex-1 overflow-hidden p-0">
            <Box className="border-b border-border px-3 py-2">
              <Text size="sm" className="font-medium">
                HTML
              </Text>
            </Box>
            <PreviewFrame
              title={`HTML ${invoice.invoiceNumber}`}
              html={html}
              loading={loadingHtml}
              error={errorHtml}
              minHeight={minHeight}
            />
          </Card>
          <Card className="min-w-0 flex-1 overflow-hidden p-0">
            <Box className="border-b border-border px-3 py-2">
              <Text size="sm" className="font-medium">
                PDF
              </Text>
            </Box>
            <PreviewFrame
              title={`PDF ${invoice.invoiceNumber}`}
              pdfSrc={pdfSrc}
              loading={pdfLoading}
              error={errorPdf}
              minHeight={minHeight}
              onOpenPdf={pdfSrc || nativePdfBlob ? handleOpenPdf : undefined}
            />
          </Card>
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack space="sm">
      <HStack space="xs" className="flex-wrap items-center justify-between">
        <HStack space="xs">
          <PreviewTabButton
            label="HTML"
            active={tab === "html"}
            onPress={() => setTab("html")}
          />
          <PreviewTabButton
            label="PDF"
            active={tab === "pdf"}
            onPress={() => setTab("pdf")}
          />
        </HStack>
      </HStack>

      <Card className="overflow-hidden p-0">
        {tab === "html" ? (
          <PreviewFrame
            title={`HTML ${invoice.invoiceNumber}`}
            html={html}
            loading={loadingHtml}
            error={errorHtml}
            minHeight={minHeight}
          />
        ) : (
          <PreviewFrame
            title={`PDF ${invoice.invoiceNumber}`}
            pdfSrc={pdfSrc}
            loading={pdfLoading}
            error={errorPdf}
            minHeight={minHeight}
            onOpenPdf={pdfSrc || nativePdfBlob ? handleOpenPdf : undefined}
          />
        )}
      </Card>
    </VStack>
  );
}
