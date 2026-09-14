// components/invoices/composer/VatCategoryPicker.tsx
// INV-7: 2 common VAT categories up front, the other 5 behind a "Speciális
// adózás" expander instead of 7 chips fighting for space in every row.
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ADVANCED_VAT_CATEGORIES, COMMON_VAT_CATEGORIES, VAT_RATES } from "@/lib/invoices/vat";
import type { VatCategory, VatRate } from "@/lib/invoices/types";
import { useIconColors } from "@/lib/theme/icon-colors";

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
      <HStack space="xs" className="flex-wrap">
        {COMMON_VAT_CATEGORIES.map((option) => (
          <Pressable
            key={option}
            onPress={() => onChangeCategory(option)}
            className={`rounded-md border px-2.5 py-1.5 ${
              category === option ? "border-primary bg-primary/10" : "border-border bg-background"
            }`}
          >
            <Text size="xs" className={category === option ? "font-medium text-primary" : "text-foreground"}>
              {t(`invoices.vat.category.${option}`)}
            </Text>
          </Pressable>
        ))}
      </HStack>

      {category === "normal" ? (
        <HStack space="xs" className="flex-wrap">
          {VAT_RATES.map((r) => (
            <Pressable
              key={r}
              onPress={() => onChangeRate(r)}
              className={`rounded-md border px-2 py-1 ${
                rate === r ? "border-primary bg-primary/10" : "border-border bg-background"
              }`}
            >
              <Text size="2xs" className={rate === r ? "font-medium text-primary" : "text-muted-foreground"}>
                {r}%
              </Text>
            </Pressable>
          ))}
        </HStack>
      ) : null}

      <Pressable onPress={() => setExpanded((v) => !v)} className="flex-row items-center gap-1">
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
            <Pressable
              key={option}
              onPress={() => onChangeCategory(option)}
              className={`rounded-md border px-2.5 py-1.5 ${
                category === option ? "border-primary bg-primary/10" : "border-border bg-background"
              }`}
            >
              <Text size="xs" className={category === option ? "font-medium text-primary" : "text-foreground"}>
                {t(`invoices.vat.category.${option}`)}
              </Text>
            </Pressable>
          ))}
        </VStack>
      ) : null}
    </VStack>
  );
}
