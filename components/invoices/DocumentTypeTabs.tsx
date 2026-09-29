// components/invoices/DocumentTypeTabs.tsx
// Responsive segmented document picker using two rows on narrow screens.
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

// "receipt" stays in the type union (other code still reasons about it —
// see toInvoiceDocumentType/toTabDocumentType in useInvoiceComposer.ts) but
// is no longer a renderable tab here: it used to navigate away from an
// in-progress invoice and silently drop typed data (INV-14, E2). Receipts
// are created from the sidebar's "Nyugták → Új nyugta" instead.
export type DocumentType = "invoice" | "proforma" | "advance" | "receipt";

const DOCUMENT_TYPE_KEYS: { value: Exclude<DocumentType, "receipt">; i18nKey: string }[] = [
  { value: "invoice", i18nKey: "invoices.documentTypes.invoice" },
  { value: "proforma", i18nKey: "invoices.documentTypes.proforma" },
  { value: "advance", i18nKey: "invoices.documentTypes.advance" },
];

type Props = {
  selected: DocumentType;
  onChange: (type: DocumentType) => void;
  /** Disabled while editing an existing invoice — the document type can't change after issuing (spec §2.7). */
  disabled?: boolean;
};

export function DocumentTypeTabs({ selected, onChange, disabled }: Props) {
  const { t } = useTranslation();

  return (
    <Box className="flex-row flex-wrap rounded-lg border border-border bg-card p-1 md:flex-nowrap">
      {DOCUMENT_TYPE_KEYS.map((dt) => (
        <Pressable
          key={dt.value}
          onPress={() => !disabled && onChange(dt.value)}
          disabled={disabled}
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === dt.value, disabled }}
          className={`w-1/3 items-center justify-center rounded-lg px-2 py-2.5 md:flex-1 md:px-4 md:py-3 ${
            selected === dt.value ? "bg-primary" : "bg-transparent"
          } ${disabled ? "opacity-50" : ""} ${TAP_TARGET_MIN_H}`}
        >
          <Text
            className={`text-sm font-medium ${
              selected === dt.value
                ? "text-primary-foreground"
                : "text-foreground"
            }`}
          >
            {t(dt.i18nKey)}
          </Text>
        </Pressable>
      ))}
    </Box>
  );
}
