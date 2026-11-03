// components/marketing/ShowcasePill.tsx
// Status pill of the landing illustrations: the app's status colours
// (lib/invoices/status-visuals.ts) with the landing's own short labels
// (landing.product.paid / sent / draft).
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { SampleStatus } from "@/components/marketing/sample-data";
import { STATUS_VISUALS } from "@/lib/invoices/status-visuals";

const LABEL_KEYS = {
  paid: "landing.product.paid",
  sent: "landing.product.sent",
  draft: "landing.product.draft",
} as const satisfies Record<SampleStatus, string>;

export function ShowcasePill({ status }: { status: SampleStatus }) {
  const { t } = useTranslation();
  const visual = STATUS_VISUALS[status];

  return (
    <Box
      testID={`showcase-pill-${status}`}
      className={`self-start rounded-pill px-[9px] py-[2px] ${visual.chip}`}
    >
      <Text className={`text-xs ${visual.text}`}>{t(LABEL_KEYS[status])}</Text>
    </Box>
  );
}
