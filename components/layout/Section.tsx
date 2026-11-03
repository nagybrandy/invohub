// components/layout/Section.tsx
// Labeled content block. variant="card" gives it the design's card (12px radius,
// --surface, card shadow, 20/22 padding; tokens.md §4); variant="plain" renders
// bare so nested Sections never become "boxes inside boxes".
import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { type } from "@/lib/ui/type";

export type SectionProps = {
  title?: string;
  description?: string;
  /** Rendered top-right of the header row, e.g. an "Edit" link. */
  action?: ReactNode;
  children: ReactNode;
  variant?: "card" | "plain";
  className?: string;
};

export function Section({
  title,
  description,
  action,
  children,
  variant = "card",
  className = "",
}: SectionProps) {
  const hasHeader = Boolean(title || description || action);
  const frameClass =
    variant === "card"
      ? "rounded-card bg-surface px-[22px] py-5 shadow-card"
      : "";

  return (
    <Box testID="section" className={`${frameClass} ${className}`.trim()}>
      <VStack space="md">
        {hasHeader ? (
          <HStack className="items-start justify-between gap-4">
            <VStack space="xs" className="flex-1">
              {title ? (
                <Heading className={type.sectionTitle}>{title}</Heading>
              ) : null}
              {description ? (
                <Text size="sm" className={type.meta}>
                  {description}
                </Text>
              ) : null}
            </VStack>
            {action ? <Box>{action}</Box> : null}
          </HStack>
        ) : null}
        {children}
      </VStack>
    </Box>
  );
}
