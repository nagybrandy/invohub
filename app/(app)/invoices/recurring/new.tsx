// app/(app)/invoices/recurring/new.tsx
// "Mentés ismétlődőként": saves the invoice in ?invoiceId (issued or draft) as
// a recurring template. v1 only ever generates DRAFTS from it; automatic
// issuing needs owner sign-off (see lib/recurring/service.ts).
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { FormScreen } from "@/components/layout/FormScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecurringScheduleForm } from "@/components/recurring/RecurringScheduleForm";
import { useRecurringInvoices } from "@/hooks/useRecurringInvoices";
import { budapestDateKey } from "@/lib/dates/budapest";
import { getBreadcrumb } from "@/lib/app-navigation";
import { errorKeyForCode } from "@/lib/recurring/form";
import { routes } from "@/lib/navigation";
import { defaultFormValues } from "@/lib/recurring/form";
import { useRouteParam } from "@/lib/routing/route-param";

export default function NewRecurringInvoiceScreen() {
  const { t } = useTranslation();
  const invoiceId = useRouteParam("invoiceId");
  const { create } = useRecurringInvoices();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const initialValues = React.useMemo(() => defaultFormValues(budapestDateKey(new Date())), []);

  return (
    <FormScreen
      header={
        <PageHeader
          title={t("recurring.form.createTitle")}
          breadcrumb={getBreadcrumb("/invoices/recurring/new", t)}
        />
      }
    >
      {!invoiceId ? (
        <Text testID="recurring-missing-invoice" className="text-sm text-muted-ink">
          {t("recurring.form.missingInvoice")}
        </Text>
      ) : (
        <RecurringScheduleForm
          mode="create"
          initialValues={initialValues}
          submitting={submitting}
          error={error}
          onCancel={() => router.back()}
          onSubmit={async (parsed) => {
            setSubmitting(true);
            setError(null);
            try {
              await create({
                sourceInvoiceId: invoiceId,
                name: parsed.name || undefined,
                ...parsed.schedule,
              });
              router.replace(routes.recurringInvoices);
            } catch (e) {
              const key = errorKeyForCode((e as { code?: string }).code);
              setError(key ? t(key) : t("recurring.form.saveFailed"));
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
    </FormScreen>
  );
}
