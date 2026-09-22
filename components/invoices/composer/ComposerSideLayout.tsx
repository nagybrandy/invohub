// components/invoices/composer/ComposerSideLayout.tsx
// Wide-screen (≥1024px) composer layout: the whole form on the left, the
// live PDF of the unsaved draft on the right in a sticky column, so the
// user always sees exactly the document the customer will receive while
// editing (owner feedback 2026-09-22). The preview re-renders debounced
// (~700ms) after edits and keeps the last render on screen meanwhile
// (useInvoicePdfPreview + PdfPreviewEmbed). A "hide" control hands the full
// width back (e.g. to the step-2 line-item grid).
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { InvoicePdfPreview } from "@/components/invoices/InvoicePdfPreview";
import type { Invoice } from "@/lib/invoices/types";

export function ComposerSideLayout({
  children,
  invoice,
  previewWidth,
  previewHeight,
  onHidePreview,
  t,
}: {
  children: React.ReactNode;
  invoice: Invoice;
  previewWidth: number;
  previewHeight: number;
  onHidePreview: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Box className="flex-row items-start gap-8" testID="composer-side-layout">
      <Box className="min-w-0 flex-1 gap-5 md:gap-6" testID="composer-form-column">
        {children}
      </Box>
      <Box
        className="sticky top-4 shrink-0"
        style={{ width: previewWidth }}
        testID="composer-side-preview"
      >
        <InvoicePdfPreview
          source={{ kind: "draft", invoice }}
          filename="piszkozat-elonezet.pdf"
          height={previewHeight}
          testID="composer-live-preview"
          headerAction={
            <Button size="sm" variant="link" onPress={onHidePreview} testID="composer-hide-preview">
              <ButtonText>{t("invoices.preview.hide")}</ButtonText>
            </Button>
          }
        />
      </Box>
    </Box>
  );
}
