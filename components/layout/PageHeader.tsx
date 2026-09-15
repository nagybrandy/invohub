// components/layout/PageHeader.tsx
// Consistent screen title row — every screen's top. Backward compatible:
// the original { title, subtitle, actions } shape still renders unchanged.
// New: breadcrumb, meta (chip next to the title), and a
// primary/secondary/overflow action split (spec §1.3, §4.8).
import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";

export type { BreadcrumbItem } from "@/components/layout/Breadcrumb";

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Only on non-top-level screens; first item links back to the parent. */
  breadcrumb?: BreadcrumbItem[];
  /** Chip / status rendered inline next to the title. */
  meta?: ReactNode;
  /** At most one — the single solid button on the screen (V9). */
  primaryAction?: ReactNode;
  /** At most two visible outline buttons. */
  secondaryActions?: ReactNode;
  /** Extra items collapsed into a trailing "···" menu. */
  overflowActions?: OverflowMenuItem[];
  /** @deprecated use primaryAction/secondaryActions/overflowActions instead. Still fully supported. */
  actions?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  meta,
  primaryAction,
  secondaryActions,
  overflowActions,
  actions,
}: PageHeaderProps) {
  const hasSplitActions = Boolean(
    primaryAction || secondaryActions || (overflowActions && overflowActions.length > 0)
  );

  return (
    <VStack space="sm" className="w-full pb-2">
      {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}
      <HStack className="flex-wrap items-start justify-between gap-4">
        <VStack space="xs" className="min-w-0 flex-1">
          <HStack space="sm" className="items-center flex-wrap">
            <Heading className="font-heading text-[32px] leading-[38px] font-bold text-foreground">
              {title}
            </Heading>
            {meta ? <Box>{meta}</Box> : null}
          </HStack>
          {subtitle ? (
            <Text size="sm" className="text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </VStack>
        {hasSplitActions ? (
          <HStack space="sm" className="w-full items-center justify-end gap-2 md:w-auto">
            {secondaryActions}
            {overflowActions && overflowActions.length > 0 ? (
              <OverflowMenu items={overflowActions} label="Továbbiak" />
            ) : null}
            {primaryAction ? <Box className="w-full md:w-auto">{primaryAction}</Box> : null}
          </HStack>
        ) : actions ? (
          <HStack space="sm">{actions}</HStack>
        ) : null}
      </HStack>
    </VStack>
  );
}
