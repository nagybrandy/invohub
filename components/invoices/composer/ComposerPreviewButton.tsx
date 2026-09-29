// components/invoices/composer/ComposerPreviewButton.tsx
// The "Előnézet" button + drawer for screens too narrow for the composer's
// live side preview (< 1024px, or when the user hid the side panel). The
// drawer shows the SAME live PDF as the side panel — the draft rendered by
// the real PDF generator — and never replaces the form (INV-9). Nothing is
// fetched until the drawer is opened.
import * as React from "react";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Heading } from "@/components/ui/heading";
import { InvoicePdfPreview } from "@/components/invoices/InvoicePdfPreview";
import type { Invoice } from "@/lib/invoices/types";

export function ComposerPreviewButton({
  invoice,
  t,
  testID = "composer-open-preview",
}: {
  invoice: Invoice;
  t: (key: string, opts?: Record<string, unknown>) => string;
  testID?: string;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onPress={() => setPreviewOpen(true)} testID={testID}>
        <ButtonText>{t("invoices.composer.openFullPreview")}</ButtonText>
      </Button>

      <Drawer isOpen={previewOpen} onClose={() => setPreviewOpen(false)} size="lg" anchor="bottom">
        <DrawerBackdrop />
        <DrawerContent className="max-h-[92%]">
          <DrawerHeader>
            <Heading size="md">{t("invoices.composer.fullPreviewTitle")}</Heading>
          </DrawerHeader>
          <DrawerBody className="flex-1">
            {previewOpen ? (
              <InvoicePdfPreview
                source={{ kind: "draft", invoice }}
                filename="piszkozat-elonezet.pdf"
                height={640}
                showTitle={false}
                testID="composer-drawer-preview"
              />
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
