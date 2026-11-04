// components/layout/StatCard.tsx
// Dashboard/list metric card (tokens.md §6.16): 13px muted label, 20/700
// tabular number, 13px muted period. Backward compatible: the original
// { label, value, hint } shape still renders unchanged. tone: positive is the
// ONLY green (paid), critical is err. Also icon, onPress (hover + chevron),
// loading (skeleton).
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
import { type } from "@/lib/ui/type";

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
  neutral: "text-ink",
  positive: "text-ok",
  critical: "text-err",
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
    <Card testID="stat-card" className="min-w-[140px] flex-1 gap-0 px-[22px] py-3.5">
      {loading ? (
        <VStack testID="stat-card-skeleton" space="sm">
          <Box className="h-3 w-20 animate-pulse rounded bg-neutral-wash" />
          <Box className="h-6 w-24 animate-pulse rounded bg-neutral-wash" />
        </VStack>
      ) : (
        <VStack space="xs">
          <HStack className="items-center justify-between">
            <Text size="sm" className="text-[13px] font-medium text-muted-ink">
              {label}
            </Text>
            {Icon ? <Icon size={16} color={icons.muted} /> : null}
          </HStack>
          <HStack className="items-center justify-between">
            <Text className={`${type.kpiNumber} ${TONE_VALUE_CLASS[tone]}`}>
              {value}
            </Text>
            {onPress ? <ChevronRight size={16} color={icons.muted} /> : null}
          </HStack>
          {hint ? (
            <Text size="sm" className={type.meta}>
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
