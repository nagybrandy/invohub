// components/dashboard/DashboardHeader.tsx
// Főoldal header (SPEC §7.1): the title and one line, "N teendő vár rád, ebből
// M sürgős." with the count in bold, or "Minden elintézve.". No create
// buttons and no quarter switcher: the summary API has no period parameter.
// The only action is the support contact in a "···" menu, when one is set up.
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import type { TodoSummary } from "@/lib/dashboard/todo-summary";
import { type } from "@/lib/ui/type";

export type DashboardHeaderProps = {
  title: string;
  summary: TodoSummary;
  /** Hidden while the counts are still loading, so the line never flashes "all done". */
  loading?: boolean;
  overflowActions?: OverflowMenuItem[];
  overflowLabel?: string;
};

export function DashboardHeader({
  title,
  summary,
  loading = false,
  overflowActions,
  overflowLabel,
}: DashboardHeaderProps) {
  const { t } = useTranslation();

  return (
    <HStack className="w-full items-start justify-between gap-4 pb-2" testID="dashboard-header">
      <VStack space="xs" className="min-w-0 flex-1">
        <Heading className={type.pageTitle}>{title}</Heading>
        {loading ? (
          // Keeps the line's height while loading.
          <Box className="h-5" />
        ) : (
          <Text size="sm" className={type.lead} testID="dashboard-summary">
            {summary.allDone ? (
              t("home.summary.allDone")
            ) : (
              <>
                <Text size="sm" className="font-semibold text-ink">
                  {t("home.summary.todoLead", { count: summary.total })}
                </Text>
                {t("home.summary.todoRest", { urgent: summary.urgent })}
              </>
            )}
          </Text>
        )}
      </VStack>
      {overflowActions && overflowActions.length > 0 ? (
        <OverflowMenu items={overflowActions} label={overflowLabel ?? "Továbbiak"} />
      ) : null}
    </HStack>
  );
}
