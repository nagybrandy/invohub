// components/invoices/InvoiceStatusChip.tsx
// THE status pill (tokens.md §6.4): 6px radius, 12px regular text, one colour
// per status from the single status-colour source. The same component is used
// in lists, cards, detail pages, the dashboard and notifications. Not
// uppercase, no border.
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { STATUS_VISUALS } from "@/lib/invoices/status-visuals";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import type { InvoiceStatus } from "@/lib/invoices/types";

export type InvoiceStatusChipProps = {
  status: InvoiceStatus;
  /** Kept for existing call sites: both sizes render the design's single 12px pill. */
  size?: "sm" | "md";
};

export function InvoiceStatusChip({ status }: InvoiceStatusChipProps) {
  const { t } = useTranslation();
  const visual = STATUS_VISUALS[status];

  return (
    <Box
      testID="invoice-status-chip"
      className={`self-start rounded-pill px-[9px] py-[2px] ${visual.chip}`}
    >
      <Text className={`text-xs ${visual.text}`}>{t(STATUS_I18N_KEY[status])}</Text>
    </Box>
  );
}
