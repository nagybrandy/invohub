// components/invoices/InvoicePreviewModal.tsx
// Quick preview drawer from invoice list — HTML/PDF tabs.
import * as React from "react";
import { Linking, Platform } from "react-native";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import type { Invoice } from "@/lib/invoices/types";
import { invoicePdfUrl } from "@/lib/api/client";

export function InvoicePreviewModal({
  invoice,
  open,
  onClose,
}: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!invoice) return null;

  const pdfUrl = invoicePdfUrl(invoice.id);

  async function handleDownloadPdf() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(pdfUrl, "_blank");
      return;
    }
    await Linking.openURL(pdfUrl);
  }

  return (
    <Drawer isOpen={open} onClose={onClose} size="lg" anchor="bottom">
      <DrawerBackdrop />
      <DrawerContent className="max-h-[92%]">
        <DrawerHeader>
          <VStack space="sm">
            <Heading size="md">{invoice.invoiceNumber}</Heading>
            <Text size="sm" className="text-muted-foreground">
              {invoice.status} · {invoice.clientName}
            </Text>
            <HStack space="sm">
              <Button size="sm" variant="outline" onPress={() => void handleDownloadPdf()}>
                <ButtonText>Download PDF</ButtonText>
              </Button>
            </HStack>
          </VStack>
        </DrawerHeader>
        <DrawerBody className="flex-1">
          <InvoiceDocumentPreview
            invoice={invoice}
            invoiceId={invoice.id}
            minHeight={440}
          />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
