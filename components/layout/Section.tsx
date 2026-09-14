// components/layout/Section.tsx
// Labeled content block. `variant="card"` (default) draws the one card
// border/background for the block; `variant="plain"` renders bare content so
// nested cards never appear inside a card (4.3 — "no boxes inside boxes").
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type SectionProps = {
  title?: string;
  description?: string;
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
  const header =
    title || action ? (
      <HStack className="items-start justify-between gap-3">
        <VStack space="xs" className="flex-1">
          {title ? (
            <Heading size="lg" className="font-heading text-foreground">
              {title}
            </Heading>
          ) : null}
          {description ? (
            <Text size="sm" className="text-muted-foreground">
              {description}
            </Text>
          ) : null}
        </VStack>
        {action ?? null}
      </HStack>
    ) : null;

  if (variant === "plain") {
    return (
      <VStack space="sm" className={className}>
        {header}
        {children}
      </VStack>
    );
  }

  return (
    <Card className={`rounded-xl border border-subtle p-5 shadow-none ${className}`}>
      <VStack space="md">
        {header}
        {children}
      </VStack>
    </Card>
  );
}
