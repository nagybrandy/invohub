// components/lists/StatusTabs.tsx
// Underline status tabs above the invoice table (tokens.md §6.9): 22px apart,
// a 1px line-strong rule under all of them, the selected tab primary-ink / 600
// with a 2px primary underline, counts in faint (selected: primary, overdue:
// err). Tabs are a radiogroup of single choices (the API filters by one status).
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export type StatusTab<K extends string = string> = {
  key: K;
  label: string;
  count?: number;
  /** Colour the count in the error colour (Lejárt). */
  critical?: boolean;
  /** Informational tabs (Egyéb) are shown but cannot be selected. */
  disabled?: boolean;
};

export function StatusTabs<K extends string>({
  tabs,
  value,
  onChange,
  accessibilityLabel,
  testIDPrefix = "status-tab-",
}: {
  tabs: StatusTab<K>[];
  value: K | null;
  onChange: (key: K) => void;
  accessibilityLabel: string;
  testIDPrefix?: string;
}) {
  return (
    <Box
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID="status-tabs"
      className="flex-row flex-wrap gap-x-[22px] border-b border-line-strong"
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;
        const countClass = selected ? "text-primary" : tab.critical ? "text-err font-semibold" : "text-faint";
        const content = (
          <Box className={`-mb-px flex-row items-center border-b-2 px-0.5 py-2.5 ${selected ? "border-primary" : "border-transparent"}`}>
            <Text className={`text-sm ${selected ? "font-semibold text-primary-ink" : "text-muted-ink"}`}>
              {tab.label}
            </Text>
            {typeof tab.count === "number" ? (
              <Text numeric className={`ml-1.5 text-sm ${countClass}`}>
                {tab.count}
              </Text>
            ) : null}
          </Box>
        );
        return tab.disabled ? (
          <Box key={tab.key} testID={`${testIDPrefix}${tab.key}`} accessibilityLabel={tab.label}>
            {content}
          </Box>
        ) : (
          <Pressable
            key={tab.key}
            testID={`${testIDPrefix}${tab.key}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            className="web:cursor-pointer"
          >
            {content}
          </Pressable>
        );
      })}
    </Box>
  );
}
