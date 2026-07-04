// components/layout/PageHeader.tsx
// Consistent screen title row with optional subtitle and actions.
import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <HStack className="items-start justify-between gap-4 pb-2">
      <VStack space="xs" className="flex-1">
        <Heading size="2xl" className="text-foreground">
          {title}
        </Heading>
        {subtitle ? (
          <Text size="sm" className="text-muted-foreground">
            {subtitle}
          </Text>
        ) : null}
      </VStack>
      {actions ? <HStack space="sm">{actions}</HStack> : null}
    </HStack>
  );
}
