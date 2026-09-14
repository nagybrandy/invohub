// components/layout/PageHeader.tsx
// Consistent screen title row: breadcrumb, title/subtitle/meta, and up to
// one primary + a couple of secondary actions (rest in an overflow menu).
import type { ReactNode } from "react";
import { router, type Href } from "expo-router";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";

export type BreadcrumbItem = { label: string; href?: Href };

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  /** Chip / status rendered inline next to the title. */
  meta?: ReactNode;
  /** At most one — the screen's single solid button. */
  primaryAction?: ReactNode;
  /** At most two visible outline buttons. */
  secondaryActions?: ReactNode;
  /** Extra items collapsed into a trailing "⋯" menu. */
  overflowActions?: OverflowMenuItem[];
  /** @deprecated use primaryAction/secondaryActions — kept for older screens. */
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
  return (
    <VStack space="xs" className="pb-2">
      {breadcrumb && breadcrumb.length > 0 ? (
        <HStack space="xs" className="flex-wrap items-center" testID="page-header-breadcrumb">
          {breadcrumb.map((item, index) => (
            <HStack key={`${item.label}-${index}`} space="xs" className="items-center">
              {index > 0 ? (
                <Text size="xs" className="text-muted-foreground">
                  /
                </Text>
              ) : null}
              {item.href ? (
                <Pressable onPress={() => router.push(item.href!)}>
                  <Text size="xs" className="text-muted-foreground">
                    {item.label}
                  </Text>
                </Pressable>
              ) : (
                <Text size="xs" className="text-muted-foreground">
                  {item.label}
                </Text>
              )}
            </HStack>
          ))}
        </HStack>
      ) : null}
      <HStack className="items-start justify-between gap-4">
        <VStack space="xs" className="flex-1">
          <HStack space="sm" className="flex-wrap items-center">
            <Heading size="2xl" className="font-heading text-foreground">
              {title}
            </Heading>
            {meta ?? null}
          </HStack>
          {subtitle ? (
            <Text size="sm" className="text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </VStack>
        <HStack space="sm" className="items-center">
          {secondaryActions ?? null}
          {primaryAction ?? null}
          {overflowActions && overflowActions.length > 0 ? (
            <OverflowMenu items={overflowActions} label="Továbbiak" />
          ) : null}
          {actions ?? null}
        </HStack>
      </HStack>
    </VStack>
  );
}
