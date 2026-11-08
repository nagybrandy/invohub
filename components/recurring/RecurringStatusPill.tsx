// components/recurring/RecurringStatusPill.tsx
// Status pill for a recurring template — same 12px pill as InvoiceStatusChip.
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { RecurringStatus } from "@/lib/recurring/service";

const VISUALS: Record<RecurringStatus, { chip: string; text: string }> = {
  active: { chip: "bg-ok-wash", text: "text-ok" },
  paused: { chip: "bg-warn-wash", text: "text-warn" },
  completed: { chip: "bg-neutral-wash", text: "text-muted-ink" },
};

export function RecurringStatusPill({ status }: { status: RecurringStatus }) {
  const { t } = useTranslation();
  const visual = VISUALS[status];
  return (
    <Box
      testID={`recurring-status-${status}`}
      className={`self-start rounded-pill px-[9px] py-[2px] ${visual.chip}`}
    >
      <Text className={`text-xs ${visual.text}`}>{t(`recurring.status.${status}`)}</Text>
    </Box>
  );
}
