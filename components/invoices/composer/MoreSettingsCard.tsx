// components/invoices/composer/MoreSettingsCard.tsx
// "További beállítások" (SPEC §8.7): a collapsible card, closed by default,
// holding only what the composer already has — the document's language and the
// notes. Megrendelésszám, Kedvezmény % and Ismétlődő számla are NOT here: the
// schema has no such fields.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Select } from "@/components/ui/select";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { FormField } from "@/components/layout/FormField";
import { CollapsibleCard } from "@/components/invoices/composer/ComposerSection";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";
import type { DocumentLanguage } from "@/lib/companies/billing-settings";

const LANGUAGES: DocumentLanguage[] = ["hu", "en"];

export function MoreSettingsCard(composer: InvoiceComposerState) {
  const { t, language, setLanguage, notes, setNotes } = composer;
  const [open, setOpen] = React.useState(false);

  return (
    <CollapsibleCard
      title={t("invoices.sections.additionalSettings")}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      testID="composer-more-settings"
    >
      <Box className="gap-4">
        <FormField label={t("invoices.fields.documentLanguage")} className="max-w-[320px]">
          <Select
            value={language}
            onChange={(value) => setLanguage(value as DocumentLanguage)}
            options={LANGUAGES.map((value) => ({ value, label: t(`billing.languages.${value}`) }))}
            accessibilityLabel={t("invoices.fields.documentLanguage")}
            testID="composer-language"
          />
        </FormField>
        <FormField label={t("invoices.fields.notes")}>
          <Textarea>
            <TextareaInput
              placeholder={t("invoices.placeholders.notes")}
              value={notes}
              onChangeText={setNotes}
              accessibilityLabel={t("invoices.fields.notes")}
              testID="composer-notes"
            />
          </Textarea>
        </FormField>
      </Box>
    </CollapsibleCard>
  );
}
