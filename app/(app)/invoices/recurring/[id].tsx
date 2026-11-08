// app/(app)/invoices/recurring/[id].tsx
// Edit a recurring template's name, schedule and payment term.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StateView } from "@/components/layout/StateView";
import { FormScreen } from "@/components/layout/FormScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecurringScheduleForm } from "@/components/recurring/RecurringScheduleForm";
import { useRecurringInvoices } from "@/hooks/useRecurringInvoices";
import { getBreadcrumb } from "@/lib/app-navigation";
import { errorKeyForCode } from "@/lib/recurring/form";
import { routes } from "@/lib/navigation";
import { formValuesFromTemplate, type RecurringFormValues } from "@/lib/recurring/form";
import { useRouteParam } from "@/lib/routing/route-param";

export default function EditRecurringInvoiceScreen() {
  const id = useRouteParam("id");
  const { t } = useTranslation();
  const { getById, update } = useRecurringInvoices();
  const [initialValues, setInitialValues] = React.useState<RecurringFormValues | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    getById(id)
      .then((template) => setInitialValues(formValuesFromTemplate(template)))
      .catch((e) => setLoadError(e instanceof Error && e.message ? e.message : t("recurring.form.loadFailed")));
  }, [id, getById, t]);

  return (
    <FormScreen
      header={
        <PageHeader
          title={t("recurring.form.editTitle")}
          breadcrumb={id ? getBreadcrumb(`/invoices/recurring/${id}`, t) : undefined}
        />
      }
    >
      {loadError ? (
        <StateView kind="error" title={t("states.errorTitle")} description={loadError} />
      ) : !initialValues ? (
        <StateView kind="loading" />
      ) : (
        <RecurringScheduleForm
          mode="edit"
          initialValues={initialValues}
          submitting={submitting}
          error={error}
          onCancel={() => router.back()}
          onSubmit={async (parsed) => {
            if (!id) return;
            setSubmitting(true);
            setError(null);
            try {
              await update(id, {
                name: parsed.name || null,
                schedule: parsed.schedule,
                paymentTermDays: parsed.paymentTermDays,
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
