// components/dashboard/DashboardStatCard.tsx
// The Főoldal's two small cards (tokens.md §6.16): 13px muted label with an
// optional 20px info button (tooltip), the 20/700 number with a small unit,
// and the 13px muted period line. `flex-1` so two of them stacked beside the
// hero card are together as tall as it. The foundation's StatCard has no room
// for the info button, so this wraps the same Card with the same look.
import { Info } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Tooltip } from "@/components/ui/tooltip";
import { splitMoney } from "@/lib/dashboard/money-parts";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";

export type DashboardStatCardProps = {
  testID: string;
  label: string;
  /** Already formatted money, e.g. "810 425 Ft". */
  amount: string;
  /** Period / count line under the number. */
  sub: string;
  /** Tooltip text; renders the "i" button when set. */
  info?: string;
  infoLabel?: string;
  loading?: boolean;
};

export function DashboardStatCard({
  testID,
  label,
  amount,
  sub,
  info,
  infoLabel,
  loading = false,
}: DashboardStatCardProps) {
  const icons = useIconColors();
  const money = splitMoney(amount);

  return (
    <Card testID={testID} className="min-w-0 flex-1 justify-center gap-0 px-[22px] py-3.5 phone:px-4">
      {loading ? (
        <VStack testID={`${testID}-skeleton`} space="sm">
          <Box className="h-3 w-24 animate-pulse rounded bg-neutral-wash" />
          <Box className="h-6 w-28 animate-pulse rounded bg-neutral-wash" />
          <Box className="h-3 w-20 animate-pulse rounded bg-neutral-wash" />
        </VStack>
      ) : (
        <VStack space="xs">
          <HStack className="items-start justify-between gap-2">
            <Text className="min-w-0 flex-1 text-[13px] font-medium text-muted-ink">{label}</Text>
            {info ? (
              <Tooltip content={info} testID={`${testID}-tooltip`}>
                <Pressable
                  testID={`${testID}-info`}
                  accessibilityRole="button"
                  accessibilityLabel={infoLabel ?? label}
                  className="h-5 w-5 items-center justify-center rounded-full border border-line-strong data-[hover=true]:bg-neutral-wash"
                >
                  <Info size={11} color={icons.muted} />
                </Pressable>
              </Tooltip>
            ) : null}
          </HStack>
          <HStack className="items-baseline gap-1">
            <Text className={`${type.kpiNumber} text-ink`}>{money.value}</Text>
            {money.unit ? <Text className="text-xs font-semibold text-muted-ink">{money.unit}</Text> : null}
          </HStack>
          <Text className={type.meta}>{sub}</Text>
        </VStack>
      )}
    </Card>
  );
}
