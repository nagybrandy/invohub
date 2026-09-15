// components/layout/StatCard.tsx
// Dashboard/list metric card. Backward compatible: the original
// { label, value, hint } shape still renders unchanged. New: tone (positive
// is the ONLY green — paid only), icon, onPress (hover + chevron), loading
// (skeleton).
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { useIconColors } from "@/lib/theme/icon-colors";

export type StatCardProps = {
  label: string;
  /** "metric" tipográfia (28/32 tabular-nums heading). */
  value: ReactNode;
  hint?: string;
  /** positive = green (paid-only contexts); critical = destructive; default neutral. */
  tone?: "neutral" | "positive" | "critical";
  icon?: LucideIcon;
  onPress?: () => void;
  loading?: boolean;
};

const TONE_VALUE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-foreground",
  positive: "text-[#15803d]",
  critical: "text-destructive",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
  onPress,
  loading = false,
}: StatCardProps) {
  const icons = useIconColors();

  const body = (
    <Card testID="stat-card" className="min-w-[140px] flex-1 p-4">
      {loading ? (
        <VStack testID="stat-card-skeleton" space="sm">
          <Box className="h-3 w-20 animate-pulse rounded bg-muted" />
          <Box className="h-8 w-24 animate-pulse rounded bg-muted" />
        </VStack>
      ) : (
        <VStack space="xs">
          <HStack className="items-center justify-between">
            <Text size="sm" className="text-muted-foreground">
              {label}
            </Text>
            {Icon ? <Icon size={16} color={icons.muted} /> : null}
          </HStack>
          <HStack className="items-center justify-between">
            <Text
              className={`font-heading text-[28px] leading-8 font-bold tabular-nums ${TONE_VALUE_CLASS[tone]}`}
            >
              {value}
            </Text>
            {onPress ? <ChevronRight size={16} color={icons.muted} /> : null}
          </HStack>
          {hint ? (
            <Text size="xs" className="text-muted-foreground">
              {hint}
            </Text>
          ) : null}
        </VStack>
      )}
    </Card>
  );

  if (!onPress) return body;

  return (
    <Pressable
      testID="stat-card-pressable"
      onPress={onPress}
      className="min-w-[140px] flex-1 data-[hover=true]:opacity-90"
      accessibilityRole="button"
    >
      {body}
    </Pressable>
  );
}
