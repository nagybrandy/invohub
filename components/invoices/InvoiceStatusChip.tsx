// components/invoices/InvoiceStatusChip.tsx
// Single status chip rendered by every screen (list, dashboard, detail) from
// the shared STATUS_VISUALS map, so `paid` is green everywhere and nowhere
// else is (L3, V5). Not uppercase — the old BadgeText `uppercase` base
// shouted too loudly in a dense list.
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { STATUS_VISUALS } from "@/lib/invoices/status-visuals";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import type { InvoiceStatus } from "@/lib/invoices/types";

export function InvoiceStatusChip({
  status,
  size = "md",
}: {
  status: InvoiceStatus;
  size?: "sm" | "md";
}) {
  const { t } = useTranslation();
  const visual = STATUS_VISUALS[status];
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-0.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <View
      testID="invoice-status-chip"
      className={`self-start rounded-full border ${padding} ${visual.chip} ${visual.border}`}
    >
      <Text className={`${textSize} font-medium ${visual.text}`}>
        {t(STATUS_I18N_KEY[status])}
      </Text>
    </View>
  );
}
