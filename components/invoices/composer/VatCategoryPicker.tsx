// components/invoices/composer/VatCategoryPicker.tsx
// INV-7: 2 common VAT categories up front, the other 5 behind a "Speciális
// adózás" expander instead of 7 chips fighting for space in every row.
//
// Every choice here — common categories, VAT-rate pills, and the advanced
// categories — is a compliance-relevant tap (AAM vs. 27% on the wrong
// line), so each renders through ChoicePill instead of an ad-hoc Pressable
// to guarantee the 44px tap-target floor (tap-targets-44px slice).
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ChoicePill, ChoicePillGroup } from "@/components/ui/choice-pill";
import { ADVANCED_VAT_CATEGORIES, COMMON_VAT_CATEGORIES, VAT_RATES } from "@/lib/invoices/vat";
import type { VatCategory, VatRate } from "@/lib/invoices/types";
import { useIconColors } from "@/lib/theme/icon-colors";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

export function VatCategoryPicker({
  category,
  rate,
  onChangeCategory,
  onChangeRate,
  t,
}: {
  category: VatCategory;
  rate: VatRate;
  onChangeCategory: (category: VatCategory) => void;
  onChangeRate: (rate: VatRate) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const icons = useIconColors();
  const [expanded, setExpanded] = React.useState(ADVANCED_VAT_CATEGORIES.includes(category));

  return (
    <VStack space="xs">
      <ChoicePillGroup>
        {COMMON_VAT_CATEGORIES.map((option) => (
          <ChoicePill key={option} selected={category === option} onPress={() => onChangeCategory(option)}>
            <Text size="xs" className={category === option ? "font-medium text-primary" : "text-foreground"}>
              {t(`invoices.vat.category.${option}`)}
            </Text>
          </ChoicePill>
        ))}
      </ChoicePillGroup>

      {category === "normal" ? (
        <ChoicePillGroup>
          {VAT_RATES.map((r) => (
            <ChoicePill
              key={r}
              selected={rate === r}
              onPress={() => onChangeRate(r)}
              accessibilityLabel={t("invoices.vat.rateA11y", { rate: r })}
            >
              <Text size="2xs" className={rate === r ? "font-medium text-primary" : "text-muted-foreground"}>
                {r}%
              </Text>
            </ChoicePill>
          ))}
        </ChoicePillGroup>
      ) : null}

      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className={`flex-row items-center gap-1 ${TAP_TARGET_MIN_H}`}
      >
        <Text size="xs" className="text-muted-foreground underline">
          {t("invoices.vat.advancedToggle")}
        </Text>
        {expanded ? (
          <ChevronUp size={12} color={icons.muted} />
        ) : (
          <ChevronDown size={12} color={icons.muted} />
        )}
      </Pressable>

      {expanded ? (
        <VStack space="xs" className="rounded-md border border-border bg-muted/30 p-2">
          {ADVANCED_VAT_CATEGORIES.map((option) => (
            <ChoicePill key={option} selected={category === option} onPress={() => onChangeCategory(option)}>
              <Text size="xs" className={category === option ? "font-medium text-primary" : "text-foreground"}>
                {t(`invoices.vat.category.${option}`)}
              </Text>
            </ChoicePill>
          ))}
        </VStack>
      ) : null}
    </VStack>
  );
}
