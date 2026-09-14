// components/layout/StatCard.tsx
// Dashboard/list metric card. Clickable (onPress) KPIs get hover + a chevron
// so it's obvious they lead somewhere (A4). tone="positive" is the ONLY way
// to get green here — reserved for paid/success figures (V5).
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { useIconColors } from "@/lib/theme/icon-colors";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "positive" | "critical";
  icon?: LucideIcon;
  onPress?: () => void;
  loading?: boolean;
};

const VALUE_TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-foreground",
  positive: "text-[#15803d]",
  critical: "text-destructive",
};

export function StatCard({ label, value, hint, tone = "neutral", icon: Icon, onPress, loading }: StatCardProps) {
  const icons = useIconColors();
  const body = (
    <Card className="min-w-[140px] flex-1 rounded-xl border border-subtle p-5 shadow-none">
      <VStack space="xs">
        <HStack className="items-center justify-between">
          <Text size="sm" className="text-muted-foreground">
            {label}
          </Text>
          {Icon ? <Icon size={16} color={icons.muted} /> : null}
        </HStack>
        {loading ? (
          <Box className="h-8 w-24 animate-pulse rounded-md bg-muted" testID="stat-card-skeleton" />
        ) : (
          <HStack className="items-center justify-between">
            <Text
              numeric={false}
              className={`font-heading text-[28px] font-bold leading-8 tabular-nums ${VALUE_TONE_CLASS[tone]}`}
            >
              {value}
            </Text>
            {onPress ? <ChevronRight size={16} color={icons.muted} /> : null}
          </HStack>
        )}
        {hint ? (
          <Text size="xs" className="text-muted-foreground">
            {hint}
          </Text>
        ) : null}
      </VStack>
    </Card>
  );

  if (!onPress) return body;

  return (
    <Pressable
      testID="stat-card-press"
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 data-[hover=true]:opacity-90"
    >
      {body}
    </Pressable>
  );
}
