// components/settings/CurrencyPicker.tsx
// Currency choice for a document or a default: HUF / EUR / USD / GBP as chips,
// every other currency the MNB publishes a rate for behind "Más deviza".
import * as React from "react";
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useSupportedCurrencies } from "@/hooks/useSupportedCurrencies";
import { PRIMARY_CURRENCIES } from "@/lib/currency/currencies";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

const chipClass = (selected: boolean) =>
  `mb-2 items-center justify-center rounded-lg border px-4 py-2 ${TAP_TARGET_MIN_H} ${
    selected ? "border-primary bg-primary/10" : "border-border bg-card"
  }`;

export function CurrencyPicker({
  value,
  onChange,
  clearable = false,
  testIDPrefix = "currency",
}: {
  value: string | undefined | null;
  onChange: (value: string | undefined) => void;
  clearable?: boolean;
  testIDPrefix?: string;
}) {
  const { t } = useTranslation();
  const all = useSupportedCurrencies();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const primaries = PRIMARY_CURRENCIES as readonly string[];
  const others = all.filter((c) => !primaries.includes(c));
  const selectedIsOther = Boolean(value) && !primaries.includes(value as string);

  const pick = (code: string) => onChange(code === value && clearable ? undefined : code);

  return (
    <VStack space="xs">
      <HStack space="sm" className="flex-wrap">
        {[...primaries, ...(selectedIsOther ? [value as string] : [])].map((code) => (
          <Pressable
            key={code}
            onPress={() => pick(code)}
            accessibilityRole="button"
            accessibilityState={{ selected: code === value }}
            testID={`${testIDPrefix}-${code}`}
            className={chipClass(code === value)}
          >
            <Text size="sm" className={code === value ? "font-semibold text-primary" : "text-foreground"}>
              {code}
            </Text>
          </Pressable>
        ))}
        {others.length > 0 ? (
          <Pressable
            onPress={() => setMoreOpen((v) => !v)}
            accessibilityRole="button"
            testID={`${testIDPrefix}-more`}
            className={chipClass(false)}
          >
            <Text size="sm" className="text-foreground">
              {t("currency.other")}
            </Text>
          </Pressable>
        ) : null}
      </HStack>
      {moreOpen ? (
        <HStack space="xs" className="flex-wrap rounded-lg border border-border bg-card p-2" testID={`${testIDPrefix}-others`}>
          {others.map((code) => (
            <Pressable
              key={code}
              onPress={() => {
                pick(code);
                setMoreOpen(false);
              }}
              accessibilityRole="button"
              testID={`${testIDPrefix}-${code}`}
              className="mb-1 rounded-md border border-border px-3 py-1.5"
            >
              <Text size="sm" className={code === value ? "font-semibold text-primary" : "text-foreground"}>
                {code}
              </Text>
            </Pressable>
          ))}
        </HStack>
      ) : null}
      <Text size="xs" className="text-muted-foreground">
        {t("currency.hint")}
      </Text>
    </VStack>
  );
}
