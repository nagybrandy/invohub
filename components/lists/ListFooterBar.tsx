// components/lists/ListFooterBar.tsx
// The strip at the bottom of a list card (tokens.md §6.6): "22 számla" on the
// left in muted, "Bruttó összesen: 4 785 360 Ft + 2159,00 €" on the right with
// the amounts in ink. Per-currency sums are joined with " + " and never added
// across currencies.
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

export function ListFooterBar({
  countLabel,
  totalsLabel,
  totals,
  testID = "list-footer-bar",
}: {
  countLabel: string;
  /** "Bruttó összesen:" */
  totalsLabel?: string;
  /** "4 785 360 Ft + 2159,00 €" */
  totals?: string;
  testID?: string;
}) {
  return (
    <Box testID={testID} className="flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <Text testID={`${testID}-count`} className="text-sm text-muted-ink">
        {countLabel}
      </Text>
      {totals ? (
        <Text testID={`${testID}-totals`} numeric className="text-sm text-muted-ink">
          {totalsLabel ? `${totalsLabel} ` : ""}
          <Text numeric className="text-sm font-semibold text-ink">
            {totals}
          </Text>
        </Text>
      ) : null}
    </Box>
  );
}
