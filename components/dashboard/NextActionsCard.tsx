// components/dashboard/NextActionsCard.tsx
// "Következő lépések" — at most 3 actionable rows below the dashboard KPIs,
// or an all-clear message (dashboard §3.3). Each row is one tap away from
// the matching filtered invoice list.
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Section } from "@/components/layout/Section";
import { StateView } from "@/components/layout/StateView";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { InvoiceStatus } from "@/lib/invoices/types";

export type NextActionRow = {
  key: string;
  label: string;
  status: InvoiceStatus | "all";
};

function buildRows(
  t: (key: string, opts?: Record<string, unknown>) => string,
  overdueCount: number,
  draftCount: number
): NextActionRow[] {
  const rows: NextActionRow[] = [];
  if (overdueCount > 0) {
    rows.push({
      key: "overdue",
      label: t("dashboard.nextActions.overdue", { count: overdueCount }),
      status: "overdue",
    });
  }
  if (draftCount > 0) {
    rows.push({
      key: "drafts",
      label: t("dashboard.nextActions.drafts", { count: draftCount }),
      status: "draft",
    });
  }
  return rows.slice(0, 3);
}

export function NextActionsCard({
  overdueCount,
  draftCount,
  loading = false,
  onSelect,
}: {
  overdueCount: number;
  draftCount: number;
  loading?: boolean;
  onSelect: (status: InvoiceStatus | "all") => void;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();

  if (loading) {
    return (
      <Section title={t("dashboard.nextActions.title")}>
        <StateView kind="loading" title="" rows={2} />
      </Section>
    );
  }

  const rows = buildRows(t, overdueCount, draftCount);

  return (
    <Section title={t("dashboard.nextActions.title")}>
      {rows.length === 0 ? (
        <Text size="sm" className="text-muted-foreground" testID="next-actions-all-clear">
          {t("dashboard.nextActions.allClear")}
        </Text>
      ) : (
        <VStack space="xs" testID="next-actions-rows">
          {rows.map((row) => (
            <Pressable
              key={row.key}
              testID={`next-action-row-${row.key}`}
              onPress={() => onSelect(row.status)}
              accessibilityRole="button"
              className="flex-row items-center justify-between rounded-lg border border-subtle px-3 py-2.5 data-[hover=true]:bg-muted/40"
            >
              <Text size="sm" className="flex-1 text-foreground">
                {row.label}
              </Text>
              <Box>
                <HStack className="items-center">
                  <ChevronRight size={16} color={icons.muted} />
                </HStack>
              </Box>
            </Pressable>
          ))}
        </VStack>
      )}
    </Section>
  );
}
