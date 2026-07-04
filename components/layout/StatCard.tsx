// components/layout/StatCard.tsx
// Dashboard metric card with label and value.
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="min-w-[140px] flex-1 p-4">
      <VStack space="xs">
        <Text size="sm" className="text-muted-foreground">
          {label}
        </Text>
        <Text className="text-2xl font-bold text-foreground">{value}</Text>
        {hint ? (
          <Text size="xs" className="text-muted-foreground">
            {hint}
          </Text>
        ) : null}
      </VStack>
    </Card>
  );
}
