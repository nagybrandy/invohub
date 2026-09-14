// components/invoices/InvoiceStatusChip.tsx
// Status pill reading from the single status-color source (L3, V5). Not
// uppercase — the previous BadgeText uppercase base read as shouting in a
// dense list (V5 follow-up).
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { STATUS_VISUALS } from "@/lib/invoices/status-visuals";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import type { InvoiceStatus } from "@/lib/invoices/types";

export type InvoiceStatusChipProps = {
  status: InvoiceStatus;
  /** "sm" (list rows, dense tables) or "md" (headers, detail pages). Default "md". */
  size?: "sm" | "md";
};

export function InvoiceStatusChip({ status, size = "md" }: InvoiceStatusChipProps) {
  const { t } = useTranslation();
  const visual = STATUS_VISUALS[status];
  const sizeClass = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-0.5";
  const textSizeClass = size === "sm" ? "text-[11px]" : "text-xs";

  return (
    <Box
      testID="invoice-status-chip"
      className={`self-start rounded-full border ${sizeClass} ${visual.chip} ${visual.border}`}
    >
      <Text className={`font-medium ${textSizeClass} ${visual.text}`}>
        {t(STATUS_I18N_KEY[status])}
      </Text>
    </Box>
  );
}
