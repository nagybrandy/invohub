// components/settings/PdfPreviewPanel.tsx
// "Előnézet mintaadatokkal": the sample invoice PDF for the template being
// edited (POST /api/pdf-template renders it from the draft, nothing is saved).
// On the web it re-renders after every edit (debounced) into the double-buffered
// PdfPreviewEmbed, so it reads as live; on native there is no inline PDF
// viewer, so the header button opens the sample in the share sheet instead.
// The paper is white in both themes (PDF), on a neutral-wash frame.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PdfPreviewEmbed } from "@/components/invoices/PdfPreviewEmbed";
import { saveDownload } from "@/components/settings/save-download";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import { sharePdfBlob } from "@/lib/pdf-preview";
import { isWeb } from "@/lib/platform";
import { type } from "@/lib/ui/type";

/** How long to wait after the last edit before asking for a fresh sample. */
export const PREVIEW_DEBOUNCE_MS = 600;
const SAMPLE_FILENAME = "invohub-sample-preview.pdf";

export function PdfPreviewPanel({
  draft,
  render,
  enabled = true,
  height = 680,
  testID = "pdf-preview-panel",
}: {
  draft: InvoicePdfTemplate;
  /** Renders the sample PDF for a draft (usePdfTemplate().previewSample). */
  render: (draft: InvoicePdfTemplate) => Promise<Blob>;
  /** Only render while the panel is visible (narrow layouts toggle it). */
  enabled?: boolean;
  height?: number;
  testID?: string;
}) {
  const { t } = useTranslation();
  const web = isWeb();
  const [url, setUrl] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const urls = React.useRef<string[]>([]);
  const requestId = React.useRef(0);
  const renderRef = React.useRef(render);
  renderRef.current = render;
  // The draft as a string, so a fresh-but-equal object does not retrigger.
  const draftKey = JSON.stringify(draft);

  React.useEffect(() => {
    if (!enabled || !web || typeof URL === "undefined") return;
    const id = ++requestId.current;
    setUpdating(true);
    const timer = setTimeout(async () => {
      try {
        const blob = await renderRef.current(JSON.parse(draftKey) as InvoicePdfTemplate);
        if (id !== requestId.current) return;
        const next = URL.createObjectURL(blob);
        urls.current.push(next);
        setUrl(next);
        setError(null);
        // PdfPreviewEmbed keeps the previous frame until the new one painted;
        // release every older object URL a little later.
        const stale = urls.current.slice(0, -1);
        urls.current = urls.current.slice(-1);
        setTimeout(() => stale.forEach((old) => URL.revokeObjectURL(old)), 8000);
      } catch (e) {
        if (id === requestId.current) setError(e instanceof Error && e.message ? e.message : t("settingsPages.pdf.previewFailed"));
      } finally {
        if (id === requestId.current) setUpdating(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, enabled, web]);

  React.useEffect(
    () => () => {
      requestId.current += 1;
      urls.current.forEach((old) => URL.revokeObjectURL(old));
      urls.current = [];
    },
    []
  );

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const blob = await renderRef.current(draft);
      if (web) saveDownload(SAMPLE_FILENAME, blob);
      else await sharePdfBlob(blob, SAMPLE_FILENAME);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("settingsPages.pdf.previewFailed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Box testID={testID} className="w-full min-w-0 gap-3">
      <Box className="flex-row flex-wrap items-center justify-between gap-3">
        <Text className={type.itemTitle}>{t("settingsPages.pdf.previewHeading")}</Text>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => void handleDownload()}
          disabled={downloading}
          testID="pdf-preview-download"
        >
          <ButtonText>{t(web ? "settingsPages.pdf.downloadSample" : "settingsPages.pdf.openSample")}</ButtonText>
        </Button>
      </Box>
      {web ? (
        <Box className="rounded-[14px] bg-neutral-wash p-3">
          <Box className="overflow-hidden rounded-control bg-white" style={{ minHeight: height }}>
            {url ? <PdfPreviewEmbed src={url} title={t("settings.pdfScreen.previewFrameTitle")} minHeight={height} testID="pdf-preview-frame" /> : null}
          </Box>
          {updating ? (
            <Text testID="pdf-preview-updating" className={`${type.meta} mt-2`}>
              {t("settingsPages.pdf.previewUpdating")}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {error ? (
        <Text testID="pdf-preview-error" className="text-sm text-err">
          {error}
        </Text>
      ) : null}
    </Box>
  );
}
