// components/invoices/composer/ComposerPreviewButton.tsx
// The "Teljes előnézet" button + drawer (+ optional shrunk thumbnail),
// lifted out of ComposerSummary (composer-line-item-horizontal-scroll-1440)
// so step 2's sticky totals bar can reach the same full preview without a
// sticky ComposerSummary column beside it (INV-9: the preview still opens
// in a drawer, it never replaces the form).
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import type { InvoicePdfCompany } from "@/lib/invoices/generate-pdf";
import type { Invoice } from "@/lib/invoices/types";

export function ComposerPreviewButton({
  invoice,
  invoiceId,
  company,
  showThumbnail = false,
  t,
}: {
  invoice: Invoice;
  /** Saved invoice id — only set once the invoice has actually been persisted (mode="edit"). */
  invoiceId?: string;
  /** The signed-in user's own company — for the unsaved-draft preview's issuer block. */
  company?: InvoicePdfCompany;
  /** ComposerSummary shows a shrunk live thumbnail beside the button; the
   * items-step totals bar shows only the button (spec deviation, ADR). */
  showThumbnail?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);

  return (
    <VStack space="sm">
      <Button
        size="sm"
        variant="outline"
        onPress={() => setPreviewOpen(true)}
        testID="composer-open-preview"
      >
        <ButtonText>{t("invoices.composer.openFullPreview")}</ButtonText>
      </Button>

      {showThumbnail ? (
        <Box
          className="pointer-events-none h-[220px] origin-top-left scale-[0.42] overflow-hidden rounded-md border border-subtle"
          style={{ width: "238%" }}
        >
          <InvoiceDocumentPreview invoice={invoice} company={company} layout="tabs" minHeight={520} />
        </Box>
      ) : null}

      <Drawer isOpen={previewOpen} onClose={() => setPreviewOpen(false)} size="lg" anchor="bottom">
        <DrawerBackdrop />
        <DrawerContent className="max-h-[92%]">
          <DrawerHeader>
            <Heading size="md">{t("invoices.composer.fullPreviewTitle")}</Heading>
          </DrawerHeader>
          <DrawerBody className="flex-1">
            <InvoiceDocumentPreview
              invoice={invoice}
              invoiceId={invoiceId}
              company={company}
              minHeight={480}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
}
