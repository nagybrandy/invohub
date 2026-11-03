// components/invoices/composer/ComposerBottomBar.tsx
// The sticky bottom bar of the composer (tokens.md §6.18): net and gross on
// the left, the actions on the right (stacked under the totals on phones).
// It also carries the first validation message, so a failed save is never
// silent when the offending field is scrolled out of view.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { InvoiceCurrency } from "@/lib/invoices/types";
import { type } from "@/lib/ui/type";

export function ComposerBottomBar({
  net,
  gross,
  currency,
  netLabel,
  grossLabel,
  error,
  children,
  testID = "composer-bottom-bar",
}: {
  /** Omitted when only a gross amount is known (a receipt's simple mode). */
  net?: number;
  gross: number;
  currency: InvoiceCurrency;
  netLabel: string;
  grossLabel: string;
  /** First blocking message, shown above the actions. */
  error?: string;
  /** The action buttons. */
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Box
      className="relative z-20 border-t border-line bg-surface px-4 pb-3 pt-3 tab:px-6"
      testID={testID}
    >
      <Box className="mx-auto w-full max-w-[1240px] gap-3">
        {error ? (
          <Text
            accessibilityRole="alert"
            className="text-[13px] font-semibold text-err"
            testID="composer-bottom-error"
          >
            {error}
          </Text>
        ) : null}
        <Box className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3 phone:flex-col phone:items-stretch">
          <HStack className="gap-6" testID="composer-bottom-totals">
            {net === undefined ? null : (
              <VStack>
                <Text className="text-[13px] text-muted-ink">{netLabel}</Text>
                <Text className={`${type.money} text-base font-bold text-ink`}>
                  {formatCurrency(net, currency)}
                </Text>
              </VStack>
            )}
            <VStack>
              <Text className="text-[13px] text-muted-ink">{grossLabel}</Text>
              <Text className={`${type.money} text-base font-bold text-ink`} testID="composer-bottom-gross">
                {formatCurrency(gross, currency)}
              </Text>
            </VStack>
          </HStack>
          <HStack className="items-center gap-3 phone:w-full">{children}</HStack>
        </Box>
      </Box>
    </Box>
  );
}
