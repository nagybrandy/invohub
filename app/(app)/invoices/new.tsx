// app/(app)/invoices/new.tsx
// Thin route wrapper — all state, layout and validation live in
// <InvoiceComposer> (docs/design/app-ux-spec-2026-09-14.md §2), shared with
// app/(app)/invoices/[id]/edit.tsx so the two screens can never drift apart.
import { InvoiceComposer } from "@/components/invoices/composer/InvoiceComposer";
import { useRouteParam } from "@/lib/routing/route-param";

export default function NewInvoiceScreen() {
  // From /invoices/new?clientId=… — the "Invoice this partner" shortcut
  // (spec §3.4, the partner list's row menu).
  const initialClientId = useRouteParam("clientId");

  return <InvoiceComposer mode="create" initialClientId={initialClientId ?? null} />;
}
