// components/invoices/InvoiceDocumentPreview.tsx
// Inline HTML/PDF invoice preview — tabs on mobile, side-by-side on desktop.
import * as React from "react";
import { ActivityIndicator, Linking, Platform } from "react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { apiFetch, apiFetchBlob, invoicePdfUrl } from "@/lib/api/client";
import { getAuthBaseUrl } from "@/lib/auth-url";
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";
import type { Invoice } from "@/lib/invoices/types";
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
  pdfUrl,
  loading,
  error,
  minHeight,
  onOpenPdf,
}: {
  title: string;
  html?: string | null;
  pdfUrl?: string | null;
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
      <Box className="py-6" style={{ minHeight }}>
        <Text className="text-destructive">{error}</Text>
      </Box>
    );
  }

  if (html && Platform.OS === "web") {
    return React.createElement("iframe", {
      title,
      srcDoc: html,
      style: { width: "100%", height: minHeight, border: "none", background: "white" },
    });
  }

  if (pdfUrl && Platform.OS === "web") {
    return React.createElement("iframe", {
      title,
      src: pdfUrl,
      style: { width: "100%", height: minHeight, border: "none", background: "white" },
    });
  }

  return (
    <VStack space="md" className="items-center py-8" style={{ minHeight }}>
      <Text className="text-center text-muted-foreground">
        {html
          ? "HTML preview is available on web."
          : "Open the PDF in your browser to preview on this device."}
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
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [loadingHtml, setLoadingHtml] = React.useState(false);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [errorHtml, setErrorHtml] = React.useState<string | null>(null);
  const [errorPdf, setErrorPdf] = React.useState<string | null>(null);

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
    if (pdfUrl?.startsWith("blob:")) URL.revokeObjectURL(pdfUrl);
    setHtml(null);
    setPdfUrl(null);
    setErrorHtml(null);
    setErrorPdf(null);
  }, [invoiceKey]);

  React.useEffect(() => {
    return () => {
      if (pdfUrl?.startsWith("blob:")) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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
    if (!needsPdf || pdfUrl) return;
    if (Platform.OS !== "web") return;

    setLoadingPdf(true);
    setErrorPdf(null);

    const loadPdf = invoiceId
      ? apiFetchBlob(`/api/invoices/${invoiceId}/pdf`)
      : fetch(`${getAuthBaseUrl()}/api/invoices/preview/pdf`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice }),
        }).then(async (response) => {
          if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? response.statusText);
          }
          return response.blob();
        });

    void loadPdf
      .then((blob) => setPdfUrl(URL.createObjectURL(blob)))
      .catch((e) =>
        setErrorPdf(e instanceof Error ? e.message : "Failed to load PDF preview.")
      )
      .finally(() => setLoadingPdf(false));
  }, [needsPdf, pdfUrl, invoice, invoiceId, invoiceKey]);

  async function handleOpenPdfNative() {
    if (invoiceId) {
      await Linking.openURL(invoicePdfUrl(invoiceId));
      return;
    }
    const base = getAuthBaseUrl();
    await Linking.openURL(`${base}/api/invoices/preview/pdf`);
  }

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
              pdfUrl={pdfUrl}
              loading={loadingPdf}
              error={errorPdf}
              minHeight={minHeight}
              onOpenPdf={Platform.OS !== "web" ? handleOpenPdfNative : undefined}
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
            pdfUrl={pdfUrl}
            loading={loadingPdf}
            error={errorPdf}
            minHeight={minHeight}
            onOpenPdf={Platform.OS !== "web" ? handleOpenPdfNative : undefined}
          />
        )}
      </Card>
    </VStack>
  );
}
