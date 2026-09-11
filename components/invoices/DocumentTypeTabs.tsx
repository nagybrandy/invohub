// components/invoices/DocumentTypeTabs.tsx
// Responsive segmented document picker using two rows on narrow screens.
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export type DocumentType = "invoice" | "proforma" | "advance" | "receipt";

const DOCUMENT_TYPE_KEYS: { value: DocumentType; i18nKey: string }[] = [
  { value: "invoice", i18nKey: "invoices.documentTypes.invoice" },
  { value: "proforma", i18nKey: "invoices.documentTypes.proforma" },
  { value: "advance", i18nKey: "invoices.documentTypes.advance" },
  { value: "receipt", i18nKey: "invoices.documentTypes.receipt" },
];

type Props = {
  selected: DocumentType;
  onChange: (type: DocumentType) => void;
};

export function DocumentTypeTabs({ selected, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <Box className="flex-row flex-wrap rounded-lg border border-border bg-card p-1 md:flex-nowrap">
      {DOCUMENT_TYPE_KEYS.map((dt) => (
        <Pressable
          key={dt.value}
          onPress={() => onChange(dt.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === dt.value }}
          className={`w-1/2 items-center rounded-lg px-2 py-2.5 md:flex-1 md:px-4 md:py-3 ${
            selected === dt.value ? "bg-primary" : "bg-transparent"
          }`}
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
