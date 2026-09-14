// app/(app)/invoices/[id]/edit.tsx
// Edit an existing invoice using the SAME composer as creation (E1,
// docs/design/app-ux-spec-2026-09-14.md §2.7) — the two screens can never
// offer different fields again. A finalized (non-draft) invoice still gets
// the existing read-only branch, unchanged (spec: "ez már ma helyesen
// működik, ne rontsuk el").
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { Box } from "@/components/ui/box";
import { InvoiceComposer } from "@/components/invoices/composer/InvoiceComposer";
import { apiFetch } from "@/lib/api/client";
import type { Invoice } from "@/lib/invoices/types";
import { useRouteParam } from "@/lib/routing/route-param";

export default function EditInvoiceScreen() {
  const id = useRouteParam("id");
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    void apiFetch<{ invoice: Invoice }>(`/api/invoices/${id}`)
      .then((data) => setInvoice(data.invoice))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !invoice) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </Box>
    );
  }

  return <InvoiceComposer mode="edit" invoice={invoice} />;
}
