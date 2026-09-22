// components/invoices/InvoicePdfPreview.tsx
// The single invoice preview used everywhere (detail screen, list drawer,
// composer side panel / drawer): the REAL generated PDF, so what the user
// sees is byte-for-byte what the customer receives (owner feedback
// 2026-09-22 — the separate HTML preview drifted from the PDF and is gone).
//
// Web: embedded, double-buffered PDF (PdfPreviewEmbed) that keeps the last
// render on screen while a debounced refresh is in flight, with a subtle
// "Frissítés…" indicator. Native, and mobile browsers without an inline PDF
// viewer (navigator.pdfViewerEnabled === false, e.g. Android Chrome): the
// body explains that and the header button opens the PDF in the OS viewer.
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
import { useInvoicePdfPreview, type InvoicePdfSource } from "@/hooks/useInvoicePdfPreview";
import { invoicePdfUrl } from "@/lib/api/client";
import { sharePdfBlob } from "@/lib/pdf-preview";
import { isWeb } from "@/lib/platform";

/** False on browsers that cannot show a PDF inline (Android Chrome) — they download it instead. */
export function browserCanEmbedPdf(): boolean {
  if (typeof navigator === "undefined") return true;
  return (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;
}

export function InvoicePdfPreview({
  source,
  height = 760,
  filename = "invoice-preview.pdf",
  openLabel,
  openTestID = "invoice-preview-open-pdf",
  headerAction,
  showTitle = true,
  testID = "invoice-pdf-preview",
}: {
  source: InvoicePdfSource;
  /** Height of the embedded PDF frame on web. */
  height?: number;
  /** Filename for the native share sheet. */
  filename?: string;
  /** Header button label (defaults to "PDF megnyitása"). */
  openLabel?: string;
  openTestID?: string;
  /** Extra control rendered at the right of the header (e.g. "hide preview"). */
  headerAction?: React.ReactNode;
  showTitle?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const web = isWeb();
  const embed = web && browserCanEmbedPdf();
  // Web always renders the PDF (a browser without an inline viewer still
  // needs the ready blob so "open" can run synchronously inside the tap —
  // an await first would trip mobile popup blockers).
  const preview = useInvoicePdfPreview(source, { enabled: web });
  const [opening, setOpening] = React.useState(false);
  const [openError, setOpenError] = React.useState<string | null>(null);

  async function handleOpen() {
    setOpenError(null);
    if (web) {
      // A saved invoice opens its real URL (proper filename on download);
      // a draft opens the blob of the current render.
      const url = source.kind === "saved" ? invoicePdfUrl(source.invoiceId) : preview.url;
      if (url && typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setOpening(true);
    try {
      await sharePdfBlob(await preview.fetchBlob(), filename);
    } catch (e) {
      setOpenError(e instanceof Error && e.message ? e.message : t("invoices.preview.loadFailed"));
    } finally {
      setOpening(false);
    }
  }

  const refreshing = embed && preview.loading && !!preview.url;
  const openDisabled = opening || (web && source.kind === "draft" && !preview.url);

  return (
    <VStack space="sm" testID={testID}>
      <HStack space="sm" className="min-h-9 items-center">
        {showTitle ? (
          <Text size="sm" className="font-medium text-muted-foreground">
            {t("invoices.preview.title")}
          </Text>
        ) : null}
        {refreshing ? (
          <HStack space="xs" className="items-center" testID="invoice-pdf-preview-refreshing">
            <ActivityIndicator size="small" />
            <Text size="xs" className="text-muted-foreground">
              {t("invoices.preview.refreshing")}
            </Text>
          </HStack>
        ) : null}
        <HStack space="sm" className="ml-auto items-center">
          {headerAction}
          <Button
            size="sm"
            variant="outline"
            onPress={() => void handleOpen()}
            disabled={openDisabled}
            testID={openTestID}
          >
            <ButtonText>{openLabel ?? t("invoices.preview.openPdf")}</ButtonText>
          </Button>
        </HStack>
      </HStack>

      {source.kind === "draft" ? (
        <Text size="xs" className="text-muted-foreground">
          {t("invoices.preview.draftNote")}
        </Text>
      ) : null}

      <Card className="overflow-hidden bg-white p-0">
        {!embed ? (
          <Box className="items-center px-4 py-8" testID="invoice-pdf-preview-native">
            <Text size="sm" className="text-center text-muted-foreground">
              {t("invoices.preview.nativeHint")}
            </Text>
          </Box>
        ) : preview.url ? (
          <PdfPreviewEmbed
            src={preview.url}
            title={t("invoices.preview.frameTitle")}
            minHeight={height}
            testID="invoice-pdf-preview-frame"
          />
        ) : preview.error ? (
          <Box className="p-6">
            <StateView
              kind="error"
              title={t("invoices.preview.loadFailed")}
              description={preview.error}
              onRetry={preview.retry}
              retryLabel={t("invoices.preview.retry")}
            />
          </Box>
        ) : (
          <Box
            className="items-center justify-center"
            style={{ height }}
            testID="invoice-pdf-preview-loading"
          >
            <ActivityIndicator />
          </Box>
        )}
      </Card>

      {embed && preview.error && preview.url ? (
        <HStack space="sm" className="items-center" testID="invoice-pdf-preview-refresh-error">
          <Text size="xs" className="text-destructive">
            {t("invoices.preview.refreshFailed")}
          </Text>
          <Pressable onPress={preview.retry}>
            <Text size="xs" className="font-medium text-primary">
              {t("invoices.preview.retry")}
            </Text>
          </Pressable>
        </HStack>
      ) : null}
      {openError ? (
        <Text size="xs" className="text-destructive">
          {openError}
        </Text>
      ) : null}
    </VStack>
  );
}
