// components/lists/InvoiceFilterSheet.tsx
// "Szűrés és rendezés" (SPEC §6.9): status chips with counts, Időszak select,
// Rendezés select + Csökkenő / Növekvő, CSV letöltés, and a footer with
// "Törlés" (reset) and the primary "Találatok megtekintése (n)". Changes apply
// to the list live; the primary button only closes the sheet. Bottom sheet on
// phones, a centred dialog on wider screens (the foundation Sheet decides).
import { Download } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { InvoiceFilterChips } from "@/components/invoices/InvoiceFilterChips";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { PeriodOption } from "@/lib/lists/filter-state";
import type { InvoiceListSort, InvoiceSortKey } from "@/lib/lists/invoice-sort";
import type { InvoiceStatus } from "@/lib/invoices/types";

export type InvoiceFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  filter: InvoiceStatus | "all";
  onSelectFilter: (filter: InvoiceStatus | "all") => void;
  counts: Partial<Record<InvoiceStatus, number>>;
  allCount: number;
  otherCount: number;
  navFailedCount: number;
  navFailedSelected: boolean;
  onSelectNavFailed: () => void;
  periodOptions: PeriodOption[];
  month: string | undefined;
  onMonthChange: (month: string | undefined) => void;
  sort: InvoiceListSort;
  onSortChange: (sort: InvoiceListSort) => void;
  onExportCsv: () => void;
  exporting: boolean;
  onReset: () => void;
  /** The number of invoices the current filters match. */
  resultCount: number;
};

const SORT_KEYS: InvoiceSortKey[] = ["issued", "due", "gross"];

export function InvoiceFilterSheet(props: InvoiceFilterSheetProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { sort } = props;

  const sortLabel = (key: InvoiceSortKey) =>
    key === "issued"
      ? t("invoices.list.columnIssued")
      : key === "due"
        ? t("invoices.list.columnDue")
        : t("invoices.list.columnGross");

  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title={t("lists.filter.title")}
      testID="invoice-filter-sheet"
      footer={
        <Box className="flex-row items-center justify-between gap-3">
          <Button variant="tertiary" testID="invoice-filter-reset" onPress={props.onReset}>
            <ButtonText>{t("lists.reset")}</ButtonText>
          </Button>
          <Button size="form" className="flex-1" testID="invoice-filter-apply" onPress={props.onClose}>
            <ButtonText>{t("lists.filter.showResults", { count: props.resultCount })}</ButtonText>
          </Button>
        </Box>
      }
    >
      <Box className="gap-[18px] pb-2 pt-1">
        <Box className="gap-2">
          <Text className="text-sm font-semibold text-ink">{t("invoices.list.columnStatus")}</Text>
          <InvoiceFilterChips
            filter={props.filter}
            onSelect={props.onSelectFilter}
            counts={props.counts}
            allCount={props.allCount}
            otherCount={props.otherCount}
            navFailedCount={props.navFailedCount}
            navFailedSelected={props.navFailedSelected}
            onSelectNavFailed={props.onSelectNavFailed}
            t={t}
          />
        </Box>
        <Box className="gap-2">
          <Text className="text-sm font-semibold text-ink">{t("lists.filter.period")}</Text>
          <Select
            value={props.month ?? ""}
            onChange={(value) => props.onMonthChange(value === "" ? undefined : value)}
            options={props.periodOptions}
            accessibilityLabel={t("lists.filter.period")}
            testID="invoice-filter-period"
          />
        </Box>
        <Box className="gap-2">
          <Text className="text-sm font-semibold text-ink">{t("lists.filter.sort")}</Text>
          <Select
            value={sort.key}
            onChange={(key) => props.onSortChange({ key: key as InvoiceSortKey, direction: sort.direction })}
            options={SORT_KEYS.map((key) => ({ value: key, label: sortLabel(key) }))}
            accessibilityLabel={t("lists.filter.sort")}
            testID="invoice-filter-sort"
          />
          <SegmentedControl
            size="sm"
            fullWidth
            value={sort.direction}
            onChange={(direction) => props.onSortChange({ key: sort.key, direction })}
            accessibilityLabel={t("lists.filter.direction")}
            options={[
              { value: "desc", label: `↓ ${t("lists.filter.descending")}`, testID: "invoice-filter-desc" },
              { value: "asc", label: `↑ ${t("lists.filter.ascending")}`, testID: "invoice-filter-asc" },
            ]}
          />
        </Box>
        <Button
          variant="tertiary"
          className="self-start"
          testID="invoice-filter-export"
          disabled={props.exporting}
          onPress={props.onExportCsv}
        >
          {props.exporting ? <ButtonSpinner /> : <Download size={18} color={icons.primary} />}
          <ButtonText>{t("invoices.list.exportCsv")}</ButtonText>
        </Button>
      </Box>
    </Sheet>
  );
}
