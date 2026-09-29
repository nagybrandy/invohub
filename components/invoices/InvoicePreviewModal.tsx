// components/invoices/InvoicePreviewModal.tsx
// Quick preview drawer from the invoice list — the real PDF (the single
// preview everywhere; see InvoicePdfPreview).
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoicePdfPreview } from "@/components/invoices/InvoicePdfPreview";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import type { Invoice } from "@/lib/invoices/types";

export function InvoicePreviewModal({
  invoice,
  open,
  onClose,
}: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!invoice) return null;

  return (
    <Drawer isOpen={open} onClose={onClose} size="lg" anchor="bottom">
      <DrawerBackdrop />
      <DrawerContent className="max-h-[92%]">
        <DrawerHeader>
          <VStack space="xs">
            <Heading size="md">{invoice.invoiceNumber || t("invoices.status.draft")}</Heading>
            <Text size="sm" className="text-muted-foreground">
              {t(STATUS_I18N_KEY[invoice.status])} · {invoice.clientName}
            </Text>
          </VStack>
        </DrawerHeader>
        <DrawerBody className="flex-1">
          {open ? (
            <InvoicePdfPreview
              source={{ kind: "saved", invoiceId: invoice.id, version: invoice.updatedAt }}
              filename={`${invoice.invoiceNumber || "invoice"}.pdf`}
              openLabel={t("invoices.list.pdfAction")}
              height={620}
              showTitle={false}
            />
          ) : null}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
