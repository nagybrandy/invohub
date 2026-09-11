// components/invoices/InvoiceDocumentPreview.tsx
// Inline HTML/PDF invoice preview — tabs on mobile, side-by-side on desktop.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PdfPreviewEmbed } from "@/components/invoices/PdfPreviewEmbed";
import { apiFetch, invoicePdfUrl } from "@/lib/api/client";
import { getAuthBaseUrl } from "@/lib/auth-url";
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";
import { sharePdfBlob } from "@/lib/pdf-preview";
import type { Invoice } from "@/lib/invoices/types";
import { isWeb } from "@/lib/platform";
import { useIsDesktop } from "@/lib/useIsDesktop";

type PreviewTab = "html" | "pdf";
type PreviewLayout = "tabs" | "split" | "auto";

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
            <ButtonText>Open PDF in browser</ButtonText>
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
        {html
          ? "HTML preview is available on web."
          : "PDF preview is available on web. Open it in your browser if the embed does not load."}
      </Text>
      {onOpenPdf ? (
        <Button onPress={() => void onOpenPdf()}>
          <ButtonText>Open PDF</ButtonText>
        </Button>
      ) : null}
    </VStack>
  );
}

export function InvoiceDocumentPreview({
  invoice,
  invoiceId,
  layout = "auto",
  minHeight = 520,
}: {
  invoice: Invoice;
  /** Saved invoice id — fetches from API. Omit for draft preview. */
  invoiceId?: string;
  layout?: PreviewLayout;
  minHeight?: number;
}) {
  const isDesktop = useIsDesktop();
  const effectiveLayout: "tabs" | "split" =
    layout === "auto" ? (isDesktop ? "split" : "tabs") : layout;

  const [tab, setTab] = React.useState<PreviewTab>("html");
  const [html, setHtml] = React.useState<string | null>(null);
  const [draftPdfUrl, setDraftPdfUrl] = React.useState<string | null>(null);
  const [nativePdfBlob, setNativePdfBlob] = React.useState<Blob | null>(null);
  const [loadingHtml, setLoadingHtml] = React.useState(false);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [errorHtml, setErrorHtml] = React.useState<string | null>(null);
  const [errorPdf, setErrorPdf] = React.useState<string | null>(null);

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
  }, [invoiceKey]);

  React.useEffect(() => {
    return () => {
      if (draftPdfUrl?.startsWith("blob:")) URL.revokeObjectURL(draftPdfUrl);
    };
  }, [draftPdfUrl]);

  const needsHtml = effectiveLayout === "split" || tab === "html";
  const needsPdf = effectiveLayout === "split" || tab === "pdf";

  React.useEffect(() => {
    if (!needsHtml || html) return;

    if (!invoiceId) {
      setHtml(generateInvoicePreviewHtml(invoice));
      return;
    }

    setLoadingHtml(true);
    setErrorHtml(null);
    void apiFetch<{ html: string }>(`/api/invoices/${invoiceId}/preview`)
      .then((data) => setHtml(data.html))
      .catch((e) =>
        setErrorHtml(e instanceof Error ? e.message : "Failed to load HTML preview.")
      )
      .finally(() => setLoadingHtml(false));
  }, [needsHtml, html, invoice, invoiceId, invoiceKey]);

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
        setErrorPdf(e instanceof Error ? e.message : "Failed to load PDF preview.")
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

  async function handleOpenPdf() {
    const url = draftPdfUrl ?? (invoiceId && web ? invoicePdfUrl(invoiceId) : null);
    if (web && url && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (nativePdfBlob) {
      await sharePdfBlob(nativePdfBlob, `${invoice.invoiceNumber}.pdf`);
    }
  }

  const pdfLoading = loadingPdf;
  const pdfSrc = draftPdfUrl;

  if (effectiveLayout === "split") {
    return (
      <VStack space="sm">
        <Text size="sm" className="font-medium text-muted-foreground">
          Document preview
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
