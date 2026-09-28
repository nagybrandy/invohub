// components/invoices/InvoiceMonthStepper.tsx
// "‹ 2026. szeptember ›" with an "all months" escape. Unset means all time,
// so an old unpaid invoice never disappears just because the month moved on.
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { currentMonth, formatMonthLabel, shiftMonth } from "@/lib/invoices/list-query";
import { useIconColors } from "@/lib/theme/icon-colors";
import { TAP_TARGET_ICON_BOX, TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

export function InvoiceMonthStepper({
  month,
  onChange,
}: {
  month: string | undefined;
  onChange: (month: string | undefined) => void;
}) {
  const { t, i18n } = useTranslation();
  const icons = useIconColors();
  const today = currentMonth();
  const atCurrent = month === today;

  return (
    <HStack space="xs" className="items-center" testID="invoice-month-stepper">
      {month ? (
        <>
          <Pressable
            onPress={() => onChange(shiftMonth(month, -1))}
            accessibilityRole="button"
            accessibilityLabel={t("invoices.list.monthPrev")}
            className={`rounded-lg ${TAP_TARGET_ICON_BOX}`}
            testID="invoice-month-prev"
          >
            <ChevronLeft size={18} color={icons.foreground} />
          </Pressable>
          <Text className="min-w-[150px] text-center font-medium text-foreground" testID="invoice-month-label">
            {formatMonthLabel(month, i18n.language)}
          </Text>
          <Pressable
            onPress={() => onChange(shiftMonth(month, 1))}
            disabled={atCurrent}
            accessibilityRole="button"
            accessibilityLabel={t("invoices.list.monthNext")}
            accessibilityState={{ disabled: atCurrent }}
            className={`rounded-lg ${TAP_TARGET_ICON_BOX} ${atCurrent ? "opacity-30" : ""}`}
            testID="invoice-month-next"
          >
            <ChevronRight size={18} color={icons.foreground} />
          </Pressable>
          <Pressable
            onPress={() => onChange(undefined)}
            accessibilityRole="button"
            className={`justify-center rounded-full border border-border px-3 ${TAP_TARGET_MIN_H}`}
            testID="invoice-month-all"
          >
            <Text size="sm" className="text-foreground">{t("invoices.list.monthAll")}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={() => onChange(today)}
          accessibilityRole="button"
          className={`justify-center rounded-full border border-border px-3 ${TAP_TARGET_MIN_H}`}
          testID="invoice-month-current"
        >
          <Text size="sm" className="text-foreground">{t("invoices.list.monthCurrent")}</Text>
        </Pressable>
      )}
    </HStack>
  );
}
