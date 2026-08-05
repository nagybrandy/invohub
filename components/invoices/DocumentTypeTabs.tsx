import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
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
    <HStack className="rounded-lg border border-border bg-card">
      {DOCUMENT_TYPE_KEYS.map((dt) => (
        <Pressable
          key={dt.value}
          onPress={() => onChange(dt.value)}
          className={`flex-1 items-center rounded-lg px-2 py-2.5 md:px-4 md:py-3 ${
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
    </HStack>
  );
}
