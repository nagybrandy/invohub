// components/invoices/composer/CopyFromInvoice.tsx
// "Vagy Másolás korábbi számlából" under the partner field (SPEC §8.3): a link
// that opens a small popover with the user's most recent invoices. Picking one
// calls the existing POST /api/invoices/[id]/duplicate (which only ever
// creates a DRAFT copy) and replaces this page with the new draft's edit page.
import * as React from "react";
import { router } from "expo-router";
import { AnchoredPopover, MENU_PANEL_CLASS } from "@/components/layout/AnchoredPopover";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { apiFetch } from "@/lib/api/client";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { formatDateOnly } from "@/lib/dates/format";
import type { Invoice } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";

export function CopyFromInvoice({
  invoices,
  t,
}: {
  /** The recent invoices to offer (already limited; see recentInvoicesForCopy). */
  invoices: Invoice[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function copy(invoice: Invoice) {
    if (busyId) return;
    setBusyId(invoice.id);
    setError(null);
    try {
      const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/duplicate`, {
        method: "POST",
      });
      setOpen(false);
      router.replace(routes.invoiceEdit(data.invoice.id));
    } catch {
      setError(t("composer.copyFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Box className="mt-2 flex-row flex-wrap items-center gap-x-1.5" testID="composer-copy-from">
      <Text className="text-sm text-muted-ink">{t("composer.copyOr")}</Text>
      <AnchoredPopover
        open={open}
        onClose={() => setOpen(false)}
        align="left"
        width={360}
        panelClassName={MENU_PANEL_CLASS}
        testID="composer-copy-popover"
        anchor={
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            aria-expanded={open}
            testID="composer-copy-trigger"
            className="min-h-10 justify-center"
          >
            <Text className="text-sm font-semibold text-primary">{t("composer.copyFromInvoice")}</Text>
          </Pressable>
        }
      >
        <Text className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-ink">{t("composer.copyPopoverTitle")}</Text>
        {invoices.length === 0 ? (
          <Text className="px-3 py-3 text-sm text-muted-ink" testID="composer-copy-empty">
            {t("composer.copyEmpty")}
          </Text>
        ) : (
          invoices.map((invoice) => (
            <Pressable
              key={invoice.id}
              onPress={() => void copy(invoice)}
              disabled={busyId !== null}
              accessibilityRole="button"
              testID={`composer-copy-option-${invoice.id}`}
              className="min-h-11 flex-row items-center gap-3 rounded-control px-3 py-2 data-[hover=true]:bg-neutral-wash"
            >
              <Box className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-ink">
                  {invoice.invoiceNumber || t("composer.copyDraftNumber")}
                </Text>
                <Text numberOfLines={1} className="text-[13px] text-muted-ink">
                  {invoice.clientName}
                </Text>
              </Box>
              <Box className="shrink-0 items-end">
                <Text className="text-sm font-semibold tabular-nums text-ink">
                  {busyId === invoice.id
                    ? t("composer.copying")
                    : formatCurrency(calculateInvoiceTotals(invoice.lineItems).totalAmount, invoice.currency)}
                </Text>
                <Text className="text-xs text-muted-ink">{formatDateOnly(invoice.issueDate)}</Text>
              </Box>
            </Pressable>
          ))
        )}
        {error ? (
          <Text accessibilityRole="alert" className="px-3 py-2 text-[13px] font-semibold text-err" testID="composer-copy-error">
            {error}
          </Text>
        ) : null}
      </AnchoredPopover>
    </Box>
  );
}
